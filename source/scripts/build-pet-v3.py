#!/usr/bin/env python3
"""Build the five-character smooth desktop-pet v3 sprite strips."""

from __future__ import annotations

import argparse
import shutil
from pathlib import Path

import cv2
import numpy as np
from PIL import Image


FRAME_SIZE = 160
FRAME_COUNT = 24
SAFETY_BORDER = 8
ROLES = ("alisa", "miyuki", "natsumi", "mashiro", "hyakka")
GROUPS = ("ambient", "move", "mishap", "drag", "interact")
ALISA_V2_NAMES = {
    "ambient": "alisa-ambient-v2.png",
    "move": "alisa-move-v2.png",
    "mishap": "alisa-mishap-v2.png",
    "drag": "alisa-drag-v2.png",
}


def keep_main_component(rgba: np.ndarray) -> np.ndarray:
    """Remove detached marks and cross-cell residue while preserving AA fringe."""
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


def split_and_clean(sheet: Image.Image, role: str, group: str) -> list[Image.Image]:
    """Extract six character components from each of four strict visual rows."""
    sheet_rgba = np.asarray(sheet.convert("RGBA")).copy()
    alpha = sheet_rgba[:, :, 3]
    count, labels, stats, centers = cv2.connectedComponentsWithStats(
        (alpha >= 16).astype(np.uint8), 8
    )
    characters = [
        index
        for index in range(1, count)
        if stats[index, cv2.CC_STAT_AREA] >= 3000
    ]
    rows: list[list[int]] = [[], [], [], []]
    for index in characters:
        row = min(3, max(0, int(centers[index][1] * 4 / sheet.height)))
        rows[row].append(index)
    for row in rows:
        row.sort(key=lambda index: centers[index][0])
        if len(row) != 6:
            raise ValueError(
                f"{role}/{group}: expected exactly 6 generated figures per row, got {len(row)}"
            )

    frames: list[Image.Image] = []
    for row in rows:
        for component in row:
            x, y, width, height = [int(value) for value in stats[component, :4]]
            pad = 5
            left = max(0, x - pad)
            top = max(0, y - pad)
            right = min(sheet.width, x + width + pad)
            bottom = min(sheet.height, y + height + pad)
            rgba = sheet_rgba[top:bottom, left:right].copy()
            local_labels = labels[top:bottom, left:right]
            main = (local_labels == component).astype(np.uint8)
            keep = cv2.dilate(main, np.ones((7, 7), np.uint8), iterations=1).astype(bool)
            rgba[~keep] = 0

            available = FRAME_SIZE - SAFETY_BORDER * 2
            scale = min(available / rgba.shape[1], available / rgba.shape[0])
            target_size = (
                max(1, int(round(rgba.shape[1] * scale))),
                max(1, int(round(rgba.shape[0] * scale))),
            )
            resized = Image.fromarray(rgba, "RGBA").resize(target_size, Image.Resampling.LANCZOS)
            canvas = Image.new("RGBA", (FRAME_SIZE, FRAME_SIZE), (0, 0, 0, 0))
            target_x = (FRAME_SIZE - target_size[0]) // 2
            target_y = FRAME_SIZE - SAFETY_BORDER - target_size[1]
            canvas.alpha_composite(resized, (target_x, target_y))
            pixels = keep_main_component(np.asarray(canvas).copy())
            pixels[pixels[:, :, 3] < 8] = 0
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
    if np.count_nonzero(alpha) < 300:
        raise ValueError(f"{label}: unexpectedly empty")
    if np.count_nonzero((alpha > 0) & (alpha < 255)) < 40:
        raise ValueError(f"{label}: missing smooth antialiased edge")
    components, _, stats, _ = cv2.connectedComponentsWithStats(
        (alpha >= 8).astype(np.uint8), 8
    )
    significant = [
        stats[index, cv2.CC_STAT_AREA]
        for index in range(1, components)
        if stats[index, cv2.CC_STAT_AREA] >= 32
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
    parser.add_argument(
        "--alisa-v2-dir",
        type=Path,
        default=Path("public/frontends/hypnosis-app/assets/pet"),
    )
    args = parser.parse_args()

    for role in ROLES:
        role_output = args.output_dir / role
        role_output.mkdir(parents=True, exist_ok=True)
        for group in GROUPS:
            output = role_output / f"{role}-{group}-v3.png"
            if role == "alisa" and group in ALISA_V2_NAMES:
                source = args.alisa_v2_dir / ALISA_V2_NAMES[group]
                if not source.is_file():
                    raise FileNotFoundError(source)
                shutil.copyfile(source, output)
                print(f"reused {source} -> {output}")
                continue
            source = args.source_dir / role / f"{group}-alpha.png"
            if not source.is_file():
                raise FileNotFoundError(source)
            frames = split_and_clean(Image.open(source), role, group)
            if len(frames) != FRAME_COUNT:
                raise ValueError(f"{role}/{group}: expected {FRAME_COUNT} frames")
            for index, frame in enumerate(frames):
                verify_frame(frame, f"{role}/{group}#{index}")
            # Keep full RGBA: palette quantization can reconnect a few isolated
            # low-alpha pixels after component cleanup and recreate frame residue.
            pack_strip(frames).save(output, optimize=True)
            print(f"wrote {output} ({FRAME_COUNT}x{FRAME_SIZE}px)")


if __name__ == "__main__":
    main()
