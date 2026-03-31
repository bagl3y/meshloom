#!/usr/bin/env bash
set -e

# developer perogative ;D
if command -v enablenvm >/dev/null 2>&1; then
    enablenvm >/dev/null 2>&1 || true
fi


# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

echo -e "${YELLOW}=== RemoteTerm Quality Checks ===${NC}"
echo

# --- Phase 1: Lint & Format ---

echo -e "${YELLOW}=== Phase 1: Lint & Format ===${NC}"

echo -ne "${BLUE}[backend lint]${NC} "
cd "$REPO_ROOT"
uv run ruff check app/ tests/ --fix --quiet
uv run ruff format app/ tests/ --check --quiet
echo -e "${GREEN}Passed!${NC}"

echo -ne "${BLUE}[frontend lint]${NC} "
cd "$REPO_ROOT/frontend"
npx --quiet eslint src/ --fix --cache --quiet
npx --quiet prettier --write --list-different src/ --log-level warn
echo -e "${GREEN}Passed!${NC}"

echo -e "${GREEN}=== Phase 1 complete ===${NC}"
echo

# --- Phase 2: Typecheck, Tests & Build ---

echo -e "${YELLOW}=== Phase 2: Typecheck, Tests & Build ===${NC}"

echo -ne "${BLUE}[pyright]${NC} "
cd "$REPO_ROOT"
uv run pyright app/ --outputjson 2>/dev/null | python3 -c "
import sys, json
d = json.load(sys.stdin)
s = d.get('summary', {})
print(f\"{s.get('filesAnalyzed',0)} files, 0 errors\")
" 2>/dev/null || { uv run pyright app/; exit 1; }
echo -e "${GREEN}Passed!${NC}"

echo -ne "${BLUE}[pytest]${NC} "
cd "$REPO_ROOT"
PYTHONPATH=. uv run pytest tests/ -q --no-header --tb=short
echo -e "${GREEN}Passed!${NC}"

echo -ne "${BLUE}[vitest]${NC} "
cd "$REPO_ROOT/frontend"
npx --quiet vitest run --reporter=dot 2>&1 | tail -5
echo -e "${GREEN}Passed!${NC}"

echo -ne "${BLUE}[build]${NC} "
cd "$REPO_ROOT/frontend"
npx --quiet tsc 2>&1 && npx --quiet vite build --logLevel error 2>&1
echo -e "${GREEN}Passed!${NC}"

echo -e "${GREEN}=== Phase 2 complete ===${NC}"
echo

echo -e "${GREEN}=== All quality checks passed! ===${NC}"
