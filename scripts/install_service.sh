#!/usr/bin/env bash
# install_service.sh
#
# Sets up RemoteTerm for MeshCore as a persistent systemd service running as
# the current user from the current repo directory. No separate service account
# is needed. After installation, git pull and rebuilds work without any sudo -u
# gymnastics.
#
# Run from anywhere inside the repo:
#   bash scripts/install_service.sh

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

SERVICE_NAME="remoteterm"
REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
CURRENT_USER="$(id -un)"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"

echo -e "${BOLD}=== RemoteTerm for MeshCore — Service Installer ===${NC}"
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

# ── transport selection ────────────────────────────────────────────────────────

echo -e "${BOLD}─── Transport ───────────────────────────────────────────────────────${NC}"
echo "How is your MeshCore radio connected?"
echo "  1) Serial — auto-detect port (default)"
echo "  2) Serial — specify port manually"
echo "  3) TCP (network connection)"
echo "  4) BLE (Bluetooth)"
echo
read -rp "Select transport [1-4] (default: 1): " TRANSPORT_CHOICE
TRANSPORT_CHOICE="${TRANSPORT_CHOICE:-1}"
echo

NEED_DIALOUT=false
SERIAL_PORT=""
TCP_HOST=""
TCP_PORT=""
BLE_ADDRESS=""
BLE_PIN=""

case "$TRANSPORT_CHOICE" in
    1)
        echo -e "${GREEN}Serial auto-detect selected.${NC}"
        NEED_DIALOUT=true
        ;;
    2)
        read -rp "Serial port path (default: /dev/ttyUSB0): " SERIAL_PORT
        SERIAL_PORT="${SERIAL_PORT:-/dev/ttyUSB0}"
        echo -e "${GREEN}Serial port: ${SERIAL_PORT}${NC}"
        NEED_DIALOUT=true
        ;;
    3)
        read -rp "TCP host (IP address or hostname): " TCP_HOST
        while [ -z "$TCP_HOST" ]; do
            echo -e "${RED}TCP host is required.${NC}"
            read -rp "TCP host: " TCP_HOST
        done
        read -rp "TCP port (default: 4000): " TCP_PORT
        TCP_PORT="${TCP_PORT:-4000}"
        echo -e "${GREEN}TCP: ${TCP_HOST}:${TCP_PORT}${NC}"
        ;;
    4)
        read -rp "BLE device address (e.g. AA:BB:CC:DD:EE:FF): " BLE_ADDRESS
        while [ -z "$BLE_ADDRESS" ]; do
            echo -e "${RED}BLE address is required.${NC}"
            read -rp "BLE device address: " BLE_ADDRESS
        done
        read -rsp "BLE PIN: " BLE_PIN
        echo
        while [ -z "$BLE_PIN" ]; do
            echo -e "${RED}BLE PIN is required.${NC}"
            read -rsp "BLE PIN: " BLE_PIN
            echo
        done
        echo -e "${GREEN}BLE: ${BLE_ADDRESS}${NC}"
        ;;
    *)
        echo -e "${YELLOW}Invalid selection — defaulting to serial auto-detect.${NC}"
        TRANSPORT_CHOICE=1
        NEED_DIALOUT=true
        ;;
esac
echo

# ── bots ──────────────────────────────────────────────────────────────────────

echo -e "${BOLD}─── Bot System ──────────────────────────────────────────────────────${NC}"
echo -e "${YELLOW}Warning:${NC} The bot system executes arbitrary Python code on the server."
echo    "It is not recommended on untrusted networks. You can always enable"
echo    "it later by editing the service file."
echo
read -rp "Enable bots? [y/N]: " ENABLE_BOTS
ENABLE_BOTS="${ENABLE_BOTS:-N}"
echo

ENABLE_AUTH="N"
AUTH_USERNAME=""
AUTH_PASSWORD=""

