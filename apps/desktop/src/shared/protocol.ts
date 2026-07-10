export type DesktopReasoningEffort = "low" | "medium" | "high" | "max"
export type DesktopLanguage = "en" | "zh" | "ja" | "fr" | "ko" | "de"

export type DesktopSettings = {
  workspaceRoot: string
  sidecarPath?: string
  provider: string
  model?: string
  language: DesktopLanguage
  thinking: boolean
  effort: DesktopReasoningEffort
  maxTokens?: number
  maxSteps?: number
  selectedSkills: string[]
  pendingSkillLoads: string[]
  session: string
  recentWorkspaces: string[]
}

export type DesktopSettingsPatch = Partial<Omit<DesktopSettings, "model" | "maxTokens" | "maxSteps">> & {
  model?: string | null
  maxTokens?: number | null
  maxSteps?: number | null
}

export type DesktopSkillInfo = {
  id: string
  name: string
  description: string
  location: string
}

export type DesktopListSkillsResult = {
  skills: DesktopSkillInfo[]
  selectedSkills: string[]
  pendingSkillLoads: string[]
}

export type DesktopProviderReadiness = {
  provider: string
  status: "ready" | "missing_env" | "unknown_provider" | "invalid"
  registered: boolean
  missingEnv: string[]
  model?: string
  reason?: string
}

export type DesktopProviderSetup = {
  provider: string
  apiKey?: string
  baseUrl?: string
  model?: string
}

export type DesktopProviderSetupResult = {
  settings: DesktopSettings
  envPath: string
  writtenKeys: string[]
}

export type DesktopGoalState = {
  id?: string
  objective: string
  status: string
  iteration: number
  complexity?: string
  firstSlice?: string
  acceptanceCriteria?: string[]
  completionChecks?: string[]
  blocker?: string
  activePlanId?: string
  summary?: string
}

export type DesktopGoalStatusResult = {
  goal?: DesktopGoalState
  text: string
}

export type DesktopPlanStatusResult = {
  planId?: string
  plan?: {
    plan: {
      id: string
      title?: string
      lowRisk: boolean
      steps: Array<{ id: string; goal: string; kind: string }>
    }
    checkpoint: {
      status: string
      currentStepId?: string
      stepStatuses: Record<string, string>
      blocker?: string
    }
  }
  status?: string
  currentStepId?: string
  blocker?: string
  text: string
}

export type DesktopSessionSummary = {
  id: string
  file: string
  messageCount: number
  title?: string
  updatedAt: number
}

export type DesktopMessagePart =
  | { type: "text"; text: string }
  | { type: "reasoning"; text: string }
  | { type: "summary"; text: string }
  | { type: "image"; source: unknown }
  | { type: "tool_call"; call: { id: string; name: string; input: unknown }; status: string }
  | { type: "tool_result"; callID: string; toolName: string; status: string; output: string; metadata?: Record<string, unknown> }

export type DesktopMessage = {
  id: string
  role: "system" | "user" | "assistant" | "tool"
  parts: DesktopMessagePart[]
  createdAt: number
}

export type DesktopListSessionsResult = {
  sessions: DesktopSessionSummary[]
  currentSession: string
}

export type DesktopLoadSessionResult = {
  session?: {
    id: string
    updatedAt: number
    tokenUsage?: Record<string, number>
  }
  messages: DesktopMessage[]
  settings: {
    provider: string
    model?: string
    language: DesktopLanguage
    thinking: boolean
    effort: DesktopReasoningEffort
    maxTokens?: number
    maxSteps?: number
    selectedSkills: string[]
    pendingSkillLoads: string[]
  }
}

export type DesktopDeleteSessionResult = {
  existed: boolean
  deletedPaths: string[]
  archivedMemoryId?: string
  currentSession?: string
}

export type DesktopFileSelection = {
  path: string
  name: string
  size: number
  insideWorkspace: boolean
  relativePath?: string
}

export type DesktopWorkspaceStatus = {
  branch: string
  clean: boolean
  added: number
  deleted: number
  changedFiles: number
  files: DesktopWorkspaceChange[]
  ahead?: number
  behind?: number
  error?: string
}

export type DesktopWorkspaceChange = {
  path: string
  status: string
  added: number
  deleted: number
  staged?: DesktopWorkspaceChangeScope
  unstaged?: DesktopWorkspaceChangeScope
  untracked: boolean
}

export type DesktopWorkspaceChangeScope = {
  status: string
  added: number
  deleted: number
}

export type DesktopWorkspaceDiff = {
  path: string
  diff: string
  scope: DesktopWorkspaceDiffScope
  status: "modified" | "untracked" | "clean"
  binary: boolean
  truncated: boolean
  exists: boolean
}

