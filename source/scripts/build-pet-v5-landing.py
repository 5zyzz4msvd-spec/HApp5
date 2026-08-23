#!/usr/bin/env python3
"""Prepare, sanitize, and pack 12-frame desktop-pet landing strips.

The image model sees explicit slot guides, while the shipped strip remains a
clean RGBA row. Generated poses are normalized together by the game-studio
sprite pipeline before ``pack`` locks the approved drag and idle endpoints.
"""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw


FRAME_COUNT = 12
FRAME_SIZE = 160
NORMALIZED_SIZE = 144
SAFETY_BORDER = (FRAME_SIZE - NORMALIZED_SIZE) // 2
GUIDE_SLOT_SIZE = 320
GUIDE_HEIGHT = 1280
CHROMA = (0, 255, 0, 255)
GUIDE = (255, 0, 255, 255)


def clean_transparent_rgb(image: Image.Image) -> Image.Image:
    rgba = np.asarray(image.convert("RGBA")).copy()
    rgba[rgba[:, :, 3] < 4] = 0
    rgba[rgba[:, :, 3] == 0, :3] = 0
    return Image.fromarray(rgba, "RGBA")


def content_bbox(image: Image.Image) -> tuple[int, int, int, int]:
    alpha = np.asarray(image.convert("RGBA"))[:, :, 3]
    ys, xs = np.nonzero(alpha >= 8)
    if not len(xs):
        raise ValueError("frame has no visible sprite content")
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1


