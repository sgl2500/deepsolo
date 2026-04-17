"""discuss.py — 数据驱动的社区讨论引擎

核心思路：每个 Agent 从自己的数据中发现自己的问题和优势，
随机碰面时各自带着自己的"需求"和"能力"对话。
只有当双方恰好互补（A 缺的 B 有，B 缺的 A 有），才可能涌现新策略。
"""

from __future__ import annotations

import json
import random
import re
from datetime import datetime, timezone
from pathlib import Path

from ..models.agent import AgentProfile, Persona
from ..models.memory import Experience
from ..storage.file_store import (
    append_conversation_turn,
    append_experience,
    create_agent_dirs,
    is_strategy_implemented,
    list_alive_agents,
    load_account,
    load_experiences,
    load_profile,
    save_profile,
)
from ..storage.json_bridge import write_frontend_json
from ..llm.client import LLMClient


# ── 自我分析层：每个 Agent 从自己的数据中发现问题 ────────


def _load_daily_series(base_path: Path, agent_id: str) -> dict:
    """直接读原始 JSON，获取 {date: day_return_pct}"""
    from ..storage import agent_dir, read_json

    path = agent_dir(base_path, agent_id) / "strategy" / "账户信息.json"
    if not path.exists():
        return {}
    raw = read_json(path)
    daily = raw.get("daily", [])
    return {d["date"]: d.get("day_return_pct", 0) for d in daily}


def _load_trade_records(base_path: Path, agent_id: str) -> list[dict]:
    """加载交易记录"""
    from ..storage import agent_dir, read_json

    path = agent_dir(base_path, agent_id) / "strategy" / "交易记录.json"
    if not path.exists():
        return []
    return read_json(path)


