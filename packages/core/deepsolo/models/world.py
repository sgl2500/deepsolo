"""世界状态模型"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass
class WorldStatus:
    """世界状态"""
    tick: int                 # 心跳计数
    agent_count: int          # 当前存活 NPC 数量
    last_heartbeat: str       # 上次心跳时间 ISO
    next_heartbeat: str       # 下次心跳时间 ISO

    def to_dict(self) -> dict:
        return {
            "tick": self.tick,
            "agentCount": self.agent_count,
            "lastHeartbeat": self.last_heartbeat,
            "nextHeartbeat": self.next_heartbeat,
        }

    @classmethod
    def from_dict(cls, d: dict) -> WorldStatus:
        return cls(
            tick=d.get("tick", 0),
            agent_count=d.get("agentCount", 0),
            last_heartbeat=d.get("lastHeartbeat", ""),
            next_heartbeat=d.get("nextHeartbeat", ""),
        )
