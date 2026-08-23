#!/usr/bin/env python3
"""Build skin-safe, single-row desktop-pet v4 sprite strips.

Each input is one chroma-keyed horizontal row containing exactly six poses.
The builder deliberately avoids connected-component filtering: detached hands,
hair tips, ribbons, tears, and skin-colored details all remain part of a frame.
"""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
from PIL import Image


FRAME_SIZE = 160
FRAME_COUNT = 8
SOURCE_FRAME_COUNT = 6
SAFETY_BORDER = 8
ACTIONS = ("idle", "unique-a", "unique-b", "drag", "enter", "exit")
SOURCE_INDEX = {
    "idle": (0, 1, 2, 2, 2, 3, 4, 0),
    "unique-a": (0, 1, 2, 2, 2, 4, 5, 0),
    "unique-b": (0, 1, 2, 2, 2, 4, 5, 0),
    "drag": (0, 1, 2, 2, 2, 3, 4, 0),
    "enter": (0, 1, 2, 3, 4, 5, 5, 5),
    "exit": (0, 1, 2, 3, 4, 5, 5, 5),
}


def find_boundaries(rgba: np.ndarray) -> list[int]:
    """Find the quietest vertical gutter near each expected slot boundary."""
    width = rgba.shape[1]
    projection = (rgba[:, :, 3] >= 8).sum(axis=0)
    search_half_width = round(width / (SOURCE_FRAME_COUNT * 3))
    boundaries = [0]
    for index in range(1, SOURCE_FRAME_COUNT):
        expected = round(index * width / SOURCE_FRAME_COUNT)
        left = max(boundaries[-1] + 10, expected - search_half_width)
        right = min(width, expected + search_half_width)
        window = projection[left:right]
        minimum = int(window.min())
        candidates = np.flatnonzero(window == minimum) + left
        boundary = int(candidates[np.argmin(np.abs(candidates - expected))])
        boundaries.append(boundary)
    boundaries.append(width)
    return boundaries


def split_cells(sheet: Image.Image, label: str) -> list[Image.Image]:
    """Split at real green gutters without discarding character components."""
    rgba = np.asarray(sheet.convert("RGBA")).copy()
    boundaries = find_boundaries(rgba)
    frames: list[Image.Image] = []

    for index in range(SOURCE_FRAME_COUNT):
        left = boundaries[index]
        right = boundaries[index + 1]
        cell = rgba[:, left:right].copy()
        alpha = cell[:, :, 3]
        ys, xs = np.nonzero(alpha >= 8)
        if len(xs) < 300:
            raise ValueError(f"{label}#{index}: empty or too small")

        pad = 3
        x0 = max(0, int(xs.min()) - pad)
        x1 = min(cell.shape[1], int(xs.max()) + 1 + pad)
        y0 = max(0, int(ys.min()) - pad)
        y1 = min(cell.shape[0], int(ys.max()) + 1 + pad)
        crop = cell[y0:y1, x0:x1].copy()

        # Only neutralize residual green in partially transparent matte pixels.
        # Opaque RGB, including skin, eyes and clothes, is never recolored.
        crop_alpha = crop[:, :, 3]
        edge = (crop_alpha > 0) & (crop_alpha < 250)
        red = crop[:, :, 0].astype(np.float32)
        green = crop[:, :, 1].astype(np.float32)
        blue = crop[:, :, 2].astype(np.float32)
        rb = np.maximum(red, blue)
        spill = edge & (green > rb * 1.10 + 5)
        crop[:, :, 1][spill] = np.clip(rb[spill], 0, 255).astype(np.uint8)
        crop[crop_alpha == 0, :3] = 0

        available = FRAME_SIZE - SAFETY_BORDER * 2
        scale = min(available / crop.shape[1], available / crop.shape[0])
        target = (
            max(1, round(crop.shape[1] * scale)),
            max(1, round(crop.shape[0] * scale)),
        )
        resized = Image.fromarray(crop, "RGBA").resize(target, Image.Resampling.LANCZOS)
        canvas = Image.new("RGBA", (FRAME_SIZE, FRAME_SIZE), (0, 0, 0, 0))
        x = (FRAME_SIZE - target[0]) // 2
        y = FRAME_SIZE - SAFETY_BORDER - target[1]
        canvas.alpha_composite(resized, (x, y))

        clean = np.asarray(canvas).copy()
        clean[clean[:, :, 3] < 4] = 0
        clean[:SAFETY_BORDER] = 0
        clean[-SAFETY_BORDER:] = 0
        clean[:, :SAFETY_BORDER] = 0
        clean[:, -SAFETY_BORDER:] = 0
        clean[clean[:, :, 3] == 0, :3] = 0
        frames.append(Image.fromarray(clean, "RGBA"))

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
    if np.count_nonzero(alpha >= 8) < 300:
        raise ValueError(f"{label}: unexpectedly empty")
    if np.count_nonzero((alpha > 0) & (alpha < 255)) < 30:
        raise ValueError(f"{label}: missing antialiased edge")


def pack(frames: list[Image.Image]) -> Image.Image:
    strip = Image.new(
        "RGBA", (FRAME_SIZE * FRAME_COUNT, FRAME_SIZE), (0, 0, 0, 0)
    )
    for index, frame in enumerate(frames):
        strip.alpha_composite(frame, (index * FRAME_SIZE, 0))
    return strip


def build_role(source_dir: Path, output_dir: Path, role: str) -> None:
    role_source = source_dir / role
    role_output = output_dir / role
    role_output.mkdir(parents=True, exist_ok=True)

    for action in ACTIONS:
        source = role_source / f"{action}-alpha-v4.png"
        if not source.is_file():
            raise FileNotFoundError(source)
        extracted = split_cells(Image.open(source), f"{role}/{action}")
        frames = [extracted[index].copy() for index in SOURCE_INDEX[action]]
        for index, frame in enumerate(frames):
            verify_frame(frame, f"{role}/{action}#{index}")

        # Selective repeated frames provide readable holds without slowing every frame.
        for current, previous in enumerate(SOURCE_INDEX[action][1:], start=1):
            if previous == SOURCE_INDEX[action][current - 1]:
                if np.any(
                    np.asarray(frames[current]) != np.asarray(frames[current - 1])
                ):
                    raise ValueError(f"{role}/{action}: hold frame is not identical")

        output = role_output / f"{role}-{action}-v4.png"
        pack(frames).save(output, optimize=True)
        print(f"wrote {output} ({FRAME_COUNT}x{FRAME_SIZE}px)")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-dir", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--role", required=True)
    args = parser.parse_args()
    build_role(args.source_dir, args.output_dir, args.role)


if __name__ == "__main__":
    main()
