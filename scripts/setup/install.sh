#!/usr/bin/env bash
# Meshloom installer â€” self-contained (English + French).
#
# One-liner (keeps a real TTY for prompts; do not use curl | bash):
#   /bin/bash -c "$(curl -fsSL https://github.com/bagl3y/meshloom/releases/latest/download/install.sh)"
# Before the first release, use:
#   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/bagl3y/meshloom/main/scripts/setup/install.sh)"
#
# Run from a checkout:
#   bash scripts/setup/install.sh

set -euo pipefail

REPO="bagl3y/meshloom"
GIT_URL="https://github.com/${REPO}.git"
PAGES_BASE="https://bagl3y.github.io/meshloom"
GHCR_IMAGE="ghcr.io/bagl3y/meshloom"
API_RELEASES="https://api.github.com/repos/${REPO}/releases/latest"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

ML_LANG=""
OS_FAMILY=""
PKG_MGR=""
DOCKER_KIND="" # none | linux-rootful | linux-rootless | desktop
INSTALL_MODE=""
TRANSPORT=""
SERIAL_PORT=""
TCP_HOST=""
TCP_PORT="5000"
BLE_ADDRESS=""
BLE_PIN=""
ENABLE_BOTS="N"
ENABLE_AUTH="N"
AUTH_USERNAME=""
AUTH_PASSWORD=""
INSTALL_DIR=""
IN_CHECKOUT=""

# â”€â”€ i18n â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

