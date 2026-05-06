"""外部策略工作区接入 DeepSolo 的注册、投影与物化。"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path

from ..models.account import AccountConfig, AccountData, AccountSummary
from ..models.agent import AgentProfile, Persona
from ..storage.file_store import create_agent_dirs, save_account, save_profile
from ..storage.json_bridge import write_frontend_json


@dataclass
class WorkspaceAgentBinding:
    agent_id: str
    name: str
    role: str
    category: str
    building_id: str
    placement: str
    description: str
    persona: dict[str, str] = field(default_factory=dict)
    live: dict[str, str] = field(default_factory=dict)
    source_files: dict[str, str] = field(default_factory=dict)

    @classmethod
    def from_dict(cls, data: dict) -> "WorkspaceAgentBinding":
        return cls(
            agent_id=str(data.get("agentId", "")).strip(),
            name=str(data.get("name", "")).strip(),
            role=str(data.get("role", "")).strip(),
            category=str(data.get("category", "emerged")).strip() or "emerged",
            building_id=str(data.get("buildingId", "")).strip(),
            placement=str(data.get("placement", "indoor-only")).strip() or "indoor-only",
            description=str(data.get("description", "")).strip(),
            persona=data.get("persona", {}) if isinstance(data.get("persona"), dict) else {},
            live=data.get("live", {}) if isinstance(data.get("live"), dict) else {},
            source_files=data.get("sourceFiles", {}) if isinstance(data.get("sourceFiles"), dict) else {},
        )


@dataclass
class WorkspaceRegistryEntry:
    workspace_id: str
    name: str
    provider: str
    path: str
    agents: list[WorkspaceAgentBinding]

    @classmethod
    def from_dict(cls, data: dict) -> "WorkspaceRegistryEntry":
        return cls(
            workspace_id=str(data.get("id", "")).strip(),
            name=str(data.get("name", "")).strip(),
            provider=str(data.get("provider", "")).strip(),
            path=str(data.get("path", "")).strip(),
            agents=[WorkspaceAgentBinding.from_dict(item) for item in data.get("agents", [])],
        )


@dataclass
class WorkspaceRegistry:
    version: int
    workspaces: list[WorkspaceRegistryEntry]

    @classmethod
    def from_dict(cls, data: dict) -> "WorkspaceRegistry":
        return cls(
            version=int(data.get("version", 1) or 1),
            workspaces=[WorkspaceRegistryEntry.from_dict(item) for item in data.get("workspaces", [])],
        )


@dataclass
class StrategyAgentProjection:
    schema_version: int
    agent_id: str
    workspace_id: str
    workspace_name: str
    building_id: str
    placement: str
    role: str
    profile: dict
    account: dict
    live_state: dict
    battle: dict
    experiences: list[dict]
    workspace_projection: dict

    def to_dict(self) -> dict:
        return {
            "schemaVersion": self.schema_version,
            "agentId": self.agent_id,
            "workspaceId": self.workspace_id,
            "workspaceName": self.workspace_name,
            "buildingId": self.building_id,
            "placement": self.placement,
            "role": self.role,
            "profile": self.profile,
            "account": self.account,
            "liveState": self.live_state,
            "battle": self.battle,
            "experiences": self.experiences,
            "workspaceProjection": self.workspace_projection,
        }


def load_workspace_registry(registry_path: Path) -> WorkspaceRegistry:
    data = _read_json(registry_path, default={"version": 1, "workspaces": []})
    if not isinstance(data, dict):
        raise ValueError(f"Invalid workspace registry: {registry_path}")
    return WorkspaceRegistry.from_dict(data)


def publish_strategy_workspaces(
    registry_path: Path,
    data_dir: Path,
    visual_data_dir: Path | None = None,
) -> list[StrategyAgentProjection]:
    registry = load_workspace_registry(registry_path)
    inbox_dir = data_dir / "inbox" / "strategy_agents"
    inbox_dir.mkdir(parents=True, exist_ok=True)

    projections: list[StrategyAgentProjection] = []
    for workspace in registry.workspaces:
        if workspace.provider != "crypto_live_heartbeat":
            continue
        for binding in workspace.agents:
            projection = build_crypto_projection(workspace, binding)
            projections.append(projection)
            _write_json(inbox_dir / f"{binding.agent_id}.snapshot.json", projection.to_dict())
            materialize_projection(projection, data_dir, visual_data_dir)

    write_frontend_json(data_dir, visual_data_dir=visual_data_dir)
    return projections


def build_crypto_projection(
    workspace: WorkspaceRegistryEntry,
    binding: WorkspaceAgentBinding,
) -> StrategyAgentProjection:
    workspace_root = Path(workspace.path)
    config_path = workspace_root / binding.live.get("configPath", "live/config.json")
    positions_path = workspace_root / binding.live.get("positionsPath", "live/state/positions.json")
    trades_path = workspace_root / binding.live.get("tradesPath", "live/state/trades.json")

    config = _read_json(config_path, default={})
    positions_payload = _read_json(positions_path, default={})
    trades_payload = _read_json(trades_path, default=[])

    positions = positions_payload.get("positions", {}) if isinstance(positions_payload, dict) else {}
    trades = trades_payload if isinstance(trades_payload, list) else []

    strategy_name = str(config.get("strategy", "外部策略")).strip() or "外部策略"
    version = str(config.get("version", "1.0")).strip() or "1.0"
    capital = _safe_number(config.get("capital"), 0.0)
    leverage = _safe_number(config.get("leverage"), 1.0)
    pos_size = _safe_number(config.get("pos_size"), capital)
    total_trades = len(trades)
    realized_pnl = round(sum(_safe_number(item.get("pnl"), 0.0) for item in trades), 4)
    equity = round(capital + realized_pnl, 4) if capital else realized_pnl
    return_pct = round((realized_pnl / capital) * 100, 3) if capital else 0.0
    win_trades = sum(1 for item in trades if _safe_number(item.get("pnl"), 0.0) > 0)
    lose_trades = sum(1 for item in trades if _safe_number(item.get("pnl"), 0.0) < 0)
    win_rate = round((win_trades / total_trades) * 100, 2) if total_trades else 0.0
    avg_return_pct = round(sum((_safe_number(item.get("pnl"), 0.0) / capital) * 100 for item in trades) / total_trades, 3) if capital and total_trades else 0.0
    max_drawdown_pct = round(_estimate_drawdown_pct(capital, trades), 3)
    mode = "dry_run" if bool(config.get("dry_run", True)) else "live"
    symbol = str(config.get("symbol", "")).strip()
    timeframe = str(config.get("timeframe", "")).strip()

    latest_position = _first_position(positions)
    latest_trade = trades[-1] if trades else {}
    position_summary = _format_position_summary(positions)
    last_decision = _build_last_decision(mode, latest_position, latest_trade)

    identity_meta = _read_markdown_metadata(workspace_root / binding.source_files.get("identityPath", "IDENTITY.md"))
    role_name = str(identity_meta.get("角色", "")).strip()
    external_name = str(identity_meta.get("名字", "")).strip()

    profile = AgentProfile(
        id=binding.agent_id,
        type="base",
        name=binding.name,
        category=binding.category,
        description=binding.description or f"{strategy_name} v{version}",
        persona=Persona(
            personality=binding.persona.get("personality") or "数据驱动，重视风控",
            speaking_style=binding.persona.get("speaking_style") or "简洁直接，优先解释当前状态与风险",
            background=binding.persona.get("background") or f"外部工作区 {workspace.workspace_id} 的策略代理，外部身份是「{external_name or workspace.name} {role_name}」。",
        ),
        parents=[],
        relation=None,
        status="alive",
        born_at=_derive_born_at(trades),
        eliminated_at=None,
        llm_tier="dedicated",
    ).to_dict()

    account = AccountData(
        config=AccountConfig(
            initial_capital=capital,
            max_holdings=max(1, int(_safe_number(config.get("max_pos"), 1))),
        ),
        summary=AccountSummary(
            start_date=_derive_start_date(trades),
            end_date=_derive_end_date(trades),
            final_capital=equity,
            total_return_pct=return_pct,
            max_drawdown_pct=max_drawdown_pct,
            total_trades=total_trades,
            win_trades=win_trades,
            lose_trades=lose_trades,
            win_rate=win_rate,
            avg_return_pct=avg_return_pct,
        ),
    ).to_dict()

    live_state = {
        "schemaVersion": 1,
        "mode": mode,
        "strategyName": strategy_name,
        "strategyVersion": version,
        "symbol": symbol,
        "timeframe": timeframe,
        "capital": capital,
        "equity": equity,
        "realizedPnl": realized_pnl,
        "positionsCount": len(positions),
        "positionSummary": position_summary,
        "lastDecision": last_decision,
        "latestPosition": latest_position,
        "latestTrade": latest_trade,
        "workspacePath": str(workspace_root),
        "updatedAt": datetime.now(timezone.utc).isoformat(),
    }

    battle = _build_battle_stats(capital, equity, return_pct, leverage, total_trades, len(positions))
    experiences = _build_experiences(strategy_name, mode, symbol, return_pct, position_summary, latest_trade)
    workspace_projection = {
        "schemaVersion": 1,
        "workspaceId": workspace.workspace_id,
        "workspaceName": workspace.name,
        "provider": workspace.provider,
        "buildingId": binding.building_id,
        "placement": binding.placement,
        "role": binding.role,
        "sourceWorkspace": workspace.workspace_id,
        "mode": mode,
        "symbol": symbol,
        "existenceTier": 10,
    }

    return StrategyAgentProjection(
        schema_version=1,
        agent_id=binding.agent_id,
        workspace_id=workspace.workspace_id,
        workspace_name=workspace.name,
        building_id=binding.building_id,
        placement=binding.placement,
        role=binding.role,
        profile=profile,
        account=account,
        live_state=live_state,
        battle=battle,
        experiences=experiences,
        workspace_projection=workspace_projection,
    )


def materialize_projection(
    projection: StrategyAgentProjection,
    data_dir: Path,
    visual_data_dir: Path | None = None,
) -> None:
    agent_dir = create_agent_dirs(data_dir, projection.agent_id)
    save_profile(data_dir, AgentProfile.from_dict(projection.profile))
    save_account(data_dir, projection.agent_id, AccountData.from_dict(projection.account))
    _write_json(agent_dir / "strategy" / "live_state.json", projection.live_state)
    _write_json(agent_dir / "strategy" / "workspace_projection.json", projection.workspace_projection)
    _write_json(agent_dir / "memory" / "experience.json", projection.experiences)
    _write_json(agent_dir / "battle.json", projection.battle)

    if visual_data_dir is None:
        return

    public_agent_dir = visual_data_dir / "agents" / projection.agent_id
    public_agent_dir.mkdir(parents=True, exist_ok=True)
    _write_json(public_agent_dir / "profile.json", projection.profile)
    _write_json(public_agent_dir / "battle.json", projection.battle)
    _write_json(public_agent_dir / "live_state.json", projection.live_state)


def _derive_born_at(trades: list[dict]) -> str:
    timestamp = trades[0].get("open_time") if trades else None
    if isinstance(timestamp, str) and timestamp:
        return timestamp
    return datetime.now(timezone.utc).isoformat()


def _derive_start_date(trades: list[dict]) -> str:
    timestamp = trades[0].get("open_time") if trades else None
    return _format_trade_date(timestamp)


def _derive_end_date(trades: list[dict]) -> str:
    timestamp = trades[-1].get("close_time") if trades else None
    return _format_trade_date(timestamp)


def _format_trade_date(timestamp: object) -> str:
    if isinstance(timestamp, str) and timestamp:
        return timestamp[:10].replace("-", "")
    return datetime.now(timezone.utc).strftime("%Y%m%d")


def _read_markdown_metadata(path: Path) -> dict[str, str]:
    content = _read_text(path, default="")
    result: dict[str, str] = {}
    for raw_line in content.splitlines():
        line = raw_line.strip()
        if not line.startswith("- ") or "：" not in line:
            continue
        key, _, value = line[2:].partition("：")
        key = key.strip()
        value = value.strip()
        if key and value:
            result[key] = value
    return result


def _build_last_decision(mode: str, latest_position: dict, latest_trade: dict) -> dict:
    if latest_position:
        return {
            "action": "hold",
            "confidence": "medium",
            "reason": str(latest_position.get("reason", "持仓中，等待下一次心跳")).strip() or "持仓中，等待下一次心跳",
            "source": mode,
        }
    if latest_trade:
        return {
            "action": "flat",
            "confidence": "medium",
            "reason": str(latest_trade.get("reason", "最近一次交易已平仓")).strip() or "最近一次交易已平仓",
            "source": mode,
        }
    return {
        "action": "observe",
        "confidence": "low",
        "reason": "当前没有持仓，等待信号",
        "source": mode,
    }


def _format_position_summary(positions: dict[str, dict]) -> str:
    if not positions:
        return "空仓"
    parts = []
    for grid_id, position in positions.items():
        direction = str(position.get("direction", "long"))
        entry_price = _safe_number(position.get("entry_price"), 0.0)
        parts.append(f"{grid_id} {direction} @ {entry_price:.2f}")
    return " | ".join(parts)


def _first_position(positions: dict[str, dict]) -> dict:
    for grid_id, position in positions.items():
        data = dict(position)
        data["gridId"] = grid_id
        return data
    return {}


def _estimate_drawdown_pct(capital: float, trades: list[dict]) -> float:
    if capital <= 0 or not trades:
        return 0.0
    peak = capital
    equity = capital
    max_drawdown = 0.0
    for trade in trades:
        equity += _safe_number(trade.get("pnl"), 0.0)
        if equity > peak:
            peak = equity
        if peak > 0:
            drawdown = ((peak - equity) / peak) * 100
            if drawdown > max_drawdown:
                max_drawdown = drawdown
    return max_drawdown


def _build_battle_stats(
    capital: float,
    equity: float,
    return_pct: float,
    leverage: float,
    total_trades: int,
    positions_count: int,
) -> dict:
    health_ratio = _clamp(equity / capital if capital > 0 else 1.0, 0.45, 1.7)
    max_hp = int(720 * health_ratio)
    max_mp = int(260 + _clamp(leverage, 1.0, 8.0) * 28)
    attack = int(58 + min(total_trades, 40) + max(return_pct, -10.0) * 1.2)
    defense = int(52 + max(0.0, 12.0 - abs(min(return_pct, 0.0))))
    speed = int(34 + min(positions_count, 3) * 4 + _clamp(leverage, 1.0, 6.0) * 2)
    return {
        "maxHp": max(380, max_hp),
        "maxMp": max(180, max_mp),
        "attack": max(36, attack),
        "defense": max(28, defense),
        "speed": max(24, speed),
        "moveRange": 4,
        "wugongId": "jingang_fumo" if positions_count > 0 else "taiji_quan",
    }


def _build_experiences(
    strategy_name: str,
    mode: str,
    symbol: str,
    return_pct: float,
    position_summary: str,
    latest_trade: dict,
) -> list[dict]:
    timestamp = datetime.now(timezone.utc).isoformat()
    results = [
        {
            "timestamp": timestamp,
            "type": "workspace_sync",
            "content": f"{strategy_name} 已从外部工作区同步，当前模式 {mode}，交易标的 {symbol or '未配置'}。",
        },
        {
            "timestamp": timestamp,
            "type": "portfolio_state",
            "content": f"当前收益 {return_pct:+.2f}%，持仓状态：{position_summary}。",
        },
    ]
    if latest_trade:
        reason = str(latest_trade.get("reason", "最近一次交易已结束")).strip() or "最近一次交易已结束"
        pnl = _safe_number(latest_trade.get("pnl"), 0.0)
        results.append({
            "timestamp": timestamp,
            "type": "trade_reflection",
            "content": f"最近一次平仓盈亏 {pnl:+.2f}，原因：{reason}。",
        })
    return results


def _safe_number(value: object, default: float) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _clamp(value: float, minimum: float, maximum: float) -> float:
    return max(minimum, min(maximum, value))


def _read_json(path: Path, default):
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return default


def _read_text(path: Path, default: str) -> str:
    if not path.exists():
        return default
    return path.read_text(encoding="utf-8")


def _write_json(path: Path, data: dict | list) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
