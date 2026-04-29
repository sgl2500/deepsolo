# Visual Asset Governance

本文件约定 `packages/visual` 的素材边界：项目内只保留当前运行时真正会请求的素材，完整素材库、AI 生成过程、预览图和历史版本统一放到项目外。

## 目录边界

```text
deepsolo/packages/visual/
  public/
    assets/          浏览器运行时会直接请求的最终素材
    data/            浏览器运行时读取的策略、NPC、Token 等数据

/Users/sunguanlong/Desktop/AIGC/assets-library/deepsolo/
  observer_house/    观察者小屋历史版本、raw、preview、metadata、cutouts
  jyqxz/             JYQXZ 完整素材库和生成素材
```

## 项目内运行时素材

允许放在 `public/assets` 的资源：

- `map_data.json`、`tile_atlas.*`、`char_atlas.*` 等核心地图/角色资源。
- `indoor_maps/`：当前建筑会进入的室内地图 JSON。
- `observer_house_v3/runtime/`：观察者小屋当前运行时贴图。
- `ai-resource/runtime/`：大地图建筑当前运行时贴图。
- `jy-runtime/`：从 JYQXZ 完整素材库中复制出的运行时子集。

不应放在项目内的资源：

- 完整素材包，例如完整 `jy-assets`。
- `raw/`：生成原图或未处理原始图。
- `preview/`：拼图预览、比对图、实验效果图。
- `metadata/`：AI 生成响应、切图清单、实验参数。
- 历史版本整包，例如 `observer_house_v1`、`observer_house_v2`。

## 项目外素材库

当前外部库：

```text
/Users/sunguanlong/Desktop/AIGC/assets-library/deepsolo/
  observer_house/v1/
  observer_house/v2/
  observer_house/v3/raw/
  observer_house/v3/preview/
  observer_house/v3/metadata/
  observer_house/v3/cutouts/
  jyqxz/full/
  jyqxz/generated/
```

这些文件用于复盘、重新裁剪、重新生成和从完整素材库中挑选素材，但不再作为浏览器运行时路径。

## 新素材进入规则

1. AI 生成、手工切图、预览拼图先进入外部素材库。
2. 只有被代码或配置实际加载的最终图，才复制/导出到 `public/assets`。
3. 新增 JYQXZ 资源时，从 `assets-library/deepsolo/jyqxz/full` 复制到 `public/assets/jy-runtime`。
4. 新增运行时目录时，必须同步更新本文件和 `scripts/visual_asset_audit.mjs`。
5. 不要把 `.DS_Store`、临时下载文件、未筛选实验图放进 `public`。
6. 大批量素材改名或搬迁前，先用 `rg "旧路径"` 查清运行时代码和工具脚本引用。

## 检查命令

```bash
cd packages/visual
npm run audit:assets
```

`audit:assets` 会检查：

- 必要运行时目录是否存在。
- 完整素材库和中间产物是否又回到项目 `public`。
- 外部素材库是否存在。
- `public` 中是否还有 `.DS_Store` 和疑似制作中间产物。

治理提醒不阻塞构建；必须项失败才需要立即修复。