t() {
    local key="$1"
    case "${ML_LANG}:${key}" in
        en:title) echo "Meshloom installer" ;;
        fr:title) echo "Installeur Meshloom" ;;
        en:choose_lang) echo "Language / Langue" ;;
        fr:choose_lang) echo "Langue / Language" ;;
        en:detected) echo "This machine" ;;
        fr:detected) echo "Cette machine" ;;
        en:choose_install) echo "How do you want to install Meshloom?" ;;
        fr:choose_install) echo "Comment installer Meshloom ?" ;;
        en:opt_service) echo "Native systemd service" ;;
        fr:opt_service) echo "Service systemd" ;;
        en:opt_docker) echo "Docker" ;;
        fr:opt_docker) echo "Docker" ;;
        en:opt_browser) echo "Browser only (open an existing Meshloom)" ;;
        fr:opt_browser) echo "Navigateur seulement (ouvrir un Meshloom existant)" ;;
        en:transports_full) echo "USB Â· TCP Â· BLE" ;;
        fr:transports_full) echo "USB Â· TCP Â· BLE" ;;
        en:transports_usb_tcp) echo "USB Â· TCP" ;;
        fr:transports_usb_tcp) echo "USB Â· TCP" ;;
        en:transports_tcp) echo "TCP only" ;;
        fr:transports_tcp) echo "TCP seulement" ;;
        en:recommended) echo "recommended" ;;
        fr:recommended) echo "recommandÃ©" ;;
        en:choose_transport) echo "Radio transport" ;;
        fr:choose_transport) echo "Transport radio" ;;
        en:opt_serial_auto) echo "USB serial (auto-detect)" ;;
        fr:opt_serial_auto) echo "USB sÃ©rie (auto-dÃ©tection)" ;;
        en:opt_serial) echo "USB serial (path)" ;;
        fr:opt_serial) echo "USB sÃ©rie (chemin)" ;;
        en:opt_tcp) echo "TCP" ;;
        fr:opt_tcp) echo "TCP" ;;
        en:opt_ble) echo "BLE (Bluetooth)" ;;
        fr:opt_ble) echo "BLE (Bluetooth)" ;;
        en:prompt_serial) echo "Serial device path" ;;
        fr:prompt_serial) echo "Chemin du port sÃ©rie" ;;
        en:prompt_tcp_host) echo "TCP host (IP or hostname)" ;;
        fr:prompt_tcp_host) echo "HÃ´te TCP (IP ou nom)" ;;
        en:prompt_tcp_port) echo "TCP port" ;;
        fr:prompt_tcp_port) echo "Port TCP" ;;
        en:prompt_ble_addr) echo "BLE address (AA:BB:CC:DD:EE:FF)" ;;
        fr:prompt_ble_addr) echo "Adresse BLE (AA:BB:CC:DD:EE:FF)" ;;
        en:prompt_ble_pin) echo "BLE PIN" ;;
        fr:prompt_ble_pin) echo "PIN BLE" ;;
        en:prompt_dir) echo "Install directory" ;;
        fr:prompt_dir) echo "RÃ©pertoire d'installation" ;;
        en:missing) echo "Missing dependency" ;;
        fr:missing) echo "DÃ©pendance absente" ;;
        en:offer_install) echo "Install it now?" ;;
        fr:offer_install) echo "L'installer maintenant ?" ;;
        en:how_install) echo "Install it with:" ;;
        fr:how_install) echo "Installez-le avec :" ;;
        en:bots_warn) echo "Bots execute arbitrary Python on this machine. Leave them off on any network you do not fully trust." ;;
        fr:bots_warn) echo "Les bots exÃ©cutent du Python arbitraire sur cette machine. Laissez-les dÃ©sactivÃ©s sur un rÃ©seau non entiÃ¨rement de confiance." ;;
        en:enable_bots) echo "Enable bots?" ;;
        fr:enable_bots) echo "Activer les bots ?" ;;
        en:enable_auth) echo "Set up HTTP Basic Auth?" ;;
        fr:enable_auth) echo "Configurer HTTP Basic Auth ?" ;;
        en:auth_user) echo "Username" ;;
        fr:auth_user) echo "Nom d'utilisateur" ;;
        en:auth_pass) echo "Password" ;;
        fr:auth_pass) echo "Mot de passe" ;;
        en:no_server) echo "Meshloom's server install targets Linux. On this OS, open a Meshloom already running on a Linux box, or use Docker with a TCP radio." ;;
        fr:no_server) echo "L'install serveur Meshloom cible Linux. Sur cet OS, ouvrez un Meshloom dÃ©jÃ  installÃ© sur une box Linux, ou utilisez Docker avec une radio TCP." ;;
        en:usb_elsewhere) echo "USB/BLE: install Meshloom on Linux (Pi, NASâ€¦) and plug the radio in there." ;;
        fr:usb_elsewhere) echo "USB/BLE : installez Meshloom sur Linux (Pi, NASâ€¦) et branchez la radio lÃ -bas." ;;
        en:done) echo "Installation complete." ;;
        fr:done) echo "Installation terminÃ©e." ;;
        en:open_at) echo "Open" ;;
        fr:open_at) echo "Ouvrez" ;;
        en:update_apt) echo "Later updates: sudo apt upgrade" ;;
        fr:update_apt) echo "Mises Ã  jour : sudo apt upgrade" ;;
        en:update_dnf) echo "Later updates: sudo dnf upgrade" ;;
        fr:update_dnf) echo "Mises Ã  jour : sudo dnf upgrade" ;;
        en:update_docker) echo "Later updates: sudo docker compose pull && sudo docker compose up -d" ;;
        fr:update_docker) echo "Mises Ã  jour : sudo docker compose pull && sudo docker compose up -d" ;;
        en:update_git) echo "Later updates: git pull && uv sync, then restart the service" ;;
        fr:update_git) echo "Mises Ã  jour : git pull && uv sync, puis redÃ©marrer le service" ;;
        en:using_repo) echo "Using the Meshloom apt/dnf repository." ;;
        fr:using_repo) echo "Utilisation du dÃ©pÃ´t apt/dnf Meshloom." ;;
        en:using_asset) echo "Installing the package from the latest GitHub release." ;;
        fr:using_asset) echo "Installation du paquet depuis la derniÃ¨re release GitHub." ;;
        en:using_clone) echo "No package available yet; cloning the source." ;;
        fr:using_clone) echo "Aucun paquet disponible ; clonage du source." ;;
        en:invalid) echo "Invalid choice." ;;
        fr:invalid) echo "Choix invalide." ;;
        en:required) echo "This value is required." ;;
        fr:required) echo "Cette valeur est obligatoire." ;;
        *) echo "$key" ;;
    esac
}

