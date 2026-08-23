#!/usr/bin/env python3
"""Build an eight-frame hanging swing from one approved transparent pose.

The character art is never regenerated per sway frame.  Every frame is the
same normalized bitmap rotated around the fixed top-center grab point, which
keeps hair, limbs, clothing, and accessories pixel-identical across the row.
"""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
from PIL import Image


FRAME_SIZE = 160
FRAME_COUNT = 8
SAFETY_BORDER = 8
BOTTOM_BORDER = 16
PIVOT = (FRAME_SIZE // 2, SAFETY_BORDER)
ANGLES = (0, -4, -4, 0, 4, 4, 0, 0)


def normalize_at_grab_point(path: Path) -> Image.Image:
    source = Image.open(path).convert("RGBA")
    rgba = np.asarray(source).copy()
    alpha = rgba[:, :, 3]
    ys, xs = np.nonzero(alpha >= 4)
    if len(xs) < 300:
        raise ValueError(f"{path}: empty or unexpectedly small frame")

    pad = 4
    left = max(0, int(xs.min()) - pad)
    top = max(0, int(ys.min()) - pad)
    right = min(source.width, int(xs.max()) + 1 + pad)
    bottom = min(source.height, int(ys.max()) + 1 + pad)
    crop = Image.fromarray(rgba[top:bottom, left:right], "RGBA")

    available_width = FRAME_SIZE - SAFETY_BORDER * 2
    available_height = FRAME_SIZE - PIVOT[1] - BOTTOM_BORDER
    scale = min(available_width / crop.width, available_height / crop.height)
    target = (
        max(1, round(crop.width * scale)),
        max(1, round(crop.height * scale)),
    )
    resized = crop.resize(target, Image.Resampling.LANCZOS)
    frame = Image.new("RGBA", (FRAME_SIZE, FRAME_SIZE), (0, 0, 0, 0))
    x = PIVOT[0] - target[0] // 2
    frame.alpha_composite(resized, (x, PIVOT[1]))
    return frame


def clean_and_verify(frame: Image.Image, label: str) -> Image.Image:
    rgba = np.asarray(frame.convert("RGBA")).copy()
    rgba[rgba[:, :, 3] < 4] = 0
    rgba[rgba[:, :, 3] == 0, :3] = 0
    alpha = rgba[:, :, 3]
    if np.count_nonzero(alpha >= 8) < 300:
        raise ValueError(f"{label}: unexpectedly empty")
    if np.any(alpha[-SAFETY_BORDER:]):
        raise ValueError(f"{label}: occupied bottom safety border")
    if np.any(alpha[:, :2]) or np.any(alpha[:, -2:]):
        raise ValueError(f"{label}: occupied side safety border")
    return Image.fromarray(rgba, "RGBA")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()

    base = normalize_at_grab_point(args.source)
    frames = []
    for index, angle in enumerate(ANGLES):
        rotated = base.rotate(
            angle,
            resample=Image.Resampling.BICUBIC,
            center=PIVOT,
            expand=False,
        )
        frames.append(clean_and_verify(rotated, f"frame#{index}"))

    strip = Image.new(
        "RGBA", (FRAME_SIZE * FRAME_COUNT, FRAME_SIZE), (0, 0, 0, 0)
    )
    for index, frame in enumerate(frames):
        strip.alpha_composite(frame, (index * FRAME_SIZE, 0))

    args.output.parent.mkdir(parents=True, exist_ok=True)
    strip.save(args.output, optimize=True)
    print(f"wrote {args.output} ({FRAME_COUNT} frames from one approved pose)")


if __name__ == "__main__":
    main()
