"""前端 JSON 桥接 — 生成前端可直接消费的 JSON 文件"""

from __future__ import annotations

import json
from pathlib import Path

from .file_store import load_profile, list_agents, load_account, load_world_status
from ..models.strategy import StrategyData
from ..models.world import WorldStatus


def _derive_state(return_pct: float) -> str:
    """根据收益率推导 Agent 状态，与前端 GameStore.loadInitialData 逻辑一致"""
    if return_pct > 20:
        return "profitable"
    if return_pct > 0:
        return "competing"
    if return_pct > -10:
        return "discussing"
    return "idle"


def generate_strategies_json(base_path: Path) -> list[dict]:
    """扫描所有 agent，生成前端 Strategy[] 格式"""
    strategies: list[dict] = []

    for agent_id in list_agents(base_path):
        profile = load_profile(base_path, agent_id)
        if profile is None or profile.status != "alive":
            continue

        account = load_account(base_path, agent_id)

        if account:
            return_pct = account.summary.total_return_pct
            max_dd = account.summary.max_drawdown_pct
            total_trades = account.summary.total_trades
            win_rate = account.summary.win_rate
            avg_return = account.summary.avg_return_pct
            capital = account.summary.final_capital
        else:
            return_pct = 0
            max_dd = 0
            total_trades = 0
            win_rate = 0
            avg_return = 0
            capital = 0

        strategies.append({
            "id": profile.id,
            "name": profile.name,
            "category": profile.category,
            "description": profile.description,
            "returnPct": return_pct,
            "maxDrawdownPct": max_dd,
            "totalTrades": total_trades,
            "winRate": win_rate,
            "avgReturnPct": avg_return,
            "capital": capital,
            "state": _derive_state(return_pct),
            "parents": profile.parents,
            "relation": profile.relation,
        })

    return strategies


def generate_world_json(base_path: Path) -> dict:
    """生成世界状态 JSON"""
    status = load_world_status(base_path)
    if status:
        return status.to_dict()
    return {
        "tick": 0,
        "agentCount": len(list_agents(base_path)),
        "lastHeartbeat": "",
        "nextHeartbeat": "",
    }


def write_frontend_json(base_path: Path) -> None:
    """将 strategies.json 和 world.json 写入 frontend/ 目录"""
    frontend_dir = base_path / "frontend"
    frontend_dir.mkdir(parents=True, exist_ok=True)

    strategies = generate_strategies_json(base_path)
    (frontend_dir / "strategies.json").write_text(
        json.dumps(strategies, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    world = generate_world_json(base_path)
    (frontend_dir / "world.json").write_text(
        json.dumps(world, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    # 同步到前端 Vite 静态目录
    visual_data = base_path.parent / "packages" / "visual" / "public" / "data"
    if visual_data.exists():
        import shutil
        shutil.copy2(frontend_dir / "strategies.json", visual_data / "strategies.json")
        shutil.copy2(frontend_dir / "world.json", visual_data / "world.json")