choose_language() {
    local default="en" choice
    case "${LANG:-}${LC_ALL:-}${LC_MESSAGES:-}" in
        fr*|FR*|*.FR) default="fr" ;;
    esac
    echo -e "${BOLD}Meshloom${NC}"
    echo
    echo "  1) English"
    echo "  2) FranÃ§ais"
    echo
    read -r -p "Language / Langue [1-2] (default: $([ "$default" = fr ] && echo 2 || echo 1)): " choice
    choice="${choice:-$([ "$default" = fr ] && echo 2 || echo 1)}"
    case "$choice" in
        2) ML_LANG="fr" ;;
        *) ML_LANG="en" ;;
    esac
    echo
}

# â”€â”€ detection â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

detect_os() {
    case "$(uname -s)" in
        Linux) OS_FAMILY="linux" ;;
        Darwin) OS_FAMILY="darwin" ;;
        MINGW*|MSYS*|CYGWIN*) OS_FAMILY="windows" ;;
        *) OS_FAMILY="other" ;;
    esac
    if command -v apt-get >/dev/null 2>&1; then
        PKG_MGR="apt"
    elif command -v dnf >/dev/null 2>&1; then
        PKG_MGR="dnf"
    else
        PKG_MGR="none"
    fi
}

docker_is_rootless() {
    docker info 2>/dev/null | grep -qi 'rootless'
}

detect_docker() {
    if ! command -v docker >/dev/null 2>&1; then
        DOCKER_KIND="none"
        return
    fi
    if [ "$OS_FAMILY" = "darwin" ] || [ "$OS_FAMILY" = "windows" ]; then
        DOCKER_KIND="desktop"
        return
    fi
    if docker_is_rootless; then
        DOCKER_KIND="linux-rootless"
    else
        DOCKER_KIND="linux-rootful"
    fi
}

detect_checkout() {
    local here=""
    if [ -n "${BASH_SOURCE[0]:-}" ] && [ -f "${BASH_SOURCE[0]}" ]; then
        here="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd 2>/dev/null || true)"
    fi
    if [ -n "$here" ] && [ -f "$here/app/main.py" ] && [ -f "$here/scripts/setup/install_service.sh" ]; then
        IN_CHECKOUT="$here"
    fi
}

host_arch() {
    case "$(uname -m)" in
        x86_64|amd64) echo "amd64" ;;
        aarch64|arm64) echo "arm64" ;;
        *) echo "unknown" ;;
    esac
}

rpm_arch() {
    case "$(host_arch)" in
        amd64) echo "x86_64" ;;
        arm64) echo "aarch64" ;;
        *) echo "unknown" ;;
    esac
}

http_ok() {
    curl -fsSIL --max-time 8 "$1" >/dev/null 2>&1
}

latest_release_tag() {
    curl -fsSL --max-time 15 "$API_RELEASES" 2>/dev/null \
        | sed -n 's/.*"tag_name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' \
        | head -n 1
}

release_asset_url() {
    local suffix="$1"
    curl -fsSL --max-time 15 "$API_RELEASES" 2>/dev/null \
        | tr ',' '\n' \
        | sed -n 's/.*"browser_download_url"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' \
        | grep -F "$suffix" \
        | head -n 1
}

# â”€â”€ prompts â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

ask_required() {
    local prompt="$1" value=""
    while [ -z "$value" ]; do
        read -r -p "${prompt}: " value
        if [ -z "$value" ]; then
            echo -e "${RED}$(t required)${NC}"
        fi
    done
    printf '%s' "$value"
}

