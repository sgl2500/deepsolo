"""NPC 上下文构建 — 从 agent 目录读取数据，构建 LLM system prompt"""

from __future__ import annotations

import json
from pathlib import Path

from ..storage.file_store import load_profile, load_account, _agent_dir, _read_json


def build_system_prompt(data_dir: Path, agent_id: str) -> str:
    """构建 NPC 的 system prompt

    包含：角色设定 + 策略表现 + 经验记忆 + 近期对话摘要
    """
    profile = load_profile(data_dir, agent_id)
    if not profile:
        return "你是一个量化交易策略 Agent。"

    # 基本人设
    parts = [
        f"你是「{profile.name}」，一个量化交易策略 Agent。",
        f"你的策略类别是「{profile.category}」。",
        f"策略描述：{profile.description}",
        "",
        f"## 性格特征",
        f"- 性格：{profile.persona.personality}",
        f"- 说话风格：{profile.persona.speaking_style}",
        f"- 背景：{profile.persona.background}",
    ]

    # 策略表现数据
    account = load_account(data_dir, agent_id)
    if account:
        parts.extend([
            "",
            "## 当前策略表现",
            f"- 收益率：{account.summary.total_return_pct:+.2f}%",
            f"- 最大回撤：{account.summary.max_drawdown_pct:.2f}%",
            f"- 总交易次数：{account.summary.total_trades}",
            f"- 胜率：{account.summary.win_rate:.2f}%",
            f"- 平均收益：{account.summary.avg_return_pct:+.3f}%",
            f"- 当前资金：{account.summary.final_capital:,.0f}",
            f"- 回测区间：{account.summary.start_date} ~ {account.summary.end_date}",
        ])

    # 经验记忆
    experiences = _load_experiences(data_dir, agent_id)
    if experiences:
        parts.append("")
        parts.append("## 你的经验教训")
        for exp in experiences[-5:]:  # 最近5条
            parts.append(f"- [{exp['type']}] {exp['content']}")

    # 近期对话摘要
    recent = _load_recent_conversations(data_dir, agent_id, limit=3)
    if recent:
        parts.append("")
        parts.append("## 最近与其他策略的交流")
        for conv in recent:
            parts.append(f"- 与「{conv['with_agent']}」讨论了{conv['topic']}话题")

    parts.extend([
        "",
        "## 对话要求",
        "请以你的角色身份回答问题，保持性格一致。",
        "用中文回答，简洁自然，不要过长的段落。",
        "可以适当引用你的策略数据来支持观点。",
        "如果被问到超出你角色范围的问题，礼貌地回到交易相关话题。",
    ])

    return "\n".join(parts)


def load_chat_history(data_dir: Path, agent_id: str, limit: int = 20) -> list[dict]:
    """加载与观察者的对话历史，返回 OpenAI 格式的消息列表"""
    conv_path = _agent_dir(data_dir, agent_id) / "memory" / "conversations" / "with_observer.json"
    if not conv_path.exists():
        return []

    data = _read_json(conv_path)
    turns = data.get("turns", [])

    # 取最近 limit 条
    recent = turns[-limit:] if len(turns) > limit else turns

    messages = []
    for turn in recent:
        messages.append({"role": turn["role"], "text": turn["text"]})

    return messages


def _load_experiences(data_dir: Path, agent_id: str) -> list[dict]:
    """加载经验记忆"""
    path = _agent_dir(data_dir, agent_id) / "memory" / "experience.json"
    if not path.exists():
        return []
    return _read_json(path)


def _load_recent_conversations(data_dir: Path, agent_id: str, limit: int = 3) -> list[dict]:
    """加载近期与其他 NPC 的对话摘要"""
    conv_dir = _agent_dir(data_dir, agent_id) / "memory" / "conversations"
    if not conv_dir.exists():
        return []

    results = []
    for f in sorted(conv_dir.glob("*.json"), key=lambda p: p.stat().st_mtime, reverse=True):
        if f.name == "with_observer.json":
            continue
        data = _read_json(f)
        results.append({
            "with_agent": data.get("with_agent", f.stem.replace("with_", "")),
            "topic": data.get("topic", ""),
            "timestamp": data.get("timestamp", ""),
        })
        if len(results) >= limit:
            break

    return results
