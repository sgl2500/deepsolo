"""文件系统存储层 — Agent 目录的 CRUD"""

from __future__ import annotations

import json
import shutil
from pathlib import Path

from ..models.agent import AgentProfile
from ..models.strategy import StrategyData
from ..models.account import AccountData
from ..models.memory import Conversation, Experience
from ..models.world import WorldStatus


def init_data_dir(base_path: str | Path) -> Path:
    """初始化 data/ 目录结构"""
    base = Path(base_path)
    (base / "agents").mkdir(parents=True, exist_ok=True)
    (base / "frontend").mkdir(parents=True, exist_ok=True)
    return base


def _agent_dir(base_path: Path, agent_id: str) -> Path:
    return base_path / "agents" / agent_id


def create_agent_dirs(base_path: Path, agent_id: str) -> Path:
    """创建 agent 的完整目录结构"""
    d = _agent_dir(base_path, agent_id)
    (d / "strategy").mkdir(parents=True, exist_ok=True)
    (d / "memory" / "conversations").mkdir(parents=True, exist_ok=True)
    return d


def save_profile(base_path: Path, profile: AgentProfile) -> None:
    """保存 profile.json"""
    d = _agent_dir(base_path, profile.id)
    d.mkdir(parents=True, exist_ok=True)
    _write_json(d / "profile.json", profile.to_dict())


def load_profile(base_path: Path, agent_id: str) -> AgentProfile | None:
    """读取 profile.json"""
    p = _agent_dir(base_path, agent_id) / "profile.json"
    if not p.exists():
        return None
    return AgentProfile.from_dict(_read_json(p))


def save_account(base_path: Path, agent_id: str, account: AccountData) -> None:
    """保存 账户信息.json"""
    d = _agent_dir(base_path, agent_id) / "strategy"
    d.mkdir(parents=True, exist_ok=True)
    _write_json(d / "账户信息.json", account.to_dict())


def load_account(base_path: Path, agent_id: str) -> AccountData | None:
    """读取 账户信息.json"""
    p = _agent_dir(base_path, agent_id) / "strategy" / "账户信息.json"
    if not p.exists():
        return None
    return AccountData.from_dict(_read_json(p))


def save_signals(base_path: Path, agent_id: str, signals: list[dict]) -> None:
    """保存 买卖信号.json"""
    d = _agent_dir(base_path, agent_id) / "strategy"
    d.mkdir(parents=True, exist_ok=True)
    _write_json(d / "买卖信号.json", signals)


def save_trades(base_path: Path, agent_id: str, trades: list[dict]) -> None:
    """保存 交易记录.json"""
    d = _agent_dir(base_path, agent_id) / "strategy"
    d.mkdir(parents=True, exist_ok=True)
    _write_json(d / "交易记录.json", trades)


def save_stock_selection(base_path: Path, agent_id: str, selection: list[dict]) -> None:
    """保存 盘前选股.json"""
    d = _agent_dir(base_path, agent_id) / "strategy"
    d.mkdir(parents=True, exist_ok=True)
    _write_json(d / "盘前选股.json", selection)


def save_strategy_script(base_path: Path, agent_id: str, script_name: str, content: str) -> None:
    """保存策略生成脚本 (.py)"""
    d = _agent_dir(base_path, agent_id) / "strategy"
    d.mkdir(parents=True, exist_ok=True)
    (d / script_name).write_text(content, encoding="utf-8")


def save_experiences(base_path: Path, agent_id: str, experiences: list[Experience]) -> None:
    """保存 experience.json"""
    d = _agent_dir(base_path, agent_id) / "memory"
    d.mkdir(parents=True, exist_ok=True)
    data = [
        {"timestamp": e.timestamp, "type": e.type, "content": e.content}
        for e in experiences
    ]
    _write_json(d / "experience.json", data)


