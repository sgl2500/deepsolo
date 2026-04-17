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
from .evolution.derive import run_derivation
from .evolution.discuss import run_discussion
from .evolution.heaven import run_heaven_judgement

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
LLM_MODEL = os.environ.get("LLM_MODEL", "glm-4.7")

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


async def derivation_scheduler():
    """定时衍生任务 — 每 24 小时执行一次"""
    # 首次启动等待 60 秒（让系统就绪）
    await asyncio.sleep(60)
    while True:
        try:
            llm = LLMClient(
                api_key=LLM_API_KEY,
                base_url=LLM_BASE_URL,
                model=LLM_MODEL,
            )
            new_id = await run_derivation(DATA_DIR, llm)
            if new_id:
                print(f"[衍生] 新策略诞生: {new_id}")
            else:
                print("[衍生] 本次未产生新策略")
        except Exception as e:
            print(f"[衍生] 错误: {e}")
        await asyncio.sleep(86400)  # 24 小时


async def discussion_scheduler():
    """定时社区讨论 — 每 4 小时执行一次"""
    # 首次启动等待 120 秒（与心跳派生错开）
    await asyncio.sleep(120)
    while True:
        try:
            llm = LLMClient(
                api_key=LLM_API_KEY,
                base_url=LLM_BASE_URL,
                model=LLM_MODEL,
            )
            new_id = await run_discussion(DATA_DIR, llm)
            if new_id:
                print(f"[讨论] 碰撞出新策略: {new_id}")
            else:
                print("[讨论] 本次讨论完成，未产生新策略")
        except Exception as e:
            print(f"[讨论] 错误: {e}")
        await asyncio.sleep(14400)  # 4 小时


async def heaven_scheduler():
    """定时天道审查 — 每天执行一次"""
    # 首次启动等待 300 秒（在讨论引擎之后运行）
    await asyncio.sleep(300)
    while True:
        try:
            llm = LLMClient(
                api_key=LLM_API_KEY,
                base_url=LLM_BASE_URL,
                model=LLM_MODEL,
            )
            eliminated = await run_heaven_judgement(DATA_DIR, llm)
        except Exception as e:
            print(f"[天罚] 错误: {e}")
        await asyncio.sleep(86400)  # 24 小时


async def main():
    """启动 WebSocket 服务"""
    if not LLM_API_KEY:
        print("警告: LLM_API_KEY 环境变量未设置")
        print("请设置: export LLM_API_KEY=your_api_key")

    print(f"数据目录: {DATA_DIR}")
    print(f"LLM: {LLM_BASE_URL} / {LLM_MODEL}")
    print(f"WebSocket 服务启动: ws://{WS_HOST}:{WS_PORT}")

    # 启动衍生定时任务
    asyncio.create_task(derivation_scheduler())

    # 启动社区讨论定时任务
    asyncio.create_task(discussion_scheduler())

    # 启动天道审查定时任务
    asyncio.create_task(heaven_scheduler())

    async with websockets.serve(handle_connection, WS_HOST, WS_PORT):
        await asyncio.Future()  # 永久运行


if __name__ == "__main__":
    asyncio.run(main())
