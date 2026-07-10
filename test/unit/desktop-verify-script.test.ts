import { describe, expect, test } from "bun:test"
import path from "node:path"
import { desktopCapabilityCommands, desktopCapabilityIntegrationPattern, desktopCapabilityUnitTests } from "../../scripts/desktop-verify.mjs"

describe("desktop verify script", () => {
  test("exposes a root command for desktop capability verification", async () => {
    const manifest = await Bun.file(path.join(import.meta.dir, "../../package.json")).json() as { scripts?: Record<string, string> }

    expect(manifest.scripts?.["desktop:verify"]).toBe("node scripts/desktop-verify.mjs")
    expect(manifest.scripts?.["desktop:verify-release"]).toBe("node scripts/verify-desktop-release.mjs")
  })

  test("runs the unit tests that guard the desktop capability queue", () => {
    expect(desktopCapabilityUnitTests).toContain("test/unit/slash.test.ts")
    expect(desktopCapabilityUnitTests).toContain("test/unit/sidecar-protocol.test.ts")
    expect(desktopCapabilityUnitTests).toContain("test/unit/sidecar-slash-result.test.ts")
    expect(desktopCapabilityUnitTests).toContain("test/unit/attachment.test.ts")
    expect(desktopCapabilityUnitTests).toContain("test/unit/image.test.ts")
    expect(desktopCapabilityUnitTests).toContain("test/unit/cli-file-slash.test.ts")
    expect(desktopCapabilityUnitTests).toContain("test/unit/desktop-capability-alignment.test.ts")
    expect(desktopCapabilityUnitTests).toContain("test/unit/desktop-verify-script.test.ts")
    expect(desktopCapabilityUnitTests).toContain("test/unit/desktop-run-queue.test.ts")
    expect(desktopCapabilityUnitTests).toContain("test/unit/desktop-settings-commands.test.ts")
    expect(desktopCapabilityUnitTests).toContain("test/unit/i18n.test.ts")
    expect(desktopCapabilityUnitTests).toContain("test/unit/desktop-preload-api.test.ts")
    expect(desktopCapabilityUnitTests).toContain("test/unit/desktop-provider-env.test.ts")
    expect(desktopCapabilityUnitTests).toContain("test/unit/desktop-settings.test.ts")
    expect(desktopCapabilityUnitTests).toContain("test/unit/desktop-sidecar-registry.test.ts")
    expect(desktopCapabilityUnitTests).toContain("test/unit/desktop-sidecar-registry-remove.test.ts")
    expect(desktopCapabilityUnitTests).toContain("test/unit/desktop-workspace-path.test.ts")
    expect(desktopCapabilityUnitTests).toContain("test/unit/desktop-sidecar-bridge.test.ts")
    expect(desktopCapabilityUnitTests).toContain("test/unit/desktop-sidecar-bridge-env.test.ts")
    expect(desktopCapabilityUnitTests).toContain("test/unit/desktop-ipc-safe.test.ts")
    expect(desktopCapabilityUnitTests).toContain("test/unit/desktop-renderer-security.test.ts")
    expect(desktopCapabilityUnitTests).toContain("test/unit/desktop-renderer-ui.test.ts")
    expect(desktopCapabilityUnitTests).toContain("test/unit/desktop-app-identity.test.ts")
    expect(desktopCapabilityUnitTests).toContain("test/unit/desktop-release-verify.test.ts")
  })

  test("runs sidecar integration coverage for real desktop capabilities", () => {
    for (const capability of [
      "renderer queued",
      "local slash",
      "desktop slash coverage",
      "desktop-created empty session",
      "deleteSession",
      "session delete active",
      "plan approval",
      "reads and clears",
      "runs goal mode through shared goal controller",
      "permission",
      "goal mode uses restricted",
      "desktop picker",
      "image slash",
      "file slash",
      "provider readiness",
      "desktop config commands",
      "updateSettings",
    ]) {
      expect(desktopCapabilityIntegrationPattern).toContain(capability)
    }
  })

  test("keeps typecheck and build in the verification chain", () => {
    expect(desktopCapabilityCommands).toContainEqual(expect.objectContaining({
      name: "desktop renderer integration tests",
      command: "bun",
      args: ["test", "test/integration/desktop-renderer-ui.test.ts"],
    }))
    expect(desktopCapabilityCommands).toContainEqual(expect.objectContaining({
      name: "typecheck",
      command: "bun",
      args: ["run", "typecheck"],
    }))
    expect(desktopCapabilityCommands).toContainEqual(expect.objectContaining({
      name: "desktop build",
      command: "bun",
      args: ["run", "desktop:build"],
    }))
  })
})
