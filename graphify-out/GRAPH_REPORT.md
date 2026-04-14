# Graph Report - /Users/sunguanlong/Desktop/AIGC/deepsolo  (2026-04-14)

## Corpus Check
- Large corpus: 10577 files · ~1,280,846 words. Semantic extraction will be expensive (many Claude tokens). Consider running on a subfolder, or use --no-semantic to run AST-only.

## Summary
- 307 nodes · 326 edges · 49 communities detected
- Extraction: 88% EXTRACTED · 11% INFERRED · 1% AMBIGUOUS · INFERRED: 37 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Architecture & Data Flow|Architecture & Data Flow]]
- [[_COMMUNITY_Map Rendering|Map Rendering]]
- [[_COMMUNITY_Game Assets & Visuals|Game Assets & Visuals]]
- [[_COMMUNITY_Scene Management|Scene Management]]
- [[_COMMUNITY_Entity System|Entity System]]
- [[_COMMUNITY_Strategy Game Store|Strategy Game Store]]
- [[_COMMUNITY_Agent Discussion System|Agent Discussion System]]
- [[_COMMUNITY_Strategy Agent Entity|Strategy Agent Entity]]
- [[_COMMUNITY_Player Controller|Player Controller]]
- [[_COMMUNITY_NPC Dialogue System|NPC Dialogue System]]
- [[_COMMUNITY_Strategy Detail Panel UI|Strategy Detail Panel UI]]
- [[_COMMUNITY_NPC Entity|NPC Entity]]
- [[_COMMUNITY_Character Sprite System|Character Sprite System]]
- [[_COMMUNITY_Boot Scene & Preloader|Boot Scene & Preloader]]
- [[_COMMUNITY_Base Entity Class|Base Entity Class]]
- [[_COMMUNITY_Evolution Engine|Evolution Engine]]
- [[_COMMUNITY_Core Storage & Memory|Core Storage & Memory]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 47|Community 47]]
- [[_COMMUNITY_Community 48|Community 48]]

## God Nodes (most connected - your core abstractions)
1. `MapRenderer` - 16 edges
2. `SceneManager` - 15 edges
3. `EntitySystem` - 14 edges
4. `GameStore` - 13 edges
5. `DiscussionSystem` - 12 edges
6. `Agent` - 12 edges
7. `Player` - 10 edges
8. `DialogueSystem` - 9 edges
9. `Relation Memory Layer (Strategy Graph, SQLite)` - 9 edges
10. `DetailPanel` - 7 edges

## Surprising Connections (you probably didn't know these)
- `packages/core/deepsolo/memory/ (Strategy Memory System)` --implements--> `Relation Memory Layer (Strategy Graph, SQLite)`  [INFERRED]
  packages/core/deepsolo/memory/__init__.py → docs/architecture.md
- `packages/evolution/deepsolo_evolution/community/ (Community Collaboration)` --calls--> `OpenAI Compatible LLM Interface`  [INFERRED]
  packages/evolution/deepsolo_evolution/community/__init__.py → README.md
- `packages/core/deepsolo/storage/ (SQLite Storage Layer)` --implements--> `Relation Memory Layer (Strategy Graph, SQLite)`  [INFERRED]
  packages/core/deepsolo/storage/__init__.py → docs/architecture.md
- `packages/core (Strategy Warehouse + Memory)` --implements--> `packages/core/deepsolo/models/ (Data Models)`  [INFERRED]
  docs/architecture.md → packages/core/deepsolo/models/__init__.py
- `packages/core (Strategy Warehouse + Memory)` --implements--> `packages/core/deepsolo/storage/ (SQLite Storage Layer)`  [INFERRED]
  docs/architecture.md → packages/core/deepsolo/storage/__init__.py

## Hyperedges (group relationships)
- **Dual-Layer Evolution Mechanism** — arch_ecology_competition, arch_community_collaboration, arch_emerged_strategy_layer, arch_relation_memory_layer [EXTRACTED 1.00]
- **AIGC Closed-Loop Strategy Optimization** — arch_aigc_loop, arch_strategy_production_engine, arch_base_strategy_layer, arch_emerged_strategy_layer, arch_pkg_connector [EXTRACTED 1.00]
- **Pixel Community Visualization System** — visual_pkg, char_walking_doc, char_walking_phaser_framework, char_walking_sprite_atlas, char_walking_isometric_projection, char_walking_strategy_agent_mapping [INFERRED 0.85]
- **Core Storage and Memory Infrastructure** — core_pkg_models, core_pkg_storage, core_pkg_memory, arch_relation_memory_layer [INFERRED 0.85]
- **Strategy Backtest Data Pipeline** — template_json_strategies, v001_account_data, connector_json_interface, arch_signal_display [INFERRED 0.70]