ensure_cmd() {
    local cmd="$1" packages="$2"
    if command -v "$cmd" >/dev/null 2>&1; then
        return 0
    fi
    echo -e "${YELLOW}$(t missing): ${cmd}${NC}"
    if [ "$PKG_MGR" = "apt" ]; then
        echo "$(t how_install) sudo apt-get install -y ${packages}"
        read -r -p "$(t offer_install) [y/N]: " yn
        if [[ "${yn:-N}" =~ ^[Yy]$ ]]; then
            sudo apt-get update
            # shellcheck disable=SC2086
            sudo apt-get install -y $packages
            return 0
        fi
    elif [ "$PKG_MGR" = "dnf" ]; then
        echo "$(t how_install) sudo dnf install -y ${packages}"
        read -r -p "$(t offer_install) [y/N]: " yn
        if [[ "${yn:-N}" =~ ^[Yy]$ ]]; then
            # shellcheck disable=SC2086
            sudo dnf install -y $packages
            return 0
        fi
    else
        echo "$(t how_install) your package manager, then re-run this installer."
    fi
    if ! command -v "$cmd" >/dev/null 2>&1; then
        echo -e "${RED}$(t missing): ${cmd}${NC}"
        exit 1
    fi
}

ensure_uv() {
    if command -v uv >/dev/null 2>&1; then
        return 0
    fi
    echo -e "${YELLOW}$(t missing): uv${NC}"
    echo "$(t how_install) curl -LsSf https://astral.sh/uv/install.sh | sh"
    read -r -p "$(t offer_install) [y/N]: " yn
    if [[ "${yn:-N}" =~ ^[Yy]$ ]]; then
        curl -LsSf https://astral.sh/uv/install.sh | sh
        # shellcheck disable=SC1090
        [ -f "$HOME/.local/bin/env" ] && . "$HOME/.local/bin/env"
        export PATH="$HOME/.local/bin:$PATH"
    fi
    if ! command -v uv >/dev/null 2>&1; then
        echo -e "${RED}$(t missing): uv${NC}"
        exit 1
    fi
}

ensure_docker() {
    ensure_cmd docker "docker.io docker-compose-v2" || true
    if ! command -v docker >/dev/null 2>&1; then
        if [ "$PKG_MGR" = "dnf" ]; then
            ensure_cmd docker "docker docker-compose"
        else
            echo "See https://docs.docker.com/engine/install/"
            exit 1
        fi
    fi
    if docker compose version >/dev/null 2>&1; then
        return 0
    fi
    if command -v docker-compose >/dev/null 2>&1; then
        return 0
    fi
    echo -e "${YELLOW}$(t missing): docker compose${NC}"
    exit 1
}

compose_cmd() {
    if docker compose version >/dev/null 2>&1; then
        echo "docker compose"
    else
        echo "docker-compose"
    fi
}

choose_install_mode() {
    echo -e "${BOLD}$(t detected):${NC} ${CYAN}${OS_FAMILY}${NC}  Docker=${CYAN}${DOCKER_KIND}${NC}"
    echo
    echo "$(t choose_install)"
    local i=1
    SERVICE_IDX=""
    DOCKER_IDX=""
    BROWSER_IDX=""
    if [ "$OS_FAMILY" = "linux" ]; then
        echo "  ${i}) $(t opt_service)     $(t transports_full)     $(t recommended)"
        SERVICE_IDX="$i"
        i=$((i + 1))
    fi
    if [ "$DOCKER_KIND" != "none" ] || [ "$OS_FAMILY" = "linux" ] || [ "$OS_FAMILY" = "darwin" ]; then
        local dtrans
        case "$DOCKER_KIND" in
            linux-rootful) dtrans="$(t transports_usb_tcp)" ;;
            *) dtrans="$(t transports_tcp)" ;;
        esac
        if [ "$DOCKER_KIND" = "none" ]; then
            if [ "$OS_FAMILY" = "linux" ]; then
                echo "  ${i}) $(t opt_docker)              USB Â· TCP"
            else
                echo "  ${i}) $(t opt_docker)              $(t transports_tcp)"
            fi
        else
            echo "  ${i}) $(t opt_docker)              ${dtrans}"
        fi
        DOCKER_IDX="$i"
        i=$((i + 1))
    fi
    echo "  ${i}) $(t opt_browser)"
    BROWSER_IDX="$i"
    echo
    if [ "$OS_FAMILY" != "linux" ]; then
        echo -e "${YELLOW}$(t no_server)${NC}"
        echo -e "${YELLOW}$(t usb_elsewhere)${NC}"
        echo
    fi
    local choice
    read -r -p "[1-${i}]: " choice
    if [ -n "$SERVICE_IDX" ] && [ "$choice" = "$SERVICE_IDX" ]; then
        INSTALL_MODE="service"
    elif [ -n "$DOCKER_IDX" ] && [ "$choice" = "$DOCKER_IDX" ]; then
        INSTALL_MODE="docker"
    elif [ "$choice" = "$BROWSER_IDX" ]; then
        INSTALL_MODE="browser"
    else
        echo -e "${RED}$(t invalid)${NC}"
        exit 1
    fi
    echo
}

