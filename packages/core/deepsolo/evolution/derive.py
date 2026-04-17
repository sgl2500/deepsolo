"""derive.py — 策略衍生核心逻辑

每天从排行榜 Top 策略中选取父代，通过 LLM 分析学习，
生成新的 agent 目录和 profile。
"""

from __future__ import annotations

import re
from datetime import datetime, timezone
from pathlib import Path

from ..models.agent import AgentProfile, Persona
from ..storage.file_store import (
    create_agent_dirs,
    list_alive_agents,
    load_account,
    load_profile,
    save_profile,
)
from ..storage.json_bridge import append_event, write_frontend_json
from ..llm.client import LLMClient


async def run_derivation(base_path: Path, llm_client: LLMClient) -> str | None:
    """执行一次策略衍生。

    Returns:
        新 agent ID，或 None（条件不满足时）
    """
    alive = list_alive_agents(base_path)
    if len(alive) < 2:
        return None

    # 1. 读取所有 agent 的账户数据，按收益排序
    agents_with_perf = []
    for agent_id in alive:
        profile = load_profile(base_path, agent_id)
        account = load_account(base_path, agent_id)
        if profile and account:
            agents_with_perf.append({
                "id": agent_id,
                "name": profile.name,
                "category": profile.category,
                "description": profile.description,
                "return_pct": account.summary.total_return_pct,
                "max_drawdown": account.summary.max_drawdown_pct,
                "win_rate": account.summary.win_rate,
                "total_trades": account.summary.total_trades,
            })

    if len(agents_with_perf) < 2:
        return None

    agents_with_perf.sort(key=lambda a: a["return_pct"], reverse=True)

    # 2. 取 Top 2 作为父策略
    parent1 = agents_with_perf[0]
    parent2 = agents_with_perf[1]

    # 3. 找出其他策略的优点（如回撤控制最好的）
    best_drawdown = min(agents_with_perf, key=lambda a: a["max_drawdown"])

    # 4. 构建 LLM prompt
    prompt = f"""你是一个量化策略研究员。请基于以下信息设计一个新的交易策略：

## 父策略 A（收益最高）
- 名称: {parent1['name']}
- 描述: {parent1['description']}
- 收益率: {parent1['return_pct']:.1f}%
- 最大回撤: {parent1['max_drawdown']:.1f}%
- 胜率: {parent1['win_rate']:.1f}%

## 父策略 B（收益第二）
- 名称: {parent2['name']}
- 描述: {parent2['description']}
- 收益率: {parent2['return_pct']:.1f}%
- 最大回撤: {parent2['max_drawdown']:.1f}%
- 胜率: {parent2['win_rate']:.1f}%

## 同期最优回撤控制（参考学习）
- 名称: {best_drawdown['name']}
- 最大回撤: {best_drawdown['max_drawdown']:.1f}%

请生成一个新策略，要求：
1. 继承父策略 A 的核心逻辑
2. 学习最优回撤控制策略的风险管理方法
3. 做一个微小的改进

请用以下 JSON 格式回复（不要其他内容）：
{{"name": "策略名称（2-4个字）", "description": "策略描述（30字以内）", "relation": "杂交或变异"}}"""

    messages = [{"role": "user", "content": prompt}]

    try:
        result = await llm_client.chat(messages)
    except Exception as e:
        print(f"[derive] LLM 调用失败: {e}")
        return None

    # 5. 解析 LLM 结果
    parsed = _parse_llm_result(result)
    if not parsed:
        print(f"[derive] 无法解析 LLM 结果: {result[:200]}")
        return None

    # 6. 生成新 agent ID
    new_id = _next_derived_id(alive)
    relation = parsed["relation"]
    display_name = f"[{relation}]{parsed['name']}"

    # 7. 创建 agent 目录和 profile
    create_agent_dirs(base_path, new_id)

    profile = AgentProfile(
        id=new_id,
        type="derived",
        name=display_name,
        category="emerged",
        description=parsed["description"],
        persona=Persona(
            personality="善于学习，喜欢分析数据",
            speaking_style="理性客观，引用具体数据",
            background=f"由{parent1['name']}和{parent2['name']}衍生而来",
        ),
        parents=[parent1["id"], parent2["id"]],
        relation=relation,
        status="alive",
        born_at=datetime.now(timezone.utc).isoformat(),
        llm_tier="shared",
    )
    save_profile(base_path, profile)

    # 8. 更新前端 JSON
    write_frontend_json(base_path)

    print(f"[derive] 新策略诞生: {display_name} ({new_id}), 父代: {parent1['id']}+{parent2['id']}")

    # 写入诞生事件
    append_event(base_path, {
        "type": "agent_born",
        "agents": [new_id],
        "agent_name": display_name,
        "detail": f"由 {parent1['name']} 和 {parent2['name']} 衍生",
        "parents": [parent1["id"], parent2["id"]],
        "relation": relation,
    })

    return new_id


def _parse_llm_result(text: str) -> dict | None:
    """从 LLM 回复中提取 JSON"""
    # 尝试提取 JSON 块
    match = re.search(r'\{[^{}]*\}', text, re.DOTALL)
    if not match:
        return None
    try:
        import json
        data = json.loads(match.group())
        if "name" in data and "description" in data:
            if "relation" not in data:
                data["relation"] = "杂交"
            return data
    except (json.JSONDecodeError, KeyError):
        pass
    return None


def _next_derived_id(existing_ids: list[str]) -> str:
    """生成下一个衍生 agent ID: e3, e4, ..."""
    max_num = 2  # e1, e2 已被 INITIAL_STRATEGIES 占用
    for aid in existing_ids:
        if aid.startswith("e") and aid[1:].isdigit():
            max_num = max(max_num, int(aid[1:]))
    return f"e{max_num + 1}"
