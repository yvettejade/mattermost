#!/usr/bin/env bash
set -Eeuo pipefail

log() {
  printf '[cloud-agent-install] %s\n' "$*" >&2
}

is_true() {
  case "${1:-}" in
    1 | true | TRUE | yes | YES) return 0 ;;
    *) return 1 ;;
  esac
}

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT"

NODE_VERSION="${CLOUD_AGENT_NODE_VERSION:-24.11.1}"
AGENT_BROWSER_VERSION="${CLOUD_AGENT_BROWSER_VERSION:-0.27.0}"

export GOPATH="${GOPATH:-$HOME/go}"
export PATH="/usr/local/go/bin:$GOPATH/bin:/usr/local/bin:$PATH"
# go.dev is not on the default Cloud Agent egress allowlist; stay on the image toolchain.
export GOTOOLCHAIN="${GOTOOLCHAIN:-local}"

ensure_go() {
  if ! command -v go >/dev/null 2>&1; then
    log "Go is not available on PATH. PATH=$PATH"
    return 1
  fi

  log "Using $(go version)"
}

source_node() {
  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  if [ -s "$NVM_DIR/nvm.sh" ]; then
    # shellcheck source=/dev/null
    . "$NVM_DIR/nvm.sh"
  fi
}

ensure_node() {
  source_node

  if command -v nvm >/dev/null 2>&1; then
    nvm install "$NODE_VERSION" >/dev/null
    nvm alias default "$NODE_VERSION" >/dev/null
    nvm use "$NODE_VERSION" >/dev/null
  fi

  if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
    log "Node.js/npm are not available; check the Cloud Agent Dockerfile build."
    return 1
  fi

  log "Using node $(node --version) and npm $(npm --version)"

  if ! command -v agent-browser >/dev/null 2>&1; then
    npm install -g "agent-browser@${AGENT_BROWSER_VERSION}"
  fi

  if ! is_true "${CLOUD_AGENT_SKIP_AGENT_BROWSER_INSTALL:-false}"; then
    agent-browser install || log "agent-browser install failed; continuing so code tasks are not blocked."
  fi
}

enterprise_build_dir() {
  case "$BUILD_ENTERPRISE_DIR" in
    /*) realpath -m "$BUILD_ENTERPRISE_DIR" ;;
    *) realpath -m "$ROOT/server/$BUILD_ENTERPRISE_DIR" ;;
  esac
}

find_enterprise_checkout() {
  local candidates=()
  if [ -n "${ENTERPRISE_CHECKOUT_DIR:-}" ]; then
    candidates+=("$ENTERPRISE_CHECKOUT_DIR")
  fi
  if [ -n "${ENTERPRISE_DIR:-}" ]; then
    candidates+=("$ENTERPRISE_DIR")
  fi
  if [ -n "${CLOUD_AGENT_ENTERPRISE_DIR:-}" ]; then
    candidates+=("$CLOUD_AGENT_ENTERPRISE_DIR")
  fi

  candidates+=(
    "$ROOT/../enterprise"
    "$ROOT/../../enterprise"
    "$HOME/enterprise"
  )

  local candidate
  for candidate in "${candidates[@]}"; do
    if git -C "$candidate" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
      realpath -m "$candidate"
      return 0
    fi
  done

  return 1
}

clone_enterprise_checkout() {
  local dest="${CLOUD_AGENT_ENTERPRISE_DIR:-$HOME/enterprise}"

  if git -C "$dest" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    realpath -m "$dest"
    return 0
  fi

  if [ -e "$dest" ]; then
    log "Cannot clone enterprise: $dest already exists and is not a git checkout."
    return 1
  fi

  if ! command -v gh >/dev/null 2>&1; then
    log "GitHub CLI is not available; cannot clone mattermost/enterprise."
    return 1
  fi

  log "Enterprise checkout missing; cloning mattermost/enterprise to $dest."
  if gh repo clone mattermost/enterprise "$dest" -- --depth 1; then
    realpath -m "$dest"
    return 0
  fi

  rm -rf "$dest"
  log "Could not clone mattermost/enterprise. repositoryDependencies grants token scope but does not check the repo out during environment builds, and this token may lack access."
  return 1
}

ensure_enterprise_checkout() {
  if is_true "${CLOUD_AGENT_SKIP_ENTERPRISE:-false}"; then
    log "Skipping enterprise verification because CLOUD_AGENT_SKIP_ENTERPRISE is set."
    return 0
  fi

  local target
  if target="$(find_enterprise_checkout)"; then
    log "Enterprise checkout ready at $target."
    export BUILD_ENTERPRISE_DIR="$target"
    return 0
  fi

  if target="$(clone_enterprise_checkout)"; then
    log "Enterprise checkout ready at $target."
    export BUILD_ENTERPRISE_DIR="$target"
    return 0
  fi

  # Environment builds only clone the primary repo. Failing here previously
  # skipped Go/webapp/Playwright hydration and marked every snapshot failed.
  log "Continuing without enterprise; open-source Go modules will still hydrate."
  return 0
}

retry() {
  local attempts="$1"
  shift
  local n=1
  until "$@"; do
    if [ "$n" -ge "$attempts" ]; then
      return 1
    fi
    log "Command failed (attempt ${n}/${attempts}); retrying in $((n * 8))s: $*"
    sleep $((n * 8))
    n=$((n + 1))
  done
}

hydrate_go_dependencies() {
  if is_true "${CLOUD_AGENT_SKIP_GO_DEPS:-false}"; then
    log "Skipping Go dependency hydration."
    return 0
  fi

  if [ -d server ]; then
    if [ -n "${BUILD_ENTERPRISE_DIR:-}" ]; then
      local enterprise_dir
      enterprise_dir="$(enterprise_build_dir)"
      log "Hydrating Go workspace with BUILD_ENTERPRISE_DIR=$enterprise_dir"
      (
        cd server
        BUILD_ENTERPRISE_DIR="$enterprise_dir" make setup-go-work
        retry 5 go mod download
        if [ -f public/go.mod ]; then
          (cd public && retry 5 go mod download)
        fi
      )
    else
      log "Hydrating Go workspace with server/Makefile default enterprise path."
      (
        cd server
        make setup-go-work
        retry 5 go mod download
        if [ -f public/go.mod ]; then
          (cd public && retry 5 go mod download)
        fi
      )
    fi
  fi
}

hydrate_webapp_dependencies() {
  if is_true "${CLOUD_AGENT_SKIP_WEBAPP_DEPS:-false}"; then
    log "Skipping webapp dependency hydration."
    return 0
  fi

  if [ -f webapp/package.json ]; then
    log "Hydrating webapp dependencies."
    (cd webapp && make node_modules)
  fi
}

hydrate_playwright_dependencies() {
  if is_true "${CLOUD_AGENT_SKIP_PLAYWRIGHT_DEPS:-false}"; then
    log "Skipping Playwright dependency hydration."
    return 0
  fi

  if [ -f e2e-tests/playwright/package-lock.json ]; then
    log "Hydrating Playwright dependencies."
    (cd e2e-tests/playwright && npm ci)
  fi
}

ensure_go
ensure_node
ensure_enterprise_checkout
hydrate_go_dependencies
hydrate_webapp_dependencies
hydrate_playwright_dependencies

log "AWS CLI: $(aws --version 2>&1 || printf 'not available')"
log "Install hook complete."
