"""DeepSolo WebSocket 服务 — 处理观察者与 NPC 的实时对话"""

from __future__ import annotations

import asyncio
import json
import os
import sys
from pathlib import Path

import websockets

from .llm.client import LLMClient
from .chat.session import ChatSession

# 项目根目录（deepsolo/）
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent

# 数据目录
DATA_DIR = PROJECT_ROOT / "data"

# 加载 .env 文件
def _load_env():
    env_path = PROJECT_ROOT / ".env"
    if env_path.exists():
        for line in env_path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if "=" in line:
                key, _, value = line.partition("=")
                key = key.strip()
                value = value.strip()
                if key not in os.environ:
                    os.environ[key] = value

_load_env()

# LLM 配置（从环境变量读取）
LLM_API_KEY = os.environ.get("LLM_API_KEY", "")
LLM_BASE_URL = os.environ.get("LLM_BASE_URL", "https://open.bigmodel.cn/api/anthropic")
LLM_MODEL = os.environ.get("LLM_MODEL", "claude-sonnet-4-20250514")

WS_HOST = os.environ.get("WS_HOST", "localhost")
WS_PORT = int(os.environ.get("WS_PORT", "8765"))


def create_session() -> ChatSession:
    """创建对话会话"""
    llm = LLMClient(
        api_key=LLM_API_KEY,
        base_url=LLM_BASE_URL,
        model=LLM_MODEL,
    )
    return ChatSession(DATA_DIR, llm)


async def handle_connection(websocket):
    """处理单个 WebSocket 连接"""
    session = create_session()
    print(f"[WS] 新连接: {websocket.remote_address}")

    try:
        async for raw_message in websocket:
            try:
                msg = json.loads(raw_message)
            except json.JSONDecodeError:
                await websocket.send(json.dumps({
                    "type": "error",
                    "text": "无效的 JSON 消息",
                }))
                continue

            msg_type = msg.get("type")

            if msg_type == "chat":
                agent_id = msg.get("agent_id", "")
                user_text = msg.get("message", "")

                if not agent_id or not user_text:
                    await websocket.send(json.dumps({
                        "type": "error",
                        "text": "缺少 agent_id 或 message",
                    }))
                    continue

                print(f"[WS] 聊天 -> {agent_id}: {user_text[:50]}...")

                # 调用 LLM
                try:
                    reply = await session.send(agent_id, user_text)
                    await websocket.send(json.dumps({
                        "type": "reply",
                        "agent_id": agent_id,
                        "text": reply,
                    }))
                except Exception as e:
                    print(f"[WS] LLM 调用失败: {e}")
                    await websocket.send(json.dumps({
                        "type": "error",
                        "agent_id": agent_id,
                        "text": f"抱歉，我现在无法回复。错误: {str(e)}",
                    }))

            elif msg_type == "history":
                agent_id = msg.get("agent_id", "")
                history = session.get_history(agent_id)
                await websocket.send(json.dumps({
                    "type": "history",
                    "agent_id": agent_id,
                    "messages": history,
                }))

            else:
                await websocket.send(json.dumps({
                    "type": "error",
                    "text": f"未知的消息类型: {msg_type}",
                }))

    except websockets.ConnectionClosed:
        print(f"[WS] 连接关闭: {websocket.remote_address}")


async def main():
    """启动 WebSocket 服务"""
    if not LLM_API_KEY:
        print("警告: LLM_API_KEY 环境变量未设置")
        print("请设置: export LLM_API_KEY=your_api_key")

    print(f"数据目录: {DATA_DIR}")
    print(f"LLM: {LLM_BASE_URL} / {LLM_MODEL}")
    print(f"WebSocket 服务启动: ws://{WS_HOST}:{WS_PORT}")

    async with websockets.serve(handle_connection, WS_HOST, WS_PORT):
        await asyncio.Future()  # 永久运行


if __name__ == "__main__":
    asyncio.run(main())
