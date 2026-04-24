#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from PIL import Image


@dataclass
class WallModule:
    name: str
    x0: int
    x1: int
    y0: int
    y1: int


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Slice a shell image into reusable wall modules and emit a manifest.",
    )
    parser.add_argument("--profile", required=True, help="Path to a JSON profile.")
    return parser.parse_args()


def ensure_parent(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)


def load_profile(profile_path: Path) -> dict[str, Any]:
    with profile_path.open("r", encoding="utf-8") as fh:
        return json.load(fh)


def build_module_list(profile: dict[str, Any], width: int, height: int) -> list[WallModule]:
    modules: list[WallModule] = []
    for item in profile["modules"]:
        modules.append(
            WallModule(
                name=item["name"],
                x0=max(0, int(item.get("x0", 0))),
                x1=min(width, int(item.get("x1", width))),
                y0=max(0, int(item.get("y0", 0))),
                y1=min(height, int(item.get("y1", height))),
            )
        )
    return modules


def alpha_bbox(image: Image.Image) -> tuple[int, int, int, int] | None:
    return image.getchannel("A").getbbox()


def paste_alpha(target: Image.Image, source: Image.Image, at_x: int, at_y: int) -> None:
    target.alpha_composite(source, (at_x, at_y))


def build_sheet(images: list[tuple[str, Image.Image]]) -> Image.Image:
    if not images:
        return Image.new("RGBA", (1, 1), (0, 0, 0, 0))

    padding = 24
    label_h = 24
    width = sum(img.width for _, img in images) + padding * (len(images) + 1)
    height = max(img.height for _, img in images) + padding * 2 + label_h
    sheet = Image.new("RGBA", (width, height), (18, 12, 10, 255))

    cursor_x = padding
    for name, img in images:
        paste_alpha(sheet, img, cursor_x, padding)
        cursor_x += img.width + padding

    return sheet


def main() -> None:
    args = parse_args()
    profile_path = Path(args.profile).resolve()
    profile = load_profile(profile_path)

    source_path = Path(profile["source"]).resolve()
    runtime_dir = Path(profile["runtime_dir"]).resolve()
    preview_recompose_path = Path(profile["preview_recompose"]).resolve()
    preview_sheet_path = Path(profile["preview_sheet"]).resolve()
    manifest_path = Path(profile["manifest"]).resolve()

    runtime_dir.mkdir(parents=True, exist_ok=True)
    ensure_parent(preview_recompose_path)
    ensure_parent(preview_sheet_path)
    ensure_parent(manifest_path)

    source = Image.open(source_path).convert("RGBA")
    width, height = source.size
    modules = build_module_list(profile, width, height)

    recompose = Image.new("RGBA", source.size, (0, 0, 0, 0))
    sheet_items: list[tuple[str, Image.Image]] = []
    manifest_modules: list[dict[str, Any]] = []

    for module in modules:
        slice_image = source.crop((module.x0, module.y0, module.x1, module.y1))
        bbox = alpha_bbox(slice_image)
        if bbox is None:
            continue

        tight = slice_image.crop(bbox)
        out_name = f"{module.name}.png"
        out_path = runtime_dir / out_name
        tight.save(out_path)

        abs_x = module.x0 + bbox[0]
        abs_y = module.y0 + bbox[1]
        paste_alpha(recompose, tight, abs_x, abs_y)
        sheet_items.append((module.name, tight))

        manifest_modules.append(
            {
                "name": module.name,
                "file": out_name,
                "sourceRect": {
                    "x": abs_x,
                    "y": abs_y,
                    "width": tight.width,
                    "height": tight.height,
                },
            }
        )

    recompose.save(preview_recompose_path)
    build_sheet(sheet_items).save(preview_sheet_path)

    manifest = {
        "profile": profile.get("name", profile_path.stem),
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "source": str(source_path),
        "sourceSize": {"width": width, "height": height},
        "runtimeDir": str(runtime_dir),
        "modules": manifest_modules,
    }
    with manifest_path.open("w", encoding="utf-8") as fh:
        json.dump(manifest, fh, ensure_ascii=False, indent=2)
        fh.write("\n")


if __name__ == "__main__":
    main()
