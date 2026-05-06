// ============================================================
// ScheduleData.ts — NPC 日程模板
// ============================================================

/** 日程项 */
export interface ScheduleItem {
  scene: string;     // 目标场景 ID（'home' 为家）
  duration: number;  // 停留时长（游戏 tick 数）
}

/** 日程模板 — 每个 NPC 从模板中生成自己的日程 */
export interface ScheduleTemplate {
  name: string;
  items: ScheduleItem[];
}

/** 日程模板库 — 按策略类别分 */
const SCHEDULE_TEMPLATES: Record<string, ScheduleTemplate[]> = {
  hot: [
    {
      name: '激进型',
      items: [
        { scene: 'home',      duration: 30 },
        { scene: 'news',       duration: 20 },
        { scene: 'exchange',   duration: 25 },
        { scene: 'teahouse',   duration: 20 },
        { scene: 'datacenter', duration: 15 },
        { scene: 'home',       duration: 20 },
        { scene: 'lab',        duration: 20 },
        { scene: 'home',       duration: 30 },
      ],
    },
    {
      name: '追涨型',
      items: [
        { scene: 'home',      duration: 20 },
        { scene: 'datacenter', duration: 25 },
        { scene: 'exchange',   duration: 20 },
        { scene: 'teahouse',   duration: 25 },
        { scene: 'rank',       duration: 15 },
        { scene: 'home',       duration: 25 },
        { scene: 'news',       duration: 20 },
        { scene: 'home',       duration: 30 },
      ],
    },
  ],
  normal: [
    {
      name: '综合型',
      items: [
        { scene: 'home',      duration: 40 },
        { scene: 'datacenter', duration: 20 },
        { scene: 'teahouse',   duration: 25 },
        { scene: 'news',       duration: 20 },
        { scene: 'home',       duration: 30 },
        { scene: 'lab',        duration: 20 },
        { scene: 'home',       duration: 35 },
      ],
    },
    {
      name: '稳健型',
      items: [
        { scene: 'home',      duration: 35 },
        { scene: 'news',       duration: 20 },
        { scene: 'teahouse',   duration: 30 },
        { scene: 'datacenter', duration: 20 },
        { scene: 'home',       duration: 25 },
        { scene: 'rank',       duration: 15 },
        { scene: 'home',       duration: 35 },
      ],
    },
  ],
  emerged: [
    {
      name: '涌现型',
      items: [
        { scene: 'home',      duration: 25 },
        { scene: 'lab',        duration: 30 },
        { scene: 'teahouse',   duration: 20 },
        { scene: 'exchange',   duration: 20 },
        { scene: 'datacenter', duration: 15 },
        { scene: 'home',       duration: 25 },
        { scene: 'news',       duration: 15 },
        { scene: 'home',       duration: 30 },
      ],
    },
  ],
};

/** 为指定策略类别生成日程 */
export function generateSchedule(category: string): ScheduleItem[] {
  const templates = SCHEDULE_TEMPLATES[category] || SCHEDULE_TEMPLATES['normal'];
  const template = templates[Math.floor(Math.random() * templates.length)];
  // 加点随机抖动
  return template.items.map(item => ({
    scene: item.scene,
    duration: item.duration + Math.floor(Math.random() * 10) - 5,
  }));
}
