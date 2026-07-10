import { app, BrowserWindow, dialog, ipcMain, nativeImage, shell } from "electron"
import { execFile } from "node:child_process"
import { existsSync } from "node:fs"
import { stat } from "node:fs/promises"
import path from "node:path"
import { promisify } from "node:util"
import { fileURLToPath } from "node:url"
import { configureProviderEnvironment, configureUiLanguageEnvironment, loadSettings, saveSettings } from "./settings.js"
import { withIpcErrorBoundary } from "./ipc-safe.js"
import { SidecarBridge } from "./sidecar.js"
import { WorkspaceSidecarRegistry } from "./sidecar-registry.js"
import { resolveWorkspaceFilePath, workspacePathInfo } from "./workspace-path.js"
import { readWorkspaceDiff } from "./workspace-diff.js"
import { parseGitStatus } from "./workspace-status.js"
import { configureDesktopAppIdentity } from "./app-identity.js"
import type { DesktopPermissionMode, DesktopProviderSetup, DesktopRunMode, DesktopSettings, DesktopWorkspaceDiffScope } from "../shared/protocol.js"

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const execFileAsync = promisify(execFile)
let sidecars: WorkspaceSidecarRegistry<DesktopSettings> | undefined

configureDesktopAppIdentity(app)

async function createWindow() {
  const settings = await loadSettings()
  sidecars = new WorkspaceSidecarRegistry((settings) => new SidecarBridge(settings))
  sidecars.configure(settings)
  const icon = desktopIconPath()
  const iconImage = icon ? nativeImage.createFromPath(icon) : undefined
  if (!app.isPackaged && process.platform === "darwin" && app.dock && iconImage && !iconImage.isEmpty()) app.dock.setIcon(iconImage)
  const window = new BrowserWindow({
    width: 1180,
    height: 820,
    minWidth: 920,
    minHeight: 640,
    title: "EasyCode",
    ...(iconImage && !iconImage.isEmpty() ? { icon: iconImage } : {}),
    backgroundColor: "#f7f8fb",
    webPreferences: {
      preload: path.join(currentDir, "../preload/preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  sidecars.onFrame((frame) => window.webContents.send("sidecar:event", frame))
  if (process.env.VITE_DEV_SERVER_URL) await window.loadURL(process.env.VITE_DEV_SERVER_URL)
  else await window.loadFile(path.join(currentDir, "../renderer/index.html"))
}

function desktopIconPath() {
  const candidates = [
    path.join(app.getAppPath(), "build", "icon.png"),
    path.join(currentDir, "../../build/icon.png"),
  ]
  return candidates.find((candidate) => existsSync(candidate))
}

function desktopHandle(channel: string, handler: (...args: any[]) => unknown) {
  ipcMain.handle(channel, withIpcErrorBoundary(handler))
}

desktopHandle("settings:get", () => loadSettings())
desktopHandle("settings:update", async (_event, patch: Partial<DesktopSettings>) => {
  const current = await loadSettings()
  const next = await saveSettings({ ...current, ...patch })
  if (patch.language) await configureUiLanguageEnvironment(next.language)
  sidecars?.configure(next)
  return next
})

desktopHandle("sidecar:initialize", async () => {
  const settings = await loadSettings()
  const bridge = activeSidecars().configure(settings)
  return bridge.request("initialize", {
    protocolVersion: 1,
    root: settings.workspaceRoot,
    provider: settings.provider,
    model: settings.model ?? null,
    language: settings.language,
    thinking: settings.thinking,
    effort: settings.effort,
    maxTokens: settings.maxTokens ?? null,
    maxSteps: settings.maxSteps ?? null,
    selectedSkills: settings.selectedSkills,
    pendingSkillLoads: settings.pendingSkillLoads,
    session: settings.session,
  })
})
desktopHandle("sidecar:listProviders", () => activeSidecars().request("listProviders"))
desktopHandle("sidecar:getProviderReadiness", (_event, workspaceRoot?: string) => sidecarRequest(workspaceRoot, "getProviderReadiness"))
desktopHandle("desktop:configureProvider", async (_event, input: DesktopProviderSetup) => {
  const current = await loadSettings()
  const env = await configureProviderEnvironment(input)
  const next = await saveSettings({
    ...current,
    provider: input.provider,
    model: input.model?.trim() || undefined,
  })
  activeSidecars().stopAll(new Error("Provider configuration changed."))
  activeSidecars().configure(next)
  return { ...env, settings: next }
})
desktopHandle("sidecar:listSkills", (_event, workspaceRoot?: string) => sidecarRequest(workspaceRoot, "listSkills"))
desktopHandle("sidecar:listSessions", (_event, workspaceRoot?: string) => sidecarRequest(workspaceRoot, "listSessions"))
desktopHandle("sidecar:loadSession", (_event, session: string, workspaceRoot?: string) => sidecarRequest(workspaceRoot, "loadSession", { session }))
desktopHandle("sidecar:deleteSession", (_event, session: string, workspaceRoot?: string) => sidecarRequest(workspaceRoot, "deleteSession", { session }))
desktopHandle("sidecar:getGoalStatus", (_event, session?: string, workspaceRoot?: string) => sidecarRequest(workspaceRoot, "getGoalStatus", session ? { session } : {}))
desktopHandle("sidecar:pauseGoal", (_event, session?: string, workspaceRoot?: string) => sidecarRequest(workspaceRoot, "pauseGoal", session ? { session, reason: "Paused from desktop." } : { reason: "Paused from desktop." }))
desktopHandle("sidecar:resumeGoal", (_event, session?: string, workspaceRoot?: string) => sidecarRequest(workspaceRoot, "resumeGoal", session ? { session } : {}))
desktopHandle("sidecar:clearGoal", (_event, session?: string, workspaceRoot?: string) => sidecarRequest(workspaceRoot, "clearGoal", session ? { session } : {}))
desktopHandle("sidecar:getPlanStatus", (_event, session?: string, workspaceRoot?: string) => sidecarRequest(workspaceRoot, "getPlanStatus", session ? { session } : {}))
desktopHandle("sidecar:clearPlan", (_event, session?: string, workspaceRoot?: string) => sidecarRequest(workspaceRoot, "clearPlan", session ? { session } : {}))
desktopHandle("sidecar:updateSettings", (_event, patch: Partial<DesktopSettings>, workspaceRoot?: string) => sidecarRequest(workspaceRoot, "updateSettings", patch as Record<string, unknown>))
desktopHandle("sidecar:executeSlashCommand", (_event, text: string, pendingImages?: number, pendingFiles?: number, workspaceRoot?: string) => sidecarRequest(workspaceRoot, "executeSlashCommand", {
  text,
  ...(pendingImages !== undefined ? { pendingImages } : {}),
  ...(pendingFiles !== undefined ? { pendingFiles } : {}),
}))
desktopHandle("sidecar:runPrompt", (_event, text: string, mode?: DesktopRunMode, images?: string[], permissionMode?: DesktopPermissionMode, files?: string[], workspaceRoot?: string) => sidecarRequest(workspaceRoot, "runPrompt", {
  text,
  ...(mode ? { mode } : {}),
  ...(images?.length ? { images } : {}),
  ...(files?.length ? { files } : {}),
  ...(permissionMode ? { permissionMode } : {}),
}))
desktopHandle("sidecar:cancelRun", (_event, workspaceRoot?: string) => sidecarRequest(workspaceRoot, "cancelRun"))
desktopHandle("sidecar:replyPermission", (_event, requestId: string, reply: string, workspaceRoot?: string) => sidecarRequest(workspaceRoot, "replyPermission", { requestId, reply }))
desktopHandle("sidecar:replyPlan", (_event, runId: string, action: string, text?: string, workspaceRoot?: string) => sidecarRequest(workspaceRoot, "replyPlan", { runId, action, text }))

desktopHandle("desktop:pickWorkspace", async () => {
  const result = await dialog.showOpenDialog({ properties: ["openDirectory"] })
  if (result.canceled) return undefined
  return result.filePaths[0]
})

desktopHandle("desktop:pickFiles", async () => {
  const settings = await loadSettings()
  const workspaceRoot = path.resolve(settings.workspaceRoot)
  const result = await dialog.showOpenDialog({ properties: ["openFile", "multiSelections"] })
  if (result.canceled) return []
  return await Promise.all(result.filePaths.map(async (filePath) => {
    const info = await stat(filePath)
    const location = workspacePathInfo(workspaceRoot, filePath)
    return {
      path: filePath,
      name: path.basename(filePath),
      size: info.size,
      ...location,
    }
  }))
})

desktopHandle("desktop:showWorkspace", async (_event, workspaceRoot?: string) => {
  const settings = await loadSettings()
  const error = await shell.openPath(workspaceRoot || settings.workspaceRoot)
  if (error) throw new Error(error)
  return { opened: !error }
})

desktopHandle("desktop:openWorkspaceFile", async (_event, filePath: string, workspaceRoot?: string) => {
  const settings = await loadSettings()
  const absolutePath = await resolveWorkspaceFilePath(workspaceRoot || settings.workspaceRoot, filePath)
  await shell.openExternal(vscodeFileUri(absolutePath))
  return { opened: true, path: absolutePath }
})

desktopHandle("desktop:openWorkspaceChanges", async (_event, workspaceRoot?: string) => {
  const settings = await loadSettings()
  const root = path.resolve(workspaceRoot || settings.workspaceRoot)
  await shell.openExternal(vscodeFileUri(root))
  await shell.openExternal("vscode://command/workbench.view.scm")
  return { opened: true, path: root }
})

desktopHandle("desktop:removeWorkspaceSidecar", (_event, workspaceRoot: string) => {
  return { stopped: activeSidecars().stopWorkspace(workspaceRoot, new Error("Workspace removed from desktop.")) }
})

desktopHandle("desktop:showSidecar", async () => {
  const status = activeSidecars().status() as ReturnType<SidecarBridge["status"]>
  if (!status?.path) throw new Error("Sidecar binary is not configured.")
  if (status.exists === false) throw new Error(`Sidecar binary does not exist: ${status.path}`)
  if (!status.canReveal) throw new Error(`Sidecar command cannot be revealed in Finder: ${status.path}`)
  shell.showItemInFolder(status.path)
  return { opened: true }
})

desktopHandle("desktop:sidecarStatus", () => activeSidecars().status())

desktopHandle("desktop:workspaceStatus", async (_event, workspaceRoot?: string) => {
  const settings = await loadSettings()
  const root = workspaceRoot || settings.workspaceRoot
  try {
    const [{ stdout }, diff, cachedDiff] = await Promise.all([
      execFileAsync("git", ["status", "--porcelain=v1", "--branch"], { cwd: root }),
      execFileAsync("git", ["diff", "--numstat"], { cwd: root }).catch(() => ({ stdout: "" })),
      execFileAsync("git", ["diff", "--cached", "--numstat"], { cwd: root }).catch(() => ({ stdout: "" })),
    ])
    return parseGitStatus(stdout, diff.stdout, cachedDiff.stdout)
  } catch (error) {
    return {
      branch: "unknown",
      clean: false,
      added: 0,
      deleted: 0,
      changedFiles: 0,
      files: [],
      error: error instanceof Error ? error.message : String(error),
    }
  }
})

desktopHandle("desktop:workspaceDiff", async (_event, filePath: string, workspaceRoot?: string, scope?: DesktopWorkspaceDiffScope) => {
  const settings = await loadSettings()
  return readWorkspaceDiff(workspaceRoot || settings.workspaceRoot, filePath, scope)
})

app.whenReady().then(() => {
  configureDesktopAppIdentity(app)
  return createWindow()
})
app.on("window-all-closed", () => {
  sidecars?.stopAll()
  if (process.platform !== "darwin") app.quit()
})
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) void createWindow()
})

function activeSidecars() {
  if (!sidecars) throw new Error("Desktop sidecar registry is not initialized.")
  return sidecars
}

async function sidecarRequest(workspaceRoot: string | undefined, method: string, params: Record<string, unknown> = {}) {
  const registry = activeSidecars()
  if (!workspaceRoot) return registry.request(method, params)
  const settings = await loadSettings()
  const requestedRoot = path.resolve(workspaceRoot)
  const activeRoot = path.resolve(settings.workspaceRoot)
  const activate = requestedRoot === activeRoot
  registry.configureWorkspace({ ...settings, workspaceRoot: requestedRoot, session: activate ? settings.session : "default" }, { activate })
  return registry.requestWorkspace(requestedRoot, method, params)
}

function vscodeFileUri(filePath: string) {
  return `vscode://file${path.resolve(filePath).split(path.sep).map(encodeURIComponent).join("/")}`
}
