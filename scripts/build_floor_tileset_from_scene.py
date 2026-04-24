#!/usr/bin/env python3

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter


ROOT = Path(__file__).resolve().parents[1]


def load_profile(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding='utf-8'))


def resolve_path(path_str: str) -> Path:
    return ROOT / path_str


def rectify_floor_texture(img: Image.Image, texture_size: int, floor_quad: tuple[int, ...]) -> Image.Image:
    texture = img.transform(
        (texture_size, texture_size),
        Image.Transform.QUAD,
        floor_quad,
        resample=Image.Resampling.BICUBIC,
    ).convert('RGBA')
    return texture


def sample_patch(texture: Image.Image, offset_x: float, offset_y: float, scale: float) -> Image.Image:
    width, height = texture.size
    center_x = width / 2 + offset_x * width
    center_y = height / 2 + offset_y * height
    sample_w = width * scale
    sample_h = height * scale
    box = (
        int(center_x - sample_w / 2),
        int(center_y - sample_h / 2),
        int(center_x + sample_w / 2),
        int(center_y + sample_h / 2),
    )
    return texture.crop(box)


def project_patch_to_iso_tile(patch: Image.Image, tile_width: int, tile_height: int) -> Image.Image:
    half_w = tile_width // 2
    half_h = tile_height // 2
    tile = Image.new('RGBA', (tile_width, tile_height), (0, 0, 0, 0))
    src_px = patch.load()
    out_px = tile.load()
    width, height = patch.size

    for y in range(tile_height):
        for x in range(tile_width):
            dx = (x - half_w) / half_w
            dy = y / half_h
            s = (dy + dx) / 2.0
            t = (dy - dx) / 2.0
            if 0.0 <= s <= 1.0 and 0.0 <= t <= 1.0:
                sx = min(width - 1, max(0, int(s * (width - 1))))
                sy = min(height - 1, max(0, int(t * (height - 1))))
                out_px[x, y] = src_px[sx, sy]

    return tile


def make_runtime_tile(
    patch: Image.Image,
    tile_width: int,
    tile_height: int,
    brightness: float,
    contrast: float,
    saturation: float,
    blur_radius: float,
    wash_rgba: tuple[int, int, int, int],
) -> Image.Image:
    patch = ImageEnhance.Brightness(patch).enhance(brightness)
    patch = ImageEnhance.Contrast(patch).enhance(contrast)
    patch = ImageEnhance.Color(patch).enhance(saturation)
    patch = patch.filter(ImageFilter.GaussianBlur(blur_radius))
    tile = project_patch_to_iso_tile(patch, tile_width, tile_height)
    tile.alpha_composite(Image.new('RGBA', (tile_width, tile_height), wash_rgba))
    return tile


def pick_variant_index(row: int, col: int) -> int:
    seed = (row * 17 + col * 31) % 16
    if seed in (0, 5):
        return 0
    if seed in (1, 9):
        return 1
    if seed == 13:
        return 2
    return 3


def tile_position(
    col: int,
    row: int,
    screen_cx: int,
    screen_cy: int,
    map_cx: int,
    map_cy: int,
    tile_half_w: int,
    tile_half_h: int,
    indoor_scale: int,
) -> tuple[int, int]:
    sx = tile_half_w * indoor_scale * ((col - map_cx) - (row - map_cy)) + screen_cx
    sy = tile_half_h * indoor_scale * ((col - map_cx) + (row - map_cy)) + screen_cy
    return int(sx), int(sy)


def save_tile_sheet(tiles: list[Image.Image], labels: list[str], output_path: Path) -> None:
    canvas = Image.new('RGBA', (460, 130), (22, 15, 10, 255))
    draw = ImageDraw.Draw(canvas)
    for index, (tile, label) in enumerate(zip(tiles, labels)):
        x = 20 + index * 105
        canvas.alpha_composite(tile.resize((144, 72), Image.Resampling.NEAREST), (x, 12))
        draw.text((x + 8, 96), label, fill=(230, 219, 193, 255))
    canvas.save(output_path)


