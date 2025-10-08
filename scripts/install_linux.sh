#!/usr/bin/env bash
set -euo pipefail

info() { echo -e "\033[36m[INFO]\033[0m $*"; }
ok() { echo -e "\033[32m[ OK ]\033[0m $*"; }
warn() { echo -e "\033[33m[WARN]\033[0m $*"; }
err() { echo -e "\033[31m[ERR ]\033[0m $*"; }

ensure_node() {
  if command -v node >/dev/null 2>&1; then
    v=$(node -v)
    maj=${v#v}; maj=${maj%%.*}
    if [ "${maj}" -ge 18 ] 2>/dev/null; then
      ok "Node.js ${v}"
      return
    else
      warn "Node.js ${v} (<18). Upgrading..."
    fi
  else
    warn "Node.js not found. Installing..."
  fi

  if command -v apt-get >/dev/null 2>&1; then
    info "Installing Node.js LTS via NodeSource (Debian/Ubuntu)..."
    curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
    sudo apt-get install -y nodejs
  elif command -v dnf >/dev/null 2>&1; then
    info "Installing Node.js via dnf..."
    sudo dnf module enable nodejs:18 -y || true
    sudo dnf install -y nodejs npm
  elif command -v yum >/dev/null 2>&1; then
    info "Installing Node.js via yum..."
    sudo yum install -y nodejs npm || { warn "Falling back to NodeSource"; curl -fsSL https://rpm.nodesource.com/setup_lts.x | sudo -E bash -; sudo yum install -y nodejs; }
  elif command -v pacman >/dev/null 2>&1; then
    info "Installing Node.js via pacman..."
    sudo pacman -Sy --noconfirm nodejs npm
  else
    warn "Unknown distro. Installing via nvm (user-local)..."
    curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
    # shellcheck source=/dev/null
    export NVM_DIR="$HOME/.nvm"; [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
    nvm install --lts
  fi
  ok "Node.js installed"
}

ensure_node

info "Installing ChessVermouth dependencies..."
npm install
npm run build
node scripts/fetch-stockfish.mjs || warn "Could not fetch Stockfish now; will retry at runtime"
(cd server && npm install)
(cd client && npm install)

ok "Setup complete. Run: node chessvermouth.js"