## Communities

### Community 0 - "Architecture & Data Flow"
Cohesion: 0.07
Nodes (41): AIGC Closed Loop, Base Strategy Layer (Read-Only), Community Collaboration Layer 2, Data Flow: 6-Step Evolution Cycle, Ecology Competition Layer 1, Emerged Strategy Layer (Continuously Evolving), OpenClaw Strategy Framework, Pixel Community Visualization (+33 more)

### Community 1 - "Map Rendering"
Cohesion: 0.16
Nodes (1): MapRenderer

### Community 2 - "Game Assets & Visuals"
Cohesion: 0.16
Nodes (17): Agent Idle Character Sprite, Game Background, Menu Background, Exchange Building Sprite, Teahouse Building Sprite, Sparkle Visual Effect, Versus Screen Effect, Exchange Building Map Tile 96x128 (+9 more)

### Community 3 - "Scene Management"
Cohesion: 0.16
Nodes (1): SceneManager

### Community 4 - "Entity System"
Cohesion: 0.15
Nodes (1): EntitySystem

### Community 5 - "Strategy Game Store"
Cohesion: 0.18
Nodes (1): GameStore

### Community 6 - "Agent Discussion System"
Cohesion: 0.18
Nodes (1): DiscussionSystem

### Community 7 - "Strategy Agent Entity"
Cohesion: 0.19
Nodes (1): Agent

### Community 8 - "Player Controller"
Cohesion: 0.22
Nodes (1): Player

### Community 9 - "NPC Dialogue System"
Cohesion: 0.33
Nodes (1): DialogueSystem

### Community 10 - "Strategy Detail Panel UI"
Cohesion: 0.32
Nodes (1): DetailPanel

### Community 11 - "NPC Entity"
Cohesion: 0.29
Nodes (1): NPC

### Community 12 - "Character Sprite System"
Cohesion: 0.32
Nodes (8): packages/visual (Pixel Community Visualization), Character Walking Implementation (JYQXZ-Based), Isometric Map-to-Screen Coordinate Projection, JYQXZ Game Data Source (Mmap.grp/Mmap.idx/Mmap.col), Phaser Game Framework, RLE Decoding Algorithm (Mmap.grp), Character Sprite Atlas (60 frames: 28 player + 32 agents), packages/visual (Pixel-Art Strategy Community Visualization)

### Community 13 - "Boot Scene & Preloader"
Cohesion: 0.38
Nodes (3): BootScene, collectPortraitIds(), collectSmapTileIds()

### Community 14 - "Base Entity Class"
Cohesion: 0.33
Nodes (2): getCharKey(), updateWalkAnimation()

### Community 15 - "Evolution Engine"
Cohesion: 0.4
Nodes (1): DialoguePanel

### Community 16 - "Core Storage & Memory"
Cohesion: 0.33
Nodes (1): WorldScene

### Community 17 - "Community 17"
Cohesion: 0.33
Nodes (1): EventBus

### Community 18 - "Community 18"
Cohesion: 0.33
Nodes (0): 

### Community 19 - "Community 19"
Cohesion: 0.4
Nodes (1): InputController

### Community 20 - "Community 20"
Cohesion: 0.4
Nodes (1): DayCycleSystem

### Community 21 - "Community 21"
Cohesion: 0.4
Nodes (1): MinimapSystem

### Community 22 - "Community 22"
Cohesion: 0.7
Nodes (4): extractIndoorScenes(), extractSceneDefinitions(), extractWorldMap(), main()

### Community 23 - "Community 23"
Cohesion: 0.5
Nodes (1): UIManager

### Community 24 - "Community 24"
Cohesion: 0.4
Nodes (1): StrategyListPanel

### Community 25 - "Community 25"
Cohesion: 0.4
Nodes (0): 

### Community 26 - "Community 26"
Cohesion: 0.5
Nodes (1): BubbleFactory

### Community 27 - "Community 27"
Cohesion: 0.5
Nodes (1): HeaderBar

