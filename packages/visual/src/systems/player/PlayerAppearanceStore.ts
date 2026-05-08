import {
  DEFAULT_PLAYER_APPEARANCE_ID,
  getPlayerAppearance,
  type PlayerAppearanceDef,
} from '../../content/PlayerAppearanceCatalog';
import { Direction } from '../../types';

const LS_KEY_PLAYER_APPEARANCE = 'deepsolo_player_appearance';

export type PlayerAppearanceTuning = {
  directionRows?: Partial<Record<Direction, number>>;
  frameSequence?: number[];
  scale?: number;
  indoorScale?: number;
  originX?: number;
  originY?: number;
  worldOffsetY?: number;
  indoorOffsetY?: number;
};

type Listener = (appearance: PlayerAppearanceDef) => void;

type PlayerAppearanceStoragePayload = {
  version?: number;
  appearanceId?: string;
  tunings?: Record<string, PlayerAppearanceTuning>;
};

const initialPayload = loadPayload();
let selectedAppearanceId = initialPayload.appearanceId ?? DEFAULT_PLAYER_APPEARANCE_ID;
let tunings: Record<string, PlayerAppearanceTuning> = initialPayload.tunings ?? {};
const listeners = new Set<Listener>();

export function getSelectedPlayerAppearance(): PlayerAppearanceDef {
  return getTunedPlayerAppearance(selectedAppearanceId);
}

export function setSelectedPlayerAppearance(id: string): PlayerAppearanceDef {
  const appearance = getTunedPlayerAppearance(id);
  selectedAppearanceId = appearance.id;
  savePayload();
  for (const listener of listeners) listener(appearance);
  return appearance;
}

export function getPlayerAppearanceTuning(id: string): PlayerAppearanceTuning {
  return cloneTuning(tunings[id] ?? {});
}

export function setPlayerAppearanceTuning(id: string, patch: PlayerAppearanceTuning): PlayerAppearanceDef {
  const base = getPlayerAppearance(id);
  tunings[base.id] = normalizeTuning(base, {
    ...(tunings[base.id] ?? {}),
    ...patch,
    directionRows: {
      ...(tunings[base.id]?.directionRows ?? {}),
      ...(patch.directionRows ?? {}),
    },
  });
  savePayload();
  const appearance = getTunedPlayerAppearance(base.id);
  if (base.id === selectedAppearanceId) {
    for (const listener of listeners) listener(appearance);
  }
  return appearance;
}

export function resetPlayerAppearanceTuning(id: string): PlayerAppearanceDef {
  const base = getPlayerAppearance(id);
  delete tunings[base.id];
  savePayload();
  const appearance = getTunedPlayerAppearance(base.id);
  if (base.id === selectedAppearanceId) {
    for (const listener of listeners) listener(appearance);
  }
  return appearance;
}

export function subscribePlayerAppearance(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getTunedPlayerAppearance(id: string): PlayerAppearanceDef {
  const base = getPlayerAppearance(id);
  const tuning = normalizeTuning(base, tunings[base.id] ?? {});
  return {
    ...base,
    scale: tuning.scale ?? base.scale,
    indoorScale: tuning.indoorScale ?? base.indoorScale,
    originX: tuning.originX ?? base.originX,
    originY: tuning.originY ?? base.originY,
    worldOffsetY: tuning.worldOffsetY ?? base.worldOffsetY,
    indoorOffsetY: tuning.indoorOffsetY ?? base.indoorOffsetY,
    frameSequence: tuning.frameSequence ?? base.frameSequence,
    directionRows: {
      ...base.directionRows,
      ...(tuning.directionRows ?? {}),
    },
  };
}

function loadPayload(): PlayerAppearanceStoragePayload {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(LS_KEY_PLAYER_APPEARANCE);
    if (!raw) return {};
    const payload = JSON.parse(raw) as PlayerAppearanceStoragePayload;
    return {
      appearanceId: typeof payload.appearanceId === 'string' ? payload.appearanceId : undefined,
      tunings: payload.tunings && typeof payload.tunings === 'object' ? payload.tunings : {},
    };
  } catch {
    return {};
  }
}

function savePayload(): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(LS_KEY_PLAYER_APPEARANCE, JSON.stringify({
    version: 1,
    savedAt: Date.now(),
    appearanceId: selectedAppearanceId,
    tunings,
  }));
}

function normalizeTuning(base: PlayerAppearanceDef, tuning: PlayerAppearanceTuning): PlayerAppearanceTuning {
  const directionRows: Partial<Record<Direction, number>> = {};
  for (const direction of [Direction.Up, Direction.Right, Direction.Left, Direction.Down]) {
    const value = clampInt(tuning.directionRows?.[direction], 0, Number.POSITIVE_INFINITY);
    if (value !== undefined) directionRows[direction] = value;
  }
  return {
    directionRows: Object.keys(directionRows).length ? directionRows : undefined,
    frameSequence: tuning.frameSequence
      ?.map((item) => clampInt(item, 0, base.frameCount - 1))
      .filter((item): item is number => item !== undefined),
    scale: clampNumber(tuning.scale, 0.1, 8),
    indoorScale: clampNumber(tuning.indoorScale, 0.1, 8),
    originX: clampNumber(tuning.originX, 0, 1),
    originY: clampNumber(tuning.originY, 0, 1.5),
    worldOffsetY: clampNumber(tuning.worldOffsetY, -80, 80),
    indoorOffsetY: clampNumber(tuning.indoorOffsetY, -80, 80),
  };
}

function cloneTuning(tuning: PlayerAppearanceTuning): PlayerAppearanceTuning {
  return {
    ...tuning,
    directionRows: tuning.directionRows ? { ...tuning.directionRows } : undefined,
    frameSequence: tuning.frameSequence ? [...tuning.frameSequence] : undefined,
  };
}

function clampNumber(value: number | undefined, min: number, max: number): number | undefined {
  if (!Number.isFinite(value)) return undefined;
  return Math.max(min, Math.min(max, Number(value)));
}

function clampInt(value: number | undefined, min: number, max: number): number | undefined {
  if (!Number.isFinite(value)) return undefined;
  return Math.floor(Math.max(min, Math.min(max, Number(value))));
}
