#!/usr/bin/env bash
# install_docker.sh
#
# Generates a local docker-compose.yml for RemoteTerm from a guided prompt flow.
# The generated compose file is intentionally gitignored so local customization
# does not create merge churn on future pulls.
#
# Run from anywhere inside the repo:
#   bash scripts/setup/install_docker.sh

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
PURPLE='\033[0;35m'
BOLD='\033[1m'
NC='\033[0m'

REPO_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
COMPOSE_FILE="$REPO_DIR/docker-compose.yml"
EXAMPLE_FILE="$REPO_DIR/docker-compose.example.yml"

IMAGE_MODE="image"
TRANSPORT_MODE="serial"
SERIAL_HOST_PATH="/dev/ttyACM0"
SERIAL_CONTAINER_PATH="/dev/meshcore-radio"
TCP_HOST=""
TCP_PORT="4000"
BLE_ADDRESS=""
BLE_PIN=""
ENABLE_BOTS="N"
ENABLE_AUTH="N"
AUTH_USERNAME=""
AUTH_PASSWORD=""
RUN_AS_HOST_USER="N"
BLE_MANUAL_WARNING=false

find_serial_devices() {
    local -n out_host_paths_ref=$1
    local -n out_labels_ref=$2
    local -n out_display_ref=$3
    local path
    local resolved
    local label

    out_host_paths_ref=()
    out_labels_ref=()
    out_display_ref=()

    if [ -d /dev/serial/by-id ]; then
        while IFS= read -r path; do
            [ -n "$path" ] || continue
            resolved="$(readlink -f "$path" 2>/dev/null || true)"
            [ -n "$resolved" ] || resolved="$path"
            label="$(basename "$path")"
            out_host_paths_ref+=("$path")
            out_labels_ref+=("$label")
            out_display_ref+=("$path -> $resolved")
        done < <(find /dev/serial/by-id -maxdepth 1 -type l | sort)
    fi

    for path in /dev/ttyACM* /dev/ttyUSB* /dev/cu.usbmodem* /dev/cu.usbserial*; do
        [ -e "$path" ] || continue
        resolved="$(readlink -f "$path" 2>/dev/null || true)"
        [ -n "$resolved" ] || resolved="$path"

        if ((${#out_host_paths_ref[@]} > 0)); then
            local existing
            for existing in "${out_display_ref[@]}"; do
                if [[ "$existing" = *"-> $resolved" ]]; then
                    resolved=""
                    break
                fi
            done
            [ -n "$resolved" ] || continue
        fi

        out_host_paths_ref+=("$path")
        out_labels_ref+=("$(basename "$path")")
        out_display_ref+=("$path")
    done
}

echo -e "${BOLD}=== RemoteTerm for MeshCore — Docker Setup ===${NC}"
echo
echo -e "  Repo directory     : ${CYAN}${REPO_DIR}${NC}"
echo -e "  Example compose    : ${CYAN}${EXAMPLE_FILE}${NC}"
echo -e "  Output compose     : ${CYAN}${COMPOSE_FILE}${NC}"
echo

if ! command -v docker &>/dev/null; then
    echo -e "${RED}Error: docker was not found in PATH.${NC}"
    exit 1
fi

if ! docker compose version &>/dev/null; then
    echo -e "${RED}Error: docker compose is required but was not available.${NC}"
    exit 1
fi

if [ -f "$COMPOSE_FILE" ]; then
    echo -e "${YELLOW}A local docker-compose.yml already exists.${NC}"
    read -rp "Overwrite it? [y/N]: " OVERWRITE
    OVERWRITE="${OVERWRITE:-N}"
    if ! [[ "$OVERWRITE" =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}Leaving the existing compose file untouched.${NC}"
        exit 0
    fi
fi

echo -e "${BOLD}─── Image Source ────────────────────────────────────────────────────${NC}"
echo "How should Docker run RemoteTerm?"
echo "  1) Use the published Docker Hub image (default)"
echo "  2) Build locally from this checkout"
echo
read -rp "Select image mode [1-2] (default: 1): " IMAGE_CHOICE
IMAGE_CHOICE="${IMAGE_CHOICE:-1}"
echo

case "$IMAGE_CHOICE" in
    1)
        IMAGE_MODE="image"
        echo -e "${GREEN}Using published Docker image.${NC}"
        ;;
    2)
        IMAGE_MODE="build"
        echo -e "${GREEN}Using local Docker build.${NC}"
        ;;
    *)
        IMAGE_MODE="image"
        echo -e "${YELLOW}Invalid selection; defaulting to published Docker image.${NC}"
        ;;
esac
echo

echo -e "${BOLD}─── Transport ───────────────────────────────────────────────────────${NC}"
echo "How will the container reach your MeshCore radio?"
echo "  1) Serial device passthrough (default)"
echo "  2) TCP"
echo "  3) BLE"
echo
echo "BLE can be configured here, but Docker Bluetooth access still requires manual compose customization."
echo
read -rp "Select transport [1-3] (default: 1): " TRANSPORT_CHOICE
TRANSPORT_CHOICE="${TRANSPORT_CHOICE:-1}"
echo

case "$TRANSPORT_CHOICE" in
    1)
        TRANSPORT_MODE="serial"
        SERIAL_HOST_PATHS=()
        SERIAL_LABELS=()
        SERIAL_DISPLAYS=()
        find_serial_devices SERIAL_HOST_PATHS SERIAL_LABELS SERIAL_DISPLAYS

        if ((${#SERIAL_HOST_PATHS[@]} == 0)); then
            echo -e "${YELLOW}No serial devices were auto-detected.${NC}"
            read -rp "Serial device path on the host (default: /dev/ttyACM0): " SERIAL_HOST_PATH
            SERIAL_HOST_PATH="${SERIAL_HOST_PATH:-/dev/ttyACM0}"
        else
            echo "Detected serial devices:"
            for i in "${!SERIAL_HOST_PATHS[@]}"; do
                printf '  %d) %s (%s)\n' "$((i + 1))" "${SERIAL_LABELS[$i]}" "${SERIAL_DISPLAYS[$i]}"
            done
            echo "  m) Enter a path manually"
            echo
            read -rp "Select serial device [1-${#SERIAL_HOST_PATHS[@]} or m] (default: 1): " SERIAL_CHOICE
            SERIAL_CHOICE="${SERIAL_CHOICE:-1}"

            if [[ "$SERIAL_CHOICE" =~ ^[Mm]$ ]]; then
                read -rp "Serial device path on the host (default: ${SERIAL_HOST_PATHS[0]}): " SERIAL_HOST_PATH
                SERIAL_HOST_PATH="${SERIAL_HOST_PATH:-${SERIAL_HOST_PATHS[0]}}"
            elif [[ "$SERIAL_CHOICE" =~ ^[0-9]+$ ]] && [ "$SERIAL_CHOICE" -ge 1 ] && [ "$SERIAL_CHOICE" -le "${#SERIAL_HOST_PATHS[@]}" ]; then
                SERIAL_HOST_PATH="${SERIAL_HOST_PATHS[$((SERIAL_CHOICE - 1))]}"
            else
                SERIAL_HOST_PATH="${SERIAL_HOST_PATHS[0]}"
                echo -e "${YELLOW}Invalid selection; defaulting to ${SERIAL_HOST_PATH}.${NC}"
            fi
        fi

        echo -e "${GREEN}Serial passthrough: ${SERIAL_HOST_PATH} -> ${SERIAL_CONTAINER_PATH}${NC}"
        ;;
    2)
        TRANSPORT_MODE="tcp"
        read -rp "TCP host (IP address or hostname): " TCP_HOST
        while [ -z "$TCP_HOST" ]; do
            echo -e "${RED}TCP host is required.${NC}"
            read -rp "TCP host: " TCP_HOST
        done
        read -rp "TCP port (default: 4000): " TCP_PORT
        TCP_PORT="${TCP_PORT:-4000}"
        echo -e "${GREEN}TCP: ${TCP_HOST}:${TCP_PORT}${NC}"
        ;;
    3)
        TRANSPORT_MODE="ble"
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
        echo
        echo -e "${RED}BLE Docker warning:${NC} Bluetooth access is not fully automated here."
        echo -e "${RED}You will need to customize docker-compose.yml manually before BLE works.${NC}"
        echo "That may include passing through Bluetooth devices, enabling privileged mode,"
        echo "using host networking, or other host-specific Docker changes."
        echo "If you want the easier path, use the regular Python launch flow for BLE instead."
        BLE_MANUAL_WARNING=true
        ;;
    *)
        TRANSPORT_MODE="serial"
        SERIAL_HOST_PATH="/dev/ttyACM0"
        echo -e "${YELLOW}Invalid selection; defaulting to serial passthrough at ${SERIAL_HOST_PATH}.${NC}"
        ;;
