"""Agent 个人信息模型"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class Persona:
    """Agent 人设"""
    personality: str          # 性格特征
    speaking_style: str       # 说话风格
    background: str           # 背景故事


@dataclass
class AgentProfile:
    """Agent 个人信息，对应前端 profile.json"""
    id: str                   # 唯一标识，如 "base_001"
    type: str                 # "base" | "derived"
    name: str                 # 显示名称
    category: str             # "hot" | "normal" | "emerged"
    description: str          # 策略描述
    persona: Persona          # 人设
    parents: list[str] = field(default_factory=list)   # 衍生来源的 parent ID
    relation: str | None = None  # "杂交" | "变异" | "启发" | None
    status: str = "alive"     # "alive" | "pending" | "eliminated" | "heaven_removed"
    born_at: str = ""         # ISO datetime
    eliminated_at: str | None = None
    llm_tier: str = "shared"  # "shared" | "dedicated"

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "type": self.type,
            "name": self.name,
            "category": self.category,
            "description": self.description,
            "persona": {
                "personality": self.persona.personality,
                "speaking_style": self.persona.speaking_style,
                "background": self.persona.background,
            },
            "parents": self.parents,
            "relation": self.relation,
            "status": self.status,
            "born_at": self.born_at,
            "eliminated_at": self.eliminated_at,
            "llm_tier": self.llm_tier,
        }

    @classmethod
    def from_dict(cls, d: dict) -> AgentProfile:
        persona_data = d.get("persona", {})
        return cls(
            id=d["id"],
            type=d["type"],
            name=d["name"],
            category=d["category"],
            description=d["description"],
            persona=Persona(
                personality=persona_data.get("personality", ""),
                speaking_style=persona_data.get("speaking_style", ""),
                background=persona_data.get("background", ""),
            ),
            parents=d.get("parents", []),
            relation=d.get("relation"),
            status=d.get("status", "alive"),
            born_at=d.get("born_at", ""),
            eliminated_at=d.get("eliminated_at"),
            llm_tier=d.get("llm_tier", "shared"),
        )
