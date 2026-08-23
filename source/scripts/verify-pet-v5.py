#!/usr/bin/env python3
"""Mechanical quality gate for the two-character desktop-pet v5 pack."""

from hashlib import sha256
from pathlib import Path

import numpy as np
from PIL import Image


ROOT = Path("public/frontends/hypnosis-app/assets/pet/v5")
DEV_ROOT = Path("public/dev/pet-v5/strips")
ROLES = ("alisa", "hyakka")
COMMON_GROUPS = ("idle", "unique-a", "unique-b", "drag", "enter", "exit")
FRAME_COUNTS = {
    "alisa": {**{group: 8 for group in COMMON_GROUPS}, "landing": 12},
    "hyakka": {**{group: 8 for group in COMMON_GROUPS}, "landing": 12},
}
FRAME_SIZE = 160
SAFETY_BORDER = 8


def verify_frame(rgba: np.ndarray, label: str) -> None:
    alpha = rgba[:, :, 3]
    guard = np.zeros_like(alpha, dtype=bool)
    guard[:SAFETY_BORDER] = guard[-SAFETY_BORDER:] = True
    guard[:, :SAFETY_BORDER] = guard[:, -SAFETY_BORDER:] = True
    assert not np.any(alpha[guard]), f"{label}: sprite touches safety border"
    assert not np.any(rgba[:, :, :3][alpha == 0]), f"{label}: hidden RGB residue"
    assert np.count_nonzero(alpha >= 8) >= 300, f"{label}: unexpectedly empty"
    assert len(np.unique(alpha)) >= 16, f"{label}: insufficient smooth alpha levels"
    assert np.count_nonzero((alpha > 0) & (alpha < 255)) >= 40, f"{label}: AA fringe missing"


expected = {
    ROOT / role / f"{role}-{group}-v5.png"
    for role in ROLES
    for group in FRAME_COUNTS[role]
}
actual = set(ROOT.rglob("*.png"))
assert actual == expected, f"unexpected v5 asset set: missing={expected - actual}, extra={actual - expected}"

verified = 0
for path in sorted(expected):
    role = path.parent.name
    group = path.stem.removeprefix(f"{role}-").removesuffix("-v5")
    frame_count = FRAME_COUNTS[role][group]
    image = Image.open(path).convert("RGBA")
    assert image.size == (FRAME_SIZE * frame_count, FRAME_SIZE), (path, image.size)
    rgba = np.asarray(image)
    for index in range(frame_count):
        start = index * FRAME_SIZE
        verify_frame(rgba[:, start : start + FRAME_SIZE], f"{path.relative_to(ROOT)}#{index}")
        verified += 1


def frame(role: str, group: str, index: int) -> np.ndarray:
    image = np.asarray(Image.open(ROOT / role / f"{role}-{group}-v5.png").convert("RGBA"))
    start = index * FRAME_SIZE
    return image[:, start : start + FRAME_SIZE]


def content_size(item: np.ndarray) -> tuple[int, int]:
    ys, xs = np.nonzero(item[:, :, 3] >= 8)
    return int(xs.max() - xs.min() + 1), int(ys.max() - ys.min() + 1)


for role in ROLES:
    idle = frame(role, "idle", 0)
    drag = frame(role, "drag", 0)
    assert np.array_equal(frame(role, "landing", 0), drag), f"{role}/landing: first frame is not approved drag pose"
    assert np.array_equal(frame(role, "landing", 11), idle), f"{role}/landing: last frame is not approved idle"
    landing_frames = [frame(role, "landing", index) for index in range(12)]
    hashes = [sha256(item.tobytes()).hexdigest() for item in landing_frames]
    assert len(set(hashes)) >= 11, f"{role}/landing: too many duplicate frames"
    for index, item in enumerate(landing_frames[1:-1], start=1):
        assert not np.array_equal(item, drag), f"{role}/landing#{index}: repeats drag endpoint"
        assert not np.array_equal(item, idle), f"{role}/landing#{index}: repeats idle endpoint"
    settle_width, settle_height = content_size(landing_frames[-2])
    idle_width, idle_height = content_size(idle)
    assert abs(settle_width - idle_width) <= max(4, round(idle_width * 0.08)), f"{role}/landing: settle width drifts from idle"
    assert abs(settle_height - idle_height) <= max(4, round(idle_height * 0.08)), f"{role}/landing: settle height drifts from idle"

for source in sorted(expected):
    mirror = DEV_ROOT / source.relative_to(ROOT)
    assert mirror.exists(), f"missing desktop-pet preview mirror: {mirror}"
    assert source.read_bytes() == mirror.read_bytes(), f"desktop-pet preview mirror drift: {mirror}"

expected_frames = sum(sum(groups.values()) for groups in FRAME_COUNTS.values())
assert verified == expected_frames == 120, verified
print("Desktop-pet v5: 2 characters, 14 strips and 120 smooth isolated frames passed")
