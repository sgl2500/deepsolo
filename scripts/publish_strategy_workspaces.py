#!/usr/bin/env python3
"""将外部策略工作区同步为 DeepSolo 可消费的 agent 数据。"""

from __future__ import annotations

from pathlib import Path
import sys

PROJECT_ROOT = Path(__file__).resolve().parent.parent
CORE_ROOT = PROJECT_ROOT / "packages" / "core"

if str(CORE_ROOT) not in sys.path:
    sys.path.insert(0, str(CORE_ROOT))

from deepsolo.projection import publish_strategy_workspaces


def main() -> int:
    registry_path = PROJECT_ROOT / "config" / "strategy_workspaces.json"
    data_dir = PROJECT_ROOT / "data"
    visual_data_dir = PROJECT_ROOT / "packages" / "visual" / "public" / "data"

    projections = publish_strategy_workspaces(
        registry_path=registry_path,
        data_dir=data_dir,
        visual_data_dir=visual_data_dir,
    )

    print(f"Published {len(projections)} workspace agent(s).")
    for projection in projections:
        print(
            f"- {projection.agent_id} -> {projection.workspace_id} "
            f"({projection.workspace_projection.get('mode', 'unknown')})"
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