esac
echo

echo -e "${BOLD}─── Bot System ──────────────────────────────────────────────────────${NC}"
echo -e "${YELLOW}Warning:${NC} The bot system executes arbitrary Python code on the server."
echo "It is not recommended on untrusted networks."
echo
read -rp "Enable bots? [y/N]: " ENABLE_BOTS
ENABLE_BOTS="${ENABLE_BOTS:-N}"
echo

if [[ "$ENABLE_BOTS" =~ ^[Yy]$ ]]; then
    echo -e "${GREEN}Bots enabled.${NC}"
    echo
    echo -e "${BOLD}─── HTTP Basic Auth ─────────────────────────────────────────────────${NC}"
    echo "With bots enabled, HTTP Basic Auth is strongly recommended if this"
    echo "service will be reachable beyond your local machine."
    echo
    read -rp "Set up HTTP Basic Auth? [Y/n]: " ENABLE_AUTH
    ENABLE_AUTH="${ENABLE_AUTH:-Y}"
    echo

    if [[ "$ENABLE_AUTH" =~ ^[Yy]$ ]]; then
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
    fi
else
    echo -e "${GREEN}Bots disabled.${NC}"
fi
echo

if [ "$(uname -s)" = "Linux" ]; then
    echo -e "${BOLD}─── Container User ──────────────────────────────────────────────────${NC}"
    echo "The container runs as root by default for maximum serial compatibility."
    echo "You can override that and run as your host UID/GID instead to avoid"
    echo "root-owned files in ./data."
    echo
    read -rp "Run as your current UID/GID instead of the default root user? [y/N]: " RUN_AS_HOST_USER
    RUN_AS_HOST_USER="${RUN_AS_HOST_USER:-N}"
    if [[ "$RUN_AS_HOST_USER" =~ ^[Yy]$ ]] && [ "$TRANSPORT_MODE" = "serial" ]; then
        echo
        echo -e "${YELLOW}Note:${NC} host-user mode can be less reliable for serial device access than running as root."
        echo "It may require extra group setup such as dialout, or other manual"
        echo "container customization, depending on your host."
        echo "If serial access becomes unreliable, rerun this setup and keep the"
        echo "default root user instead."
    fi
    echo
