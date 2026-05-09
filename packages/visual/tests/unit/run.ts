import { runTests } from './test_utils';
import { tests as authStoreTests } from './auth_store.test';
import { tests as battleAssetCatalogTests } from './battle_asset_catalog.test';
import { tests as battleRulesTests } from './battle_rules.test';
import { tests as battleSkillEffectCatalogTests } from './battle_skill_effect_catalog.test';
import { tests as combatProfileTests } from './combat_profile.test';
import { tests as combatDisplayTests } from './combat_display.test';
import { tests as indoorCoordinateMapperTests } from './indoor_coordinate_mapper.test';
import { tests as indoorEditorPersistenceTests } from './indoor_editor_persistence.test';
import { tests as indoorExitLocksTests } from './indoor_exit_locks.test';
import { tests as indoorRoomTemplateTests } from './indoor_room_templates.test';
import { tests as playerAppearanceTests } from './player_appearance.test';
import { tests as playerLocationPersistenceTests } from './player_location_persistence.test';
import { tests as sideBattleRulesTests } from './side_battle_rules.test';
import { tests as shopSystemTests } from './shop_system.test';
import { tests as strategyNpcPlacementTests } from './strategy_npc_placement.test';
import { tests as strategyNpcVisualsTests } from './strategy_npc_visuals.test';
import { tests as detailPanelLiveStateTests } from './detail_panel_live_state.test';
import { tests as giftSystemTests } from './gift_system.test';

export async function run(): Promise<void> {
  await runTests([
    { suite: 'AuthStore', tests: authStoreTests },
    { suite: 'BattleAssetCatalog', tests: battleAssetCatalogTests },
    { suite: 'BattleRules', tests: battleRulesTests },
    { suite: 'BattleSkillEffectCatalog', tests: battleSkillEffectCatalogTests },
    { suite: 'CombatDisplay', tests: combatDisplayTests },
    { suite: 'CombatProfile', tests: combatProfileTests },
    { suite: 'IndoorCoordinateMapper', tests: indoorCoordinateMapperTests },
    { suite: 'IndoorEditorPersistence', tests: indoorEditorPersistenceTests },
    { suite: 'IndoorExitLocks', tests: indoorExitLocksTests },
    { suite: 'IndoorRoomTemplates', tests: indoorRoomTemplateTests },
    { suite: 'PlayerAppearance', tests: playerAppearanceTests },
    { suite: 'PlayerLocationPersistence', tests: playerLocationPersistenceTests },
    { suite: 'SideBattleRules', tests: sideBattleRulesTests },
    { suite: 'ShopSystem', tests: shopSystemTests },
    { suite: 'StrategyNpcPlacement', tests: strategyNpcPlacementTests },
    { suite: 'StrategyNpcVisuals', tests: strategyNpcVisualsTests },
    { suite: 'DetailPanelLiveState', tests: detailPanelLiveStateTests },
    { suite: 'GiftSystem', tests: giftSystemTests },
  ]);
}