export type DesktopWorkspaceDiffScope = "all" | "staged" | "unstaged" | "untracked"

export type DesktopWorkspaceGitAction = "stage" | "unstage"

export type DesktopWorkspaceGitActionResult = {
  action: DesktopWorkspaceGitAction
  path: string
}

export type DesktopRunMode = "build" | "plan" | "goal"
export type DesktopPermissionMode = "ask" | "auto-review"

export type DesktopProviderListResult = {
  providers: string[]
  currentProvider: string
}

export type DesktopSidecarStatus = {
  path: string
  running: boolean
  canReveal: boolean
  exists?: boolean
}

export type DesktopSlashCommandResult =
  | { handled: false; promptText: string; mode?: DesktopRunMode }
  | {
    handled: true
    title: string
    text: string
    settings?: Partial<DesktopSettings>
    session?: string
    action?: { type: "resumeGoal" } | { type: "addImage"; path: string; label: string } | { type: "clearImages" } | { type: "addFile"; path: string; label: string } | { type: "clearFiles" }
  }

export type SidecarFrame =
  | { type: "event"; runId?: string; event: any }
  | { id: string; ok: true; result: any }
  | { id: string; ok: false; error: { code: string; message: string } }

export type DesktopApi = {
  settings(): Promise<DesktopSettings>
  updateSettings(settings: Partial<DesktopSettings>): Promise<DesktopSettings>
  initialize(): Promise<any>
  listProviders(): Promise<DesktopProviderListResult>
  getProviderReadiness(workspaceRoot?: string): Promise<DesktopProviderReadiness>
  configureProvider(input: DesktopProviderSetup): Promise<DesktopProviderSetupResult>
  listSkills(workspaceRoot?: string): Promise<DesktopListSkillsResult>
  listSessions(workspaceRoot?: string): Promise<DesktopListSessionsResult>
  loadSession(session: string, workspaceRoot?: string): Promise<DesktopLoadSessionResult>
  deleteSession(session: string, workspaceRoot?: string): Promise<DesktopDeleteSessionResult>
  getGoalStatus(session?: string, workspaceRoot?: string): Promise<DesktopGoalStatusResult>
  pauseGoal(session?: string, workspaceRoot?: string): Promise<any>
  resumeGoal(session?: string, workspaceRoot?: string): Promise<any>
  clearGoal(session?: string, workspaceRoot?: string): Promise<any>
  getPlanStatus(session?: string, workspaceRoot?: string): Promise<DesktopPlanStatusResult>
  clearPlan(session?: string, workspaceRoot?: string): Promise<any>
  updateSidecarSettings(settings: DesktopSettingsPatch, workspaceRoot?: string): Promise<{ settings: DesktopSettings }>
  pickWorkspace(): Promise<string | undefined>
  pickFiles(): Promise<DesktopFileSelection[]>
  showWorkspace(workspaceRoot?: string): Promise<{ opened: boolean }>
  openWorkspaceFile(filePath: string, workspaceRoot?: string): Promise<{ opened: boolean; path: string }>
  openWorkspaceChanges(workspaceRoot?: string): Promise<{ opened: boolean; path: string }>
  removeWorkspaceSidecar(workspaceRoot: string): Promise<{ stopped: boolean }>
  showSidecar(): Promise<{ opened: boolean }>
  sidecarStatus(): Promise<DesktopSidecarStatus>
  workspaceStatus(workspaceRoot?: string): Promise<DesktopWorkspaceStatus>
  workspaceDiff(filePath: string, workspaceRoot?: string, scope?: DesktopWorkspaceDiffScope): Promise<DesktopWorkspaceDiff>
  workspaceGitAction(filePath: string, action: DesktopWorkspaceGitAction, workspaceRoot?: string): Promise<DesktopWorkspaceGitActionResult>
  executeSlashCommand(text: string, pendingImages?: number, pendingFiles?: number, workspaceRoot?: string): Promise<DesktopSlashCommandResult>
  runPrompt(text: string, mode?: DesktopRunMode, images?: string[], permissionMode?: DesktopPermissionMode, files?: string[], workspaceRoot?: string): Promise<any>
  cancelRun(workspaceRoot?: string): Promise<any>
  replyPermission(requestId: string, reply: "once" | "always" | "reject", workspaceRoot?: string): Promise<any>
  replyPlan(runId: string, action: "approve" | "reject" | "edit" | "new_prompt", text?: string, workspaceRoot?: string): Promise<any>
  onSidecarEvent(listener: (frame: SidecarFrame) => void): () => void
}

declare global {
  interface Window {
    easycode: DesktopApi
  }
}