def resize_content_width(image: Image.Image, ratio: float) -> Image.Image:
    if abs(ratio - 1) < 0.005:
        return image
    left, top, right, bottom = content_bbox(image)
    content = image.crop((left, top, right, bottom))
    target_width = max(1, round(content.width * ratio))
    resized = content.resize((target_width, content.height), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", image.size, (0, 0, 0, 0))
    x = (image.width - target_width) // 2
    canvas.alpha_composite(resized, (x, top))
    return clean_transparent_rgb(canvas)


def edit_canvas(seed_path: Path, idle_path: Path, out_path: Path, fill_idle: bool) -> None:
    seed = Image.open(seed_path).convert("RGBA")
    idle = Image.open(idle_path).convert("RGBA")
    if seed.size != (FRAME_SIZE, FRAME_SIZE) or idle.size != (FRAME_SIZE, FRAME_SIZE):
        raise ValueError("drag and idle edit-canvas endpoints must both be 160x160")

    seed = seed.resize((GUIDE_SLOT_SIZE, GUIDE_SLOT_SIZE), Image.Resampling.LANCZOS)
    idle = idle.resize((GUIDE_SLOT_SIZE, GUIDE_SLOT_SIZE), Image.Resampling.LANCZOS)
    width = FRAME_COUNT * GUIDE_SLOT_SIZE
    canvas = Image.new("RGBA", (width, GUIDE_HEIGHT), CHROMA)
    top = (GUIDE_HEIGHT - GUIDE_SLOT_SIZE) // 2
    canvas.alpha_composite(seed, (0, top))
    idle_slots = range(1, FRAME_COUNT) if fill_idle else (FRAME_COUNT - 1,)
    for index in idle_slots:
        canvas.alpha_composite(idle, (index * GUIDE_SLOT_SIZE, top))

    draw = ImageDraw.Draw(canvas)
    for index in range(1, FRAME_COUNT):
        x = index * GUIDE_SLOT_SIZE
        draw.line((x, 0, x, GUIDE_HEIGHT - 1), fill=GUIDE, width=6)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(out_path)


def sanitize_strip(input_path: Path, out_path: Path) -> None:
    image = Image.open(input_path).convert("RGBA")
    rgba = np.asarray(image).copy()
    height, width = rgba.shape[:2]
    slot_width = width / FRAME_COUNT

    # Remove model-preserved magenta guides and reserve a transparent gutter at
    # every exact slot boundary. A pose crossing a boundary remains visibly
    # truncated in preview and cannot silently bleed into its neighbor.
    rgb = rgba[:, :, :3].astype(np.int16)
    magenta = (
        (rgb[:, :, 0] > 70)
        & (rgb[:, :, 2] > 70)
        & (np.abs(rgb[:, :, 0] - rgb[:, :, 2]) < 42)
        & (rgb[:, :, 1] + 10 < np.minimum(rgb[:, :, 0], rgb[:, :, 2]))
    )
    rgba[magenta] = 0
    edge_band = max(4, round(height * 0.02))
    rgba[:edge_band] = 0
    rgba[-edge_band:] = 0
    gutter = max(8, round(slot_width * 0.04))
    for index in range(1, FRAME_COUNT):
        center = round(index * slot_width)
        rgba[:, max(0, center - gutter) : min(width, center + gutter + 1)] = 0

    # Chroma removal can leave sparse antialias specks far outside a figure.
    # Trim only the sparse exterior of each slot; never cut a narrow column
    # through the character or select only its largest connected component.
    for index in range(FRAME_COUNT):
        left = round(index * slot_width)
        right = round((index + 1) * slot_width)
        slot_alpha = rgba[:, left:right, 3]
        active_rows = np.count_nonzero(slot_alpha >= 8, axis=1) >= 5
        active_columns = np.count_nonzero(slot_alpha >= 8, axis=0) >= 5
        row_ids = np.flatnonzero(active_rows)
        column_ids = np.flatnonzero(active_columns)
        if not len(row_ids) or not len(column_ids):
            continue
        top = max(0, int(row_ids[0]) - 3)
        bottom = min(height, int(row_ids[-1]) + 4)
        inner_left = max(0, int(column_ids[0]) - 3)
        inner_right = min(right - left, int(column_ids[-1]) + 4)
        rgba[:top, left:right] = 0
        rgba[bottom:, left:right] = 0
        rgba[top:bottom, left : left + inner_left] = 0
        rgba[top:bottom, left + inner_right : right] = 0

        column_counts = np.count_nonzero(rgba[:, left:right, 3] >= 8, axis=0)
        narrow_candidates = column_counts >= max(20, round(height * 0.03))
        runs = []
        run_start = None
        for x, active in enumerate(np.append(narrow_candidates, False)):
            if active and run_start is None:
                run_start = x
            elif not active and run_start is not None:
                runs.append((run_start, x))
                run_start = None
        for run_index, (start, end) in enumerate(runs):
            previous_end = runs[run_index - 1][1] if run_index else 0
            next_start = runs[run_index + 1][0] if run_index + 1 < len(runs) else right - left
            if end - start <= 4 and start - previous_end > 8 and next_start - end > 8:
                rgba[:, left + start : left + end] = 0

    # Require a real independent pose in every slot before normalization.
    counts = []
    for index in range(FRAME_COUNT):
        left = round(index * slot_width)
        right = round((index + 1) * slot_width)
        counts.append(int(np.count_nonzero(rgba[:, left:right, 3] >= 8)))
    if any(count < 300 for count in counts):
        raise ValueError(f"expected {FRAME_COUNT} populated slots, alpha counts={counts}")

    cleaned = clean_transparent_rgb(Image.fromarray(rgba, "RGBA"))
    out_path.parent.mkdir(parents=True, exist_ok=True)
    cleaned.save(out_path)


def pack_strip(
    frames_dir: Path,
    drag_path: Path,
    idle_path: Path,
    out_path: Path,
    order: list[int],
    match_idle_width: bool,
) -> None:
    if sorted(order) != list(range(1, FRAME_COUNT + 1)):
        raise ValueError(f"order must contain each frame 1..{FRAME_COUNT} exactly once")
    middle = [Image.open(frames_dir / f"{index:02d}.png").convert("RGBA") for index in order]
    if any(frame.size != (NORMALIZED_SIZE, NORMALIZED_SIZE) for frame in middle):
        raise ValueError(f"normalized frames must be {NORMALIZED_SIZE}x{NORMALIZED_SIZE}")

    drag = clean_transparent_rgb(Image.open(drag_path).convert("RGBA"))
    idle = clean_transparent_rgb(Image.open(idle_path).convert("RGBA"))
    if drag.size != (FRAME_SIZE, FRAME_SIZE) or idle.size != (FRAME_SIZE, FRAME_SIZE):
        raise ValueError("approved drag and idle endpoints must be 160x160")

    if match_idle_width:
        idle_width = content_bbox(idle)[2] - content_bbox(idle)[0]
        generated_width = content_bbox(middle[-1])[2] - content_bbox(middle[-1])[0]
        ratio = idle_width / generated_width
        if not 0.85 <= ratio <= 1.25:
            raise ValueError(f"idle width correction is unsafe: {ratio:.3f}")
        middle = [resize_content_width(frame, ratio) for frame in middle]

    frames = []
    for frame in middle:
        canvas = Image.new("RGBA", (FRAME_SIZE, FRAME_SIZE), (0, 0, 0, 0))
        canvas.alpha_composite(clean_transparent_rgb(frame), (SAFETY_BORDER, SAFETY_BORDER))
        frames.append(clean_transparent_rgb(canvas))
    frames[0] = drag
    frames[-1] = idle

    strip = Image.new("RGBA", (FRAME_SIZE * FRAME_COUNT, FRAME_SIZE), (0, 0, 0, 0))
    for index, frame in enumerate(frames):
        strip.alpha_composite(frame, (index * FRAME_SIZE, 0))
    out_path.parent.mkdir(parents=True, exist_ok=True)
    strip.save(out_path, optimize=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    subparsers = parser.add_subparsers(dest="command", required=True)

    canvas_parser = subparsers.add_parser("edit-canvas")
    canvas_parser.add_argument("--seed", type=Path, required=True)
    canvas_parser.add_argument("--idle", type=Path, required=True)
    canvas_parser.add_argument("--fill-idle", action="store_true")
    canvas_parser.add_argument("--out", type=Path, required=True)

    sanitize_parser = subparsers.add_parser("sanitize")
    sanitize_parser.add_argument("--input", type=Path, required=True)
    sanitize_parser.add_argument("--out", type=Path, required=True)

    pack_parser = subparsers.add_parser("pack")
    pack_parser.add_argument("--frames-dir", type=Path, required=True)
    pack_parser.add_argument("--drag", type=Path, required=True)
    pack_parser.add_argument("--idle", type=Path, required=True)
    pack_parser.add_argument("--out", type=Path, required=True)
    pack_parser.add_argument(
        "--order",
        default=",".join(str(index) for index in range(1, FRAME_COUNT + 1)),
        help="Comma-separated source-frame order; defaults to 1..12.",
    )
    pack_parser.add_argument("--match-idle-width", action="store_true")

    args = parser.parse_args()
    if args.command == "edit-canvas":
        edit_canvas(args.seed, args.idle, args.out, args.fill_idle)
    elif args.command == "sanitize":
        sanitize_strip(args.input, args.out)
    else:
        order = [int(value) for value in args.order.split(",")]
        pack_strip(args.frames_dir, args.drag, args.idle, args.out, order, args.match_idle_width)


if __name__ == "__main__":
    main()
