import { runTests } from './test_utils';
import { tests as battleRulesTests } from './battle_rules.test';
import { tests as indoorCoordinateMapperTests } from './indoor_coordinate_mapper.test';
import { tests as indoorEditorPersistenceTests } from './indoor_editor_persistence.test';
import { tests as indoorRoomTemplateTests } from './indoor_room_templates.test';
import { tests as playerAppearanceTests } from './player_appearance.test';
import { tests as strategyNpcPlacementTests } from './strategy_npc_placement.test';
import { tests as strategyNpcVisualsTests } from './strategy_npc_visuals.test';
import { tests as detailPanelLiveStateTests } from './detail_panel_live_state.test';

export async function run(): Promise<void> {
  await runTests([
    { suite: 'BattleRules', tests: battleRulesTests },
    { suite: 'IndoorCoordinateMapper', tests: indoorCoordinateMapperTests },
    { suite: 'IndoorEditorPersistence', tests: indoorEditorPersistenceTests },
    { suite: 'IndoorRoomTemplates', tests: indoorRoomTemplateTests },
    { suite: 'PlayerAppearance', tests: playerAppearanceTests },
    { suite: 'StrategyNpcPlacement', tests: strategyNpcPlacementTests },
    { suite: 'StrategyNpcVisuals', tests: strategyNpcVisualsTests },
    { suite: 'DetailPanelLiveState', tests: detailPanelLiveStateTests },
  ]);
}