def _self_analyze(
    agent_id: str,
    series: dict[str, float],
    trades: list[dict],
    account_summary: dict | None,
) -> dict:
    """Agent 从自己的数据中做自我诊断。

    Returns:
        {
            "strengths": ["我擅长什么"],
            "weaknesses": ["我的问题是什么"],
            "needs": ["我需要什么帮助"],
            "data_evidence": {"关键数据点": 值},
        }
    """
    strengths = []
    weaknesses = []
    needs = []
    evidence = {}

    if not series and not trades:
        return {
            "strengths": ["尚未积累足够数据"],
            "weaknesses": ["缺乏交易历史"],
            "needs": ["需要更多实盘验证"],
            "data_evidence": {},
        }

    rets = list(series.values()) if series else []

    # --- 基本指标 ---
    if rets:
        avg_ret = sum(rets) / len(rets)
        total_ret = sum(rets)
        max_gain = max(rets)
        max_loss = min(rets)
        positive_days = sum(1 for r in rets if r > 0)
        win_day_pct = positive_days / len(rets) * 100
        volatility = (sum((r - avg_ret) ** 2 for r in rets) / len(rets)) ** 0.5

        evidence["日均收益"] = f"{avg_ret:+.3f}%"
        evidence["累计收益"] = f"{total_ret:+.2f}%"
        evidence["最大单日盈利"] = f"{max_gain:+.2f}%"
        evidence["最大单日亏损"] = f"{max_loss:+.2f}%"
        evidence["盈利日占比"] = f"{win_day_pct:.1f}%"
        evidence["日波动率"] = f"{volatility:.2f}%"

        # --- 优势判断 ---
        if total_ret > 20:
            strengths.append(f"累计收益 {total_ret:+.1f}%，盈利能力突出")
        elif total_ret > 0:
            strengths.append(f"累计收益 {total_ret:+.1f}%，整体盈利")

        if volatility < 2:
            strengths.append(f"日波动率仅 {volatility:.2f}%，非常稳定")

        if win_day_pct > 55:
            strengths.append(f"盈利日占比 {win_day_pct:.0f}%，胜率较高")

        if max_gain > 5:
            strengths.append(f"单日最大盈利 {max_gain:+.2f}%，爆发力强")

        # --- 问题判断 ---
        if total_ret < -10:
            weaknesses.append(f"累计亏损 {total_ret:.1f}%，策略整体失效")
            needs.append("需要根本性的策略改进，或者学习盈利策略的方法")
        elif total_ret < 0:
            weaknesses.append(f"微亏 {total_ret:.1f}%，策略缺乏 alpha")

        if max_loss < -8:
            weaknesses.append(f"单日最大亏损 {max_loss:.2f}%，极端风险失控")
            needs.append("需要风控手段来限制单日亏损")

        if volatility > 4:
            weaknesses.append(f"日波动率 {volatility:.2f}%，收益曲线过于剧烈")
            needs.append("需要降低波动的方法，比如组合对冲")

        if win_day_pct < 45:
            weaknesses.append(f"盈利日占比仅 {win_day_pct:.0f}%，多数交易日亏损")
            needs.append("需要提高选股胜率或优化买入时机")

        # --- 连续亏损检测 ---
        max_losing_streak = 0
        current_streak = 0
        for r in rets:
            if r < 0:
                current_streak += 1
                max_losing_streak = max(max_losing_streak, current_streak)
            else:
                current_streak = 0

        if max_losing_streak >= 5:
            weaknesses.append(f"最长连亏 {max_losing_streak} 天，心理压力巨大")
            needs.append("需要能在我连亏时互补的策略来平滑曲线")

        # --- 回撤期检测 ---
        equity = 100000
        peak = equity
        in_drawdown = False
        dd_start = ""
        worst_dd = 0
        worst_dd_period = ""
        for date, r in series.items():
            equity *= (1 + r / 100)
            if equity > peak:
                peak = equity
                if in_drawdown:
                    in_drawdown = False
            else:
                dd_pct = (equity - peak) / peak * 100
                if dd_pct < worst_dd:
                    worst_dd = dd_pct
                    worst_dd_period = date
                if not in_drawdown:
                    in_drawdown = True
                    dd_start = date

        if worst_dd < -10:
            weaknesses.append(f"最大回撤 {worst_dd:.1f}%（从 {dd_start} 起），抗跌能力不足")
            needs.append("需要低相关或负相关的策略来对冲回撤期")

    # --- 交易层面分析 ---
    if trades:
        closed = [t for t in trades if t.get("status") == "closed"]
        if closed:
            hold_days = [t.get("hold_days", 1) for t in closed]
            avg_hold = sum(hold_days) / len(hold_days)

            # 按买卖原因分析
            big_loss_trades = [t for t in closed if t.get("return_pct", 0) < -5]
            if big_loss_trades:
                weaknesses.append(
                    f"有 {len(big_loss_trades)} 笔交易亏损超过 5%，止损不够坚决"
                )
                needs.append("更严格的止损规则或更好的入场时机筛选")

    # 兜底
    if not strengths:
        strengths.append("仍在探索阶段，暂无明显优势")
    if not weaknesses:
        weaknesses.append("表现尚可，但缺乏突出亮点")
    if not needs:
        needs.append("寻找能进一步放大优势的组合伙伴")

    return {
        "strengths": strengths,
        "weaknesses": weaknesses,
        "needs": needs,
        "data_evidence": evidence,
    }


# ── 互补判断 ───────────────────────────────────────────


def _check_complementarity(self_analyses: dict[str, dict]) -> dict | None:
    """判断参与者之间是否存在互补。

    条件：A 的需求恰好能被 B 的优势满足，反之亦然。
    双向互补才可能产生新策略。

    Returns:
        互补描述，或 None（不互补）
    """
    aids = list(self_analyses.keys())
    if len(aids) < 2:
        return None

    # 收集所有优势关键词和能力
    complement_finds = []

    for i in range(len(aids)):
        for j in range(i + 1, len(aids)):
            a, b = aids[i], aids[j]
            sa, sb = self_analyses[a], self_analyses[b]

            a_needs = " ".join(sa["needs"])
            b_needs = " ".join(sb["needs"])
            a_strengths = " ".join(sa["strengths"])
            b_strengths = " ".join(sb["strengths"])

            # 检查 A 的需求是否能被 B 的优势满足
            a_helped = False
            b_helped = False

            # 关键词匹配：需求 vs 优势
            help_patterns = [
                ("波动", "稳定"),
                ("亏损", "盈利"),
                ("止损", "胜率"),
                ("连亏", "爆发力"),
                ("回撤", "收益"),
                ("alpha", "alpha"),
                ("选股", "选股"),
                ("风控", "稳定"),
            ]

            for need_kw, strength_kw in help_patterns:
                if need_kw in a_needs and strength_kw in b_strengths:
                    a_helped = True
                if need_kw in b_needs and strength_kw in a_strengths:
                    b_helped = True

            # 数据层面的互补：比较关键指标
            a_ev = sa["data_evidence"]
            b_ev = sb["data_evidence"]
            if a_ev and b_ev:
                # 收益互补
                a_total = _extract_pct(a_ev.get("累计收益", "0"))
                b_total = _extract_pct(b_ev.get("累计收益", "0"))
                if (a_total > 10 and b_total < 0) or (b_total > 10 and a_total < 0):
                    a_helped = True
                    b_helped = True

                # 波动互补
                a_vol = _extract_pct(a_ev.get("日波动率", "99"))
                b_vol = _extract_pct(b_ev.get("日波动率", "99"))
                if abs(a_vol - b_vol) > 1.5:
                    if a_vol > b_vol:
                        # a 波动大，b 稳定 → b 帮 a 降波
                        a_helped = True
                    else:
                        b_helped = True

            if a_helped and b_helped:
                complement_finds.append({
                    "pair": [a, b],
                    "a_helped_by": b,
                    "b_helped_by": a,
                })

    if complement_finds:
        best = complement_finds[0]
        a, b = best["pair"]
        return {
            "is_complementary": True,
            "pair": best["pair"],
            "description": (
                f"{a} 和 {b} 存在双向互补: "
                f"{a} 需要 {self_analyses[a]['needs'][0]}，"
                f"而 {b} 的优势是 {self_analyses[b]['strengths'][0]}；"
                f"反之 {b} 需要 {self_analyses[b]['needs'][0]}，"
                f"而 {a} 的优势是 {self_analyses[a]['strengths'][0]}。"
            ),
        }

    return None


