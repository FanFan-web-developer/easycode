# Desktop Sidecar

Status: V1 implemented and released as `desktop-v0.0.1`; ongoing work is readiness hardening, packaging hygiene, and cross-platform verification.

## Objective

EasyCode desktop is a local chat-style client that talks to the EasyCode runtime through a sidecar binary. The desktop app must not import agent/runtime internals directly; it communicates through JSONL over stdio.

## Protocol

- Request: `{ "id": "...", "method": "...", "params": { ... } }`
- Response: `{ "id": "...", "ok": true, "result": { ... } }` or `{ "id": "...", "ok": false, "error": { "code": "...", "message": "..." } }`
- Event: `{ "type": "event", "runId": "...", "event": { ... } }`
- `initialize` requires protocol version `1` when a version is provided.

## Sidecar Command

`easycode sidecar --stdio` starts the machine protocol:

- no TUI rendering
- no terminal prompts
- structured permission requests through `permission_request`
- structured plan approval requests through `plan_approval_request`
- one active run at a time in v1

Supported v1 methods: `initialize`, `listSessions`, `loadSession`, `deleteSession`, `getSettings`, `updateSettings`, `runPrompt`, `cancelRun`, `replyPermission`, `replyPlan`, and `shutdown`.

## Desktop Boundary

The Electron app lives under `apps/desktop`. It prefers a bundled platform sidecar from packaged resources, then a user-configured sidecar path, then `easycode` on `PATH`. Renderer code only calls the preload API; all sidecar spawning and filesystem settings are handled in the Electron main process.

## Build And Release

- `bun run desktop:dev` builds the local CLI sidecar, builds the desktop app, and starts Electron against the local sidecar.
- `bun run desktop:build` builds the generic local sidecar plus desktop renderer/main/preload output.
- `bun run desktop:package` builds the current-platform sidecar binary, builds the desktop app, and packages artifacts into `apps/desktop/release`.
- CLI releases continue to use `v*` tags through `.github/workflows/release.yml`.
- Desktop releases use separate `desktop-v*` tags through `.github/workflows/desktop-release.yml`.
- `bun run desktop:release -- desktop-vX.Y.Z` is the GitHub/CI entrypoint for desktop artifacts. It updates `apps/desktop/package.json` inside the current checkout and runs the desktop packaging chain. `--publish` forwards to electron-builder.
- `bun run desktop:publish -- X.Y.Z` is the one-command local release entrypoint. It checks for a clean tree, optionally bumps and commits `apps/desktop/package.json`, builds local desktop artifacts, creates an annotated `desktop-vX.Y.Z` tag, and pushes the commit plus tag.

## V1 Readiness Checklist

- Sidecar protocol stays JSONL-over-stdio and versioned at protocol `1`.
- The desktop app continues to treat the CLI/runtime as a sidecar boundary, not as renderer-imported runtime internals.
- Session, settings, provider readiness, plan approval, permission replies, prompt runs, cancellation, and shutdown remain covered by sidecar integration or desktop unit tests.
- Packaged builds must include a platform sidecar and keep `apps/desktop/.npmrc` on the official npm registry.
- Release candidates should pass `bun run desktop:build` plus the root quality gate; real-provider failures should be reported separately from local build/test regressions.
- Cross-platform release validation should cover macOS arm64, Linux x64, and Windows x64 artifacts from `.github/workflows/desktop-release.yml`.
