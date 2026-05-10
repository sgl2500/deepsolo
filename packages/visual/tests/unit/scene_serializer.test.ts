import { assert, test, type TestCase } from './test_utils';
import { Direction } from '../../src/types';
import { createIndoorEditableSceneSnapshot } from '../../src/editor/core/SceneSerializer';

export const tests: TestCase[] = [
  test('indoor scene snapshots include locked runtime indoor actors', () => {
    const snapshot = createIndoorEditableSceneSnapshot('digital_sect', {
      indoorActors: [{
        id: 'strategy_digital_master',
        sourceId: 'digital_master',
        buildingId: 'digital_sect',
        kind: 'strategy_npc',
        name: '数字掌门',
        position: { x: 26, y: 17, direction: Direction.Down },
        visual: {
          kind: 'spine',
          dataKey: 'battle_spine_role148_json',
          atlasKey: 'battle_spine_role148_atlas',
          scale: 0.34,
          offsetY: 18,
          defaultAnimation: 'idle',
        },
        collider: { type: 'circle', radius: 0.55 },
        interactions: ['chat', 'gift', 'battle', 'profile'],
      }],
    });

    const actorObject = snapshot.objects.find((object) => object.id === 'strategy_digital_master');
    assert.equal(actorObject?.kind, 'indoorActor');
    assert.equal(actorObject?.locked, true);
    assert.deepEqual(actorObject?.position, { x: 26, y: 17 });
    assert.equal(actorObject?.collider?.type, 'circle');
    assert.equal(actorObject?.interaction?.targetId, 'digital_master');
    assert.equal(snapshot.metadata?.indoorActorCount, 1);
  }),
];

