import { spawnSync } from "node:child_process"

export const desktopCapabilityUnitTests = [
  "test/unit/slash.test.ts",
  "test/unit/sidecar-protocol.test.ts",
  "test/unit/sidecar-slash-result.test.ts",
  "test/unit/attachment.test.ts",
  "test/unit/image.test.ts",
  "test/unit/cli-file-slash.test.ts",
  "test/unit/desktop-run-queue.test.ts",
  "test/unit/desktop-slash-coverage.test.ts",
  "test/unit/desktop-session-workspace-state.test.ts",
  "test/unit/desktop-plan-goal-state.test.ts",
  "test/unit/desktop-permission-state.test.ts",
  "test/unit/desktop-attachment-state.test.ts",
  "test/unit/desktop-settings-commands.test.ts",
  "test/unit/desktop-settings-sync.test.ts",
  "test/unit/i18n.test.ts",
  "test/unit/desktop-capability-alignment.test.ts",
  "test/unit/desktop-verify-script.test.ts",
  "test/unit/desktop-preload-api.test.ts",
  "test/unit/desktop-provider-env.test.ts",
  "test/unit/desktop-settings.test.ts",
  "test/unit/desktop-sidecar-registry.test.ts",
  "test/unit/desktop-sidecar-registry-remove.test.ts",
  "test/unit/desktop-workspace-path.test.ts",
  "test/unit/desktop-sidecar-bridge.test.ts",
  "test/unit/desktop-sidecar-bridge-env.test.ts",
  "test/unit/desktop-ipc-safe.test.ts",
  "test/unit/desktop-renderer-security.test.ts",
  "test/unit/desktop-renderer-ui.test.ts",
  "test/unit/desktop-app-identity.test.ts",
  "test/unit/desktop-dev-launcher.test.ts",
  "test/unit/desktop-package-scripts.test.ts",
  "test/unit/desktop-release-verify.test.ts",
]

export const desktopCapabilityIntegrationPattern = [
  "renderer queued",
  "local slash",
  "desktop slash coverage",
  "desktop quick slash",
  "desktop-created empty session",
  "desktop restore",
  "deleteSession",
  "session delete active",
  "isolated default sessions",
  "separate workspace sidecar instances",
  "plan approval",
  "reads and clears",
  "pending plan",
  "pauses and resumes",
  "runs goal mode through shared goal controller",
  "permission",
  "auto-review",
  "goal mode uses restricted",
  "forwards image inputs",
  "desktop picker",
  "image slash",
  "file slash",
  "unsupported image",
  "outside the workspace",
  "provider readiness",
  "desktop config commands",
  "updateSettings",
].join("|")

export const desktopCapabilityCommands = [
  {
    name: "desktop unit capability tests",
    command: "bun",
    args: ["test", ...desktopCapabilityUnitTests],
  },
  {
    name: "desktop sidecar integration tests",
    command: "bun",
    args: ["test", "test/integration/sidecar.test.ts", "--test-name-pattern", desktopCapabilityIntegrationPattern],
  },
  {
    name: "desktop renderer integration tests",
    command: "bun",
    args: ["test", "test/integration/desktop-renderer-ui.test.ts"],
  },
  {
    name: "typecheck",
    command: "bun",
    args: ["run", "typecheck"],
  },
  {
    name: "desktop build",
    command: "bun",
    args: ["run", "desktop:build"],
  },
]

export function runDesktopCapabilityVerification(commands = desktopCapabilityCommands) {
  for (const item of commands) {
    console.log(`\n==> ${item.name}`)
    const result = spawnSync(item.command, item.args, { stdio: "inherit" })
    if (result.error) throw result.error
    if (result.status !== 0) return result.status ?? 1
  }
  return 0
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  process.exit(runDesktopCapabilityVerification())
}
