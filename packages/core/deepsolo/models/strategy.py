"""策略数据模型，与前端 Strategy 接口对齐"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class StrategyData:
    """策略表现数据，对应前端 Strategy 接口"""
    id: str
    name: str
    category: str             # "hot" | "normal" | "emerged"
    description: str
    return_pct: float         # 对应前端 returnPct
    max_drawdown_pct: float   # 对应前端 maxDrawdownPct
    total_trades: int
    win_rate: float
    avg_return_pct: float
    capital: float
    state: str                # "idle" | "backtesting" | "evolving" | "competing" | "discussing" | "profitable" | "retired"
    parents: list[str] = field(default_factory=list)
    relation: str | None = None

    def to_frontend_dict(self) -> dict:
        """生成前端 Strategy 接口格式的 dict"""
        return {
            "id": self.id,
            "name": self.name,
            "category": self.category,
            "description": self.description,
            "returnPct": self.return_pct,
            "maxDrawdownPct": self.max_drawdown_pct,
            "totalTrades": self.total_trades,
            "winRate": self.win_rate,
            "avgReturnPct": self.avg_return_pct,
            "capital": self.capital,
            "state": self.state,
            "parents": self.parents,
            "relation": self.relation,
        }

    @classmethod
    def from_frontend_dict(cls, d: dict) -> StrategyData:
        """从前端 Strategy 格式反序列化"""
        return cls(
            id=d["id"],
            name=d["name"],
            category=d["category"],
            description=d["description"],
            return_pct=d["returnPct"],
            max_drawdown_pct=d["maxDrawdownPct"],
            total_trades=d["totalTrades"],
            win_rate=d["winRate"],
            avg_return_pct=d["avgReturnPct"],
            capital=d["capital"],
            state=d.get("state", "idle"),
            parents=d.get("parents", []),
            relation=d.get("relation"),
        )
