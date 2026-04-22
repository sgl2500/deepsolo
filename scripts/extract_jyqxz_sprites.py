#!/usr/bin/env python3
"""
从 JYQXZ 原版游戏中提取所有素材 (idx/grp -> PNG)

基于 piccache.c 的 RLE 解压算法重写：
  - 读取 .idx 文件获取每个精灵的偏移量
  - 从 .grp 文件中提取数据
  - PNG 格式直接保存，RLE 格式解压后保存为 PNG
  - 使用 Mmap.col 调色板 (256 色，每分量 ×4)
  - 生成 _info.json 元数据文件

用法:
  python3 extract_jyqxz_sprites.py [--source SOURCE_DIR] [--output OUTPUT_DIR] [--categories CAT1,CAT2,...]
"""

import os
import sys
import json
import struct
import argparse
from pathlib import Path
from typing import Optional

try:
    from PIL import Image
except ImportError:
    print("需要 Pillow 库: pip install Pillow")
    sys.exit(1)

# ============================================================
# 调色板加载
# ============================================================

def load_palette(col_path: str) -> list[tuple[int, int, int]]:
    """加载 256 色调色板 (Mmap.col)，每分量 ×4"""
    palette = []
    with open(col_path, 'rb') as f:
        for _ in range(256):
            r, g, b = struct.unpack('BBB', f.read(3))
            palette.append((r * 4, g * 4, b * 4))
    return palette


# ============================================================
# IDX/GRP 读取
# ============================================================

def read_idx(idx_path: str) -> list[int]:
    """读取 .idx 文件，返回偏移量数组 (含前导 0)"""
    with open(idx_path, 'rb') as f:
        data = f.read()
    num = len(data) // 4
    offsets = [0]  # idx[0] = 0
    for i in range(num):
        val = struct.unpack_from('<i', data, i * 4)[0]
        offsets.append(val)
    return offsets


def read_sprite_data(grp_path: str, offsets: list[int], sprite_id: int) -> Optional[bytes]:
    """从 .grp 文件中读取指定精灵的原始数据"""
    if sprite_id < 0 or sprite_id + 1 >= len(offsets):
        return None

    start = offsets[sprite_id]
    end = offsets[sprite_id + 1]

    if start < 0:
        return None

    with open(grp_path, 'rb') as f:
        f.seek(start)
        data = f.read(end - start)

    return data if len(data) > 0 else None


# ============================================================
# RLE 解压 (基于 piccache.c CreatePicSurface32)
# ============================================================

def decode_rle(data: bytes, w: int, h: int, palette: list[tuple[int, int, int]]) -> Image.Image:
    """RLE 解压为 RGBA Image"""
    img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    pixels = img.load()

    p = 0
    data_len = len(data)

    for row in range(h):
        if p >= data_len:
            break

        row_len = data[p]
        start = p
        p += 1

        if row_len == 0:
            continue

        x = 0
        while True:
            if p >= data_len:
                break

            # 跳过透明像素
            x += data[p]
            if x >= w:
                break
            p += 1

            if p >= data_len:
                break

            # 实色像素数量
            solid_count = data[p]
            p += 1

            for _ in range(solid_count):
                if p >= data_len or x >= w:
                    break
                r, g, b = palette[data[p]]
                pixels[x, row] = (r, g, b, 255)
                p += 1
                x += 1

            if x >= w:
                break
            if p - start >= row_len:
                break

        if p + 1 >= data_len:
            break

    return img


# ============================================================
# 单个精灵提取
# ============================================================

def extract_sprite(data: bytes, palette: list[tuple[int, int, int]]):
    """
    提取单个精灵，返回 (Image, xoff, yoff) 或 None
    PNG 数据直接加载，RLE 数据解压
    """
    if data is None or len(data) == 0:
        return None

    # PNG 检测
    if data[:8] == b'\x89PNG\r\n\x1a\n':
        import io
        try:
            img = Image.open(io.BytesIO(data))
            img = img.convert('RGBA')
            w, h = img.size
            return img, w // 2, h
        except Exception:
            return None

    # RLE 格式: 8字节头 + 像素数据
    if len(data) < 8:
        return None

    w = struct.unpack_from('<h', data, 0)[0]
    h = struct.unpack_from('<h', data, 2)[0]
    xoff = struct.unpack_from('<h', data, 4)[0]
    yoff = struct.unpack_from('<h', data, 6)[0]

    if w <= 0 or h <= 0 or w > 2000 or h > 2000:
        return None

    try:
        img = decode_rle(data[8:], w, h, palette)
        return img, xoff, yoff
    except Exception as e:
        return None


# ============================================================
# 归档批量提取
# ============================================================

