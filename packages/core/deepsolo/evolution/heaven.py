"""heaven.py — 天道惩罚系统

独立于 Agent 之外的审查系统，每天扫描衍生 Agent：
1. 有数据的 → LLM 审查未来函数和逻辑不自洽
2. 空壳超时的 → 连续多天未实质化，人道消灭

基础 Agent（type=base）不受天罚约束。
"""

from __future__ import annotations

import json
import random
import re
from datetime import datetime, timezone
from pathlib import Path

from ..models.memory import Experience
from ..storage.file_store import (
    _agent_dir,
    _read_json,
    _write_json,
    append_experience,
    create_agent_dirs,
    is_strategy_implemented,
    list_agents,
    load_account,
    load_experiences,
    load_profile,
    save_profile,
)
from ..storage.json_bridge import write_frontend_json
from ..llm.client import LLMClient


# ── 空壳超时检测 ────────────────────────────────────────

SHELL_TIMEOUT_DAYS = 3  # 空壳超过 N 天未实质化则消灭


def _days_since_born(profile) -> int:
    """计算 Agent 出生至今的天数"""
    if not profile.born_at:
        return 0
    try:
        born = datetime.fromisoformat(profile.born_at)
        now = datetime.now(timezone.utc)
        return (now - born).days
    except (ValueError, TypeError):
        return 0


def _check_shell_timeout(base_path: Path) -> list[dict]:
    """检查空壳超时。

    Returns:
        需要消灭的 Agent 列表，每项含 {id, name, reason, detail}
    """
    eliminated = []

    for agent_id in list_agents(base_path):
        profile = load_profile(base_path, agent_id)
        if not profile or profile.type != "derived":
            continue
        if profile.status in ("eliminated", "heaven_removed"):
            continue
        if is_strategy_implemented(base_path, agent_id):
            continue

        days = _days_since_born(profile)
        if days >= SHELL_TIMEOUT_DAYS:
            eliminated.append({
                "id": agent_id,
                "name": profile.name,
                "reason": "shell_timeout",
                "detail": (
                    f"空壳 Agent 已存活 {days} 天仍未实质化（阈值 {SHELL_TIMEOUT_DAYS} 天）。"
                    f"夜间系统未为其回填策略数据，判定为空洞想法，天道消灭。"
                ),
            })

    return eliminated


# ── LLM 审查 ───────────────────────────────────────────


def _load_strategy_code(base_path: Path, agent_id: str) -> str:
    """读取策略生成代码"""
    d = _agent_dir(base_path, agent_id) / "strategy"
    parts = []
    for name in ["生成买卖信号.py", "生成回测明细.py", "生成盘前选股.py"]:
        p = d / name
        if p.exists():
            parts.append(f"### {name}\n```python\n{p.read_text(encoding='utf-8')}\n```")
    return "\n\n".join(parts) if parts else "（无策略代码）"


def _load_trades_sample(base_path: Path, agent_id: str, n: int = 20) -> str:
    """读取交易记录采样"""
    path = _agent_dir(base_path, agent_id) / "strategy" / "交易记录.json"
    if not path.exists():
        return "（无交易记录）"
    trades = _read_json(path)
    if not isinstance(trades, list) or not trades:
        return "（无交易记录）"
    sample = trades[-n:] if len(trades) > n else trades
    return json.dumps(sample, ensure_ascii=False, indent=2)


def _load_daily_sample(base_path: Path, agent_id: str, n: int = 10) -> str:
    """读取日度数据采样"""
    path = _agent_dir(base_path, agent_id) / "strategy" / "账户信息.json"
    if not path.exists():
        return "（无日度数据）"
    raw = _read_json(path)
    daily = raw.get("daily", [])
    if not daily:
        return "（无日度数据）"
    sample = daily[-n:] if len(daily) > n else daily
    # 精简：只保留关键字段
    simplified = []
    for d in sample:
        simplified.append({
            "date": d.get("date"),
            "total_equity": d.get("total_equity"),
            "day_return_pct": d.get("day_return_pct"),
            "cash": d.get("cash"),
        })
    return json.dumps(simplified, ensure_ascii=False, indent=2)


def _load_account_summary(base_path: Path, agent_id: str) -> str:
    """读取账户汇总"""
    account = load_account(base_path, agent_id)
    if not account:
        return "（无账户数据）"
    return json.dumps(account.to_dict().get("summary", {}), ensure_ascii=False, indent=2)


