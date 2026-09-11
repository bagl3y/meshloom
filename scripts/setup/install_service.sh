#!/usr/bin/env bash
# install_service.sh
#
# Sets up Meshloom as a persistent systemd service running as
# the current user from the current repo directory. No separate service account
# is needed. After installation, git pull and rebuilds work without any sudo -u
# gymnastics.
#
# Run from anywhere inside the repo:
#   bash scripts/setup/install_service.sh

set -e

is_root() { [ "$(id -u)" -eq 0 ]; }

as_root() {
    if is_root; then
        "$@"
    else
        command sudo "$@"
    fi
}

priv() {
    if is_root; then
        printf '%s' "$*"
    else
        printf 'sudo %s' "$*"
    fi
}

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

SERVICE_NAME="meshloom"
REPO_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
CURRENT_USER="$(id -un)"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"
FRONTEND_MODE="build"

echo -e "${BOLD}=== Meshloom — Service Installer ===${NC}"
echo

# ── sanity checks ──────────────────────────────────────────────────────────────

if [ "$(uname -s)" != "Linux" ]; then
    echo -e "${RED}Error: this script is for Linux (systemd) only.${NC}"
    exit 1
fi

if ! command -v systemctl &>/dev/null; then
    echo -e "${RED}Error: systemd not found. This script requires a systemd-based Linux system.${NC}"
    exit 1
fi

if ! command -v uv &>/dev/null; then
    echo -e "${RED}Error: 'uv' not found. Install it first:${NC}"
    echo    "  curl -LsSf https://astral.sh/uv/install.sh | sh"
    exit 1
fi

if ! command -v python3 &>/dev/null; then
    echo -e "${RED}Error: python3 is required but was not found.${NC}"
    exit 1
fi

UV_BIN="$(command -v uv)"
UVICORN_BIN="$REPO_DIR/.venv/bin/uvicorn"

echo -e "  Installing as user : ${CYAN}${CURRENT_USER}${NC}"
echo -e "  Repo directory     : ${CYAN}${REPO_DIR}${NC}"
echo -e "  Service name       : ${CYAN}${SERVICE_NAME}${NC}"
echo -e "  uv                 : ${CYAN}${UV_BIN}${NC}"
echo

version_major() {
    local version="$1"
    version="${version#v}"
    printf '%s' "${version%%.*}"
}

require_minimum_version() {
    local tool_name="$1"
    local detected_version="$2"
    local minimum_major="$3"
    local major
    major="$(version_major "$detected_version")"
    if ! [[ "$major" =~ ^[0-9]+$ ]] || [ "$major" -lt "$minimum_major" ]; then
        echo -e "${RED}Error: ${tool_name} ${minimum_major}+ is required for a local frontend build, but found ${detected_version}.${NC}"
        exit 1
    fi
}

# Radio transport is configured in the web UI (app_settings), not via
# systemd Environment= lines. Grant dialout so a later serial choice works.
NEED_DIALOUT=true

# ── frontend install mode ──────────────────────────────────────────────────────

if [ -n "${MESHLOOM_FRONTEND_MODE:-}" ]; then
    FRONTEND_MODE="$MESHLOOM_FRONTEND_MODE"
    echo -e "${GREEN}Frontend mode: ${FRONTEND_MODE}${NC}"
    echo
else
    echo -e "${BOLD}─── Frontend Assets ─────────────────────────────────────────────────${NC}"
    echo "How should the frontend be installed?"
    echo "  1) Build locally with npm (default, latest code, requires node/npm)"
    echo "  2) Download prebuilt frontend (fastest)"
    echo
    read -rp "Select frontend mode [1-2] (default: 1): " FRONTEND_CHOICE
    FRONTEND_CHOICE="${FRONTEND_CHOICE:-1}"
    echo

    case "$FRONTEND_CHOICE" in
        1)
            FRONTEND_MODE="build"
            echo -e "${GREEN}Using local frontend build.${NC}"
            ;;
        2)
            FRONTEND_MODE="prebuilt"
            echo -e "${GREEN}Using prebuilt frontend download.${NC}"
            ;;
        *)
            FRONTEND_MODE="build"
            echo -e "${YELLOW}Invalid selection — defaulting to local frontend build.${NC}"
            ;;
    esac
    echo
fi

# ── python dependencies ────────────────────────────────────────────────────────

echo -e "${YELLOW}Installing Python dependencies (uv sync)...${NC}"
cd "$REPO_DIR"
uv sync
echo -e "${GREEN}Dependencies ready.${NC}"
echo

# ── frontend assets ────────────────────────────────────────────────────────────

if [ "$FRONTEND_MODE" = "build" ]; then
    if ! command -v node &>/dev/null; then
        echo -e "${RED}Error: node is required for a local frontend build but was not found.${NC}"
        echo -e "${YELLOW}Tip:${NC} Re-run the installer and choose the prebuilt frontend option, or install Node.js 20+ and npm 9+."
        exit 1
    fi
    if ! command -v npm &>/dev/null; then
        echo -e "${RED}Error: npm is required for a local frontend build but was not found.${NC}"
        echo -e "${YELLOW}Tip:${NC} Re-run the installer and choose the prebuilt frontend option, or install Node.js 20+ and npm 9+."
        exit 1
    fi

    NODE_VERSION="$(node -v)"
    NPM_VERSION="$(npm -v)"
    require_minimum_version "Node.js" "$NODE_VERSION" 20
    require_minimum_version "npm" "$NPM_VERSION" 9

    echo -e "${YELLOW}Building frontend locally with Node ${NODE_VERSION} and npm ${NPM_VERSION}...${NC}"
    (
        cd "$REPO_DIR/frontend"
        npm install
        npm run build
    )
