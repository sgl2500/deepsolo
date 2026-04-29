#!/usr/bin/env python3

import json
from pathlib import Path
from typing import Dict, List, Tuple

from PIL import Image, ImageChops, ImageColor, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[1]
SMAP_DIR = ROOT / "packages/visual/public/assets/jy-runtime/10_smap"
MAP_PATH = ROOT / "packages/visual/public/assets/maps/indoor/indoor_birth_house.json"
OUT_DIR = ROOT / "packages/visual/docs/previews"

TILE_HALF_W = 18
TILE_HALF_H = 9
CUSTOM_OFFSETS: Dict[int, Tuple[int, int]] = {
    9501: (20, 64),
    9502: (24, 33),
    9503: (12, 46),
    9510: (18, 17),
    9511: (18, 17),
    9512: (18, 17),
    9513: (18, 17),
    9514: (18, 17),
    9515: (18, 17),
    9520: (18, 46),
    9521: (18, 46),
    9522: (18, 46),
    9523: (18, 64),
    9524: (18, 64),
    9525: (18, 64),
    9526: (18, 34),
    9527: (18, 34),
    9528: (18, 28),
    9529: (18, 54),
    9530: (18, 54),
    9531: (18, 46),
    9532: (18, 46),
    9533: (18, 23),
    9534: (18, 24),
}

PALETTE = {
    "bg0": "#1b1713",
    "bg1": "#2c241f",
    "panel": "#231d18",
    "panel_edge": "#5a4737",
    "ink": "#f0e4ca",
    "muted": "#c5ae8d",
    "accent": "#b64338",
    "gold": "#ddb061",
}


def load_json(path: Path):
    return json.loads(path.read_text())


def load_font(size: int) -> ImageFont.ImageFont:
    candidates = [
        "/System/Library/Fonts/PingFang.ttc",
        "/System/Library/Fonts/Hiragino Sans GB.ttc",
        "/System/Library/Fonts/STHeiti Light.ttc",
        "/System/Library/Fonts/Supplemental/Songti.ttc",
    ]
    for candidate in candidates:
        font_path = Path(candidate)
        if font_path.exists():
            try:
                return ImageFont.truetype(str(font_path), size)
            except OSError:
                continue
    return ImageFont.load_default()


