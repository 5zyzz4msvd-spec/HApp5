#!/usr/bin/env python3
"""Pack independently generated desktop-pet frames into one safe sprite row.

Unlike the retired sheet-splitting workflow, every input file contains exactly
one character pose. No connected-component filtering or cross-cell slicing is
performed, so neighboring frames can never leak hair or skin into each other.
"""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
from PIL import Image


FRAME_SIZE = 160
FRAME_COUNT = 8
SAFETY_BORDER = 8


def normalize_frame(path: Path) -> Image.Image:
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

    available = FRAME_SIZE - SAFETY_BORDER * 2
    scale = min(available / crop.width, available / crop.height)
    target = (
        max(1, round(crop.width * scale)),
        max(1, round(crop.height * scale)),
    )
    resized = crop.resize(target, Image.Resampling.LANCZOS)
    frame = Image.new("RGBA", (FRAME_SIZE, FRAME_SIZE), (0, 0, 0, 0))
    x = (FRAME_SIZE - target[0]) // 2
    y = FRAME_SIZE - SAFETY_BORDER - target[1]
    frame.alpha_composite(resized, (x, y))

    clean = np.asarray(frame).copy()
    clean[clean[:, :, 3] < 4] = 0
    clean[:SAFETY_BORDER] = 0
    clean[-SAFETY_BORDER:] = 0
    clean[:, :SAFETY_BORDER] = 0
    clean[:, -SAFETY_BORDER:] = 0
    clean[clean[:, :, 3] == 0, :3] = 0
    return Image.fromarray(clean, "RGBA")


def verify_frame(frame: Image.Image, label: str) -> None:
    rgba = np.asarray(frame.convert("RGBA"))
    alpha = rgba[:, :, 3]
    guard = np.zeros_like(alpha, dtype=bool)
    guard[:SAFETY_BORDER] = guard[-SAFETY_BORDER:] = True
    guard[:, :SAFETY_BORDER] = guard[:, -SAFETY_BORDER:] = True
    if np.any(alpha[guard]):
        raise ValueError(f"{label}: occupied safety border")
    if np.any(rgba[:, :, :3][alpha == 0]):
        raise ValueError(f"{label}: hidden RGB residue")
    if np.count_nonzero(alpha >= 8) < 300:
        raise ValueError(f"{label}: unexpectedly empty")
    if np.count_nonzero((alpha > 0) & (alpha < 255)) < 30:
        raise ValueError(f"{label}: missing smooth alpha edge")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--frame", type=Path, action="append", required=True)
    args = parser.parse_args()

    if len(args.frame) != FRAME_COUNT:
        raise ValueError(f"expected exactly {FRAME_COUNT} --frame values")
    frames = [normalize_frame(path) for path in args.frame]
    for index, frame in enumerate(frames):
        verify_frame(frame, f"frame#{index}")

    strip = Image.new(
        "RGBA", (FRAME_SIZE * FRAME_COUNT, FRAME_SIZE), (0, 0, 0, 0)
    )
    for index, frame in enumerate(frames):
        strip.alpha_composite(frame, (index * FRAME_SIZE, 0))

    args.output.parent.mkdir(parents=True, exist_ok=True)
    strip.save(args.output, optimize=True)
    print(f"wrote {args.output} ({FRAME_COUNT} independent frames)")


if __name__ == "__main__":
    main()