def load_experiences(base_path: Path, agent_id: str) -> list[dict]:
    """读取 experience.json"""
    path = _agent_dir(base_path, agent_id) / "memory" / "experience.json"
    if not path.exists():
        return []
    return _read_json(path)


def save_conversation(base_path: Path, agent_id: str, conversation: Conversation) -> None:
    """保存与某个 agent 的对话"""
    d = _agent_dir(base_path, agent_id) / "memory" / "conversations"
    d.mkdir(parents=True, exist_ok=True)
    filename = f"with_{conversation.with_agent}.json"
    _write_json(d / filename, conversation.to_dict())


def list_agents(base_path: Path) -> list[str]:
    """列出所有 agent ID"""
    agents_dir = base_path / "agents"
    if not agents_dir.exists():
        return []
    return sorted(
        d.name for d in agents_dir.iterdir()
        if d.is_dir() and (d / "profile.json").exists()
    )


def list_alive_agents(base_path: Path) -> list[str]:
    """列出所有存活 agent ID"""
    result = []
    for agent_id in list_agents(base_path):
        profile = load_profile(base_path, agent_id)
        if profile and profile.status == "alive":
            result.append(agent_id)
    return result


def save_world_status(base_path: Path, status: WorldStatus) -> None:
    """保存世界状态"""
    _write_json(base_path / "world_status.json", status.to_dict())


def load_world_status(base_path: Path) -> WorldStatus | None:
    """读取世界状态"""
    p = base_path / "world_status.json"
    if not p.exists():
        return None
    return WorldStatus.from_dict(_read_json(p))


def append_experience(base_path: Path, agent_id: str, experience: Experience) -> None:
    """追加一条经验到 experience.json"""
    d = _agent_dir(base_path, agent_id) / "memory"
    d.mkdir(parents=True, exist_ok=True)
    path = d / "experience.json"

    if path.exists():
        data = _read_json(path)
    else:
        data = []

    data.append({
        "timestamp": experience.timestamp,
        "type": experience.type,
        "content": experience.content,
    })
    _write_json(path, data)


def append_conversation_turn(
    base_path: Path,
    agent_id: str,
    with_agent: str,
    turn: dict,
) -> None:
    """追加一轮对话到与某个 agent 的对话文件

    Args:
        turn: {"agent_id": str, "role": str, "text": str, "timestamp": str}
    """
    d = _agent_dir(base_path, agent_id) / "memory" / "conversations"
    d.mkdir(parents=True, exist_ok=True)

    filename = f"with_{with_agent}.json"
    path = d / filename

    if path.exists():
        data = _read_json(path)
    else:
        data = {
            "with_agent": with_agent,
            "topic": "",
            "turns": [],
        }

    data.setdefault("turns", []).append(turn)
    data["last_updated"] = turn.get("timestamp", "")

    _write_json(path, data)


def remove_agent(base_path: Path, agent_id: str) -> None:
    """删除 agent 目录"""
    d = _agent_dir(base_path, agent_id)
    if d.exists():
        shutil.rmtree(d)


def is_strategy_implemented(base_path: Path, agent_id: str) -> bool:
    """判断 Agent 的策略是否已被实现（夜间系统已回填数据）。

    标准：交易记录.json 存在且非空，且有日度账户数据。
    """
    trades_path = _agent_dir(base_path, agent_id) / "strategy" / "交易记录.json"
    account_path = _agent_dir(base_path, agent_id) / "strategy" / "账户信息.json"

    if not trades_path.exists() or not account_path.exists():
        return False

    try:
        trades = _read_json(trades_path)
        if not trades or not isinstance(trades, list) or len(trades) == 0:
            return False
        account = _read_json(account_path)
        if not account.get("daily"):
            return False
        return True
    except (json.JSONDecodeError, KeyError):
        return False


# ── helpers ──

def _write_json(path: Path, data: dict | list) -> None:
    path.write_text(
        json.dumps(data, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def _read_json(path: Path) -> dict | list:
    return json.loads(path.read_text(encoding="utf-8"))
