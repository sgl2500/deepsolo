import { assert, test, type TestCase } from './test_utils';
import { AgentState, Direction, type Strategy } from '../../src/types';
import {
  createStoryNpcIndoorActor,
  createStaticIndoorCharacterActor,
  createStrategyNpcIndoorActor,
} from '../../src/content/IndoorActorRegistry';

const DIGITAL_MASTER: Strategy = {
  id: 'digital_master',
  name: '数字掌门',
  category: 'emerged',
  description: '外部 crypto 工作区映射进来的掌门策略。',
  returnPct: 0,
  maxDrawdownPct: 0,
  totalTrades: 0,
  winRate: 0,
  avgReturnPct: 0,
  capital: 500,
  state: AgentState.Discussing,
  buildingId: 'digital_sect',
  placement: 'indoor-only',
  role: '掌门',
  sourceWorkspace: 'crypto',
  mode: 'dry_run',
};

export const tests: TestCase[] = [
  test('strategy NPC maps to a unified indoor actor with visual, collider, and interactions', () => {
    const actor = createStrategyNpcIndoorActor('digital_sect', DIGITAL_MASTER, {
      mapX: 26,
      mapY: 17,
      direction: Direction.Down,
    });

    assert.equal(actor.id, 'strategy_digital_master');
    assert.equal(actor.kind, 'strategy_npc');
    assert.equal(actor.position.x, 26);
    assert.equal(actor.visual.kind, 'spine');
    assert.deepEqual(actor.interactions, ['chat', 'gift', 'battle', 'profile']);
    assert.deepEqual(actor.collider, { type: 'circle', radius: 0.55 });
  }),

  test('static indoor character also maps to the unified indoor actor shape', () => {
    const actor = createStaticIndoorCharacterActor({
      buildingId: 'digital_sect',
      id: 'digital_sect_guard',
      textureKey: 'token_center_dashixiong',
      localX: 20,
      localY: 12,
      scale: 0.54,
      collider: { minLocalX: 19.4, maxLocalX: 20.6, minLocalY: 11.4, maxLocalY: 12.6 },
    });

    assert.equal(actor.kind, 'decorative_character');
    assert.equal(actor.visual.kind, 'static_texture');
    assert.equal(actor.collider?.type, 'rect');
    if (actor.collider?.type !== 'rect') return;
    assert.ok(Math.abs(actor.collider.width - 1.2) < 0.001);
    assert.ok(Math.abs(actor.collider.height - 1.2) < 0.001);
    assert.equal(actor.collider.offsetX, 0);
    assert.equal(actor.collider.offsetY, 0);
  }),

  test('story NPC maps to a unified indoor actor with dialogue interactions', () => {
    const actor = createStoryNpcIndoorActor({
      id: 'gushen',
      name: '股神',
      mapId: 'birth_house',
      mapX: 10.5,
      mapY: 12.5,
      charKey: 'token_center_shishu',
      dialogueId: 'gushen_story_entry',
      defaultDir: Direction.Down,
    });

    assert.equal(actor.kind, 'story_npc');
    assert.equal(actor.position.x, 10.5);
    assert.equal(actor.visual.kind, 'static_texture');
    assert.deepEqual(actor.interactions, ['dialogue', 'gift']);
    assert.deepEqual(actor.collider, { type: 'circle', radius: 0.5 });
  }),
];
