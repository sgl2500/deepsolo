// ============================================================
// agents/index.ts — Agent 档案加载 + 衍生属性生成
// ============================================================
//
// 战斗属性从 data/agents/{id}/battle.json 加载。
// 每个基础 Agent 的 battle.json 由后端 data 目录同步到 public/。
// 衍生 Agent 无 battle.json，从父母属性随机插值生成。
// ============================================================

/** 战斗属性 */
export interface BattleStats {
  maxHp: number;
  maxMp: number;
  attack: number;
  defense: number;
  speed: number;
  moveRange: number;
  wugongId: string;
}

/** Agent 档案（battle.json + profile.json 合并视图） */
export interface AgentProfile {
  id: string;
  name: string;
  battle: BattleStats;
}

/** 已加载的 Agent 战斗属性缓存 (id → BattleStats) */
const battleCache = new Map<string, BattleStats>();

/** 已知的基础/常驻 Agent ID（用于预加载战斗载具配置） */
const BASE_AGENT_IDS = ['hv1', 'hv2', 'hv3', 'hv4', 'nv1', 'nv2', 'digital_master', 'digital_elder'];

/** 预加载所有基础 Agent 的 battle.json */
export async function preloadAgentProfiles(): Promise<void> {
  const loads = BASE_AGENT_IDS.map(async id => {
    try {
      const resp = await fetch(`./data/agents/${id}/battle.json`);
      if (resp.ok) {
        const stats: BattleStats = await resp.json();
        battleCache.set(id, stats);
      }
    } catch { /* ignore */ }
  });
  await Promise.all(loads);
}

/** 获取 Agent 战斗属性 */
export function getBattleStats(id: string): BattleStats | undefined {
  return battleCache.get(id);
}

/** 所有可参战的基础 Agent ID */
export function getKnownAgentIds(): string[] {
  return BASE_AGENT_IDS.filter(id => battleCache.has(id));
}

/** 尝试加载单个 Agent 的 battle.json（衍生 Agent 可能在运行时出现） */
export async function loadBattleStats(id: string): Promise<BattleStats | undefined> {
  if (battleCache.has(id)) return battleCache.get(id);
  try {
    const resp = await fetch(`./data/agents/${id}/battle.json`);
    if (resp.ok) {
      const stats: BattleStats = await resp.json();
      battleCache.set(id, stats);
      return stats;
    }
  } catch { /* ignore */ }
  return undefined;
}

/** 在父母战斗属性之间随机插值，生成衍生 Agent 属性 */
export function deriveBattleStats(
  parentA: BattleStats,
  parentB: BattleStats,
  wugongId: string,
): BattleStats {
  const lerp = (a: number, b: number) => {
    const t = Math.random();
    return Math.round(a * (1 - t) + b * t);
  };
  const jitter = (v: number, range: number) =>
    Math.max(1, v + Math.floor(Math.random() * range * 2 - range));

  return {
    maxHp: jitter(lerp(parentA.maxHp, parentB.maxHp), 50),
    maxMp: jitter(lerp(parentA.maxMp, parentB.maxMp), 30),
    attack: jitter(lerp(parentA.attack, parentB.attack), 5),
    defense: jitter(lerp(parentA.defense, parentB.defense), 5),
    speed: jitter(lerp(parentA.speed, parentB.speed), 3),
    moveRange: Math.max(2, Math.min(6, lerp(parentA.moveRange, parentB.moveRange))),
    wugongId,
  };
}

export type { BattleStats as BattleStatsType };
