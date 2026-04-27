#!/usr/bin/env python3
"""Process scene-editor raw chroma-key images into transparent tilepack assets."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

try:
    from PIL import Image
except ImportError as exc:  # pragma: no cover
    raise SystemExit("Pillow is required: python3 -m pip install Pillow") from exc

GREEN_KEY = (0, 255, 0)
DEFAULT_META: dict[str, dict[str, Any]] = {
    "floor_plank_a": {"name": "木地板 A", "layerHint": "floor", "tags": ["floor", "wood", "observer_house"]},
    "floor_plank_worn": {"name": "磨损木地板", "layerHint": "floor", "tags": ["floor", "wood", "worn", "observer_house"]},
    "wall_panel_plain": {"name": "普通后墙板", "layerHint": "wall", "tags": ["wall", "back", "observer_house"]},
    "wall_window_lattice": {"name": "后墙格窗", "layerHint": "wall", "tags": ["wall", "window", "observer_house"]},
    "wall_pillar": {"name": "室内木柱", "layerHint": "wall", "tags": ["wall", "pillar", "observer_house"]},
    "observer_tea_table": {"name": "观察者茶案", "layerHint": "decor", "tags": ["decor", "table", "observer_house"]},
    "strategy_scroll_shelf": {"name": "策略卷轴架", "layerHint": "decor", "tags": ["decor", "shelf", "observer_house"]},
    "front_low_wall": {"name": "前景矮墙", "layerHint": "occluder", "tags": ["front", "occluder", "observer_house"]},
}


def key_distance(pixel: tuple[int, int, int], key: tuple[int, int, int]) -> float:
    return sum((pixel[i] - key[i]) ** 2 for i in range(3)) ** 0.5


def remove_green_and_crop(src: Path, dst: Path, threshold: int, padding: int) -> tuple[int, int]:
    image = Image.open(src).convert("RGBA")
    pixels = image.load()
    width, height = image.size

    min_x, min_y = width, height
    max_x, max_y = -1, -1

    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            if a == 0 or key_distance((r, g, b), GREEN_KEY) <= threshold:
                pixels[x, y] = (r, g, b, 0)
                continue
            min_x = min(min_x, x)
            min_y = min(min_y, y)
            max_x = max(max_x, x)
            max_y = max(max_y, y)

    if max_x < min_x or max_y < min_y:
        raise ValueError(f"no non-green subject found in {src}")

    min_x = max(0, min_x - padding)
    min_y = max(0, min_y - padding)
    max_x = min(width - 1, max_x + padding)
    max_y = min(height - 1, max_y + padding)
    cropped = image.crop((min_x, min_y, max_x + 1, max_y + 1))
    dst.parent.mkdir(parents=True, exist_ok=True)
    cropped.save(dst)
    return cropped.size


def build_tile_record(asset_id: str, filename: str, size: tuple[int, int]) -> dict[str, Any]:
    meta = DEFAULT_META.get(asset_id, {})
    layer_hint = meta.get("layerHint", "decor")
    return {
        "id": asset_id,
        "name": meta.get("name", asset_id),
        "src": f"processed/{filename}",
        "layerHint": layer_hint,
        "origin": {"x": 0.5, "y": 1},
        "scale": 1,
        "sourceSize": {"width": size[0], "height": size[1]},
        "tags": meta.get("tags", [layer_hint]),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--pack", required=True, type=Path, help="Tilepack directory containing raw/ and manifest.json")
    parser.add_argument("--threshold", type=int, default=42, help="RGB distance threshold for #00ff00 removal")
    parser.add_argument("--padding", type=int, default=4, help="Transparent padding retained around cropped subject")
    args = parser.parse_args()

    pack_dir = args.pack
    raw_dir = pack_dir / "raw"
    processed_dir = pack_dir / "processed"
    if not raw_dir.exists():
        raise SystemExit(f"raw directory not found: {raw_dir}")

    tiles = []
    for src in sorted(raw_dir.iterdir()):
        if src.suffix.lower() not in {".png", ".jpg", ".jpeg", ".webp"}:
            continue
        asset_id = src.stem
        dst = processed_dir / f"{asset_id}.png"
        size = remove_green_and_crop(src, dst, args.threshold, args.padding)
        tiles.append(build_tile_record(asset_id, dst.name, size))
        print(f"processed {src.name} -> {dst.relative_to(pack_dir)} {size[0]}x{size[1]}")

    manifest = {
        "schemaVersion": "deepsolo.tilepack.v1",
        "id": pack_dir.name,
        "name": "观察者小屋 v1 贴图包" if pack_dir.name == "observer_house_v1" else pack_dir.name,
        "tileWidth": 64,
        "tileHeight": 32,
        "tiles": tiles,
    }
    manifest_path = pack_dir / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"wrote {manifest_path} with {len(tiles)} tiles")


if __name__ == "__main__":
    main()
