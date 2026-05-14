set dotenv-load := true
set dotenv-filename := ".local.env"
set dotenv-required := false

default: check

# Start the Worker in local dev mode
dev:
  pnpm -r --include-workspace-root run --if-present dev

# Deploy all workers (requires CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID)
deploy:
  pnpm -r run --if-present deploy

# Run all CI checks (typecheck + format check)
check:
  pnpm -r --include-workspace-root run --if-present check

# Format all source files in place
format:
  pnpm -r --include-workspace-root run --if-present format

# Install new or changed dependencies
update:
  pnpm install

# Install all workspace dependencies
install: install-modules install-hooks

install-modules:
  pnpm ci

install-hooks:
  @p="$(git rev-parse --git-path hooks)/pre-commit"; printf '%s\n' '#!/usr/bin/env bash' 'set -euo pipefail' '' 'cd "$(git rev-parse --show-toplevel)"' 'exec just pre-commit' > "$p"; chmod +x "$p"

pre-commit: check
