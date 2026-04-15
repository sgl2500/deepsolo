"""账户数据模型，与前端 AccountData 接口对齐"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass
class AccountConfig:
    """账户配置"""
    initial_capital: float
    max_holdings: int


@dataclass
class AccountSummary:
    """账户汇总"""
    start_date: str
    end_date: str
    final_capital: float
    total_return_pct: float
    max_drawdown_pct: float
    total_trades: int
    win_trades: int
    lose_trades: int
    win_rate: float
    avg_return_pct: float


@dataclass
class AccountData:
    """账户数据，对应前端 AccountData 接口"""
    config: AccountConfig
    summary: AccountSummary

    def to_dict(self) -> dict:
        return {
            "config": {
                "initial_capital": self.config.initial_capital,
                "max_holdings": self.config.max_holdings,
            },
            "summary": {
                "start_date": self.summary.start_date,
                "end_date": self.summary.end_date,
                "final_capital": self.summary.final_capital,
                "total_return_pct": self.summary.total_return_pct,
                "max_drawdown_pct": self.summary.max_drawdown_pct,
                "total_trades": self.summary.total_trades,
                "win_trades": self.summary.win_trades,
                "lose_trades": self.summary.lose_trades,
                "win_rate": self.summary.win_rate,
                "avg_return_pct": self.summary.avg_return_pct,
            },
        }

    @classmethod
    def from_dict(cls, d: dict) -> AccountData:
        cfg = d.get("config", {})
        smr = d.get("summary", {})
        return cls(
            config=AccountConfig(
                initial_capital=cfg.get("initial_capital", 100000),
                max_holdings=cfg.get("max_holdings", 5),
            ),
            summary=AccountSummary(
                start_date=smr.get("start_date", ""),
                end_date=smr.get("end_date", ""),
                final_capital=smr.get("final_capital", 0),
                total_return_pct=smr.get("total_return_pct", 0),
                max_drawdown_pct=smr.get("max_drawdown_pct", 0),
                total_trades=smr.get("total_trades", 0),
                win_trades=smr.get("win_trades", 0),
                lose_trades=smr.get("lose_trades", 0),
                win_rate=smr.get("win_rate", 0),
                avg_return_pct=smr.get("avg_return_pct", 0),
            ),
        )
