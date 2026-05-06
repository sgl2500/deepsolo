import generatedIndoorLayouts from './generated_indoor_layouts.json';
import type { EditableSceneSnapshot } from '../editor/schema/SceneSchema';
import type {
  FurnitureEditorSnapshotItem,
  IndoorCharacterEditorSnapshotItem,
  InteractableEditorSnapshotItem,
} from '../systems/map/IndoorEditorPersistence';
import type { IndoorFloorTileOverride } from '../systems/map/IndoorTileEditorPersistence';

export type GeneratedIndoorLayout = {
  sceneId: string;
  savedAt: number;
  furniture: FurnitureEditorSnapshotItem[];
  characters: IndoorCharacterEditorSnapshotItem[];
  interactables: InteractableEditorSnapshotItem[];
  floorTileOverrides: IndoorFloorTileOverride[];
  sceneSnapshot?: EditableSceneSnapshot;
};

type GeneratedIndoorLayoutsPayload = {
  version: 1;
  savedAt: number;
  scenes: Record<string, GeneratedIndoorLayout>;
};

const payload = generatedIndoorLayouts as GeneratedIndoorLayoutsPayload;

export function getGeneratedIndoorLayout(sceneId: string): GeneratedIndoorLayout | null {
  const layout = payload.scenes?.[sceneId];
  if (!layout || layout.sceneId !== sceneId) return null;
  return {
    sceneId,
    savedAt: Number.isFinite(layout.savedAt) ? layout.savedAt : 0,
    furniture: Array.isArray(layout.furniture) ? layout.furniture : [],
    characters: Array.isArray(layout.characters) ? layout.characters : [],
    interactables: Array.isArray(layout.interactables) ? layout.interactables : [],
    floorTileOverrides: Array.isArray(layout.floorTileOverrides) ? layout.floorTileOverrides : [],
    sceneSnapshot: layout.sceneSnapshot,
  };
}