else
    echo -e "${YELLOW}Fetching prebuilt frontend...${NC}"
    python3 "$REPO_DIR/scripts/setup/fetch_prebuilt_frontend.py"
fi
echo

# ── data directory ─────────────────────────────────────────────────────────────

mkdir -p "$REPO_DIR/data"

# ── serial port access ─────────────────────────────────────────────────────────

if [ "$NEED_DIALOUT" = true ] && ! is_root; then
    if ! id -nG "$CURRENT_USER" | grep -qw dialout; then
        echo -e "${YELLOW}Adding ${CURRENT_USER} to the 'dialout' group for serial port access...${NC}"
        as_root usermod -aG dialout "$CURRENT_USER"
        echo -e "${GREEN}Done. You may need to log out and back in for this to take effect for${NC}"
        echo -e "${GREEN}manual runs; the service itself handles it via SupplementaryGroups.${NC}"
        echo
    else
        echo -e "${GREEN}User ${CURRENT_USER} is already in the 'dialout' group.${NC}"
        echo
    fi
fi

# ── systemd service file ───────────────────────────────────────────────────────

if as_root systemctl is-active --quiet "$SERVICE_NAME"; then
    echo -e "${YELLOW}${SERVICE_NAME} is currently running; stopping it before applying changes...${NC}"
    as_root systemctl stop "$SERVICE_NAME"
    echo
fi

echo -e "${YELLOW}Writing systemd service file to ${SERVICE_FILE}...${NC}"

generate_service_file() {
    echo "[Unit]"
    echo "Description=Meshloom"
    echo "After=network.target"
    echo ""
    echo "[Service]"
    echo "Type=simple"
    echo "User=${CURRENT_USER}"
    echo "WorkingDirectory=${REPO_DIR}"
    echo "ExecStart=${UVICORN_BIN} app.main:app --host 0.0.0.0 --port 8000"
    echo "Restart=always"
    echo "RestartSec=5"
    echo "Environment=MESHCORE_DATABASE_PATH=${REPO_DIR}/data/meshcore.db"

    # Serial group access (root already has device access)
    if [ "$NEED_DIALOUT" = true ] && ! is_root; then
        echo "SupplementaryGroups=dialout"
    fi

    echo ""
    echo "[Install]"
    echo "WantedBy=multi-user.target"
}

generate_service_file | as_root tee "$SERVICE_FILE" > /dev/null

echo -e "${GREEN}Service file written.${NC}"
echo

# ── enable and start ───────────────────────────────────────────────────────────

echo -e "${YELLOW}Reloading systemd and applying ${SERVICE_NAME}...${NC}"
as_root systemctl daemon-reload
as_root systemctl enable "$SERVICE_NAME"
as_root systemctl start "$SERVICE_NAME"
echo

# ── status check ───────────────────────────────────────────────────────────────

echo -e "${YELLOW}Service status:${NC}"
as_root systemctl status "$SERVICE_NAME" --no-pager -l || true
echo

# ── summary ────────────────────────────────────────────────────────────────────

echo -e "${GREEN}${BOLD}=== Installation complete! ===${NC}"
echo
echo -e "Meshloom is running at ${CYAN}http://$(hostname -I | awk '{print $1}'):8000${NC}"
echo

echo -e "  Transport : ${CYAN}Configured in the web interface${NC}"
if [ "$FRONTEND_MODE" = "build" ]; then
    echo -e "  Frontend  : ${GREEN}Built locally${NC}"
else
    echo -e "  Frontend  : ${YELLOW}Prebuilt download${NC}"
fi

echo

if [ "$FRONTEND_MODE" = "prebuilt" ]; then
    echo -e "${YELLOW}Note:${NC} A prebuilt frontend has been fetched and installed. It may lag"
    echo    "behind the latest code. To build the frontend from source for the most"
    echo    "up-to-date features later, run:"
    echo
    echo -e "  ${CYAN}cd ${REPO_DIR}/frontend && npm install && npm run build${NC}"
    echo
fi

echo -e "${BOLD}─── Quick Reference ─────────────────────────────────────────────────${NC}"
echo
echo -e "${YELLOW}Update to latest and restart:${NC}"
echo -e "  cd ${REPO_DIR}"
echo -e "  git pull"
echo -e "  uv sync"
echo -e "  cd frontend && npm install && npm run build && cd .."
echo -e "  $(priv systemctl restart ${SERVICE_NAME})"
echo
echo -e "${YELLOW}Refresh prebuilt frontend only (skips local build):${NC}"
echo -e "  python3 ${REPO_DIR}/scripts/setup/fetch_prebuilt_frontend.py"
echo -e "  $(priv systemctl restart ${SERVICE_NAME})"
echo
echo -e "${YELLOW}View live logs (useful for troubleshooting):${NC}"
echo -e "  $(priv journalctl -u ${SERVICE_NAME} -f)"
echo
echo -e "${YELLOW}Service control:${NC}"
echo -e "  $(priv "systemctl start|stop|restart|status ${SERVICE_NAME}")"
echo -e "${BOLD}─────────────────────────────────────────────────────────────────────${NC}"