docker_allows_usb() {
    [ "$DOCKER_KIND" = "linux-rootful" ]
}

choose_transport() {
    local allow_usb="n" allow_ble="n"
    if [ "$INSTALL_MODE" = "service" ]; then
        allow_usb="y"
        allow_ble="y"
    elif [ "$INSTALL_MODE" = "docker" ] && docker_allows_usb; then
        allow_usb="y"
    fi

    echo "$(t choose_transport)"
    local n=1
    local idx_auto="" idx_serial="" idx_tcp="" idx_ble=""
    if [ "$allow_usb" = "y" ]; then
        echo "  ${n}) $(t opt_serial_auto)"
        idx_auto="$n"
        n=$((n + 1))
        echo "  ${n}) $(t opt_serial)"
        idx_serial="$n"
        n=$((n + 1))
    fi
    echo "  ${n}) $(t opt_tcp)"
    idx_tcp="$n"
    n=$((n + 1))
    if [ "$allow_ble" = "y" ]; then
        echo "  ${n}) $(t opt_ble)"
        idx_ble="$n"
        n=$((n + 1))
    fi
    echo
    local choice
    read -r -p "[1-$((n - 1))]: " choice
    if [ -n "$idx_auto" ] && [ "$choice" = "$idx_auto" ]; then
        TRANSPORT="serial-auto"
    elif [ -n "$idx_serial" ] && [ "$choice" = "$idx_serial" ]; then
        TRANSPORT="serial"
        SERIAL_PORT="$(ask_required "$(t prompt_serial)")"
    elif [ "$choice" = "$idx_tcp" ]; then
        TRANSPORT="tcp"
        TCP_HOST="$(ask_required "$(t prompt_tcp_host)")"
        read -r -p "$(t prompt_tcp_port) [5000]: " TCP_PORT
        TCP_PORT="${TCP_PORT:-5000}"
    elif [ -n "$idx_ble" ] && [ "$choice" = "$idx_ble" ]; then
        TRANSPORT="ble"
        BLE_ADDRESS="$(ask_required "$(t prompt_ble_addr)")"
        read -r -s -p "$(t prompt_ble_pin): " BLE_PIN
        echo
        while [ -z "$BLE_PIN" ]; do
            echo -e "${RED}$(t required)${NC}"
            read -r -s -p "$(t prompt_ble_pin): " BLE_PIN
            echo
        done
    else
        echo -e "${RED}$(t invalid)${NC}"
        exit 1
    fi
    echo
}

choose_bots_auth() {
    echo -e "${YELLOW}$(t bots_warn)${NC}"
    read -r -p "$(t enable_bots) [y/N]: " ENABLE_BOTS
    ENABLE_BOTS="${ENABLE_BOTS:-N}"
    echo
    if [[ "$ENABLE_BOTS" =~ ^[Yy]$ ]]; then
        read -r -p "$(t enable_auth) [Y/n]: " ENABLE_AUTH
        ENABLE_AUTH="${ENABLE_AUTH:-Y}"
    else
        read -r -p "$(t enable_auth) [y/N]: " ENABLE_AUTH
        ENABLE_AUTH="${ENABLE_AUTH:-N}"
    fi
    echo
    if [[ "$ENABLE_AUTH" =~ ^[Yy]$ ]]; then
        AUTH_USERNAME="$(ask_required "$(t auth_user)")"
        read -r -s -p "$(t auth_pass): " AUTH_PASSWORD
        echo
        while [ -z "$AUTH_PASSWORD" ]; do
            echo -e "${RED}$(t required)${NC}"
            read -r -s -p "$(t auth_pass): " AUTH_PASSWORD
            echo
        done
    fi
}

