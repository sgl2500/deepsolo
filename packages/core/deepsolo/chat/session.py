"""对话会话 — 管理 NPC 对话、调用 LLM、保存记录"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

from ..llm.client import LLMClient
from ..llm.context import build_system_prompt, load_chat_history
from ..storage.file_store import _agent_dir, _read_json


class ChatSession:
    """与单个 NPC 的对话会话"""

    def __init__(self, data_dir: Path, llm: LLMClient):
        self.data_dir = data_dir
        self.llm = llm

    async def send(self, agent_id: str, user_message: str) -> str:
        """发送消息并获取回复

        1. 构建 system prompt
        2. 加载历史对话
        3. 调用 LLM
        4. 保存本轮对话到文件
        5. 返回回复
        """
        # 构建消息列表
        system_prompt = build_system_prompt(self.data_dir, agent_id)
        history = load_chat_history(self.data_dir, agent_id)

        # 转换为 LLM 格式 {role, content}
        llm_history = [{"role": m["role"], "content": m["text"]} for m in history]
        messages = [{"role": "system", "content": system_prompt}] + llm_history
        messages.append({"role": "user", "content": user_message})

        # 调用 LLM
        reply = await self.llm.chat(messages)

        # 保存对话记录
        self._save_turn(agent_id, user_message, reply)

        return reply

    def get_history(self, agent_id: str, limit: int = 50) -> list[dict]:
        """获取与观察者的对话历史"""
        return load_chat_history(self.data_dir, agent_id, limit)

    def _save_turn(self, agent_id: str, user_message: str, reply: str) -> None:
        """保存一轮对话到文件"""
        conv_path = _agent_dir(self.data_dir, agent_id) / "memory" / "conversations"
        conv_path.mkdir(parents=True, exist_ok=True)

        file_path = conv_path / "with_observer.json"

        # 读取已有数据
        if file_path.exists():
            data = _read_json(file_path)
        else:
            data = {
                "with_agent": "observer",
                "topic": "free_chat",
                "turns": [],
            }

        now = datetime.now(timezone.utc).isoformat()

        # 追加本轮对话
        data["turns"].append({
            "role": "user",
            "agent_id": "observer",
            "text": user_message,
            "timestamp": now,
        })
        data["turns"].append({
            "role": "assistant",
            "agent_id": agent_id,
            "text": reply,
            "timestamp": now,
        })

        # 更新时间戳
        data["last_updated"] = now

        file_path.write_text(
            json.dumps(data, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
