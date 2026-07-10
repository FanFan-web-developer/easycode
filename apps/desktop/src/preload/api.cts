import type { DesktopApi, DesktopDeleteSessionResult, DesktopFileSelection, DesktopGoalStatusResult, DesktopListSessionsResult, DesktopListSkillsResult, DesktopPermissionMode, DesktopPlanStatusResult, DesktopProviderListResult, DesktopProviderReadiness, DesktopProviderSetup, DesktopProviderSetupResult, DesktopRunMode, DesktopSettings, DesktopSettingsPatch, DesktopSidecarStatus, DesktopSlashCommandResult, DesktopWorkspaceDiff, DesktopWorkspaceDiffScope, DesktopWorkspaceGitAction, DesktopWorkspaceGitActionResult, DesktopWorkspaceStatus, SidecarFrame } from "../shared/protocol.js"

export type DesktopIpcRenderer = {
  invoke(channel: string, ...args: unknown[]): Promise<unknown>
  on(channel: string, listener: (event: unknown, frame: SidecarFrame) => void): void
  off(channel: string, listener: (event: unknown, frame: SidecarFrame) => void): void
}

export function createDesktopApi(ipcRenderer: DesktopIpcRenderer): DesktopApi {
  const invoke = <T,>(channel: string, ...args: unknown[]) => ipcRenderer.invoke(channel, ...args) as Promise<T>
  return {
    settings: () => invoke<DesktopSettings>("settings:get"),
    updateSettings: (settings: Partial<DesktopSettings>) => invoke<DesktopSettings>("settings:update", settings),
    initialize: () => invoke("sidecar:initialize"),
    listProviders: () => invoke<DesktopProviderListResult>("sidecar:listProviders"),
    getProviderReadiness: (workspaceRoot?: string) => invoke<DesktopProviderReadiness>("sidecar:getProviderReadiness", ...optionalArg(workspaceRoot)),
    configureProvider: (input: DesktopProviderSetup) => invoke<DesktopProviderSetupResult>("desktop:configureProvider", input),
    listSkills: (workspaceRoot?: string) => invoke<DesktopListSkillsResult>("sidecar:listSkills", ...optionalArg(workspaceRoot)),
    listSessions: (workspaceRoot?: string) => invoke<DesktopListSessionsResult>("sidecar:listSessions", ...optionalArg(workspaceRoot)),
    loadSession: (session: string, workspaceRoot?: string) => invoke("sidecar:loadSession", session, ...optionalArg(workspaceRoot)),
    deleteSession: (session: string, workspaceRoot?: string) => invoke<DesktopDeleteSessionResult>("sidecar:deleteSession", session, ...optionalArg(workspaceRoot)),
    getGoalStatus: (session?: string, workspaceRoot?: string) => invoke<DesktopGoalStatusResult>("sidecar:getGoalStatus", ...optionalArgs(session, workspaceRoot)),
    pauseGoal: (session?: string, workspaceRoot?: string) => invoke("sidecar:pauseGoal", ...optionalArgs(session, workspaceRoot)),
    resumeGoal: (session?: string, workspaceRoot?: string) => invoke("sidecar:resumeGoal", ...optionalArgs(session, workspaceRoot)),
    clearGoal: (session?: string, workspaceRoot?: string) => invoke("sidecar:clearGoal", ...optionalArgs(session, workspaceRoot)),
    getPlanStatus: (session?: string, workspaceRoot?: string) => invoke<DesktopPlanStatusResult>("sidecar:getPlanStatus", ...optionalArgs(session, workspaceRoot)),
    clearPlan: (session?: string, workspaceRoot?: string) => invoke("sidecar:clearPlan", ...optionalArgs(session, workspaceRoot)),
    updateSidecarSettings: (settings: DesktopSettingsPatch, workspaceRoot?: string) => invoke<{ settings: DesktopSettings }>("sidecar:updateSettings", settings, ...optionalArg(workspaceRoot)),
    pickWorkspace: () => invoke<string | undefined>("desktop:pickWorkspace"),
    pickFiles: () => invoke<DesktopFileSelection[]>("desktop:pickFiles"),
    showWorkspace: (workspaceRoot?: string) => invoke<{ opened: boolean }>("desktop:showWorkspace", workspaceRoot),
    openWorkspaceFile: (filePath: string, workspaceRoot?: string) => invoke<{ opened: boolean; path: string }>("desktop:openWorkspaceFile", filePath, ...optionalArg(workspaceRoot)),
    openWorkspaceChanges: (workspaceRoot?: string) => invoke<{ opened: boolean; path: string }>("desktop:openWorkspaceChanges", ...optionalArg(workspaceRoot)),
    removeWorkspaceSidecar: (workspaceRoot: string) => invoke<{ stopped: boolean }>("desktop:removeWorkspaceSidecar", workspaceRoot),
    showSidecar: () => invoke<{ opened: boolean }>("desktop:showSidecar"),
    sidecarStatus: () => invoke<DesktopSidecarStatus>("desktop:sidecarStatus"),
    workspaceStatus: (workspaceRoot?: string) => invoke<DesktopWorkspaceStatus>("desktop:workspaceStatus", ...optionalArg(workspaceRoot)),
    workspaceDiff: (filePath: string, workspaceRoot?: string, scope?: DesktopWorkspaceDiffScope) => invoke<DesktopWorkspaceDiff>("desktop:workspaceDiff", filePath, ...workspaceDiffArgs(workspaceRoot, scope)),
    workspaceGitAction: (filePath: string, action: DesktopWorkspaceGitAction, workspaceRoot?: string) => invoke<DesktopWorkspaceGitActionResult>("desktop:workspaceGitAction", filePath, action, ...optionalArg(workspaceRoot)),
    executeSlashCommand: (text: string, pendingImages?: number, pendingFiles?: number, workspaceRoot?: string) => invoke<DesktopSlashCommandResult>("sidecar:executeSlashCommand", text, pendingImages, pendingFiles, ...optionalArg(workspaceRoot)),
    runPrompt: (text: string, mode?: DesktopRunMode, images?: string[], permissionMode?: DesktopPermissionMode, files?: string[], workspaceRoot?: string) => invoke("sidecar:runPrompt", text, mode, images, permissionMode, files, ...optionalArg(workspaceRoot)),
    cancelRun: (workspaceRoot?: string) => invoke("sidecar:cancelRun", ...optionalArg(workspaceRoot)),
    replyPermission: (requestId: string, reply: "once" | "always" | "reject", workspaceRoot?: string) => invoke("sidecar:replyPermission", requestId, reply, ...optionalArg(workspaceRoot)),
    replyPlan: (runId: string, action: "approve" | "reject" | "edit" | "new_prompt", text?: string, workspaceRoot?: string) => invoke("sidecar:replyPlan", runId, action, text, ...optionalArg(workspaceRoot)),
    onSidecarEvent: (listener: (frame: SidecarFrame) => void) => {
      const wrapped = (_event: unknown, frame: SidecarFrame) => listener(frame)
      ipcRenderer.on("sidecar:event", wrapped)
      return () => ipcRenderer.off("sidecar:event", wrapped)
    },
  }
}

function optionalArg<T>(value: T | undefined): [] | [T] {
  return value === undefined ? [] : [value]
}

function optionalArgs<T, U>(first: T | undefined, second: U | undefined): [] | [T] | [T | undefined, U] {
  if (second !== undefined) return [first, second]
  return first === undefined ? [] : [first]
}

function workspaceDiffArgs(workspaceRoot: string | undefined, scope: DesktopWorkspaceDiffScope | undefined): [] | [string] | [string | undefined, DesktopWorkspaceDiffScope] {
  if (scope && scope !== "all") return [workspaceRoot, scope]
  return workspaceRoot === undefined ? [] : [workspaceRoot]
}