write_meshloom_env() {
    local dest="$1"
    {
        echo "# Generated by Meshloom install.sh"
        echo "MESHCORE_DATABASE_PATH=/var/lib/meshloom/meshcore.db"
        case "$TRANSPORT" in
            serial) echo "MESHCORE_SERIAL_PORT=${SERIAL_PORT}" ;;
            tcp)
                echo "MESHCORE_TCP_HOST=${TCP_HOST}"
                echo "MESHCORE_TCP_PORT=${TCP_PORT}"
                ;;
            ble)
                echo "MESHCORE_BLE_ADDRESS=${BLE_ADDRESS}"
                echo "MESHCORE_BLE_PIN=${BLE_PIN}"
                ;;
        esac
        if [[ ! "$ENABLE_BOTS" =~ ^[Yy]$ ]]; then
            echo "MESHCORE_DISABLE_BOTS=true"
        fi
        if [[ "$ENABLE_AUTH" =~ ^[Yy]$ ]]; then
            echo "MESHCORE_BASIC_AUTH_USERNAME=${AUTH_USERNAME}"
            echo "MESHCORE_BASIC_AUTH_PASSWORD=${AUTH_PASSWORD}"
        fi
    } | sudo tee "$dest" >/dev/null
    sudo chmod 640 "$dest"
}

start_meshloom_unit() {
    sudo systemctl daemon-reload
    sudo systemctl enable meshloom
    sudo systemctl restart meshloom
}

install_from_pages() {
    echo -e "${GREEN}$(t using_repo)${NC}"
    sudo mkdir -p /etc/apt/keyrings /etc/yum.repos.d
    if [ "$PKG_MGR" = "apt" ]; then
        if http_ok "${PAGES_BASE}/meshloom.gpg"; then
            curl -fsSL "${PAGES_BASE}/meshloom.gpg" | sudo tee /etc/apt/keyrings/meshloom.gpg >/dev/null
            echo "deb [signed-by=/etc/apt/keyrings/meshloom.gpg] ${PAGES_BASE}/apt stable main" \
                | sudo tee /etc/apt/sources.list.d/meshloom.list >/dev/null
        else
            echo "deb [trusted=yes] ${PAGES_BASE}/apt stable main" \
                | sudo tee /etc/apt/sources.list.d/meshloom.list >/dev/null
        fi
        sudo apt-get update
        sudo apt-get install -y meshloom
    else
        if http_ok "${PAGES_BASE}/meshloom.asc"; then
            sudo rpm --import "${PAGES_BASE}/meshloom.asc" || true
        fi
        sudo tee /etc/yum.repos.d/meshloom.repo >/dev/null <<EOF
[meshloom]
name=Meshloom
baseurl=${PAGES_BASE}/rpm/\$basearch
enabled=1
gpgcheck=$(http_ok "${PAGES_BASE}/meshloom.asc" && echo 1 || echo 0)
gpgkey=${PAGES_BASE}/meshloom.asc
EOF
        sudo dnf install -y meshloom
    fi
    sudo mkdir -p /etc/meshloom
    write_meshloom_env /etc/meshloom/meshloom.env
    start_meshloom_unit
}

install_from_release_asset() {
    local arch suffix url tmp
    arch="$(host_arch)"
    [ "$arch" != "unknown" ] || return 1
    if [ "$PKG_MGR" = "apt" ]; then
        suffix="_${arch}.deb"
    else
        suffix=".$(rpm_arch).rpm"
    fi
    url="$(release_asset_url "$suffix")"
    [ -n "$url" ] || return 1
    echo -e "${GREEN}$(t using_asset)${NC}"
    tmp="$(mktemp)"
    curl -fL --max-time 180 "$url" -o "$tmp"
    if [ "$PKG_MGR" = "apt" ]; then
        sudo apt-get install -y "$tmp"
    else
        sudo dnf install -y "$tmp"
    fi
    rm -f "$tmp"
    sudo mkdir -p /etc/meshloom
    write_meshloom_env /etc/meshloom/meshloom.env
    start_meshloom_unit
}

