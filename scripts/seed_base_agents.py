"""
生成 6 个基础策略 Agent 的完整数据文件。

用法:
    cd deepsolo
    python scripts/seed_base_agents.py
"""

import sys
from datetime import datetime, timezone
from pathlib import Path

# 让脚本可以 import deepsolo 包
project_root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(project_root / "packages" / "core"))

from deepsolo.storage import (
    init_data_dir,
    create_agent_dirs,
    save_profile,
    save_account,
    save_signals,
    save_trades,
    save_stock_selection,
    save_strategy_script,
    save_experiences,
    save_world_status,
    write_frontend_json,
)
from deepsolo.models.agent import AgentProfile, Persona
from deepsolo.models.account import AccountConfig, AccountData, AccountSummary
from deepsolo.models.world import WorldStatus

DATA_DIR = project_root / "data"

# ── 6 个基础策略数据（来自前端 config.ts INITIAL_STRATEGIES） ──

BASE_STRATEGIES = [
    {
        "id": "hv1",
        "name": "人气追涨",
        "category": "hot",
        "description": "相对竞价>1.5%, 竞价涨幅<5%, 0931涨幅>-5%, 次日收盘卖出",
        "return_pct": 28.78,
        "max_drawdown_pct": 26.79,
        "total_trades": 292,
        "win_rate": 44.18,
        "avg_return_pct": 0.423,
        "capital": 128780,
        "initial_capital": 100000,
        "persona": Persona(
            personality="激进、果断，喜欢追涨强势股",
            speaking_style="简洁有力，喜欢用数据说话",
            background="资深短线交易者，擅长竞价选股，快进快出",
        ),
    },
    {
        "id": "hv2",
        "name": "妖股追涨",
        "category": "hot",
        "description": "信号生成时按相对竞价排序取前5只",
        "return_pct": -5.50,
        "max_drawdown_pct": 25.16,
        "total_trades": 295,
        "win_rate": 44.07,
        "avg_return_pct": -0.02,
        "capital": 94500,
        "initial_capital": 100000,
        "persona": Persona(
            personality="大胆、冒险，不惧高波动",
            speaking_style="张扬、自信，即使亏钱也不认输",
            background="妖股猎人，专追连续涨停的股票，高风险高回报",
        ),
    },
    {
        "id": "hv3",
        "name": "上影线追涨",
        "category": "hot",
        "description": "竞价涨幅<0.5%, 次日开盘卖出",
        "return_pct": 5.97,
        "max_drawdown_pct": 20.39,
        "total_trades": 78,
        "win_rate": 42.31,
        "avg_return_pct": 0.214,
        "capital": 105970,
        "initial_capital": 100000,
        "persona": Persona(
            personality="稳健、细致，善于从K线形态中发现机会",
            speaking_style="沉稳内敛，话不多但句句在理",
            background="技术派交易者，专注上影线形态的短线机会",
        ),
    },
    {
        "id": "hv4",
        "name": "分时大票追涨",
        "category": "hot",
        "description": "竞价涨幅<0.5%, 次日开盘卖出",
        "return_pct": 73.74,
        "max_drawdown_pct": 17.61,
        "total_trades": 116,
        "win_rate": 47.41,
        "avg_return_pct": 0.996,
        "capital": 173741,
        "initial_capital": 100000,
        "persona": Persona(
            personality="理性、严谨，偏好大市值股票",
            speaking_style="条理清晰，喜欢分析逻辑链",
            background="大票交易专家，专注分时走势的大市值追涨策略",
        ),
    },
    {
        "id": "nv1",
        "name": "多信号综合版",
        "category": "normal",
        "description": "盘前选股+早盘强势突破/健康回调",
        "return_pct": -13.99,
        "max_drawdown_pct": 28.23,
        "total_trades": 260,
        "win_rate": 43.85,
        "avg_return_pct": -0.277,
        "capital": 86010,
        "initial_capital": 100000,
        "persona": Persona(
            personality="全面、谨慎，喜欢综合多个信号",
            speaking_style="深思熟虑，发言前总要综合分析",
            background="综合策略研究者，尝试融合多种信号提高胜率",
        ),
    },
    {
        "id": "nv2",
        "name": "早盘强势突破",
        "category": "normal",
        "description": "连续阳线+突破前高+量比>1.5",
        "return_pct": -22.32,
        "max_drawdown_pct": 30.36,
        "total_trades": 106,
        "win_rate": 40.57,
        "avg_return_pct": -0.456,
        "capital": 77675,
        "initial_capital": 100000,
        "persona": Persona(
            personality="积极、乐观，相信突破的力量",
            speaking_style="热情洋溢，经常鼓励其他策略",
            background="突破策略爱好者，专注于早盘强势突破信号",
        ),
    },
]

