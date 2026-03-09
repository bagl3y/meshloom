#!/usr/bin/env bash
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

NODE_VERSIONS=("20" "22" "24")
NPM_VERSIONS=("9" "10")

echo -e "${YELLOW}=== Frontend Docker CI Matrix ===${NC}"
echo -e "${BLUE}Repo:${NC} $SCRIPT_DIR"
echo

run_combo() {
    local node_version="$1"
    local npm_version="$2"
    local image="node:${node_version}-slim"

    echo -e "${YELLOW}=== Node ${node_version} / npm ${npm_version} ===${NC}"

    docker run --rm \
        -v "$SCRIPT_DIR:/src:ro" \
        -w /tmp \
        "$image" \
        bash -lc "
            set -euo pipefail
            cp -a /src/frontend ./frontend
            cd frontend
            npm i -g npm@${npm_version}
            echo 'Using Node:' \$(node -v)
            echo 'Using npm:' \$(npm -v)
            npm install
            npm run build
        "

    echo -e "${GREEN}Passed:${NC} Node ${node_version} / npm ${npm_version}"
    echo
}

for node_version in "${NODE_VERSIONS[@]}"; do
    for npm_version in "${NPM_VERSIONS[@]}"; do
        run_combo "$node_version" "$npm_version"
    done
done

echo -e "${GREEN}=== Docker CI matrix passed ===${NC}"
