from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
CORE_ROOT = REPO_ROOT / "packages" / "core"

if str(CORE_ROOT) not in sys.path:
    sys.path.insert(0, str(CORE_ROOT))

from deepsolo.llm.context import build_system_prompt
from deepsolo.projection import build_crypto_projection, load_workspace_registry, publish_strategy_workspaces


class StrategyWorkspaceProjectionTest(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.root = Path(self.temp_dir.name)
        self.crypto_root = self.root / "crypto"
        self.data_dir = self.root / "data"
        self.visual_data_dir = self.root / "visual" / "public" / "data"
        self.registry_path = self.data_dir / "workspaces" / "registry.json"

        self._seed_crypto_workspace()
        self._seed_registry()
        self.visual_data_dir.mkdir(parents=True, exist_ok=True)

    def tearDown(self) -> None:
        self.temp_dir.cleanup()

    def test_load_registry_and_build_projection(self) -> None:
        registry = load_workspace_registry(self.registry_path)
        self.assertEqual(registry.version, 1)
        self.assertEqual(len(registry.workspaces), 1)

        workspace = registry.workspaces[0]
        binding = workspace.agents[0]
        projection = build_crypto_projection(workspace, binding)

        self.assertEqual(projection.agent_id, "digital_master")
        self.assertEqual(projection.workspace_id, "crypto")
        self.assertEqual(projection.building_id, "digital_sect")
        self.assertEqual(projection.placement, "indoor-only")
        self.assertEqual(projection.profile["name"], "数字掌门")
        self.assertEqual(projection.live_state["symbol"], "BTC-USDT-SWAP")
        self.assertEqual(projection.live_state["positionsCount"], 1)
        self.assertEqual(projection.workspace_projection["role"], "掌门")

    def test_publish_materializes_agent_and_frontend_json(self) -> None:
        projections = publish_strategy_workspaces(
            registry_path=self.registry_path,
            data_dir=self.data_dir,
            visual_data_dir=self.visual_data_dir,
        )
        self.assertEqual(len(projections), 1)

        snapshot_path = self.data_dir / "inbox" / "strategy_agents" / "digital_master.snapshot.json"
        profile_path = self.data_dir / "agents" / "digital_master" / "profile.json"
        account_path = self.data_dir / "agents" / "digital_master" / "strategy" / "账户信息.json"
        live_state_path = self.data_dir / "agents" / "digital_master" / "strategy" / "live_state.json"
        frontend_strategies = self.data_dir / "frontend" / "strategies.json"

        for path in [snapshot_path, profile_path, account_path, live_state_path, frontend_strategies]:
            self.assertTrue(path.exists(), f"missing {path}")

        strategies = json.loads(frontend_strategies.read_text(encoding="utf-8"))
        digital_master = next(item for item in strategies if item["id"] == "digital_master")
        self.assertEqual(digital_master["buildingId"], "digital_sect")
        self.assertEqual(digital_master["placement"], "indoor-only")
        self.assertEqual(digital_master["sourceWorkspace"], "crypto")
        self.assertEqual(digital_master["mode"], "dry_run")

        public_battle = self.visual_data_dir / "agents" / "digital_master" / "battle.json"
        self.assertTrue(public_battle.exists())

    def test_chat_prompt_includes_live_state(self) -> None:
        publish_strategy_workspaces(
            registry_path=self.registry_path,
            data_dir=self.data_dir,
            visual_data_dir=self.visual_data_dir,
        )
        prompt = build_system_prompt(self.data_dir, "digital_master")
        self.assertIn("当前实盘/模拟状态", prompt)
        self.assertIn("BTC-USDT-SWAP", prompt)
        self.assertIn("S0 short @ 75306.60", prompt)
        self.assertIn("最近决策", prompt)

    def _seed_crypto_workspace(self) -> None:
        (self.crypto_root / "live" / "state").mkdir(parents=True, exist_ok=True)
        (self.crypto_root / "IDENTITY.md").write_text(
            "# Identity\n\n- 名字：数字货币\n- 角色：加密货币市场分析师与投资顾问\n",
            encoding="utf-8",
        )
        (self.crypto_root / "SOUL.md").write_text(
            "# SOUL\n\n专注于加密货币市场分析、交易策略和投资建议。\n",
            encoding="utf-8",
        )
        (self.crypto_root / "MEMORY.md").write_text(
            "# MEMORY\n\n- 核心项目：BTC 均值回归\n",
            encoding="utf-8",
        )

        self._write_json(
            self.crypto_root / "live" / "config.json",
            {
                "strategy": "BTC均值回归",
                "version": "3.1",
                "dry_run": True,
                "capital": 500,
                "pos_size": 250,
                "leverage": 3,
                "max_pos": 1,
                "symbol": "BTC-USDT-SWAP",
                "timeframe": "1H",
            },
        )
        self._write_json(
            self.crypto_root / "live" / "state" / "positions.json",
            {
                "updated_at": "2026-04-17T16:42:40.931407",
                "positions": {
                    "S0": {
                        "direction": "short",
                        "entry_price": 75306.6,
                        "quantity": 0.01,
                        "open_time": "2026-04-14T22:42:55.371440",
                        "stop_loss": 86602.59,
                        "take_profit": 60245.28,
                        "highest": 75357.4,
                        "lowest": 75306.6,
                        "reason": "RSI超买: RSI=71",
                    }
                },
            },
        )
        self._write_json(
            self.crypto_root / "live" / "state" / "trades.json",
            [
                {
                    "grid_id": "L0",
                    "direction": "long",
                    "open_time": "2026-04-10T10:00:00",
                    "close_time": "2026-04-11T12:00:00",
                    "entry_price": 68000.0,
                    "exit_price": 69250.0,
                    "fill_price": 69210.0,
                    "pnl": 12.5,
                    "total_fee": 0.8,
                    "reason": "止盈",
                }
            ],
        )

    def _seed_registry(self) -> None:
        self.registry_path.parent.mkdir(parents=True, exist_ok=True)
        self._write_json(
            self.registry_path,
            {
                "version": 1,
                "workspaces": [
                    {
                        "id": "crypto",
                        "name": "数字门派",
                        "provider": "crypto_live_heartbeat",
                        "path": str(self.crypto_root),
                        "agents": [
                            {
                                "agentId": "digital_master",
                                "name": "数字掌门",
                                "role": "掌门",
                                "category": "emerged",
                                "buildingId": "digital_sect",
                                "placement": "indoor-only",
                                "description": "外部 crypto 工作区映射进来的掌门策略。",
                                "persona": {
                                    "personality": "数据驱动，谨慎执行，重视风控与复盘",
                                    "speaking_style": "简洁直接，优先引用当前策略状态和风险数据",
                                    "background": "数字门派掌门，长期驻守外部 crypto 工作区。",
                                },
                                "live": {
                                    "configPath": "live/config.json",
                                    "positionsPath": "live/state/positions.json",
                                    "tradesPath": "live/state/trades.json",
                                },
                                "sourceFiles": {
                                    "identityPath": "IDENTITY.md",
                                    "soulPath": "SOUL.md",
                                    "memoryPath": "MEMORY.md",
                                },
                            }
                        ],
                    }
                ],
            },
        )

    def _write_json(self, path: Path, payload: dict | list) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    unittest.main()