fi

mkdir -p "$REPO_DIR/data"

{
    echo "# Generated by scripts/setup/install_docker.sh"
    echo "# This file is gitignored. Re-run the setup script to regenerate it."
    echo "services:"
    echo "  remoteterm:"
    if [ "$IMAGE_MODE" = "build" ]; then
        echo "    build: ."
    else
        echo "    image: jkingsman/remoteterm-meshcore:latest"
    fi
    if [[ "$RUN_AS_HOST_USER" =~ ^[Yy]$ ]]; then
        echo "    user: \"$(id -u):$(id -g)\""
    fi
    echo "    ports:"
    echo "      - \"8000:8000\""
    echo "    volumes:"
    echo "      - ./data:/app/data"
    if [ "$TRANSPORT_MODE" = "serial" ]; then
        echo "    devices:"
        echo "      - ${SERIAL_HOST_PATH}:${SERIAL_CONTAINER_PATH}"
    fi
    echo "    environment:"
    echo "      MESHCORE_DATABASE_PATH: data/meshcore.db"
    if [ "$TRANSPORT_MODE" = "serial" ]; then
        echo "      MESHCORE_SERIAL_PORT: ${SERIAL_CONTAINER_PATH}"
    elif [ "$TRANSPORT_MODE" = "tcp" ]; then
        echo "      MESHCORE_TCP_HOST: ${TCP_HOST}"
        echo "      MESHCORE_TCP_PORT: ${TCP_PORT}"
    else
        echo "      MESHCORE_BLE_ADDRESS: ${BLE_ADDRESS}"
        echo "      MESHCORE_BLE_PIN: ${BLE_PIN}"
    fi
    if ! [[ "$ENABLE_BOTS" =~ ^[Yy]$ ]]; then
        echo "      MESHCORE_DISABLE_BOTS: \"true\""
    fi
    if [[ "$ENABLE_AUTH" =~ ^[Yy]$ ]]; then
        echo "      MESHCORE_BASIC_AUTH_USERNAME: ${AUTH_USERNAME}"
        echo "      MESHCORE_BASIC_AUTH_PASSWORD: ${AUTH_PASSWORD}"
    fi
    echo "    restart: unless-stopped"
} >"$COMPOSE_FILE"

echo -e "${GREEN}Generated ${COMPOSE_FILE}.${NC}"
echo
echo -e "${BOLD}Docker commands${NC}"
if [ "$IMAGE_MODE" = "build" ]; then
    echo "  docker compose up -d --build    # build the local image and start RemoteTerm in the background"
else
    echo "  docker compose up -d            # start RemoteTerm in the background"
fi
echo "  docker compose logs -f          # follow the container logs live"
echo
echo "  docker compose down             # stop and remove the running container"
echo "  docker compose restart          # restart the container without changing the image"
echo "  docker compose pull && docker compose up -d   # upgrade to the latest published image and restart"
if [ "$TRANSPORT_MODE" = "ble" ] || [ "$BLE_MANUAL_WARNING" = true ]; then
    echo
    echo -e "${RED}BLE requires more than the generated env vars.${NC}"
    echo -e "${RED}Before starting, edit docker-compose.yml for Bluetooth passthrough and any privileged/network settings your host requires.${NC}"
fi
echo
echo -e "${GREEN}Your new docker file is ready at ${COMPOSE_FILE}.${NC}"
echo -e "${GREEN}Feel free to edit it by hand as desired, or:${NC}"
echo
echo -e "${PURPLE}┌──────────────────────────────────────────────┐${NC}"
echo -e "${PURPLE}│  Run ${GREEN}${BOLD}docker compose up -d${NC}${PURPLE} to get started.    │${NC}"
echo -e "${PURPLE}└──────────────────────────────────────────────┘${NC}"