ensure_clone() {
    if [ -n "$IN_CHECKOUT" ]; then
        INSTALL_DIR="$IN_CHECKOUT"
        return 0
    fi
    local default="${HOME}/meshloom" tag
    read -r -p "$(t prompt_dir) [${default}]: " INSTALL_DIR
    INSTALL_DIR="${INSTALL_DIR:-$default}"
    if [ -f "${INSTALL_DIR}/app/main.py" ]; then
        return 0
    fi
    ensure_cmd git "git"
    ensure_cmd curl "curl"
    tag="$(latest_release_tag || true)"
    mkdir -p "$(dirname "$INSTALL_DIR")"
    if [ -n "$tag" ]; then
        git clone --depth 1 --branch "$tag" "$GIT_URL" "$INSTALL_DIR"
    else
        git clone --depth 1 "$GIT_URL" "$INSTALL_DIR"
    fi
}

run_service_from_source() {
    echo -e "${YELLOW}$(t using_clone)${NC}"
    ensure_clone
    ensure_cmd python3 "python3"
    ensure_uv
    export MESHLOOM_NONINTERACTIVE=1
    export MESHLOOM_TRANSPORT="$TRANSPORT"
    export MESHLOOM_SERIAL_PORT="$SERIAL_PORT"
    export MESHLOOM_TCP_HOST="$TCP_HOST"
    export MESHLOOM_TCP_PORT="$TCP_PORT"
    export MESHLOOM_BLE_ADDRESS="$BLE_ADDRESS"
    export MESHLOOM_BLE_PIN="$BLE_PIN"
    export MESHLOOM_ENABLE_BOTS="$ENABLE_BOTS"
    export MESHLOOM_ENABLE_AUTH="$ENABLE_AUTH"
    export MESHLOOM_AUTH_USERNAME="$AUTH_USERNAME"
    export MESHLOOM_AUTH_PASSWORD="$AUTH_PASSWORD"
    if command -v node >/dev/null 2>&1 && command -v npm >/dev/null 2>&1; then
        export MESHLOOM_FRONTEND_MODE="build"
    else
        export MESHLOOM_FRONTEND_MODE="prebuilt"
    fi
    bash "${INSTALL_DIR}/scripts/setup/install_service.sh"
}

install_native_service() {
    ensure_cmd curl "curl"
    if [ "$PKG_MGR" = "apt" ] && http_ok "${PAGES_BASE}/apt/dists/stable/Release"; then
        install_from_pages
        echo
        echo -e "${GREEN}$(t done)${NC}"
        echo "$(t open_at) ${CYAN}http://$(hostname -I 2>/dev/null | awk '{print $1}'):8000${NC}"
        echo "$(t update_apt)"
        return
    fi
    if [ "$PKG_MGR" = "dnf" ] && http_ok "${PAGES_BASE}/rpm/$(rpm_arch)/repodata/repomd.xml"; then
        install_from_pages
        echo
        echo -e "${GREEN}$(t done)${NC}"
        echo "$(t open_at) ${CYAN}http://$(hostname -I 2>/dev/null | awk '{print $1}'):8000${NC}"
        echo "$(t update_dnf)"
        return
    fi
    if [ "$PKG_MGR" = "apt" ] || [ "$PKG_MGR" = "dnf" ]; then
        if install_from_release_asset; then
            echo
            echo -e "${GREEN}$(t done)${NC}"
            echo "$(t open_at) ${CYAN}http://$(hostname -I 2>/dev/null | awk '{print $1}'):8000${NC}"
            if [ "$PKG_MGR" = "apt" ]; then echo "$(t update_apt)"; else echo "$(t update_dnf)"; fi
            return
        fi
    fi
    run_service_from_source
    echo
    echo -e "${GREEN}$(t done)${NC}"
    echo "$(t update_git)"
}

yaml_quote() {
    local value="$1"
    value="${value//\\/\\\\}"
    value="${value//\"/\\\"}"
    printf '"%s"' "$value"
}

