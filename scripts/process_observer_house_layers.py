#!/usr/bin/env python3

from __future__ import annotations

import json
from pathlib import Path
from typing import Iterable

from PIL import Image, ImageDraw, ImageOps


ROOT = Path(__file__).resolve().parents[1]
ASSET_ROOT = Path("/Users/sunguanlong/Desktop/AIGC/assets-library/deepsolo/observer_house/v3")
RAW_DIR = ASSET_ROOT / "raw"
CUTOUT_DIR = ASSET_ROOT / "cutouts"
RUNTIME_DIR = ROOT / "packages/visual/public/assets/rooms/observer_house"
PREVIEW_DIR = ASSET_ROOT / "preview"
V2_RUNTIME_DIR = Path("/Users/sunguanlong/Desktop/AIGC/assets-library/deepsolo/observer_house/v2/runtime")
GREEN = (0, 255, 0)
TOLERANCE = 70

RUNTIME_FILES = {
    "room_master": "room_master.png",
    "floor_base": "floor_base.png",
    "back_shell": "back_shell.png",
    "front_occluder": "front_occluder.png",
}


def find_source(layer_name: str) -> Path:
    layer_dir = RAW_DIR / layer_name
    preferred = layer_dir / f"{layer_name}.png"
    if preferred.exists():
        return preferred

    candidates = sorted(layer_dir.glob("*.png"))
    if not candidates:
        raise FileNotFoundError(f"no png found for layer {layer_name} in {layer_dir}")
    return candidates[0]


def is_green(pixel: tuple[int, int, int, int]) -> bool:
    r, g, b, a = pixel
    if a == 0:
        return True
    if g >= 180 and g - r >= 70 and g - b >= 70:
        return True
    return (
        abs(r - GREEN[0]) <= TOLERANCE
        and abs(g - GREEN[1]) <= TOLERANCE
        and abs(b - GREEN[2]) <= TOLERANCE
    )


def remove_green(image: Image.Image) -> Image.Image:
    img = image.convert("RGBA")
    pixels = img.load()
    for y in range(img.height):
        for x in range(img.width):
            pixel = pixels[x, y]
            if is_green(pixel):
                pixels[x, y] = (0, 0, 0, 0)
    bbox = img.getbbox()
    return img.crop(bbox) if bbox else img


def save_named(image: Image.Image, file_name: str) -> Path:
    cutout_path = CUTOUT_DIR / file_name
    runtime_path = RUNTIME_DIR / file_name
    image.save(cutout_path)
    image.save(runtime_path)
    return runtime_path


def masked(image: Image.Image, polygon: list[tuple[int, int]], invert: bool = False) -> Image.Image:
    mask = Image.new("L", image.size, 0 if not invert else 255)
    draw = ImageDraw.Draw(mask)
    draw.polygon(polygon, fill=255 if not invert else 0)
    out = Image.new("RGBA", image.size, (0, 0, 0, 0))
    out.paste(image, (0, 0), mask)
    bbox = out.getbbox()
    return out.crop(bbox) if bbox else out


def derive_floor_and_back(master: Image.Image) -> tuple[Image.Image, Image.Image]:
    w, h = master.size
    floor_polygon = [
        (0, int(h * 0.71)),
        (int(w * 0.11), int(h * 0.64)),
        (int(w * 0.39), int(h * 0.50)),
        (int(w * 0.50), int(h * 0.45)),
        (int(w * 0.61), int(h * 0.50)),
        (int(w * 0.89), int(h * 0.64)),
        (w, int(h * 0.71)),
        (w, int(h * 0.90)),
        (int(w * 0.50), h),
        (0, int(h * 0.90)),
    ]
    floor = masked(master, floor_polygon, invert=False)
    back = masked(master, floor_polygon, invert=True)
    return floor, back


def compose_front_occluder(source: Image.Image) -> Image.Image:
    left = ImageOps.mirror(source)
    right = source
    gap = int(source.width * 0.14)
    canvas_w = left.width + gap + right.width
    canvas_h = max(left.height, right.height)
    canvas = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))
    canvas.alpha_composite(left, (0, canvas_h - left.height))
    canvas.alpha_composite(right, (left.width + gap, canvas_h - right.height))

    # Add a pair of doorway posts so the center gap reads as an actual entrance.
    post = source.crop((0, int(source.height * 0.46), int(source.width * 0.10), source.height))
    post_x_left = left.width - int(source.width * 0.05) - post.width
    post_x_right = left.width + gap + int(source.width * 0.05)
    post_y = canvas_h - post.height
    canvas.alpha_composite(post, (post_x_left, post_y))
    canvas.alpha_composite(post, (post_x_right, post_y))

    bbox = canvas.getbbox()
    return canvas.crop(bbox) if bbox else canvas


def alpha_composite_center(
    canvas: Image.Image,
    layer: Image.Image,
    center_x: int,
    bottom_y: int,
    scale: float,
) -> None:
    target_w = max(1, int(layer.width * scale))
    target_h = max(1, int(layer.height * scale))
    resized = layer.resize((target_w, target_h), Image.Resampling.LANCZOS)
    x = center_x - resized.width // 2
    y = bottom_y - resized.height
    canvas.alpha_composite(resized, (x, y))


def build_preview(layer_paths: dict[str, Path]) -> Path:
    preview = Image.new("RGBA", (1280, 720), (36, 24, 18, 255))
    floor = Image.open(layer_paths["floor_base"]).convert("RGBA")
    back = Image.open(layer_paths["back_shell"]).convert("RGBA")
    front = Image.open(layer_paths["front_occluder"]).convert("RGBA")

    alpha_composite_center(preview, floor, center_x=640, bottom_y=606, scale=0.42)
    alpha_composite_center(preview, back, center_x=640, bottom_y=604, scale=0.42)

    furniture_specs: Iterable[tuple[str, int, int, float]] = [
        ("bed.png", 348, 418, 0.68),
        ("chest.png", 308, 470, 0.62),
        ("table.png", 640, 474, 0.66),
        ("bookshelf.png", 840, 316, 0.66),
        ("screen.png", 946, 372, 0.61),
        ("lantern.png", 986, 410, 0.62),
    ]
    for file_name, center_x, bottom_y, scale in furniture_specs:
        path = V2_RUNTIME_DIR / file_name
        if not path.exists():
            continue
        sprite = Image.open(path).convert("RGBA")
        alpha_composite_center(preview, sprite, center_x=center_x, bottom_y=bottom_y, scale=scale)

    alpha_composite_center(preview, front, center_x=640, bottom_y=660, scale=0.28)

    preview_path = PREVIEW_DIR / "observer_house_v3_mockup.png"
    preview.save(preview_path)
    return preview_path


def main() -> None:
    room_master = remove_green(Image.open(find_source("floor_base")))
    front_source = remove_green(Image.open(RAW_DIR / "front_occluder_wide" / "image_01.png"))
    front = compose_front_occluder(front_source)

    floor, back = derive_floor_and_back(room_master)

    layer_paths: dict[str, Path] = {
        "room_master": save_named(room_master, RUNTIME_FILES["room_master"]),
        "floor_base": save_named(floor, RUNTIME_FILES["floor_base"]),
        "back_shell": save_named(back, RUNTIME_FILES["back_shell"]),
        "front_occluder": save_named(front, RUNTIME_FILES["front_occluder"]),
    }

    preview_path = build_preview(layer_paths)
    manifest = {
        "runtime": {key: str(path) for key, path in layer_paths.items()},
        "preview": str(preview_path),
    }
    (ASSET_ROOT / "metadata" / "runtime_manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(json.dumps(manifest, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
