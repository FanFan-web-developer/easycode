import { describe, expect, test } from "bun:test"
import path from "node:path"
import { createDesktopApi, type DesktopIpcRenderer } from "../../apps/desktop/src/preload/api.cts"
import type { SidecarFrame } from "../../apps/desktop/src/shared/protocol"

class FakeIpc implements DesktopIpcRenderer {
  readonly calls: Array<{ channel: string; args: unknown[] }> = []
  readonly listeners = new Map<string, (event: unknown, frame: SidecarFrame) => void>()

  async invoke(channel: string, ...args: unknown[]) {
    this.calls.push({ channel, args })
    return { channel, args }
  }

  on(channel: string, listener: (event: unknown, frame: SidecarFrame) => void) {
    this.listeners.set(channel, listener)
  }

  off(channel: string, listener: (event: unknown, frame: SidecarFrame) => void) {
    if (this.listeners.get(channel) === listener) this.listeners.delete(channel)
  }
}

const expectedInvokeCalls = [
  { method: "settings", args: [], channel: "settings:get", ipcArgs: [] },
  { method: "updateSettings", args: [{ session: "scratch" }], channel: "settings:update", ipcArgs: [{ session: "scratch" }] },
  { method: "initialize", args: [], channel: "sidecar:initialize", ipcArgs: [] },
  { method: "listProviders", args: [], channel: "sidecar:listProviders", ipcArgs: [] },
  { method: "getProviderReadiness", args: [], channel: "sidecar:getProviderReadiness", ipcArgs: [] },
  { method: "configureProvider", args: [{ provider: "deepseek", model: "deepseek-v4-flash" }], channel: "desktop:configureProvider", ipcArgs: [{ provider: "deepseek", model: "deepseek-v4-flash" }] },
  { method: "listSkills", args: [], channel: "sidecar:listSkills", ipcArgs: [] },
  { method: "listSessions", args: [], channel: "sidecar:listSessions", ipcArgs: [] },
  { method: "loadSession", args: ["scratch"], channel: "sidecar:loadSession", ipcArgs: ["scratch"] },
  { method: "deleteSession", args: ["scratch"], channel: "sidecar:deleteSession", ipcArgs: ["scratch"] },
  { method: "getGoalStatus", args: ["scratch"], channel: "sidecar:getGoalStatus", ipcArgs: ["scratch"] },
  { method: "pauseGoal", args: ["scratch"], channel: "sidecar:pauseGoal", ipcArgs: ["scratch"] },
  { method: "resumeGoal", args: ["scratch"], channel: "sidecar:resumeGoal", ipcArgs: ["scratch"] },
  { method: "clearGoal", args: ["scratch"], channel: "sidecar:clearGoal", ipcArgs: ["scratch"] },
  { method: "getPlanStatus", args: ["scratch"], channel: "sidecar:getPlanStatus", ipcArgs: ["scratch"] },
  { method: "clearPlan", args: ["scratch"], channel: "sidecar:clearPlan", ipcArgs: ["scratch"] },
  { method: "updateSidecarSettings", args: [{ language: "zh" }], channel: "sidecar:updateSettings", ipcArgs: [{ language: "zh" }] },
  { method: "pickWorkspace", args: [], channel: "desktop:pickWorkspace", ipcArgs: [] },
  { method: "pickFiles", args: [], channel: "desktop:pickFiles", ipcArgs: [] },
  { method: "showWorkspace", args: ["/repo"], channel: "desktop:showWorkspace", ipcArgs: ["/repo"] },
  { method: "openWorkspaceFile", args: ["report.md"], channel: "desktop:openWorkspaceFile", ipcArgs: ["report.md"] },
  { method: "openWorkspaceChanges", args: [], channel: "desktop:openWorkspaceChanges", ipcArgs: [] },
  { method: "removeWorkspaceSidecar", args: ["/repo/old"], channel: "desktop:removeWorkspaceSidecar", ipcArgs: ["/repo/old"] },
  { method: "showSidecar", args: [], channel: "desktop:showSidecar", ipcArgs: [] },
  { method: "sidecarStatus", args: [], channel: "desktop:sidecarStatus", ipcArgs: [] },
  { method: "workspaceStatus", args: [], channel: "desktop:workspaceStatus", ipcArgs: [] },
  { method: "workspaceDiff", args: ["src/app.ts"], channel: "desktop:workspaceDiff", ipcArgs: ["src/app.ts"] },
  { method: "executeSlashCommand", args: ["/settings", 1, 2], channel: "sidecar:executeSlashCommand", ipcArgs: ["/settings", 1, 2] },
  { method: "runPrompt", args: ["build it", "plan", ["screen.png"], "ask", ["src/add.ts"]], channel: "sidecar:runPrompt", ipcArgs: ["build it", "plan", ["screen.png"], "ask", ["src/add.ts"]] },
  { method: "cancelRun", args: [], channel: "sidecar:cancelRun", ipcArgs: [] },
  { method: "replyPermission", args: ["permission_1", "once"], channel: "sidecar:replyPermission", ipcArgs: ["permission_1", "once"] },
  { method: "replyPlan", args: ["run_1", "edit", "add tests"], channel: "sidecar:replyPlan", ipcArgs: ["run_1", "edit", "add tests"] },
] as const

