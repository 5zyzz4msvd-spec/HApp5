#!/usr/bin/env python3
"""Build smooth 160px Alisa desktop-pet strips from 6x4 alpha contact sheets."""

from __future__ import annotations

import argparse
from pathlib import Path

import cv2
import numpy as np
from PIL import Image


SOURCE_CELL = 256
FRAME_SIZE = 160
GRID_COLUMNS = 6
GRID_ROWS = 4
FRAME_COUNT = GRID_COLUMNS * GRID_ROWS
SAFETY_BORDER = 8

SHEETS = {
    "ambient": "alisa-ambient-v2.png",
    "move": "alisa-move-v2.png",
    "mishap": "alisa-mishap-v2.png",
    "drag": "alisa-drag-v2.png",
}


def keep_main_component(rgba: np.ndarray) -> np.ndarray:
    """Remove detached motion marks and neighboring-frame residue, preserving AA fringe."""
    alpha = rgba[:, :, 3]
    mask = (alpha >= 16).astype(np.uint8)
    count, labels, stats, _ = cv2.connectedComponentsWithStats(mask, 8)
    if count <= 1:
        raise ValueError("empty sprite frame")
    largest = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
    main = (labels == largest).astype(np.uint8)
    keep = cv2.dilate(main, np.ones((7, 7), np.uint8), iterations=1).astype(bool)
    cleaned = rgba.copy()
    cleaned[~keep] = 0
    return cleaned


def split_and_clean(sheet: Image.Image) -> list[Image.Image]:
    if sheet.size != (SOURCE_CELL * GRID_COLUMNS, SOURCE_CELL * GRID_ROWS):
        raise ValueError(f"expected 1536x1024 contact sheet, got {sheet.size}")

    frames: list[Image.Image] = []
    for row in range(GRID_ROWS):
        for column in range(GRID_COLUMNS):
            box = (
                column * SOURCE_CELL,
                row * SOURCE_CELL,
                (column + 1) * SOURCE_CELL,
                (row + 1) * SOURCE_CELL,
            )
            rgba = np.asarray(sheet.crop(box).convert("RGBA")).copy()
            rgba = keep_main_component(rgba)
            frame = Image.fromarray(rgba, "RGBA").resize(
                (FRAME_SIZE, FRAME_SIZE), Image.Resampling.LANCZOS
            )
            pixels = keep_main_component(np.asarray(frame).copy())
            alpha = pixels[:, :, 3]
            ys, xs = np.nonzero(alpha >= 8)
            shift_x = int(round((FRAME_SIZE - 1) / 2 - (xs.min() + xs.max()) / 2))
            if shift_x:
                centered = np.zeros_like(pixels)
                source_start = max(0, -shift_x)
                source_end = min(FRAME_SIZE, FRAME_SIZE - shift_x)
                target_start = source_start + shift_x
                target_end = source_end + shift_x
                centered[:, target_start:target_end] = pixels[:, source_start:source_end]
                pixels = centered
            pixels[:SAFETY_BORDER] = 0
            pixels[-SAFETY_BORDER:] = 0
            pixels[:, :SAFETY_BORDER] = 0
            pixels[:, -SAFETY_BORDER:] = 0
            pixels[pixels[:, :, 3] == 0, :3] = 0
            frames.append(Image.fromarray(pixels, "RGBA"))
    return frames


def verify_frame(frame: Image.Image, label: str) -> None:
    rgba = np.asarray(frame.convert("RGBA"))
    alpha = rgba[:, :, 3]
    guard = np.zeros_like(alpha, dtype=bool)
    guard[:SAFETY_BORDER] = guard[-SAFETY_BORDER:] = True
    guard[:, :SAFETY_BORDER] = guard[:, -SAFETY_BORDER:] = True
    if np.any(alpha[guard]):
        raise ValueError(f"{label}: occupied {SAFETY_BORDER}px safety border")
    if np.any(rgba[:, :, :3][alpha == 0]):
        raise ValueError(f"{label}: hidden RGB residue")
    if np.count_nonzero(alpha) < 400:
        raise ValueError(f"{label}: unexpectedly empty")
    if np.count_nonzero((alpha > 0) & (alpha < 255)) < 40:
        raise ValueError(f"{label}: missing smooth antialiased edge")
    components, _, stats, _ = cv2.connectedComponentsWithStats(
        (alpha >= 8).astype(np.uint8), 8
    )
    significant = [
        stats[index, cv2.CC_STAT_AREA]
        for index in range(1, components)
        if stats[index, cv2.CC_STAT_AREA] >= 8
    ]
    if len(significant) != 1:
        raise ValueError(f"{label}: detached components remain: {significant}")


def pack_strip(frames: list[Image.Image]) -> Image.Image:
    strip = Image.new("RGBA", (FRAME_SIZE * len(frames), FRAME_SIZE), (0, 0, 0, 0))
    for index, frame in enumerate(frames):
        strip.alpha_composite(frame, (index * FRAME_SIZE, 0))
    return strip


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-dir", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    args = parser.parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)

    for stem, output_name in SHEETS.items():
        source = args.source_dir / f"{stem}-alpha.png"
        frames = split_and_clean(Image.open(source))
        if len(frames) != FRAME_COUNT:
            raise ValueError(f"{stem}: expected {FRAME_COUNT} frames")
        for index, frame in enumerate(frames):
            verify_frame(frame, f"{stem}#{index}")
        output = args.output_dir / output_name
        indexed = pack_strip(frames).quantize(
            colors=256,
            method=Image.Quantize.FASTOCTREE,
            dither=Image.Dither.NONE,
        )
        indexed.save(output, optimize=True)
        print(f"wrote {output} ({FRAME_COUNT}x{FRAME_SIZE}px)")


if __name__ == "__main__":
    main()