def extract_archive(idx_path: str, grp_path: str, palette: list[tuple[int, int, int]],
                    output_dir: str, name_prefix: str, zero_padded: int = 4):
    """
    从 idx/grp 归档中提取所有精灵为 PNG
    返回 info 列表
    """
    os.makedirs(output_dir, exist_ok=True)

    offsets = read_idx(idx_path)
    total = len(offsets) - 1  # 减去前导 0
    info_list = []
    extracted = 0
    skipped = 0

    print(f"  共 {total} 个精灵")

    for i in range(total):
        data = read_sprite_data(grp_path, offsets, i)
        if data is None:
            skipped += 1
            continue

        result = extract_sprite(data, palette)
        if result is None:
            skipped += 1
            continue

        img, xoff, yoff = result
        w, h = img.size

        if w == 0 or h == 0:
            skipped += 1
            continue

        filename = f"{i:0{zero_padded}d}.png"
        filepath = os.path.join(output_dir, filename)
        img.save(filepath)

        info_list.append({
            'idx': i,
            'w': w,
            'h': h,
            'xoff': xoff,
            'yoff': yoff,
        })
        extracted += 1

    # 写 _info.json
    info_path = os.path.join(output_dir, '_info.json')
    with open(info_path, 'w') as f:
        json.dump(info_list, f)

    print(f"  提取 {extracted} 个, 跳过 {skipped} 个")
    return info_list


# ============================================================
# 目录类提取定义
# ============================================================

# 归档提取配置: (name, idx_basename, grp_basename, output_subdir, prefix)
ARCHIVE_EXTRACTS = [
    # 名称             idx 文件名        grp 文件名        输出子目录      前缀
    ('smap',           'SMAP.IDX',       'SMAP.GRP',       '10_smap',      'smap'),
    ('mmap',           'Mmap.idx',       'Mmap.grp',       '01_mmap',      'mmap'),
    ('wmap',           'WMAP.idx',       'WMAP.GRP',       '11_wmap',      'wmap'),
    ('thing',          'THING.IDX',      'THING.GRP',      '08_thing',     'thing'),
    ('kdef',           'Kdef.idx',       'Kdef.grp',       '05_kdef',      'kdef'),
    ('allsin',         'Allsin.idx',     'Allsin.grp',     '02_allsin',    'allsin'),
    ('alldef',         'Alldef.idx',     'Alldef.grp',     '03_alldef',    'alldef'),
    ('warfld',         'Warfld.idx',     'Warfld.grp',     '07_warfld',    'warfld'),
    ('ranger',         'Ranger.idx',     'Ranger.grp',     '06_ranger',    'ranger'),
    ('talk',           'talk.idx',       'talk.grp',       '09_talk',      'talk'),
]


def extract_fight(source_data: str, output_base: str, palette: list[tuple[int, int, int]]):
    """提取战斗精灵 (DATA/fight/ 目录下的多个 idx/grp 对)"""
    fight_dir = os.path.join(source_data, 'fight')
    output_dir = os.path.join(output_base, '12_fight')
    os.makedirs(output_dir, exist_ok=True)

    if not os.path.isdir(fight_dir):
        print("  fight 目录不存在，跳过")
        return

    # 找到所有 Fight*.idx 文件
    fight_files = sorted([f for f in os.listdir(fight_dir) if f.endswith('.idx')])

    for idx_file in fight_files:
        name = idx_file.replace('.idx', '').replace('.IDX', '')
        grp_file = idx_file.replace('.idx', '.grp').replace('.IDX', '.GRP')

        idx_path = os.path.join(fight_dir, idx_file)
        grp_path = os.path.join(fight_dir, grp_file)

        if not os.path.exists(grp_path):
            # 尝试大写
            grp_path = os.path.join(fight_dir, grp_file.upper())

        if not os.path.exists(grp_path):
            print(f"  {name}: grp 文件不存在，跳过")
            continue

        sub_output = os.path.join(output_dir, name)
        print(f"  提取 fight/{name}...")
        extract_archive(idx_path, grp_path, palette, sub_output, name)


def extract_eft(source_data: str, output_base: str, palette: list[tuple[int, int, int]]):
    """提取武功特效 (DATA/eft/ 目录下的多个 idx/grp 对)"""
    eft_dir = os.path.join(source_data, 'eft')
    output_dir = os.path.join(output_base, '13_eft')
    os.makedirs(output_dir, exist_ok=True)

    if not os.path.isdir(eft_dir):
        print("  eft 目录不存在，跳过")
        return

    eft_files = sorted([f for f in os.listdir(eft_dir) if f.endswith('.idx')])

    for idx_file in eft_files:
        name = idx_file.replace('.idx', '').replace('.IDX', '')
        grp_file = idx_file.replace('.idx', '.grp').replace('.IDX', '.GRP')

        idx_path = os.path.join(eft_dir, idx_file)
        grp_path = os.path.join(eft_dir, grp_file)

        if not os.path.exists(grp_path):
            grp_path = os.path.join(eft_dir, grp_file.upper())

        if not os.path.exists(grp_path):
            continue

        sub_output = os.path.join(output_dir, name)
        print(f"  提取 eft/{name}...")
        extract_archive(idx_path, grp_path, palette, sub_output, name)


