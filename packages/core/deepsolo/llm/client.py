"""LLM 调用客户端

使用 Anthropic Messages API 格式，通过智谱 AI 代理。
用户可替换具体实现。
"""

from __future__ import annotations

import httpx


class LLMClient:
    """LLM 调用客户端（Anthropic API 格式）"""

    def __init__(
        self,
        api_key: str,
        base_url: str = "https://open.bigmodel.cn/api/anthropic",
        model: str = "claude-sonnet-4-20250514",
    ):
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.model = model

    async def chat(self, messages: list[dict]) -> str:
        """发送消息并返回回复文本

        Args:
            messages: 消息列表，支持 system/user/assistant role
                [{"role": "system", "content": "..."}, {"role": "user", "content": "..."}]

        Returns:
            LLM 回复文本
        """
        # 分离 system prompt
        system_content = ""
        chat_messages = []
        for msg in messages:
            if msg["role"] == "system":
                system_content = msg["content"]
            else:
                chat_messages.append(msg)

        url = f"{self.base_url}/v1/messages"
        headers = {
            "x-api-key": self.api_key,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
        }
        payload = {
            "model": self.model,
            "max_tokens": 1024,
            "system": system_content,
            "messages": chat_messages,
        }

        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.post(url, headers=headers, json=payload)
            resp.raise_for_status()
            data = resp.json()
            return data["content"][0]["text"]
