"""记忆系统模型"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class DialogueTurn:
    """对话中的一轮发言"""
    agent_id: str
    role: str       # "winner" | "loser" | "neutral"
    text: str


@dataclass
class Experience:
    """Agent 的经验教训"""
    timestamp: str
    type: str       # "success" | "failure" | "insight"
    content: str


@dataclass
class Conversation:
    """与其他 Agent 的对话记录"""
    with_agent: str
    timestamp: str
    topic: str      # "market_trend" | "strategy_review" | "risk_control" | "opportunity"
    turns: list[DialogueTurn] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "with_agent": self.with_agent,
            "timestamp": self.timestamp,
            "topic": self.topic,
            "turns": [
                {"agent_id": t.agent_id, "role": t.role, "text": t.text}
                for t in self.turns
            ],
        }

    @classmethod
    def from_dict(cls, d: dict) -> Conversation:
        turns = [
            DialogueTurn(agent_id=t["agent_id"], role=t["role"], text=t["text"])
            for t in d.get("turns", [])
        ]
        return cls(
            with_agent=d["with_agent"],
            timestamp=d["timestamp"],
            topic=d["topic"],
            turns=turns,
        )