def rounded_panel(size: Tuple[int, int], radius: int = 28) -> Image.Image:
    img = Image.new("RGBA", size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    draw.rounded_rectangle(
        (0, 0, size[0] - 1, size[1] - 1),
        radius=radius,
        fill=ImageColor.getrgb(PALETTE["panel"]) + (245,),
        outline=ImageColor.getrgb(PALETTE["panel_edge"]) + (255,),
        width=2,
    )
    return img


def add_shadow(img: Image.Image, blur: int = 18, offset: Tuple[int, int] = (0, 16), alpha: int = 120) -> Image.Image:
    shadow = Image.new("RGBA", (img.width + blur * 4, img.height + blur * 4), (0, 0, 0, 0))
    solid = Image.new("RGBA", img.size, (0, 0, 0, alpha))
    shadow.alpha_composite(solid, (blur * 2 + offset[0], blur * 2 + offset[1]))
    shadow = shadow.filter(ImageFilter.GaussianBlur(blur))
    out = Image.new("RGBA", shadow.size, (0, 0, 0, 0))
    out.alpha_composite(shadow, (0, 0))
    out.alpha_composite(img, (blur * 2, blur * 2))
    return out


def build_offsets() -> Dict[int, Tuple[int, int]]:
    offsets = {}
    info = load_json(SMAP_DIR / "_info.json")
    for item in info:
        offsets[item["idx"]] = (item["xoff"], item["yoff"])
    offsets.update(CUSTOM_OFFSETS)
    return offsets


def load_tile(tile_id: int, scale: int, cache: Dict[Tuple[int, int], Image.Image]) -> Image.Image | None:
    key = (tile_id, scale)
    if key in cache:
        return cache[key]
    path = SMAP_DIR / f"{tile_id:04d}.png"
    if not path.exists():
        return None
    src = Image.open(path).convert("RGBA")
    tile = src.resize((src.width * scale, src.height * scale), Image.Resampling.NEAREST)
    cache[key] = tile
    return tile


def render_room(map_data: dict, scale: int = 4) -> Image.Image:
    offsets = build_offsets()
    cache: Dict[Tuple[int, int], Image.Image] = {}
    width = 1800
    height = 1300
    ox = width // 2
    oy = 240
    img = Image.new("RGBA", (width, height), (0, 0, 0, 0))

    roof_yoff = max(
        offsets.get(map_data["surface"][r][c], (18, 17))[1]
        for r in range(map_data["height"])
        for c in range(map_data["width"])
        if map_data["surface"][r][c]
    )
    roof_offset = roof_yoff * scale - 20 * scale
    cx = map_data["cx"]
    cy = map_data["cy"]

    def pos(col: int, row: int) -> Tuple[int, int]:
        sx = TILE_HALF_W * scale * ((col - cx) - (row - cy)) + ox
        sy = TILE_HALF_H * scale * ((col - cx) + (row - cy)) + oy
        return int(sx), int(sy)

    for layer in ("earth", "surface"):
        for row in range(map_data["height"]):
            for col in range(map_data["width"]):
                tile_id = map_data[layer][row][col]
                if not tile_id:
                    continue
                tile = load_tile(tile_id, scale, cache)
                if tile is None:
                    continue
                xoff, yoff = offsets.get(tile_id, (18, 17))
                sx, sy = pos(col, row)
                dy = map_data["surfaceHeight"][row][col] * scale
                img.alpha_composite(tile, (sx - xoff * scale, sy - yoff * scale - dy))

    for row in range(map_data["height"]):
        for col in range(map_data["width"]):
            tile_id = map_data["building"][row][col]
            if not tile_id:
                continue
            tile = load_tile(tile_id, scale, cache)
            if tile is None:
                continue
            xoff, yoff = offsets.get(tile_id, (18, 17))
            is_wall = yoff > 30 and tile_id != 622
            sx, sy = pos(col, row)
            dy = map_data["surfaceHeight"][row][col] * scale
            extra_y = 0 if is_wall else roof_offset
            img.alpha_composite(tile, (sx - xoff * scale, sy - yoff * scale - dy - extra_y))

    return img


def add_lighting(room: Image.Image) -> Image.Image:
    glow = Image.new("RGBA", room.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(glow)
    warm = ImageColor.getrgb("#f2b466")
    draw.ellipse((930, 640, 1240, 980), fill=warm + (52,))
    draw.ellipse((760, 340, 1120, 760), fill=(255, 206, 120, 36))
    glow = glow.filter(ImageFilter.GaussianBlur(36))

    vignette = Image.new("L", room.size, 0)
    vdraw = ImageDraw.Draw(vignette)
    vdraw.rectangle((0, 0, room.width, room.height), fill=120)
    vdraw.ellipse((-180, -60, room.width + 180, room.height + 220), fill=10)
    vignette = ImageChops.invert(vignette).filter(ImageFilter.GaussianBlur(90))

    shaded = Image.new("RGBA", room.size, (0, 0, 0, 0))
    shaded.alpha_composite(room, (0, 0))
    shaded.alpha_composite(glow, (0, 0))

    dark = Image.new("RGBA", room.size, (12, 8, 6, 36))
    shaded = Image.composite(shaded, Image.alpha_composite(shaded, dark), vignette)
    return shaded


def render_direction_panel(room: Image.Image) -> Image.Image:
    size = (1450, 900)
    bg = Image.new("RGBA", size, ImageColor.getrgb("#211913") + (255,))
    overlay = Image.new("RGBA", size, (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    od.ellipse((-200, -120, 620, 620), fill=ImageColor.getrgb("#62362b") + (96,))
    od.ellipse((900, -80, 1550, 540), fill=ImageColor.getrgb("#7a5329") + (60,))
    od.ellipse((480, 520, 1180, 1080), fill=ImageColor.getrgb("#322019") + (82,))
    bg.alpha_composite(overlay, (0, 0))

    room = room.crop((110, 40, 1670, 1110)).resize((1300, 792), Image.Resampling.LANCZOS)
    bg.alpha_composite(room, (82, 82))

    border = Image.new("RGBA", size, (0, 0, 0, 0))
    ImageDraw.Draw(border).rounded_rectangle(
        (0, 0, size[0] - 1, size[1] - 1),
        radius=34,
        outline=ImageColor.getrgb(PALETTE["panel_edge"]) + (255,),
        width=2,
    )
    bg.alpha_composite(border, (0, 0))

    draw = ImageDraw.Draw(bg)
    title = load_font(44)
    text = load_font(22)
    label = load_font(20)

    draw.text((70, 28), "公共观察者小屋 - 完整方向图", font=title, fill=PALETTE["ink"])
    draw.text((70, 820), "目标：先定空间气质、家具关系和武侠世界的生活感，再往下拆成可复用贴图。", font=text, fill=PALETTE["muted"])

    tags = [
        ("休息区 / 木榻", (340, 208)),
        ("中庭 / 地毯", (650, 408)),
        ("公共长案", (780, 538)),
        ("屋规告示", (520, 598)),
        ("藏卷书架", (1110, 230)),
    ]
    for text_value, xy in tags:
        x, y = xy
        box = rounded_panel((156, 34), radius=14)
        tint = Image.new("RGBA", box.size, ImageColor.getrgb(PALETTE["accent"]) + (168,))
        bubble = Image.alpha_composite(box, tint)
        bg.alpha_composite(bubble, (x, y))
        ImageDraw.Draw(bg).text((x + 14, y + 7), text_value, font=label, fill=PALETTE["ink"])

    return bg


def render_tile_library() -> Image.Image:
    sections: List[Tuple[str, List[int]]] = [
        ("地面", [9510, 9511, 9512, 9513, 9514, 9515]),
        ("木榻", [9520, 9521, 9522, 9534]),
        ("书架", [9523, 9524, 9525]),
        ("长案", [9526, 9527, 9528]),
        ("屏风", [9529, 9530]),
        ("告示/火盆", [9531, 9532, 9533]),
    ]

    card_w = 1550
    card_h = 960
    img = rounded_panel((card_w, card_h), radius=34)
    draw = ImageDraw.Draw(img)
    title = load_font(44)
    sub = load_font(22)
    small = load_font(18)
    draw.text((68, 28), "小屋独立贴图库 - 可评审稿", font=title, fill=PALETTE["ink"])
    draw.text((68, 82), "这不是最后入库版，而是给你先看“是否值得继续按这个语言拆贴图”的中间稿。", font=sub, fill=PALETTE["muted"])

    x0 = 60
    y0 = 150
    section_gap = 110
    tile_cache: Dict[int, Image.Image] = {}

    for idx, (name, ids) in enumerate(sections):
        sy = y0 + idx * section_gap
        draw.text((x0, sy - 34), name, font=sub, fill=PALETTE["gold"])
        for j, tile_id in enumerate(ids):
            tx = x0 + j * 150
            card = rounded_panel((126, 92), radius=18)
            inner = Image.new("RGBA", card.size, ImageColor.getrgb("#43362d") + (255,))
            card = Image.alpha_composite(card, inner)
            img.alpha_composite(card, (tx, sy))
            if tile_id not in tile_cache:
                src = Image.open(SMAP_DIR / f"{tile_id:04d}.png").convert("RGBA")
                scale = min(92 / max(src.width, 1), 52 / max(src.height, 1))
                scale = min(scale, 4.0)
                thumb = src.resize(
                    (max(1, int(src.width * scale)), max(1, int(src.height * scale))),
                    Image.Resampling.NEAREST,
                )
                tile_cache[tile_id] = thumb
            thumb = tile_cache[tile_id]
            img.alpha_composite(thumb, (tx + (126 - thumb.width) // 2, sy + 12))
            draw.text((tx + 12, sy + 64), str(tile_id), font=small, fill=PALETTE["ink"])

    notes_y = 858
    draw.rounded_rectangle((56, notes_y - 16, 1494, 926), radius=18, fill=ImageColor.getrgb("#2e241d") + (255,))
    notes = [
        "1. 先用这一套把“像不像一个真实武侠屋子”做对，再决定哪些块要继续精修。",
        "2. 这批资产已经按功能分组，后面能平移到茶馆、书屋、议事屋。",
        "3. 下一步如果你认可方向，我会把母图继续推到更完整，再做正式切图版。",
    ]
    for i, line in enumerate(notes):
        draw.text((84, notes_y + i * 20), line, font=small, fill=PALETTE["muted"])

    return img


def render_assembly_preview(room: Image.Image) -> Image.Image:
    panel = rounded_panel((1450, 860), radius=34)
    bg = Image.new("RGBA", panel.size, ImageColor.getrgb("#181310") + (255,))
    draw = ImageDraw.Draw(bg)
    title = load_font(44)
    sub = load_font(22)
    small = load_font(18)
    draw.text((68, 28), "贴图库拼装预览", font=title, fill=PALETTE["ink"])
    draw.text((68, 82), "这里看的是“这套块拼回房间后，整体是不是成立”，不看走路和交互。", font=sub, fill=PALETTE["muted"])

    crop = room.crop((120, 90, 1660, 1010)).resize((1240, 720), Image.Resampling.LANCZOS)
    frame = rounded_panel((1260, 740), radius=28)
    bg.alpha_composite(frame, (88, 106))
    bg.alpha_composite(crop, (98, 116))

    draw.rounded_rectangle((88, 786, 1360, 832), radius=18, fill=ImageColor.getrgb("#2c221c") + (255,))
    draw.text((112, 799), "当前重点：床看起来像床、书架像书架、长案像长案，且都属于同一个世界。", font=small, fill=PALETTE["gold"])

    return Image.alpha_composite(panel, bg)


def build_pitch_board(direction: Image.Image, library: Image.Image, assembly: Image.Image) -> Image.Image:
    board = Image.new("RGBA", (1600, 2920), ImageColor.getrgb(PALETTE["bg0"]) + (255,))
    grad = Image.new("RGBA", board.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(grad)
    draw.ellipse((-240, -160, 900, 900), fill=ImageColor.getrgb("#472820") + (120,))
    draw.ellipse((980, -120, 1820, 760), fill=ImageColor.getrgb("#6a4a25") + (72,))
    draw.ellipse((240, 2040, 1500, 3240), fill=ImageColor.getrgb("#2f1f1a") + (120,))
    board.alpha_composite(grad, (0, 0))

    title = load_font(58)
    sub = load_font(24)
    top = ImageDraw.Draw(board)
    top.text((86, 54), "观察者小屋 - 母图 / 贴图库 / 拼装预览", font=title, fill=PALETTE["ink"])
    top.text((88, 124), "先看美术母体是否成立，再决定要不要正式切成游戏里的模块贴图。", font=sub, fill=PALETTE["muted"])

    panels = [
        add_shadow(direction, blur=22, offset=(0, 18), alpha=150),
        add_shadow(library, blur=22, offset=(0, 18), alpha=150),
        add_shadow(assembly, blur=22, offset=(0, 18), alpha=150),
    ]
    y = 190
    for panel in panels:
        board.alpha_composite(panel, (56, y))
        y += panel.height + 54

    footer = "产物用途：先让你确认方向；确认后我再按这套语言继续精修、重切、落到游戏。"
    top.text((88, 2848), footer, font=sub, fill=PALETTE["gold"])
    return board


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    map_data = load_json(MAP_PATH)
    room = render_room(map_data, scale=4)
    direction = render_direction_panel(room)
    library = render_tile_library()
    assembly = render_assembly_preview(room)
    pitch = build_pitch_board(direction, library, assembly)

    direction_path = OUT_DIR / "birth_house_direction_render.png"
    library_path = OUT_DIR / "birth_house_tile_library.png"
    assembly_path = OUT_DIR / "birth_house_assembly_preview.png"
    board_path = OUT_DIR / "birth_house_pitch_board.png"

    direction.save(direction_path)
    library.save(library_path)
    assembly.save(assembly_path)
    pitch.save(board_path)

    print(direction_path)
    print(library_path)
    print(assembly_path)
    print(board_path)


if __name__ == "__main__":
    main()