if [[ "$ENABLE_BOTS" =~ ^[Yy] ]]; then
    echo -e "${GREEN}Bots enabled.${NC}"
    echo

    echo -e "${BOLD}─── HTTP Basic Auth ─────────────────────────────────────────────────${NC}"
    echo "With bots enabled, HTTP Basic Auth is strongly recommended if this"
    echo "service will be accessible beyond your local machine."
    echo
    read -rp "Set up HTTP Basic Auth? [Y/n]: " ENABLE_AUTH
    ENABLE_AUTH="${ENABLE_AUTH:-Y}"
    echo

    if [[ "$ENABLE_AUTH" =~ ^[Yy] ]]; then
        read -rp "Username: " AUTH_USERNAME
        while [ -z "$AUTH_USERNAME" ]; do
            echo -e "${RED}Username cannot be empty.${NC}"
            read -rp "Username: " AUTH_USERNAME
        done
        read -rsp "Password: " AUTH_PASSWORD
        echo
        while [ -z "$AUTH_PASSWORD" ]; do
            echo -e "${RED}Password cannot be empty.${NC}"
            read -rsp "Password: " AUTH_PASSWORD
            echo
        done
        echo -e "${GREEN}Basic Auth configured for user '${AUTH_USERNAME}'.${NC}"
        echo -e "${YELLOW}Note:${NC} Basic Auth credentials are not safe over plain HTTP."
        echo    "See README_ADVANCED.md for HTTPS setup."
    fi
else
    echo -e "${GREEN}Bots disabled.${NC}"
fi
echo

# ── python dependencies ────────────────────────────────────────────────────────

echo -e "${YELLOW}Installing Python dependencies (uv sync)...${NC}"
cd "$REPO_DIR"
uv sync
echo -e "${GREEN}Dependencies ready.${NC}"
echo

# ── prebuilt frontend ──────────────────────────────────────────────────────────

echo -e "${YELLOW}Fetching prebuilt frontend...${NC}"
python3 "$REPO_DIR/scripts/fetch_prebuilt_frontend.py"
echo

# ── data directory ─────────────────────────────────────────────────────────────

mkdir -p "$REPO_DIR/data"

# ── serial port access ─────────────────────────────────────────────────────────

if [ "$NEED_DIALOUT" = true ]; then
    if ! id -nG "$CURRENT_USER" | grep -qw dialout; then
        echo -e "${YELLOW}Adding ${CURRENT_USER} to the 'dialout' group for serial port access...${NC}"
        sudo usermod -aG dialout "$CURRENT_USER"
        echo -e "${GREEN}Done. You may need to log out and back in for this to take effect for${NC}"
        echo -e "${GREEN}manual runs; the service itself handles it via SupplementaryGroups.${NC}"
        echo
    else
        echo -e "${GREEN}User ${CURRENT_USER} is already in the 'dialout' group.${NC}"
        echo
    fi
fi

# ── systemd service file ───────────────────────────────────────────────────────

echo -e "${YELLOW}Writing systemd service file to ${SERVICE_FILE}...${NC}"

generate_service_file() {
    echo "[Unit]"
    echo "Description=RemoteTerm for MeshCore"
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

    # Transport
    case "$TRANSPORT_CHOICE" in
        2) echo "Environment=MESHCORE_SERIAL_PORT=${SERIAL_PORT}" ;;
        3)
            echo "Environment=MESHCORE_TCP_HOST=${TCP_HOST}"
            echo "Environment=MESHCORE_TCP_PORT=${TCP_PORT}"
            ;;
        4)
            echo "Environment=MESHCORE_BLE_ADDRESS=${BLE_ADDRESS}"
            echo "Environment=MESHCORE_BLE_PIN=${BLE_PIN}"
            ;;
    esac

    # Bots
    if [[ ! "$ENABLE_BOTS" =~ ^[Yy] ]]; then
        echo "Environment=MESHCORE_DISABLE_BOTS=true"
    fi

    # Basic auth
    if [[ "$ENABLE_BOTS" =~ ^[Yy] ]] && [[ "$ENABLE_AUTH" =~ ^[Yy] ]]; then
        echo "Environment=MESHCORE_BASIC_AUTH_USERNAME=${AUTH_USERNAME}"
        echo "Environment=MESHCORE_BASIC_AUTH_PASSWORD=${AUTH_PASSWORD}"
    fi

    # Serial group access
    if [ "$NEED_DIALOUT" = true ]; then
        echo "SupplementaryGroups=dialout"
    fi

    echo ""
    echo "[Install]"
    echo "WantedBy=multi-user.target"
}