def _extract_pct(s: str) -> float:
    """从 "12.3%" 或 "+12.3%" 中提取数字"""
    try:
        return float(s.replace("%", "").replace("+", "").strip())
    except (ValueError, AttributeError):
        return 0


# ── Prompt 构建 ─────────────────────────────────────────


def _pick_participants(alive_ids: list[str], count: int = 3) -> list[str]:
    """随机选取 2-3 个参与者"""
    n = min(random.randint(2, count), len(alive_ids))
    return random.sample(alive_ids, n)


def _gather_agent_info(base_path: Path, agent_id: str) -> dict:
    """收集 Agent 的 profile + 统计"""
    profile = load_profile(base_path, agent_id)
    account = load_account(base_path, agent_id)

    info = {
        "id": agent_id,
        "name": profile.name if profile else agent_id,
        "description": profile.description if profile else "",
        "category": profile.category if profile else "normal",
        "type": profile.type if profile else "base",
        "personality": profile.persona.personality if profile else "",
        "speaking_style": profile.persona.speaking_style if profile else "",
    }

    if account:
        info["return_pct"] = account.summary.total_return_pct
        info["max_drawdown"] = account.summary.max_drawdown_pct
        info["win_rate"] = account.summary.win_rate
        info["total_trades"] = account.summary.total_trades
        info["summary"] = {
            "return_pct": account.summary.total_return_pct,
            "max_drawdown": account.summary.max_drawdown_pct,
            "win_rate": account.summary.win_rate,
            "total_trades": account.summary.total_trades,
        }
    else:
        info["return_pct"] = 0
        info["max_drawdown"] = 0
        info["win_rate"] = 0
        info["total_trades"] = 0
        info["summary"] = {}

    experiences = load_experiences(base_path, agent_id)
    info["recent_experiences"] = [
        f"[{e['type']}] {e['content']}" for e in experiences[-3:]
    ] if experiences else []

    return info


