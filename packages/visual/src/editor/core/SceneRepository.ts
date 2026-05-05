import { LS_KEY_SCENE_EDITOR_DRAFTS } from '../../config';
import type { EditableSceneSnapshot, EditableSceneType } from '../schema/SceneSchema';

export type SceneDraftRecord = {
  version: 1;
  sceneId: string;
  sceneType: EditableSceneType;
  savedAt: number;
  snapshot: EditableSceneSnapshot;
};

export type SceneRepository = {
  loadSceneDraft(sceneType: EditableSceneType, sceneId: string): SceneDraftRecord | null;
  saveSceneDraft(snapshot: EditableSceneSnapshot): SceneDraftRecord;
  clearSceneDraft(sceneType: EditableSceneType, sceneId: string): void;
};

export function getSceneDraftStorageKey(sceneType: EditableSceneType, sceneId: string): string {
  return `${LS_KEY_SCENE_EDITOR_DRAFTS}:${sceneType}:${sceneId}`;
}

export class LocalSceneRepository implements SceneRepository {
  loadSceneDraft(sceneType: EditableSceneType, sceneId: string): SceneDraftRecord | null {
    const raw = localStorage.getItem(getSceneDraftStorageKey(sceneType, sceneId));
    if (!raw) return null;
    const payload = JSON.parse(raw) as Partial<SceneDraftRecord>;
    if (
      payload.version !== 1 ||
      payload.sceneId !== sceneId ||
      payload.sceneType !== sceneType ||
      !payload.snapshot ||
      payload.snapshot.version !== 1
    ) return null;
    return payload as SceneDraftRecord;
  }

  saveSceneDraft(snapshot: EditableSceneSnapshot): SceneDraftRecord {
    const record: SceneDraftRecord = {
      version: 1,
      sceneId: snapshot.sceneId,
      sceneType: snapshot.sceneType,
      savedAt: Date.now(),
      snapshot: {
        ...snapshot,
        savedAt: snapshot.savedAt || Date.now(),
      },
    };
    localStorage.setItem(
      getSceneDraftStorageKey(record.sceneType, record.sceneId),
      JSON.stringify(record),
    );
    return record;
  }

  clearSceneDraft(sceneType: EditableSceneType, sceneId: string): void {
    localStorage.removeItem(getSceneDraftStorageKey(sceneType, sceneId));
  }
}