generate_service_file | sudo tee "$SERVICE_FILE" > /dev/null

echo -e "${GREEN}Service file written.${NC}"
echo

# ── enable and start ───────────────────────────────────────────────────────────

echo -e "${YELLOW}Enabling and starting ${SERVICE_NAME}...${NC}"
sudo systemctl daemon-reload
sudo systemctl enable --now "$SERVICE_NAME"
echo

# ── status check ───────────────────────────────────────────────────────────────

echo -e "${YELLOW}Service status:${NC}"
sudo systemctl status "$SERVICE_NAME" --no-pager -l || true
echo

# ── summary ────────────────────────────────────────────────────────────────────

echo -e "${GREEN}${BOLD}=== Installation complete! ===${NC}"
echo
echo -e "RemoteTerm is running at ${CYAN}http://$(hostname -I | awk '{print $1}'):8000${NC}"
echo

case "$TRANSPORT_CHOICE" in
    1) echo -e "  Transport : ${CYAN}Serial (auto-detect)${NC}" ;;
    2) echo -e "  Transport : ${CYAN}Serial (${SERIAL_PORT})${NC}" ;;
    3) echo -e "  Transport : ${CYAN}TCP (${TCP_HOST}:${TCP_PORT})${NC}" ;;
    4) echo -e "  Transport : ${CYAN}BLE (${BLE_ADDRESS})${NC}" ;;
esac

if [[ "$ENABLE_BOTS" =~ ^[Yy] ]]; then
    echo -e "  Bots      : ${YELLOW}Enabled${NC}"
    if [[ "$ENABLE_AUTH" =~ ^[Yy] ]]; then
        echo -e "  Basic Auth: ${GREEN}Enabled (user: ${AUTH_USERNAME})${NC}"
    else
        echo -e "  Basic Auth: ${YELLOW}Not configured${NC}"
    fi
else
    echo -e "  Bots      : ${GREEN}Disabled${NC} (edit ${SERVICE_FILE} to enable)"
fi
echo

echo -e "${YELLOW}Note:${NC} A prebuilt frontend has been fetched and installed. It may lag"
echo    "behind the latest code. To build the frontend from source for the most"
echo    "up-to-date features, run:"
echo
echo -e "  ${CYAN}cd ${REPO_DIR}/frontend && npm install && npm run build${NC}"
echo

echo -e "${BOLD}─── Quick Reference ─────────────────────────────────────────────────${NC}"
echo
echo -e "${YELLOW}Update to latest and restart:${NC}"
echo -e "  cd ${REPO_DIR}"
echo -e "  git pull"
echo -e "  uv sync"
echo -e "  cd frontend && npm install && npm run build && cd .."
echo -e "  sudo systemctl restart ${SERVICE_NAME}"
echo
echo -e "${YELLOW}Refresh prebuilt frontend only (skips local build):${NC}"
echo -e "  python3 ${REPO_DIR}/scripts/fetch_prebuilt_frontend.py"
echo -e "  sudo systemctl restart ${SERVICE_NAME}"
echo
echo -e "${YELLOW}View live logs (useful for troubleshooting):${NC}"
echo -e "  sudo journalctl -u ${SERVICE_NAME} -f"
echo
echo -e "${YELLOW}Service control:${NC}"
echo -e "  sudo systemctl start|stop|restart|status ${SERVICE_NAME}"
echo -e "${BOLD}─────────────────────────────────────────────────────────────────────${NC}"