def _build_meeting_prompt(
    participants: list[dict],
    self_analyses: dict[str, dict],
    complement: dict | None,
) -> str:
    """构建碰面讨论 prompt — 每个人带着自己的问题来"""

    # 每个参与者的自我诊断
    perspectives = []
    for p in participants:
        aid = p["id"]
        sa = self_analyses.get(aid, {})
        ev = sa.get("data_evidence", {})

        ev_str = ""
        for k, v in ev.items():
            ev_str += f"\n      {k}: {v}"

        strengths = "；".join(sa.get("strengths", []))
        weaknesses = "；".join(sa.get("weaknesses", []))
        needs = "；".join(sa.get("needs", []))

        exp_str = ""
        if p["recent_experiences"]:
            exp_str = "\n    历史经验: " + "; ".join(p["recent_experiences"])

        perspectives.append(
            f"### {p['name']} ({aid})\n"
            f"  策略: {p['description']}\n"
            f"  性格: {p['personality']}，说话风格: {p['speaking_style']}\n"
            f"  我的数据:{ev_str}\n"
            f"  我的优势: {strengths}\n"
            f"  我的问题: {weaknesses}\n"
            f"  我需要: {needs}"
            f"{exp_str}"
        )

    perspectives_text = "\n\n".join(perspectives)

    # 互补提示
    complement_hint = ""
    if complement:
        complement_hint = f"""

## 互补信号

{complement['description']}

双方确实存在互补，讨论中应该自然走向"我们能不能结合起来"的思路。"""
    else:
        complement_hint = """

## 注意

双方没有明显的互补关系。这次碰面就是普通交流，各说各的，不会有策略诞生。
对话内容应该是各自抱怨自己的问题、分享经验，但最终发现对方帮不了自己。"""

    emerged_instruction = (
        "true，并填写 new_idea"
        if complement
        else "false，new_idea 留空"
    )

    prompt = f"""以下策略 Agent 在社区中随机碰面，开始聊天。

## 各自的情况

{perspectives_text}
{complement_hint}

## 要求

1. 每个参与者从**自己的立场**出发发言，用自己的说话风格
2. 谈论自己的数据、问题、经验，向对方分享或请教
3. 如果发现自己的问题对方恰好能解决，自然地产生合作想法
4. 如果发现对方帮不了自己，就正常结束对话，不要硬凑
5. 引用具体的数字（自己的收益率、回撤、胜率等）

## 输出格式

严格 JSON：
{{
  "dialogues": [
    {{" "agent_id": "参与者ID", "text": "发言内容"}}
  ],
  "emerged": {emerged_instruction},
  "new_idea": {{
    "name": "新策略名称（2-4字）",
    "description": "融合了什么（30字内）",
    "relation": "杂交或变异或启发",
    "insights": ["基于什么互补关系"]
  }},
  "experiences": [
    {{
      "agent_id": "参与者ID",
      "type": "insight 或 failure 或 success",
      "content": "从这次碰面中学到/意识到了什么"
    }}
  ]
}}"""

    return prompt


def _parse_discussion_result(text: str) -> dict | None:
    """解析 LLM 返回的 JSON"""
    match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', text, re.DOTALL)
    if match:
        text = match.group(1)
    else:
        match = re.search(r'\{.*\}', text, re.DOTALL)
        if match:
            text = match.group()

    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        return None

    if "dialogues" not in data or "experiences" not in data:
        return None

    return data


# ── 主流程 ─────────────────────────────────────────────


