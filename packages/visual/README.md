# DeepSolo Visual

像素风策略社区可视化。当前包含大地图、室内观察者小屋、玩家属性/武功/物品、战斗系统、室内家具编辑器和大地图建筑编辑器。

## 常用命令

```bash
npm run dev              # Vite 开发服务器，默认 3456 端口
npm run typecheck        # TypeScript 类型检查
npm run test:unit        # 纯函数/数据模块单元测试
npm run build            # 类型检查 + 生产构建
npm run check            # 交付前门禁：typecheck + test:unit + build
npm run audit:governance # 项目治理巡检
npm run preview          # 预览 dist
```

## 开发约定

- 普通玩家模式不显示坐标、碰撞、mask、编辑点位等后台数据。
- 编辑器入口保留在游戏内：室内 `F2`，大地图 `F3`。
- 编辑器说明使用中文，并支持在左下角收起。
- 编辑结果可以先存在 localStorage，但阶段完成后应固化到代码配置。
- 资源贴图优先使用 runtime 尺寸，避免浏览器大比例缩放导致发糊。

## 关键文档

- `docs/visual_governance.md`：Visual 包治理说明。
- `docs/world_map_editor.md`：大地图建筑、入口、多边形碰撞编辑器。
- `docs/indoor_birth_house.md`：观察者小屋交互与玩家流程。
- `docs/observer_house_furniture_tuning.md`：家具、遮挡、碰撞、mask 调参。
- `docs/battle_system_tuning.md`：战斗系统配置和资源说明。
- `docs/battle_system_refactor_plan.md`：战斗大文件拆分计划。
- `docs/map_renderer_refactor_plan.md`：地图渲染大文件拆分计划。
