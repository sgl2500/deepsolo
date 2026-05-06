# Strategy Workspace Ingestion Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Register external strategy workspaces such as `crypto`, publish their runtime state into DeepSolo, and expose them as in-game NPC strategy data without merging the codebases.

**Architecture:** Keep external workspaces isolated on disk, add a registry in DeepSolo, and materialize each published workspace agent into the existing `data/agents/{id}` shape plus a richer workspace projection file. Reuse the current `strategies.json`, indoor strategy NPC, and WebSocket chat pipeline so the first phase does not require a new dialogue router.

**Tech Stack:** Python 3.11+, dataclasses, JSON file bridge, TypeScript frontend polling, Phaser indoor strategy NPCs

---

### Task 1: Define workspace registry and projection schema

**Files:**
- Create: `config/strategy_workspaces.json`
- Create: `packages/core/deepsolo/projection/__init__.py`
- Create: `packages/core/deepsolo/projection/strategy_workspace.py`
- Test: `tests/test_strategy_workspace_projection.py`

**Step 1: Write the failing test**

Create a test that loads a sample registry, builds a projection payload for a fake crypto workspace, and asserts the projection contains:
- `agentId`
- `workspaceId`
- `buildingId`
- `placement`
- `profile`
- `strategy`
- `liveState`

**Step 2: Run test to verify it fails**

Run: `python3 -m unittest tests.test_strategy_workspace_projection -v`
Expected: FAIL because the projection module does not exist yet.

**Step 3: Write minimal implementation**

Add dataclasses for:
- `WorkspaceAgentBinding`
- `WorkspaceRegistryEntry`
- `WorkspaceRegistry`
- `StrategyAgentProjection`

Add JSON loaders and serializers so the test can build a projection object from registry data and runtime data.

**Step 4: Run test to verify it passes**

Run: `python3 -m unittest tests.test_strategy_workspace_projection -v`
Expected: PASS for registry parsing and projection serialization.

### Task 2: Publish external workspace state into DeepSolo agent directories

**Files:**
- Create: `scripts/publish_strategy_workspaces.py`
- Modify: `packages/core/deepsolo/storage/json_bridge.py`
- Test: `tests/test_strategy_workspace_projection.py`

**Step 1: Write the failing test**

Extend the test to create a temp `crypto` workspace with:
- `live/config.json`
- `live/state/positions.json`
- `live/state/trades.json`
- `IDENTITY.md`
- `SOUL.md`

Then run the publisher and assert it writes:
- `data/inbox/strategy_agents/digital_master.snapshot.json`
- `data/agents/digital_master/profile.json`
- `data/agents/digital_master/strategy/账户信息.json`
- `data/agents/digital_master/strategy/live_state.json`
- `data/frontend/strategies.json`

**Step 2: Run test to verify it fails**

Run: `python3 -m unittest tests.test_strategy_workspace_projection -v`
Expected: FAIL because no publisher exists yet.

**Step 3: Write minimal implementation**

Implement a publisher that:
- reads `data/workspaces/registry.json`
- reads the crypto workspace runtime files
- computes a live summary
- writes a snapshot into `data/inbox/strategy_agents/`
- materializes a standard DeepSolo agent directory
- refreshes `data/frontend/strategies.json`

**Step 4: Run test to verify it passes**

Run: `python3 -m unittest tests.test_strategy_workspace_projection -v`
Expected: PASS for snapshot generation and agent materialization.

### Task 3: Enrich chat context with live workspace state

**Files:**
- Modify: `packages/core/deepsolo/llm/context.py`
- Test: `tests/test_strategy_workspace_projection.py`

**Step 1: Write the failing test**

Add a test that creates `strategy/live_state.json` for a published agent and asserts `build_system_prompt(...)` includes:
- strategy mode
- symbol
- equity
- current positions
- last decision

**Step 2: Run test to verify it fails**

Run: `python3 -m unittest tests.test_strategy_workspace_projection -v`
Expected: FAIL because live state is not included in prompts yet.

**Step 3: Write minimal implementation**

Load `live_state.json` when present and append a compact "当前实盘/模拟状态" section to the system prompt.

**Step 4: Run test to verify it passes**

Run: `python3 -m unittest tests.test_strategy_workspace_projection -v`
Expected: PASS.

### Task 4: Surface workspace-backed strategies in the visual layer

**Files:**
- Modify: `packages/visual/src/types/strategy.ts`
- Modify: `packages/visual/src/content/StrategyNpcPlacement.ts`
- Modify: `packages/visual/src/systems/EntitySystem.ts`
- Test: `packages/visual/tests/unit/indoor_room_templates.test.ts`

**Step 1: Write the failing test**

Add a TypeScript-side assertion or fixture-backed unit check that a strategy with:
- `placement = "indoor-only"`
- `buildingId = "digital_sect"`

is routed into the digital sect indoor slots and is not spawned as a world roaming strategy agent.

**Step 2: Run test to verify it fails**

Run: `cd packages/visual && npm run test:unit`
Expected: FAIL because the strategy placement metadata is ignored.

**Step 3: Write minimal implementation**

Add optional strategy metadata:
- `placement?: "world" | "indoor-only"`
- `buildingId?: string`
- `role?: string`
- `sourceWorkspace?: string`
- `mode?: string`

Use `buildingId` when selecting indoor strategy slots, and skip world agent creation for `indoor-only` strategies.

**Step 4: Run test to verify it passes**

Run: `cd packages/visual && npm run test:unit`
Expected: PASS.

### Task 5: Seed the digital sect master from the real crypto workspace

**Files:**
- Modify: `config/strategy_workspaces.json`
- Generate: `data/agents/digital_master/*`
- Generate: `packages/visual/public/data/agents/digital_master/*`

**Step 1: Run the publisher against the real workspace**

Run: `python3 scripts/publish_strategy_workspaces.py`
Expected: `digital_master` files are written from `/Users/sunguanlong/Desktop/AIGC/crypto`.

**Step 2: Verify frontend artifacts**

Run:
- `rg -n "digital_master|数字掌门" data/frontend/strategies.json`
- `rg -n "digital_master" packages/visual/public/data/strategies.json`

Expected: the strategy exists in both files.

**Step 3: Verify visual build**

Run: `cd packages/visual && npm run check`
Expected: typecheck, unit tests, and build all pass.

### Task 6: Commit checkpoint

**Files:**
- Commit all files from Tasks 1-5

**Step 1: Review diff**

Run: `git diff --stat`

**Step 2: Commit**

```bash
git add docs/plans/2026-05-06-strategy-workspace-ingestion.md \
  data/workspaces/registry.json \
  packages/core/deepsolo/projection \
  packages/core/deepsolo/storage/json_bridge.py \
  packages/core/deepsolo/llm/context.py \
  packages/visual/src/types/strategy.ts \
  packages/visual/src/content/StrategyNpcPlacement.ts \
  packages/visual/src/systems/EntitySystem.ts \
  scripts/publish_strategy_workspaces.py \
  tests/test_strategy_workspace_projection.py
git commit -m "feat: ingest external strategy workspaces"
```
