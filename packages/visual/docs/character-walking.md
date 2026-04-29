# DeepSolo 策略世界 - 人物行走实现文档

## 概述

在金庸群侠传（JYQXZ）等角地图上实现可操控角色的四方向行走动画。所有角色素材均来源于原版游戏的 `Mmap.grp` 文件，与地图瓦片共用同一套 RLE 编码格式。

## 数据源

所有素材均位于原版游戏数据目录：
```
/Users/sunguanlong/Desktop/AIGC/JYQXZ/jyqxz/Release/DATA/
├── Mmap.grp    # 地图瓦片 + 角色行走精灵（RLE 压缩格式）
├── Mmap.idx    # 精灵偏移索引
└── Mmap.col    # 256 色调色板（每分量 6bit，使用时 ×4 转 8bit）
```

## 行走精灵原理

### 索引公式

来源于游戏脚本 `SCRIPT/jyconst.lua` 和 `SCRIPT/jymain.lua`：

```lua
CC.MyStartPic = 2501   -- 主角行走起始图号

function GetMyPic()
    n = CC.MyStartPic + JY.Base["人物方向"] * 7 + JY.MyCurrentPic
    return n
end
```

**公式：`tile_index = 2501 + direction × 7 + frame`**

- `direction`：方向编号，0-3（共4个方向）
- `frame`：行走帧编号，0-6（每方向7帧行走动画）
- 总计：4方向 × 7帧 = **28 张精灵**

### 方向映射

来源于 `SCRIPT/jymain.lua` 中的按键处理：

| 按键 | direction | 朝向 | 起始 tile |
|------|-----------|------|-----------|
| ↑ (W) | 0 | 上 | 2501 |
| → (D) | 1 | 右 | 2508 |
| ← (A) | 2 | 左 | 2515 |
| ↓ (S) | 3 | 下 | 2522 |

### 精灵尺寸

原始尺寸约 **15×39 像素**，前端以 5 倍缩放显示（约 75×195 像素），并通过 `setScale(0.6)` 最终呈现约 **45×117 像素**。

每张精灵包含 8 字节头部：

| 偏移 | 类型 | 含义 |
|------|------|------|
| 0-1 | uint16 | 宽度 (w) |
| 2-3 | uint16 | 高度 (h) |
| 4-5 | int16 | X 偏移 (xoff) - 精灵锚点 X |
| 6-7 | int16 | Y 偏移 (yoff) - 精灵锚点 Y（脚底位置） |

行走精灵的典型偏移值：`xoff ≈ 5-50, yoff ≈ 44`（yoff 大于精灵高度，脚底位于锚点位置）。

## RLE 解码算法

Mmap.grp 使用行级 RLE 压缩，每行数据格式：

```
[行长度字节] [跳过像素数] [实心像素数] [像素颜色索引...] ... 循环
```

Python 解码核心代码：

```python
def decode_tile(grp_data, offsets, tile_index, palette):
    start = offsets[tile_index]
    end = offsets[tile_index + 1]
    data = grp_data[start:end]

    w, h = unpack('<HH', data[0:4])
    xoff, yoff = unpack('<hh', data[4:8])

    img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    pixels = img.load()
    rle = data[8:]
    p = 0

    for row in range(h):
        row_len = rle[p]; rs = p; p += 1
        if row_len > 0:
            x = 0
            while True:
                x += rle[p]; p += 1       # 跳过透明像素
                if x >= w: break
                solid = rle[p]; p += 1     # 实心像素数量
                for j in range(solid):
                    color = palette[rle[p]]
                    pixels[x, row] = (*color, 255)
                    p += 1; x += 1
                if x >= w or p - rs >= row_len: break
    return img, xoff, yoff
```

## 生成的前端资源

通过 `gen_char_atlas.py` 脚本生成，输出到 `assets/` 目录：

| 文件 | 说明 |
|------|------|
| `char_atlas.png` | 角色精灵图集，包含玩家（28帧）+ 8个策略代理（各4帧）= 60帧 |
| `char_atlas.json` | Phaser 纹理图集 JSON（hash 格式），记录每帧在图集中的位置和尺寸 |
| `char_meta.json` | 角色元数据，包含每帧的 xoff/yoff 偏移和策略→角色的映射关系 |

### 精灵图集布局

- 玩家：`player_d{0-3}_f{0-6}` 共 28 帧，5 倍缩放
- 策略代理：`{hv1,hv2,hv3,hv4,nv1,nv2,e1,e2}_{0-3}` 各 4 帧，3 倍缩放
- 代理素材来源：Mmap tile 1008-1115（地图 NPC 精灵）

### 策略代理映射

| 策略 ID | 角色 key | Mmap tile 范围 | 类别 |
|---------|----------|---------------|------|
| 玩家 | player | 2501-2528 | 行走动画 |
| hv1 | hv1 | 1008-1011 | 热度策略 |
| hv2 | hv2 | 1012-1015 | 热度策略 |
| hv3 | hv3 | 1016-1019 | 热度策略 |
| hv4 | hv4 | 1020-1023 | 热度策略 |
| nv1 | nv1 | 1100-1103 | 普通策略 |
| nv2 | nv2 | 1104-1107 | 普通策略 |
| e1 | e1 | 1108-1111 | 涌现策略 |
| e2 | e2 | 1112-1115 | 涌现策略 |

## 前端实现要点

### 精灵定位

使用 Phaser 的 `setOrigin` 将锚点设为脚底位置：

```javascript
sprite.setOrigin(meta.xoff / frame.width, meta.yoff / frame.height)
      .setScale(0.6);
```

### 方向切换

根据按键的主方向轴确定朝向：

```javascript
// UP=0, RIGHT=1, LEFT=2, DOWN=3（与游戏源码一致）
if (Math.abs(dy) >= Math.abs(dx)) {
    dir = dy < 0 ? 0 : 3;
} else {
    dir = dx > 0 ? 1 : 2;
}
const frameKey = `player_d${dir}_f${Math.floor(time / 120) % 7}`;
```

### 地图坐标转屏幕坐标

等角投影公式（以玩家为中心）：

```javascript
toScreen(mx, my) {
    const dx = mx - this.px, dy = my - this.py;
    return {
        x: 18 * (dx - dy) + 640,   // XS * (dx-dy) + SW/2
        y: 9 * (dx + dy) + 360      // YS * (dx+dy) + SH/2
    };
}
```

## 调色板

`Mmap.col` 包含 256 个 RGB 三元组，每分量 6 位（0-63），需乘以 4 转换为 8 位（0-255）：

```python
palette = [(raw[i]*4, raw[i+1]*4, raw[i+2]*4) for i in range(0, 768, 3)]
```

## 参考资料

- 游戏源码：`/Users/sunguanlong/Desktop/AIGC/JYQXZ/jyqxz/Release/SCRIPT/jyconst.lua`（常量定义）
- 游戏源码：`/Users/sunguanlong/Desktop/AIGC/JYQXZ/jyqxz/Release/SCRIPT/jymain.lua`（方向/行走逻辑）
- C 渲染代码：`jy_mainmap.c`（地图绘制）、`jy_piccache.c`（RLE 解码）
- 素材浏览：`assets/jy-runtime/16_walk/`（行走精灵 PNG 预览）
