#!/usr/bin/env bash
set -euo pipefail

# Build and package the desktop client for the current host platform.
# This script does not bump versions, tag, push, or require a clean tree.

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DESKTOP_DIR="$ROOT/apps/desktop"
PUBLISH="never"

die() { echo "error: $*" >&2; exit 1; }
info() { echo "==> $*"; }

for arg in "$@"; do
  case "$arg" in
    --publish) PUBLISH="always" ;;
    --publish=*) PUBLISH="${arg#--publish=}" ;;
    --no-publish) PUBLISH="never" ;;
    *) die "unknown argument: $arg" ;;
  esac
done

command -v bun >/dev/null 2>&1 || die "bun is required"

case "$(uname -s)-$(uname -m)" in
  Darwin-arm64) SIDECAR_BUILD="build:darwin-arm64" ;;
  Darwin-x86_64) SIDECAR_BUILD="build:darwin-x64" ;;
  Linux-x86_64) SIDECAR_BUILD="build:linux-x64" ;;
  Linux-aarch64|Linux-arm64) SIDECAR_BUILD="build:linux-arm64" ;;
  MINGW*|MSYS*|CYGWIN*) SIDECAR_BUILD="build:win-x64" ;;
  *) die "unsupported package host: $(uname -s)-$(uname -m)" ;;
esac

info "installing desktop dependencies"
cd "$DESKTOP_DIR"
bun install --frozen-lockfile

info "cleaning previous sidecar binaries"
node -e "const fs = require('node:fs'); const dir = process.argv[1]; if (fs.existsSync(dir)) for (const name of fs.readdirSync(dir)) if (name === 'easycode' || name.startsWith('easycode-')) fs.rmSync(require('node:path').join(dir, name), { force: true, recursive: true })" "$ROOT/dist"

info "building sidecar with $SIDECAR_BUILD"
cd "$ROOT"
bun run "$SIDECAR_BUILD"

info "building desktop renderer/main process"
cd "$DESKTOP_DIR"
bun run build

info "cleaning previous desktop artifacts"
node -e "require('node:fs').rmSync(process.argv[1], { recursive: true, force: true })" "$DESKTOP_DIR/release"

info "packaging desktop client"
bun run package -- --publish "$PUBLISH"

info "verifying desktop release artifacts"
cd "$ROOT"
bun run desktop:verify-release

info "desktop artifacts: $DESKTOP_DIR/release"
