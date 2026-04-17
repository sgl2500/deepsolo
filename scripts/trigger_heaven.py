"""一键触发天道审查 — 无需启动 WebSocket 服务器"""

import asyncio
import os
import sys
from pathlib import Path

# 项目根目录
PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = PROJECT_ROOT / "data"

# 加载 .env
def _load_env():
    env_path = PROJECT_ROOT / ".env"
    if env_path.exists():
        for line in env_path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if "=" in line:
                key, _, value = line.partition("=")
                if key.strip() not in os.environ:
                    os.environ[key.strip()] = value.strip()

_load_env()

# 确保能 import deepsolo
sys.path.insert(0, str(PROJECT_ROOT / "packages" / "core"))


async def main():
    from deepsolo.llm.client import LLMClient
    from deepsolo.evolution.heaven import run_heaven_judgement

    api_key = os.environ.get("LLM_API_KEY", "")
    base_url = os.environ.get("LLM_BASE_URL", "https://open.bigmodel.cn/api/anthropic")
    model = os.environ.get("LLM_MODEL", "glm-4.7")

    if not api_key:
        print("错误: LLM_API_KEY 未设置，请在 .env 中配置")
        sys.exit(1)

    llm = LLMClient(api_key=api_key, base_url=base_url, model=model)

    print(f"数据目录: {DATA_DIR}")
    print(f"LLM: {base_url} / {model}")
    print("=" * 50)
    print("天道审查启动...")
    print()

    eliminated = await run_heaven_judgement(DATA_DIR, llm)

    print()
    print("=" * 50)
    if eliminated:
        print(f"审查完成，共消灭 {len(eliminated)} 个 Agent: {eliminated}")
    else:
        print("审查完成，全部通过")


if __name__ == "__main__":
    asyncio.run(main())