def save_room_preview(
    tiles: list[Image.Image],
    output_path: Path,
    preview_size: tuple[int, int],
    map_center: tuple[int, int],
    tile_half_size: tuple[int, int],
    indoor_scale: int,
    row_range: tuple[int, int],
    col_range: tuple[int, int],
    back_shell_path: Path | None = None,
    back_shell_scale: float = 0.42,
    back_shell_anchor: tuple[int, int] = (640, 612),
) -> None:
    preview_w, preview_h = preview_size
    screen_cx = preview_w // 2
    screen_cy = preview_h // 2
    map_cx, map_cy = map_center
    tile_half_w, tile_half_h = tile_half_size
    half_w = tiles[0].width // 2
    half_h = tiles[0].height // 2

    preview = Image.new('RGBA', (preview_w, preview_h), (19, 14, 11, 255))
    row_start, row_end = row_range
    col_start, col_end = col_range
    for row in range(row_start, row_end + 1):
        for col in range(col_start, col_end + 1):
            tile = tiles[pick_variant_index(row, col)]
            x, y = tile_position(
                col, row, screen_cx, screen_cy, map_cx, map_cy, tile_half_w, tile_half_h, indoor_scale,
            )
            preview.alpha_composite(tile, (x - half_w, y - half_h))

    if back_shell_path and back_shell_path.exists():
        back_shell = Image.open(back_shell_path).convert('RGBA')
        scaled = back_shell.resize(
            (int(back_shell.width * back_shell_scale), int(back_shell.height * back_shell_scale)),
            Image.Resampling.LANCZOS,
        )
        anchor_x, anchor_y = back_shell_anchor
        preview.alpha_composite(scaled, (anchor_x - scaled.width // 2, anchor_y - scaled.height))

    preview.save(output_path)


def build_from_profile(profile_path: Path) -> dict[str, Any]:
    profile = load_profile(profile_path)

    source_path = resolve_path(profile['source_path'])
    runtime_dir = resolve_path(profile['runtime_dir'])
    preview_dir = resolve_path(profile['preview_dir'])
    metadata_dir = resolve_path(profile['metadata_dir'])
    back_shell_path = resolve_path(profile['back_shell_path']) if profile.get('back_shell_path') else None

    runtime_dir.mkdir(parents=True, exist_ok=True)
    preview_dir.mkdir(parents=True, exist_ok=True)
    metadata_dir.mkdir(parents=True, exist_ok=True)

    tile_width = int(profile['tile_width'])
    tile_height = int(profile['tile_height'])
    texture_size = int(profile.get('texture_size', 512))
    floor_quad = tuple(profile['floor_quad'])
    wash_rgba = tuple(profile.get('wash_rgba', [218, 172, 97, 18]))
    saturation = float(profile.get('saturation', 0.90))
    blur_radius = float(profile.get('blur_radius', 0.55))
    texture_color = float(profile.get('texture_color', 0.94))
    texture_contrast = float(profile.get('texture_contrast', 0.95))

    source = Image.open(source_path).convert('RGBA')
    texture = rectify_floor_texture(source, texture_size, floor_quad)
    texture = ImageEnhance.Color(texture).enhance(texture_color)
    texture = ImageEnhance.Contrast(texture).enhance(texture_contrast)

    rectified_texture_path = preview_dir / profile['rectified_texture_file']
    texture.save(rectified_texture_path)

    outputs: list[dict[str, Any]] = []
    tiles: list[Image.Image] = []
    labels: list[str] = []

    for tile_def in profile['tiles']:
        patch = sample_patch(
            texture,
            float(tile_def['offset_x']),
            float(tile_def['offset_y']),
            float(tile_def['sample_scale']),
        )
        tile = make_runtime_tile(
            patch,
            tile_width=tile_width,
            tile_height=tile_height,
            brightness=float(tile_def['brightness']),
            contrast=float(tile_def['contrast']),
            saturation=saturation,
            blur_radius=blur_radius,
            wash_rgba=wash_rgba,
        )
        output_path = runtime_dir / tile_def['file']
        tile.save(output_path)
        outputs.append({
            'source': profile['source_path'],
            'floor_quad': profile['floor_quad'],
            'output': str(output_path.relative_to(ROOT)),
            'offset_x': tile_def['offset_x'],
            'offset_y': tile_def['offset_y'],
            'sample_scale': tile_def['sample_scale'],
            'brightness': tile_def['brightness'],
            'contrast': tile_def['contrast'],
        })
        labels.append(tile_def.get('label', tile_def['file']))
        tiles.append(tile)

    save_tile_sheet(tiles, labels, preview_dir / profile['tile_sheet_file'])
    save_room_preview(
        tiles,
        output_path=preview_dir / profile['room_preview_file'],
        preview_size=(int(profile.get('preview_width', 1280)), int(profile.get('preview_height', 720))),
        map_center=(int(profile.get('map_cx', 13)), int(profile.get('map_cy', 13))),
        tile_half_size=(int(profile.get('tile_half_w', 18)), int(profile.get('tile_half_h', 9))),
        indoor_scale=int(profile.get('indoor_scale', 2)),
        row_range=tuple(profile.get('row_range', [3, 23])),
        col_range=tuple(profile.get('col_range', [3, 23])),
        back_shell_path=back_shell_path,
        back_shell_scale=float(profile.get('back_shell_scale', 0.42)),
        back_shell_anchor=tuple(profile.get('back_shell_anchor', [640, 612])),
    )

    manifest = {
        'generator': 'scripts/build_floor_tileset_from_scene.py',
        'profile': str(profile_path.relative_to(ROOT)),
        'source_set': profile['name'],
        'tile_size': {'width': tile_width, 'height': tile_height},
        'strategy': profile['strategy'],
        'outputs': outputs,
    }
    manifest_path = metadata_dir / profile['manifest_file']
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
    return manifest


def main() -> None:
    parser = argparse.ArgumentParser(description='Build reusable isometric floor tilesets from scene art.')
    parser.add_argument('--profile', required=True, help='JSON profile path relative to repo root or absolute path')
    args = parser.parse_args()

    profile_path = Path(args.profile)
    if not profile_path.is_absolute():
        profile_path = ROOT / profile_path

    manifest = build_from_profile(profile_path)
    print(json.dumps(manifest, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