async def run_discussion(base_path: Path, llm_client: LLMClient) -> str | None:
    """执行一次社区碰面讨论。

    流程：
    1. 筛选有数据的 Agent，随机选 2-3 个碰面
    2. 每个参与者做自我诊断（优势/问题/需求）
    3. 判断是否双向互补
    4. LLM 模拟碰面对话
    5. 互补时可能诞生新 Agent，否则仅记录经验

    Returns:
        新 agent ID，或 None
    """
    alive = list_alive_agents(base_path)
    if len(alive) < 2:
        print("[discuss] 存活 Agent 不足 2 个")
        return None

    # 1. 筛选已实现策略的 Agent（有交易数据和日度数据），再选参与者
    implemented = [aid for aid in alive if is_strategy_implemented(base_path, aid)]
    if len(implemented) < 2:
        print("[discuss] 已实现的 Agent 不足 2 个，跳过讨论")
        return None

    participant_ids = _pick_participants(implemented)

    print(f"[discuss] 随机碰面: {participant_ids}")

    # 2. 每个参与者做自我诊断
    self_analyses = {}
    for aid in participant_ids:
        series = _load_daily_series(base_path, aid)
        trades = _load_trade_records(base_path, aid)
        account = load_account(base_path, aid)
        summary = account.to_dict().get("summary") if account else None

        analysis = _self_analyze(aid, series, trades, summary)
        self_analyses[aid] = analysis

        print(f"  {aid}: 优势={analysis['strengths'][0]}")
        print(f"         问题={analysis['weaknesses'][0]}")
        print(f"         需求={analysis['needs'][0]}")

    # 3. 判断互补性
    complement = _check_complementarity(self_analyses)

    if complement:
        print(f"  ★ 互补! {complement['description'][:80]}")
    else:
        print(f"  ✗ 不互补，普通碰面")

    # 4. 构建 prompt 并调用 LLM
    participants = [_gather_agent_info(base_path, aid) for aid in participant_ids]
    prompt = _build_meeting_prompt(participants, self_analyses, complement)
    messages = [{"role": "user", "content": prompt}]

    try:
        result_text = await llm_client.chat(messages)
    except Exception as e:
        print(f"[discuss] LLM 调用失败: {e}")
        return None

    result = _parse_discussion_result(result_text)
    if not result:
        print(f"[discuss] 解析失败: {result_text[:200]}")
        return None

    now = datetime.now(timezone.utc).isoformat()

    # 5. 保存对话 — 每个 Agent 保存完整讨论记录
    dialogues = result.get("dialogues", [])
    # 生成一个讨论 ID 用于文件命名
    disc_id = f"disc_{now[:19].replace(':', '').replace('-', '').replace('T', '_')}"
    for aid in participant_ids:
        others = sorted([p for p in participant_ids if p != aid])
        # 保存为 with_disc_{id}.json，包含完整对话
        from ..storage import agent_dir, write_json

        conv_dir = agent_dir(base_path, aid) / "memory" / "conversations"
        conv_dir.mkdir(parents=True, exist_ok=True)

        conv_data = {
            "with_agents": others,
            "discussion_id": disc_id,
            "topic": "碰面讨论",
            "turns": [
                {
                    "agent_id": line.get("agent_id", ""),
                    "role": "self" if line.get("agent_id") == aid else "other",
                    "text": line.get("text", ""),
                    "timestamp": now,
                }
                for line in dialogues
            ],
            "last_updated": now,
        }
        write_json(conv_dir / f"{disc_id}.json", conv_data)

    # 6. 写入经验
    saved = 0
    for exp in result.get("experiences", []):
        aid = exp.get("agent_id", "")
        if aid in participant_ids:
            append_experience(base_path, aid, Experience(
                timestamp=now,
                type=exp.get("type", "insight"),
                content=exp.get("content", ""),
            ))
            saved += 1

    print(f"[discuss] 经验写入 {saved} 条")

    # 7. 只有互补时才可能诞生新 Agent
    new_id = None
    emerged = result.get("emerged", False)

    if complement and emerged and result.get("new_idea"):
        new_idea = result["new_idea"]
        new_id = _next_derived_id(alive)
        relation = new_idea.get("relation", "启发")
        display_name = f"[{relation}]{new_idea.get('name', '未知策略')}"

        create_agent_dirs(base_path, new_id)

        parent_names = [
            load_profile(base_path, aid).name
            for aid in participant_ids
            if load_profile(base_path, aid)
        ]
        background = (
            f"{', '.join(parent_names)} 碰面时发现互补: "
            f"{complement['description'][:60]}"
        )

        profile = AgentProfile(
            id=new_id,
            type="derived",
            name=display_name,
            category="emerged",
            description=new_idea.get("description", ""),
            persona=Persona(
                personality="善于融合不同观点，喜欢跨策略思考",
                speaking_style="条理清晰，善于总结归纳",
                background=background,
            ),
            parents=participant_ids,
            relation=relation,
            status="alive",
            born_at=now,
            llm_tier="shared",
        )
        save_profile(base_path, profile)

        # 新 Agent 的经验 = 父代各自的核心洞察 + 诞生洞察
        for aid in participant_ids:
            sa = self_analyses[aid]
            append_experience(base_path, new_id, Experience(
                timestamp=now,
                type="insight",
                content=f"继承自{aid}: 优势-{sa['strengths'][0]}",
            ))
        for ins in new_idea.get("insights", []):
            append_experience(base_path, new_id, Experience(
                timestamp=now,
                type="insight",
                content=f"诞生洞察: {ins}",
            ))

        print(f"[discuss] 新策略诞生: {display_name} ({new_id})")
    else:
        if not complement:
            print("[discuss] 不互补，各走各的")
        else:
            print("[discuss] 互补但讨论未产生具体想法")

    # 8. 刷新前端
    write_frontend_json(base_path)
    return new_id


def _other_id(participant_ids: list[str], self_id: str) -> str:
    for aid in participant_ids:
        if aid != self_id:
            return aid
    return participant_ids[0]


def _next_derived_id(existing_ids: list[str]) -> str:
    max_num = 2
    for aid in existing_ids:
        if aid.startswith("e") and aid[1:].isdigit():
            max_num = max(max_num, int(aid[1:]))
    return f"e{max_num + 1}"