def _build_judgement_prompt(
    profile,
    strategy_code: str,
    trades_sample: str,
    account_summary: str,
    daily_sample: str,
) -> str:
    """构建天罚审查 prompt"""

    prompt = f"""你是一个量化策略审查员，代号"天道"。你的职责是审查衍生交易策略是否存在未来函数或逻辑不自洽。

## 被审查策略

- 名称: {profile.name}
- ID: {profile.id}
- 描述: {profile.description}
- 父代: {profile.parents}
- 关系: {profile.relation}

## 策略代码

{strategy_code}

## 交易记录（最近采样）

{trades_sample}

## 账户汇总

{account_summary}

## 日度数据（最近采样）

{daily_sample}

## 审查清单（逐条检查）

1. **未来函数** — 策略代码是否使用了实际交易时不可得的信息？例如：
   - 用当日收盘价做买入决策
   - 用次日最高价作为卖出价格
   - 用全局排名（需要收盘后才能排序）做盘中决策

2. **卖出价格异常** — 是否多次精准卖在当日最高/最低价？正常策略不可能总是卖在极值点。

3. **持仓天数矛盾** — 策略描述说"次日卖出"，但实际 hold_days 是否与描述矛盾？

4. **仓位矛盾** — 策略描述中的仓位限制与实际交易的成本占比是否矛盾？

5. **收益数据一致性** — 用交易明细的 profit 之和与账户 total_return_pct 是否大体一致？

6. **异常收益** — 是否存在单笔 return_pct > 30% 或胜率 > 80%（交易>50笔）等不正常现象？

## 输出要求

严格用以下 JSON 格式回复（不要其他内容）：

{{
  "verdict": "innocent" 或 "guilty",
  "violations": [
    {{
      "type": "future_function 或 sell_anomaly 或 holding_mismatch 或 position_mismatch 或 data_inconsistency 或 abnormal_return",
      "severity": "critical 或 warning",
      "description": "一句话描述违规内容",
      "evidence": "具体的数据证据"
    }}
  ]
}}

如果没有发现任何问题，verdict 必须是 "innocent"，violations 为空数组。"""

    return prompt


def _parse_judgement_result(text: str) -> dict | None:
    """解析天罚审查结果"""
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

    if "verdict" not in data:
        return None

    return data


# ── 消灭处理 ───────────────────────────────────────────


def _eliminate_agent(
    base_path: Path,
    agent_id: str,
    reason: str,
    violations: list[dict] | None = None,
    detail: str = "",
) -> None:
    """人道消灭一个 Agent"""
    profile = load_profile(base_path, agent_id)
    if not profile:
        return

    now = datetime.now(timezone.utc).isoformat()

    # 更新 profile
    profile.status = "heaven_removed"
    profile.eliminated_at = now
    save_profile(base_path, profile)

    # 写入天罚报告
    mem_dir = _agent_dir(base_path, agent_id) / "memory"
    mem_dir.mkdir(parents=True, exist_ok=True)

    report = {
        "judgement_id": f"hj_{now[:10].replace('-', '')}_{agent_id}",
        "agent_id": agent_id,
        "agent_name": profile.name,
        "verdict": "guilty",
        "reason": reason,
        "timestamp": now,
        "violations": violations or [],
        "detail": detail,
    }
    _write_json(mem_dir / "heaven_judgement.json", report)

    # 追加一条经验（给其他 Agent 看）
    summary = detail or (violations[0]["description"] if violations else reason)
    append_experience(base_path, agent_id, Experience(
        timestamp=now,
        type="failure",
        content=f"天道消灭: {summary}",
    ))


# ── 主流程 ─────────────────────────────────────────────


async def run_heaven_judgement(base_path: Path, llm_client: LLMClient) -> list[str]:
    """执行一次天道审查。

    Returns:
        被消灭的 Agent ID 列表
    """
    eliminated_ids = []

    # === 第一阶段：空壳超时检测（不需要 LLM） ===
    shell_victims = _check_shell_timeout(base_path)
    for victim in shell_victims:
        _eliminate_agent(
            base_path,
            victim["id"],
            reason=victim["reason"],
            detail=victim["detail"],
        )
        eliminated_ids.append(victim["id"])
        print(f"[天罚] 空壳超时消灭: {victim['name']} ({victim['id']}) — {victim['detail'][:60]}")

    # === 第二阶段：LLM 审查有数据的衍生 Agent ===
    for agent_id in list_agents(base_path):
        profile = load_profile(base_path, agent_id)
        if not profile:
            continue
        # 只审衍生 + alive + 有数据
        if profile.type != "derived":
            continue
        if profile.status != "alive":
            continue
        if not is_strategy_implemented(base_path, agent_id):
            continue

        print(f"[天罚] 审查: {profile.name} ({agent_id})")

        # 收集审查材料
        strategy_code = _load_strategy_code(base_path, agent_id)
        trades_sample = _load_trades_sample(base_path, agent_id)
        account_summary = _load_account_summary(base_path, agent_id)
        daily_sample = _load_daily_sample(base_path, agent_id)

        # 构建审查 prompt
        prompt = _build_judgement_prompt(
            profile, strategy_code, trades_sample, account_summary, daily_sample,
        )
        messages = [{"role": "user", "content": prompt}]

        try:
            result_text = await llm_client.chat(messages)
        except Exception as e:
            print(f"[天罚] LLM 调用失败 ({agent_id}): {e}")
            continue

        result = _parse_judgement_result(result_text)
        if not result:
            print(f"[天罚] 解析失败 ({agent_id}): {result_text[:100]}")
            continue

        if result.get("verdict") == "guilty" and result.get("violations"):
            violations = result["violations"]
            v_types = ", ".join(v.get("type", "?") for v in violations)
            _eliminate_agent(
                base_path,
                agent_id,
                reason="llm_judgement",
                violations=violations,
                detail=f"LLM 审查发现 {len(violations)} 项违规: {v_types}",
            )
            eliminated_ids.append(agent_id)
            print(f"[天罚] 审查消灭: {profile.name} ({agent_id}) — {v_types}")
        else:
            print(f"[天罚] 审查通过: {profile.name} ({agent_id})")

    # 刷新前端
    if eliminated_ids:
        write_frontend_json(base_path)
        print(f"[天罚] 本次共消灭 {len(eliminated_ids)} 个 Agent: {eliminated_ids}")
    else:
        print("[天罚] 本次审查全部通过")

    return eliminated_ids