def copy_png_dir(source_dir: str, output_dir: str, name: str):
    """直接复制 PNG 目录（如 head, mhead）"""
    os.makedirs(output_dir, exist_ok=True)

    if not os.path.isdir(source_dir):
        print(f"  {name}: 源目录不存在，跳过")
        return

    files = [f for f in os.listdir(source_dir) if f.endswith('.png')]
    info_list = []

    for f in sorted(files):
        src = os.path.join(source_dir, f)
        dst = os.path.join(output_dir, f)

        # 复制文件
        with open(src, 'rb') as sf:
            data = sf.read()
        with open(dst, 'wb') as df:
            df.write(data)

        # 获取尺寸
        try:
            img = Image.open(src)
            w, h = img.size
            base = f.replace('.png', '')
            idx = int(base) if base.isdigit() else 0
            info_list.append({
                'idx': idx,
                'w': w,
                'h': h,
                'xoff': w // 2,
                'yoff': h,
            })
        except Exception:
            pass

    info_path = os.path.join(output_dir, '_info.json')
    with open(info_path, 'w') as f:
        json.dump(info_list, f)

    print(f"  {name}: 复制 {len(files)} 个 PNG")


# ============================================================
# 16_walk 和 17_npc_map 特殊处理
# ============================================================

def extract_walk_sprites(source_data: str, output_base: str, palette: list[tuple[int, int, int]]):
    """
    提取行走动画精灵。
    Walk 数据可能在 Allsin 中或其他位置。
    当前 jy-assets/16_walk 已有 PNG，检查是否需要重新提取。
    """
    walk_output = os.path.join(output_base, '16_walk')
    os.makedirs(walk_output, exist_ok=True)
    print("  16_walk: 保留现有文件 (walk 精灵来源于角色数据提取)")


def extract_npc_map(source_data: str, output_base: str, palette: list[tuple[int, int, int]]):
    """
    提取 NPC 地图精灵。
    从 SMAP 中提取特定编号的 NPC 精灵。
    """
    npc_output = os.path.join(output_base, '17_npc_map')
    os.makedirs(npc_output, exist_ok=True)
    print("  17_npc_map: 保留现有文件 (NPC 精灵来源于 SMAP 提取)")


# ============================================================
# 主提取流程
# ============================================================

def main():
    parser = argparse.ArgumentParser(description='从 JYQXZ 原版游戏中提取所有素材')
    parser.add_argument('--source', default='../../JYQXZ/jyqxz/Release/DATA',
                        help='原版游戏 DATA 目录路径')
    parser.add_argument('--output', default='../packages/visual/public/assets/jy-assets',
                        help='输出目录')
    parser.add_argument('--categories', default=None,
                        help='只提取指定类别 (逗号分隔): smap,mmap,wmap,thing,kdef,allsin,alldef,warfld,ranger,talk,fight,eft,head,mhead')
    args = parser.parse_args()

    source = os.path.abspath(args.source)
    output = os.path.abspath(args.output)

    if not os.path.isdir(source):
        print(f"源目录不存在: {source}")
        sys.exit(1)

    # 加载调色板
    col_path = os.path.join(source, 'Mmap.col')
    if not os.path.exists(col_path):
        print(f"调色板文件不存在: {col_path}")
        sys.exit(1)

    print(f"调色板: {col_path}")
    palette = load_palette(col_path)
    print(f"  加载 {len(palette)} 色调色板")

    # 类别过滤
    cats = None
    if args.categories:
        cats = set(args.categories.split(','))

    # 提取主归档
    for name, idx_file, grp_file, subdir, prefix in ARCHIVE_EXTRACTS:
        if cats and name not in cats:
            continue

        idx_path = os.path.join(source, idx_file)
        grp_path = os.path.join(source, grp_file)

        # 尝试大小写变体
        if not os.path.exists(idx_path):
            idx_path = os.path.join(source, idx_file.upper())
        if not os.path.exists(grp_path):
            grp_path = os.path.join(source, grp_file.upper())

        if not os.path.exists(idx_path) or not os.path.exists(grp_path):
            print(f"  {name}: 文件不存在，跳过")
            continue

        print(f"\n提取 {name} ({idx_file})...")
        out_dir = os.path.join(output, subdir)
        extract_archive(idx_path, grp_path, palette, out_dir, prefix)

    # 提取 fight 子目录
    if not cats or 'fight' in cats:
        print(f"\n提取 fight...")
        extract_fight(source, output, palette)

    # 提取 eft 子目录
    if not cats or 'eft' in cats:
        print(f"\n提取 eft...")
        extract_eft(source, output, palette)

    # 复制 PNG 目录
    if not cats or 'head' in cats:
        print(f"\n复制 head...")
        copy_png_dir(os.path.join(source, 'head'), os.path.join(output, '14_head'), 'head')

    if not cats or 'mhead' in cats:
        print(f"\n复制 mhead...")
        copy_png_dir(os.path.join(source, 'mhead'), os.path.join(output, '15_mhead'), 'mhead')

    print("\n完成!")


if __name__ == '__main__':
    main()