# ── 策略生成脚本模板 ──

SCRIPT_GENERATE_SIGNALS = '''# 生成买卖信号
# 策略: {name}
# TODO: 接入实际行情数据源

def generate_signals(date: str, config: dict) -> list[dict]:
    """根据策略规则生成买卖信号"""
    # 示例：返回空信号列表
    return []
'''

SCRIPT_GENERATE_BACKTEST = '''# 生成回测明细
# 策略: {name}
# TODO: 接入实际行情数据源

def generate_backtest(start_date: str, end_date: str, config: dict) -> dict:
    """运行回测，返回明细"""
    return {{
        "trades": [],
        "summary": {{
            "total_return_pct": 0,
            "max_drawdown_pct": 0,
            "total_trades": 0,
            "win_rate": 0,
        }},
    }}
'''

SCRIPT_GENERATE_STOCK_SELECTION = '''# 生成盘前选股
# 策略: {name}
# TODO: 接入实际行情数据源

def generate_stock_selection(date: str, config: dict) -> list[dict]:
    """根据策略规则生成盘前选股列表"""
    return []
'''


def seed():
    now = datetime.now(timezone.utc).isoformat()

    print(f"Initializing data directory: {DATA_DIR}")
    init_data_dir(DATA_DIR)

    for s in BASE_STRATEGIES:
        print(f"Creating agent: {s['id']} ({s['name']})")

        # 创建目录结构
        create_agent_dirs(DATA_DIR, s["id"])

        # profile.json
        profile = AgentProfile(
            id=s["id"],
            type="base",
            name=s["name"],
            category=s["category"],
            description=s["description"],
            persona=s["persona"],
            parents=[],
            relation=None,
            status="alive",
            born_at=now,
            eliminated_at=None,
            llm_tier="shared",
        )
        save_profile(DATA_DIR, profile)

        # 账户信息.json
        account = AccountData(
            config=AccountConfig(initial_capital=s["initial_capital"], max_holdings=5),
            summary=AccountSummary(
                start_date="2026-01-01",
                end_date="2026-04-14",
                final_capital=s["capital"],
                total_return_pct=s["return_pct"],
                max_drawdown_pct=s["max_drawdown_pct"],
                total_trades=s["total_trades"],
                win_trades=int(s["total_trades"] * s["win_rate"] / 100),
                lose_trades=s["total_trades"] - int(s["total_trades"] * s["win_rate"] / 100),
                win_rate=s["win_rate"],
                avg_return_pct=s["avg_return_pct"],
            ),
        )
        save_account(DATA_DIR, s["id"], account)

        # 策略数据文件（空数组，后续填充）
        save_signals(DATA_DIR, s["id"], [])
        save_trades(DATA_DIR, s["id"], [])
        save_stock_selection(DATA_DIR, s["id"], [])

        # 策略生成脚本
        save_strategy_script(
            DATA_DIR, s["id"], "生成买卖信号.py",
            SCRIPT_GENERATE_SIGNALS.format(name=s["name"]),
        )
        save_strategy_script(
            DATA_DIR, s["id"], "生成回测明细.py",
            SCRIPT_GENERATE_BACKTEST.format(name=s["name"]),
        )
        save_strategy_script(
            DATA_DIR, s["id"], "生成盘前选股.py",
            SCRIPT_GENERATE_STOCK_SELECTION.format(name=s["name"]),
        )

        # 经验记忆（空）
        save_experiences(DATA_DIR, s["id"], [])

    # 世界状态
    world = WorldStatus(
        tick=0,
        agent_count=len(BASE_STRATEGIES),
        last_heartbeat="",
        next_heartbeat="",
    )
    save_world_status(DATA_DIR, world)

    # 生成前端 JSON
    write_frontend_json(DATA_DIR)

    # 同步到前端 public/data/ 目录，Vite 自动提供静态文件服务
    public_data = project_root / "packages" / "visual" / "public" / "data"
    public_data.mkdir(parents=True, exist_ok=True)
    import shutil
    shutil.copy2(
        DATA_DIR / "frontend" / "strategies.json",
        public_data / "strategies.json",
    )
    shutil.copy2(
        DATA_DIR / "frontend" / "world.json",
        public_data / "world.json",
    )

    print(f"\nDone! Generated {len(BASE_STRATEGIES)} base agents.")
    print(f"Frontend JSON: {DATA_DIR / 'frontend' / 'strategies.json'}")
    print(f"Synced to:     {public_data / 'strategies.json'}")
    print(f"World status:  {DATA_DIR / 'world_status.json'}")


if __name__ == "__main__":
    seed()