write_docker_compose() {
    local dir="$1"
    local image="${GHCR_IMAGE}:latest"
    local tag
    tag="$(latest_release_tag || true)"
    if [ -n "$tag" ]; then
        image="${GHCR_IMAGE}:${tag#v}"
    fi
    mkdir -p "${dir}/data"
    {
        echo "# Generated by Meshloom install.sh"
        echo "services:"
        echo "  meshloom:"
        echo "    image: ${image}"
        echo "    ports:"
        echo "      - \"8000:8000\""
        echo "    volumes:"
        echo "      - ./data:/app/data"
        if [ "$TRANSPORT" = "serial" ] || [ "$TRANSPORT" = "serial-auto" ]; then
            local host_dev="${SERIAL_PORT:-/dev/ttyACM0}"
            if [ "$TRANSPORT" = "serial-auto" ]; then
                if [ -e /dev/ttyACM0 ]; then host_dev="/dev/ttyACM0"
                elif [ -e /dev/ttyUSB0 ]; then host_dev="/dev/ttyUSB0"
                fi
            fi
            echo "    devices:"
            echo "      - ${host_dev}:/dev/meshcore-radio"
        fi
        echo "    environment:"
        echo "      MESHCORE_DATABASE_PATH: $(yaml_quote "data/meshcore.db")"
        if [ "$TRANSPORT" = "serial" ] || [ "$TRANSPORT" = "serial-auto" ]; then
            echo "      MESHCORE_SERIAL_PORT: $(yaml_quote "/dev/meshcore-radio")"
        else
            echo "      MESHCORE_TCP_HOST: $(yaml_quote "$TCP_HOST")"
            echo "      MESHCORE_TCP_PORT: $(yaml_quote "$TCP_PORT")"
        fi
        if [[ ! "$ENABLE_BOTS" =~ ^[Yy]$ ]]; then
            echo "      MESHCORE_DISABLE_BOTS: $(yaml_quote "true")"
        fi
        if [[ "$ENABLE_AUTH" =~ ^[Yy]$ ]]; then
            echo "      MESHCORE_BASIC_AUTH_USERNAME: $(yaml_quote "$AUTH_USERNAME")"
            echo "      MESHCORE_BASIC_AUTH_PASSWORD: $(yaml_quote "$AUTH_PASSWORD")"
        fi
        echo "    restart: unless-stopped"
    } >"${dir}/docker-compose.yml"
}

install_docker_stack() {
    ensure_docker
    detect_docker
    if [ "$TRANSPORT" != "tcp" ] && ! docker_allows_usb; then
        echo -e "${RED}USB passthrough needs rootful Docker on Linux.${NC}"
        exit 1
    fi
    local default="${IN_CHECKOUT:-${HOME}/meshloom}"
    read -r -p "$(t prompt_dir) [${default}]: " INSTALL_DIR
    INSTALL_DIR="${INSTALL_DIR:-$default}"
    mkdir -p "$INSTALL_DIR"
    write_docker_compose "$INSTALL_DIR"
    echo -e "${GREEN}Wrote ${INSTALL_DIR}/docker-compose.yml${NC}"
    local dc
    dc="$(compose_cmd)"
    read -r -p "sudo ${dc} up -d now? [Y/n]: " yn
    yn="${yn:-Y}"
    if [[ "$yn" =~ ^[Yy]$ ]]; then
        (cd "$INSTALL_DIR" && sudo $dc pull && sudo $dc up -d)
    fi
    echo
    echo -e "${GREEN}$(t done)${NC}"
    echo "$(t open_at) ${CYAN}http://127.0.0.1:8000${NC}"
    echo "$(t update_docker)"
}

# â”€â”€ main â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

choose_language
echo -e "${BOLD}$(t title)${NC}"
echo
detect_os
detect_docker
detect_checkout
choose_install_mode

if [ "$INSTALL_MODE" = "browser" ]; then
    echo "$(t no_server)"
    exit 0
fi

choose_transport
choose_bots_auth

if [ "$INSTALL_MODE" = "service" ]; then
    install_native_service
else
    install_docker_stack
fi
