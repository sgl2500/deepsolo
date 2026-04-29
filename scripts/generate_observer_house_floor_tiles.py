#!/usr/bin/env python3

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
ASSET_ROOT = Path('/Users/sunguanlong/Desktop/AIGC/assets-library/deepsolo/observer_house/v3')
RUNTIME_DIR = ROOT / 'packages/visual/public/assets/rooms/observer_house'
PREVIEW_DIR = ASSET_ROOT / 'preview'
METADATA_DIR = ASSET_ROOT / 'metadata'

TILE_W = 72
TILE_H = 36
HALF_W = TILE_W // 2
HALF_H = TILE_H // 2
PREVIEW_W = 1280
PREVIEW_H = 720
SCREEN_CX = PREVIEW_W // 2
SCREEN_CY = PREVIEW_H // 2
MAP_CX = 13
MAP_CY = 13
TILE_HALF_W = 18
TILE_HALF_H = 9
INDOOR_SCALE = 2


@dataclass(frozen=True)
class VariantSpec:
    name: str
    phase: int
    warmth: int
    accent: tuple[int, int, int]
    knot_points: tuple[tuple[int, int, int], ...]
    scratch_points: tuple[tuple[int, int, int, int], ...]


VARIANTS = (
    VariantSpec(
        name='balanced',
        phase=0,
        warmth=0,
        accent=(142, 92, 58),
        knot_points=((24, 14, 3),),
        scratch_points=((14, 18, 31, 11), (42, 26, 58, 18)),
    ),
    VariantSpec(
        name='amber',
        phase=5,
        warmth=8,
        accent=(161, 108, 68),
        knot_points=((53, 15, 3),),
        scratch_points=((10, 15, 27, 8), (38, 28, 55, 21)),
    ),
    VariantSpec(
        name='aged',
        phase=9,
        warmth=-10,
        accent=(112, 74, 48),
        knot_points=((46, 22, 4),),
        scratch_points=((16, 23, 28, 18), (41, 13, 60, 7)),
    ),
    VariantSpec(
        name='polished',
        phase=13,
        warmth=4,
        accent=(170, 117, 76),
        knot_points=(),
        scratch_points=((9, 19, 25, 13), (46, 25, 61, 17)),
    ),
)

BASE_BOARDS = [
    (120, 77, 45),
    (133, 87, 52),
    (147, 99, 60),
    (158, 108, 67),
]


def clamp(value: int) -> int:
    return max(0, min(255, int(value)))