### Community 28 - "Community 28"
Cohesion: 0.5
Nodes (1): EventLogPanel

### Community 29 - "Community 29"
Cohesion: 0.5
Nodes (0): 

### Community 30 - "Community 30"
Cohesion: 0.67
Nodes (0): 

### Community 31 - "Community 31"
Cohesion: 0.67
Nodes (1): 第二层：社区协作 — LLM 驱动的策略讨论、新思路提取

### Community 32 - "Community 32"
Cohesion: 1.0
Nodes (2): deepsolo-core Python Package, deepsolo-evolution Python Package

### Community 33 - "Community 33"
Cohesion: 1.0
Nodes (0): 

### Community 34 - "Community 34"
Cohesion: 1.0
Nodes (0): 

### Community 35 - "Community 35"
Cohesion: 1.0
Nodes (0): 

### Community 36 - "Community 36"
Cohesion: 1.0
Nodes (0): 

### Community 37 - "Community 37"
Cohesion: 1.0
Nodes (0): 

### Community 38 - "Community 38"
Cohesion: 1.0
Nodes (0): 

### Community 39 - "Community 39"
Cohesion: 1.0
Nodes (0): 

### Community 40 - "Community 40"
Cohesion: 1.0
Nodes (0): 

### Community 41 - "Community 41"
Cohesion: 1.0
Nodes (0): 

### Community 42 - "Community 42"
Cohesion: 1.0
Nodes (0): 

### Community 43 - "Community 43"
Cohesion: 1.0
Nodes (0): 

### Community 44 - "Community 44"
Cohesion: 1.0
Nodes (0): 

### Community 45 - "Community 45"
Cohesion: 1.0
Nodes (0): 

### Community 46 - "Community 46"
Cohesion: 1.0
Nodes (0): 

### Community 47 - "Community 47"
Cohesion: 1.0
Nodes (1): Strategy Relation Types (Inherit/Mutate/Hybrid/Inspire/Complement/Adversarial)

### Community 48 - "Community 48"
Cohesion: 1.0
Nodes (1): Strategy Agent File Structure (STRATEGY.md + memory/ + persona.md + relations.json)

## Ambiguous Edges - Review These
- `NPC Analyst Character Sprite` → `Teahouse Building Sprite`  [AMBIGUOUS]
  packages/visual/public/assets/characters/npc_analyst.png · relation: conceptually_related_to
- `Strategy Card UI Element` → `Menu Background`  [AMBIGUOUS]
  packages/visual/public/assets/backgrounds/menu_bg.png · relation: conceptually_related_to

## Knowledge Gaps
- **18 isolated node(s):** `Graph Database (Future)`, `Signal Display / Strategy Cards`, `packages/visual (Pixel Community Visualization)`, `Rationale: SQLite for Lightweight Local-First Storage`, `Rationale: Standardized Data Structure for Strategy Decoupling` (+13 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 32`** (2 nodes): `deepsolo-core Python Package`, `deepsolo-evolution Python Package`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 33`** (1 nodes): `__init__.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 34`** (1 nodes): `__init__.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 35`** (1 nodes): `__init__.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 36`** (1 nodes): `__init__.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 37`** (1 nodes): `__init__.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 38`** (1 nodes): `vite.config.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 39`** (1 nodes): `main.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 40`** (1 nodes): `types.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 41`** (1 nodes): `config.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 42`** (1 nodes): `SmapTileRegistry.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 43`** (1 nodes): `BuildingData.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 44`** (1 nodes): `NPCData.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 45`** (1 nodes): `DialogueScripts.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 46`** (1 nodes): `__init__.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 47`** (1 nodes): `Strategy Relation Types (Inherit/Mutate/Hybrid/Inspire/Complement/Adversarial)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 48`** (1 nodes): `Strategy Agent File Structure (STRATEGY.md + memory/ + persona.md + relations.json)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `NPC Analyst Character Sprite` and `Teahouse Building Sprite`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `Strategy Card UI Element` and `Menu Background`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What connects `Graph Database (Future)`, `Signal Display / Strategy Cards`, `packages/visual (Pixel Community Visualization)` to the rest of the system?**
  _18 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Architecture & Data Flow` be split into smaller, more focused modules?**
  _Cohesion score 0.07 - nodes in this community are weakly interconnected._