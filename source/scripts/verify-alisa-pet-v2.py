#!/usr/bin/env python3
"""Mechanical guard against cross-frame residue in Alisa desktop-pet v2 assets."""

from __future__ import annotations

from pathlib import Path

import cv2
import numpy as np
from PIL import Image


ROOT = Path("public/frontends/hypnosis-app/assets/pet")
FRAME_SIZE = 160
FRAME_COUNT = 24
SAFETY_BORDER = 8
EXPECTED = (
    "alisa-ambient-v2.png",
    "alisa-move-v2.png",
    "alisa-mishap-v2.png",
    "alisa-drag-v2.png",
)


def verify_frame(rgba: np.ndarray, label: str) -> None:
    alpha = rgba[:, :, 3]
    guard = np.zeros_like(alpha, dtype=bool)
    guard[:SAFETY_BORDER] = guard[-SAFETY_BORDER:] = True
    guard[:, :SAFETY_BORDER] = guard[:, -SAFETY_BORDER:] = True
    assert not np.any(alpha[guard]), f"{label}: sprite touches cell safety border"
    assert not np.any(rgba[:, :, :3][alpha == 0]), f"{label}: hidden RGB residue"
    assert len(np.unique(alpha)) >= 16, f"{label}: insufficient smooth alpha levels"
    assert np.count_nonzero((alpha > 0) & (alpha < 255)) >= 40, f"{label}: antialias fringe missing"

    mask = (alpha >= 8).astype(np.uint8)
    count, labels, stats, _ = cv2.connectedComponentsWithStats(mask, 8)
    areas = [stats[index, cv2.CC_STAT_AREA] for index in range(1, count)]
    significant = [area for area in areas if area >= 32]
    assert len(significant) == 1, f"{label}: detached hair/action fragments remain: {significant}"

    largest = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
    main = (labels == largest).astype(np.uint8)
    halo = cv2.dilate(main, np.ones((7, 7), np.uint8), iterations=1).astype(bool)
    assert not np.any((alpha > 0) & ~halo), f"{label}: low-alpha neighboring-frame residue"


for name in EXPECTED:
    path = ROOT / name
    image = Image.open(path).convert("RGBA")
    assert image.size == (FRAME_SIZE * FRAME_COUNT, FRAME_SIZE), (name, image.size)
    rgba = np.asarray(image)
    for index in range(FRAME_COUNT):
        start = index * FRAME_SIZE
        verify_frame(rgba[:, start : start + FRAME_SIZE], f"{name}#{index}")

print("Alisa desktop-pet v2: 96 smooth isolated frames passed")
