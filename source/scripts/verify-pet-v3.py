#!/usr/bin/env python3
"""Mechanical quality gate for all 600 desktop-pet v3 frames."""

from pathlib import Path

import cv2
import numpy as np
from PIL import Image


ROOT = Path("public/frontends/hypnosis-app/assets/pet/v3")
ROLES = ("alisa", "miyuki", "natsumi", "mashiro", "hyakka")
GROUPS = ("ambient", "move", "mishap", "drag", "interact")
FRAME_SIZE = 160
FRAME_COUNT = 24
SAFETY_BORDER = 8


def verify_frame(rgba: np.ndarray, label: str) -> None:
    alpha = rgba[:, :, 3]
    guard = np.zeros_like(alpha, dtype=bool)
    guard[:SAFETY_BORDER] = guard[-SAFETY_BORDER:] = True
    guard[:, :SAFETY_BORDER] = guard[:, -SAFETY_BORDER:] = True
    assert not np.any(alpha[guard]), f"{label}: sprite touches safety border"
    assert not np.any(rgba[:, :, :3][alpha == 0]), f"{label}: hidden RGB residue"
    assert len(np.unique(alpha)) >= 16, f"{label}: insufficient smooth alpha levels"
    assert np.count_nonzero((alpha > 0) & (alpha < 255)) >= 40, f"{label}: AA fringe missing"

    mask = (alpha >= 8).astype(np.uint8)
    count, labels, stats, _ = cv2.connectedComponentsWithStats(mask, 8)
    areas = [stats[index, cv2.CC_STAT_AREA] for index in range(1, count)]
    significant = [area for area in areas if area >= 32]
    assert len(significant) == 1, f"{label}: detached hair/action fragments: {significant}"
    largest = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
    main = (labels == largest).astype(np.uint8)
    halo = cv2.dilate(main, np.ones((7, 7), np.uint8), iterations=1).astype(bool)
    assert not np.any((alpha > 0) & ~halo), f"{label}: neighboring-frame residue"


verified = 0
for role in ROLES:
    for group in GROUPS:
        path = ROOT / role / f"{role}-{group}-v3.png"
        image = Image.open(path).convert("RGBA")
        assert image.size == (FRAME_SIZE * FRAME_COUNT, FRAME_SIZE), (path, image.size)
        rgba = np.asarray(image)
        for index in range(FRAME_COUNT):
            start = index * FRAME_SIZE
            verify_frame(rgba[:, start : start + FRAME_SIZE], f"{role}/{group}#{index}")
            verified += 1

assert verified == 600, verified
print("Desktop-pet v3: 5 characters, 25 strips and 600 smooth isolated frames passed")
