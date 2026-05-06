import {
  DEFAULT_PLAYER_APPEARANCE_ID,
  getPlayerAppearance,
  type PlayerAppearanceDef,
} from '../../content/PlayerAppearanceCatalog';

const LS_KEY_PLAYER_APPEARANCE = 'deepsolo_player_appearance';

type Listener = (appearance: PlayerAppearanceDef) => void;

let selectedAppearanceId = loadSelectedAppearanceId();
const listeners = new Set<Listener>();

export function getSelectedPlayerAppearance(): PlayerAppearanceDef {
  return getPlayerAppearance(selectedAppearanceId);
}

export function setSelectedPlayerAppearance(id: string): PlayerAppearanceDef {
  const appearance = getPlayerAppearance(id);
  selectedAppearanceId = appearance.id;
  saveSelectedAppearanceId(appearance.id);
  for (const listener of listeners) listener(appearance);
  return appearance;
}

export function subscribePlayerAppearance(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function loadSelectedAppearanceId(): string {
  if (typeof localStorage === 'undefined') return DEFAULT_PLAYER_APPEARANCE_ID;
  try {
    const raw = localStorage.getItem(LS_KEY_PLAYER_APPEARANCE);
    if (!raw) return DEFAULT_PLAYER_APPEARANCE_ID;
    const payload = JSON.parse(raw) as { version?: number; appearanceId?: string };
    return typeof payload.appearanceId === 'string' ? payload.appearanceId : DEFAULT_PLAYER_APPEARANCE_ID;
  } catch {
    return DEFAULT_PLAYER_APPEARANCE_ID;
  }
}

function saveSelectedAppearanceId(appearanceId: string): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(LS_KEY_PLAYER_APPEARANCE, JSON.stringify({
    version: 1,
    savedAt: Date.now(),
    appearanceId,
  }));
}
