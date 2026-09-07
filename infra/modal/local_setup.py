"""Create private local credentials without printing secrets or overwriting an existing file."""
import json
from pathlib import Path
import secrets
import subprocess
import sys

path = Path(__file__).resolve().parents[2] / ".env.arena"
if path.exists():
    raise SystemExit("Local Arena configuration already exists; nothing was changed.")
result = subprocess.run([sys.executable, "-X", "utf8", "-m", "modal", "workspace", "proxy-tokens", "create", "--json"],
                        capture_output=True, text=True, encoding="utf-8", check=True)
token = json.loads(result.stdout)
values = {
    "OPEN_ARENA_MATCHED_ENABLED": "false",
    "OPEN_ARENA_BUDGETS_CONFIRMED": "false",
    "OPEN_ARENA_ACCESS_KEY": secrets.token_urlsafe(32),
    "OPEN_ARENA_MODAL_URL": "",
    "OPEN_ARENA_MODAL_KEY": token["Modal-Key"],
    "OPEN_ARENA_MODAL_SECRET": token["Modal-Secret"],
    "OPEN_ARENA_OPENROUTER_KEY": "",
    "OPEN_ARENA_26B_PROVIDER": "google-vertex/global",
    "OPEN_ARENA_26B_PROVIDER_NAME": "Google",
    "OPEN_ARENA_JUDGE_PROVIDER": "openai",
    "OPEN_ARENA_JUDGE_PROVIDER_NAME": "OpenAI",
    "OPEN_ARENA_MONTHLY_RUN_LIMIT": "20",
    "OPEN_ARENA_DAILY_RUN_LIMIT": "10",
}
with path.open("x", encoding="utf-8") as output:
    output.write("# Private pilot credentials. Never commit or paste into chat.\n")
    output.write("# Add the separate OpenRouter API key with a $25 monthly limit below.\n")
    output.write("\n".join(f"{key}={json.dumps(value)}" for key, value in values.items()) + "\n")
print(f"Created {path.name}. Credentials were not printed.")