describe("desktop preload api", () => {
  test("preload script exposes the typed desktop api factory before bundling", async () => {
    const source = await Bun.file(path.join(import.meta.dir, "../../apps/desktop/src/preload/preload.cts")).text()
    const tsconfig = await Bun.file(path.join(import.meta.dir, "../../apps/desktop/tsconfig.json")).json() as { include?: string[] }
    const manifest = await Bun.file(path.join(import.meta.dir, "../../apps/desktop/package.json")).json() as { scripts?: Record<string, string> }
    const bundleScript = await Bun.file(path.join(import.meta.dir, "../../apps/desktop/scripts/bundle-preload.mjs")).text()

    expect(source).toContain('require("electron")')
    expect(source).toContain('require("./api.cjs")')
    expect(source).toContain("createDesktopApi(ipcRenderer)")
    expect(source).not.toContain("unknown) => invoke")
    expect(tsconfig.include).toContain("src/**/*.cts")
    expect(manifest.scripts?.build).toContain("node scripts/bundle-preload.mjs")
    expect(bundleScript).toContain("dist\", \"preload\", \"preload.cjs")
    expect(bundleScript).toContain("--external")
    expect(bundleScript).toContain("electron")
  })

  test("keeps sandbox preload and main handlers aligned with every desktop API channel", async () => {
    const preloadSource = await Bun.file(path.join(import.meta.dir, "../../apps/desktop/src/preload/preload.cts")).text()
    const apiSource = await Bun.file(path.join(import.meta.dir, "../../apps/desktop/src/preload/api.cts")).text()
    const mainSource = await Bun.file(path.join(import.meta.dir, "../../apps/desktop/src/main/main.ts")).text()

    expect(preloadSource).toContain("createDesktopApi")
    for (const expected of expectedInvokeCalls) {
      expect(apiSource.includes(`"${expected.channel}"`), `typed preload api missing ${expected.channel}`).toBe(true)
      expect(mainSource.includes(`desktopHandle("${expected.channel}"`), `main missing ${expected.channel}`).toBe(true)
    }
  })

  test("maps typed desktop api methods to stable IPC channels", async () => {
    const ipc = new FakeIpc()
    const api = createDesktopApi(ipc)

    for (const expected of expectedInvokeCalls) {
      const method = api[expected.method] as (...args: unknown[]) => Promise<unknown>
      await method(...expected.args)
    }

    expect(ipc.calls).toEqual(expectedInvokeCalls.map((expected) => ({ channel: expected.channel, args: [...expected.ipcArgs] })))
  })

  test("passes workspace roots only for workspace-scoped sidecar calls", async () => {
    const ipc = new FakeIpc()
    const api = createDesktopApi(ipc)

    await api.listSkills("/repo/a")
    await api.listSessions("/repo/a")
    await api.loadSession("scratch", "/repo/a")
    await api.deleteSession("scratch", "/repo/a")
    await api.getGoalStatus("scratch", "/repo/a")
    await api.pauseGoal("scratch", "/repo/a")
    await api.resumeGoal("scratch", "/repo/a")
    await api.clearGoal("scratch", "/repo/a")
    await api.getPlanStatus("scratch", "/repo/a")
    await api.clearPlan("scratch", "/repo/a")
    await api.updateSidecarSettings({ language: "zh" }, "/repo/a")
    await api.executeSlashCommand("/settings", 0, 0, "/repo/a")
    await api.runPrompt("build it", "build", [], "ask", [], "/repo/a")
    await api.cancelRun("/repo/a")
    await api.replyPermission("permission_1", "once", "/repo/a")
    await api.replyPlan("run_1", "approve", undefined, "/repo/a")

    expect(ipc.calls).toEqual([
      { channel: "sidecar:listSkills", args: ["/repo/a"] },
      { channel: "sidecar:listSessions", args: ["/repo/a"] },
      { channel: "sidecar:loadSession", args: ["scratch", "/repo/a"] },
      { channel: "sidecar:deleteSession", args: ["scratch", "/repo/a"] },
      { channel: "sidecar:getGoalStatus", args: ["scratch", "/repo/a"] },
      { channel: "sidecar:pauseGoal", args: ["scratch", "/repo/a"] },
      { channel: "sidecar:resumeGoal", args: ["scratch", "/repo/a"] },
      { channel: "sidecar:clearGoal", args: ["scratch", "/repo/a"] },
      { channel: "sidecar:getPlanStatus", args: ["scratch", "/repo/a"] },
      { channel: "sidecar:clearPlan", args: ["scratch", "/repo/a"] },
      { channel: "sidecar:updateSettings", args: [{ language: "zh" }, "/repo/a"] },
      { channel: "sidecar:executeSlashCommand", args: ["/settings", 0, 0, "/repo/a"] },
      { channel: "sidecar:runPrompt", args: ["build it", "build", [], "ask", [], "/repo/a"] },
      { channel: "sidecar:cancelRun", args: ["/repo/a"] },
      { channel: "sidecar:replyPermission", args: ["permission_1", "once", "/repo/a"] },
      { channel: "sidecar:replyPlan", args: ["run_1", "approve", undefined, "/repo/a"] },
    ])
  })

  test("passes workspace roots for workspace-scoped desktop status calls", async () => {
    const ipc = new FakeIpc()
    const api = createDesktopApi(ipc)

    await api.getProviderReadiness("/repo/a")
    await api.openWorkspaceFile("src/app.ts", "/repo/a")
    await api.openWorkspaceChanges("/repo/a")
    await api.workspaceStatus("/repo/a")
    await api.workspaceDiff("src/app.ts", "/repo/a", "staged")

    expect(ipc.calls).toEqual([
      { channel: "sidecar:getProviderReadiness", args: ["/repo/a"] },
      { channel: "desktop:openWorkspaceFile", args: ["src/app.ts", "/repo/a"] },
      { channel: "desktop:openWorkspaceChanges", args: ["/repo/a"] },
      { channel: "desktop:workspaceStatus", args: ["/repo/a"] },
      { channel: "desktop:workspaceDiff", args: ["src/app.ts", "/repo/a", "staged"] },
    ])
  })

  test("forwards and unregisters sidecar event listeners", () => {
    const ipc = new FakeIpc()
    const api = createDesktopApi(ipc)
    const frames: SidecarFrame[] = []
    const unsubscribe = api.onSidecarEvent((frame: SidecarFrame) => frames.push(frame))
    const frame: SidecarFrame = { type: "event", event: { type: "fatal", message: "boom" } }

    ipc.listeners.get("sidecar:event")?.({}, frame)
    unsubscribe()
    ipc.listeners.get("sidecar:event")?.({}, frame)

    expect(frames).toEqual([frame])
    expect(ipc.listeners.has("sidecar:event")).toBe(false)
  })
})