def tint(color: tuple[int, int, int], delta: int = 0, warmth: int = 0) -> tuple[int, int, int]:
    r, g, b = color
    return (
        clamp(r + delta + warmth),
        clamp(g + delta + warmth // 3),
        clamp(b + delta - warmth // 5),
    )


def hash_noise(x: int, y: int, salt: int) -> int:
    value = (x * 73856093) ^ (y * 19349663) ^ (salt * 83492791)
    value &= 0xFFFFFFFF
    return (value % 17) - 8


def diamond_span(y: int) -> tuple[int, int]:
    if y <= HALF_H:
        ratio = y / HALF_H
    else:
        ratio = (TILE_H - 1 - y) / (HALF_H - 1)
    half_span = max(1, int(round((HALF_W - 1) * ratio)))
    left = HALF_W - half_span
    right = HALF_W + half_span - 1
    return left, right


def iter_diamond_pixels() -> Iterable[tuple[int, int, int, int]]:
    for y in range(TILE_H):
        left, right = diamond_span(y)
        for x in range(left, right + 1):
            yield x, y, left, right


def add_knots(draw: ImageDraw.ImageDraw, spec: VariantSpec) -> None:
    for cx, cy, radius in spec.knot_points:
        shadow = (72, 45, 26, 46)
        core = tint(spec.accent, delta=-28, warmth=-2) + (92,)
        highlight = tint(spec.accent, delta=22, warmth=4) + (44,)
        draw.ellipse((cx - radius, cy - radius + 1, cx + radius, cy + radius + 1), fill=shadow)
        draw.ellipse((cx - radius, cy - radius, cx + radius, cy + radius), fill=core)
        draw.arc((cx - radius - 1, cy - radius - 1, cx + radius + 1, cy + radius + 1), 210, 20, fill=highlight, width=1)


def add_scratches(draw: ImageDraw.ImageDraw, spec: VariantSpec) -> None:
    for x1, y1, x2, y2 in spec.scratch_points:
        draw.line((x1, y1, x2, y2), fill=(214, 182, 139, 72), width=1)
        draw.line((x1, y1 + 1, x2, y2 + 1), fill=(74, 44, 24, 30), width=1)


def make_floor_tile(spec: VariantSpec) -> Image.Image:
    img = Image.new('RGBA', (TILE_W, TILE_H), (0, 0, 0, 0))
    px = img.load()

    for x, y, left, right in iter_diamond_pixels():
        board_span = ((x + y * 2 + spec.phase) // 14) % len(BASE_BOARDS)
        remainder = (x + y * 2 + spec.phase) % 14
        color = BASE_BOARDS[board_span]

        edge_mix = 0
        if y < HALF_H:
            edge_mix += 6
        else:
            edge_mix -= 4
        if x < HALF_W:
            edge_mix += 3
        else:
            edge_mix -= 2

        noise = hash_noise(x, y, spec.phase)
        delta = edge_mix + noise
        if remainder in (0, 1, 2):
            delta -= 16
        elif remainder in (7, 8):
            delta += 6

        distance_to_edge = min(x - left, right - x, y, TILE_H - 1 - y)
        if distance_to_edge <= 0:
            delta -= 24
        elif distance_to_edge == 1:
            delta -= 10
        elif distance_to_edge == 2:
            delta += 4

        if (x + y + spec.phase) % 19 == 0:
            delta += 5
        if (x * 2 + y + spec.phase) % 29 == 0:
            delta -= 7

        px[x, y] = tint(color, delta=delta, warmth=spec.warmth) + (255,)

    draw = ImageDraw.Draw(img, 'RGBA')

    # Beveled lip on the top ridge makes the tile read as a crafted floor board, not a flat fill.
    draw.line((HALF_W, 1, TILE_W - 5, HALF_H - 1), fill=(226, 190, 146, 38), width=1)
    draw.line((HALF_W, 1, 4, HALF_H - 1), fill=(240, 206, 164, 42), width=1)
    draw.line((5, HALF_H + 1, HALF_W, TILE_H - 3), fill=(84, 52, 30, 44), width=1)
    draw.line((TILE_W - 5, HALF_H + 1, HALF_W, TILE_H - 3), fill=(68, 40, 22, 52), width=1)

    add_knots(draw, spec)
    add_scratches(draw, spec)

    # Small inlaid board detail to break repetition across the room.
    inset = Image.new('RGBA', (TILE_W, TILE_H), (0, 0, 0, 0))
    inset_draw = ImageDraw.Draw(inset, 'RGBA')
    inset_draw.polygon(((HALF_W, 6), (57, HALF_H), (HALF_W, 30), (15, HALF_H)), fill=spec.accent + (18,))
    inset_draw.line((26, 13, 45, 24), fill=(228, 194, 151, 26), width=1)
    inset_draw.line((28, 24, 49, 13), fill=(80, 49, 29, 18), width=1)
    img.alpha_composite(inset)

    return img


def save_tile_sheet(tiles: list[Image.Image]) -> None:
    cols = len(tiles)
    margin = 20
    label_h = 34
    canvas = Image.new('RGBA', (cols * (TILE_W + margin) + margin, TILE_H + margin * 2 + label_h), (22, 15, 10, 255))
    draw = ImageDraw.Draw(canvas)
    for index, tile in enumerate(tiles):
        x = margin + index * (TILE_W + margin)
        canvas.alpha_composite(tile, (x, margin))
        draw.text((x, TILE_H + margin + 8), f'floor_tile_{index}', fill=(230, 219, 193, 255))
    canvas.save(PREVIEW_DIR / 'floor_tile_sheet.png')


def tile_position(col: int, row: int) -> tuple[int, int]:
    sx = TILE_HALF_W * INDOOR_SCALE * ((col - MAP_CX) - (row - MAP_CY)) + SCREEN_CX
    sy = TILE_HALF_H * INDOOR_SCALE * ((col - MAP_CX) + (row - MAP_CY)) + SCREEN_CY
    return int(sx), int(sy)


def pick_variant_index(row: int, col: int) -> int:
    seed = (row * 17 + col * 31) % 16
    if seed in (0, 5):
        return 0
    if seed in (1, 9):
        return 1
    if seed == 13:
        return 2
    return 3


def save_room_preview(tiles: list[Image.Image]) -> None:
    preview = Image.new('RGBA', (PREVIEW_W, PREVIEW_H), (19, 14, 11, 255))
    glow = Image.new('RGBA', (PREVIEW_W, PREVIEW_H), (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow, 'RGBA')
    glow_draw.ellipse((370, 210, 980, 670), fill=(181, 120, 62, 34))
    glow_draw.ellipse((520, 150, 1080, 620), fill=(245, 181, 103, 20))
    preview.alpha_composite(glow)

    for row in range(3, 23):
        for col in range(3, 23):
            tile = tiles[pick_variant_index(row, col)]
            x, y = tile_position(col, row)
            preview.alpha_composite(tile, (x - HALF_W, y - HALF_H))

    back_shell_path = RUNTIME_DIR / 'back_shell.png'
    if back_shell_path.exists():
        back_shell = Image.open(back_shell_path).convert('RGBA')
        scaled = back_shell.resize((int(back_shell.width * 0.42), int(back_shell.height * 0.42)), Image.Resampling.LANCZOS)
        preview.alpha_composite(scaled, (640 - scaled.width // 2, 612 - scaled.height))

    preview.save(PREVIEW_DIR / 'floor_room_preview.png')


def main() -> None:
    RUNTIME_DIR.mkdir(parents=True, exist_ok=True)
    PREVIEW_DIR.mkdir(parents=True, exist_ok=True)
    METADATA_DIR.mkdir(parents=True, exist_ok=True)

    tiles: list[Image.Image] = []
    manifest = {
        'generator': 'scripts/generate_observer_house_floor_tiles.py',
        'tile_size': {'width': TILE_W, 'height': TILE_H},
        'style': 'modular wuxia indoor wood floor',
        'files': [],
    }

    for index, spec in enumerate(VARIANTS):
        tile = make_floor_tile(spec)
        file_name = f'floor_tile_{index}.png'
        tile.save(RUNTIME_DIR / file_name)
        tiles.append(tile)
        manifest['files'].append({'file': file_name, 'variant': spec.name})

    save_tile_sheet(tiles)
    save_room_preview(tiles)

    (METADATA_DIR / 'floor_tiles_manifest.json').write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2),
        encoding='utf-8',
    )


if __name__ == '__main__':
    main()
