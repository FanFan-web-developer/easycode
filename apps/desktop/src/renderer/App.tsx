import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import type { DesktopDeleteSessionResult, DesktopFileSelection, DesktopGoalState, DesktopGoalStatusResult, DesktopListSessionsResult, DesktopListSkillsResult, DesktopLoadSessionResult, DesktopPermissionMode, DesktopPlanStatusResult, DesktopProviderListResult, DesktopProviderReadiness, DesktopProviderSetup, DesktopProviderSetupResult, DesktopRunMode, DesktopSessionSummary, DesktopSettings, DesktopSkillInfo, DesktopSlashCommandResult, DesktopWorkspaceStatus, SidecarFrame } from "../shared/protocol.js"
import { applyAttachmentAction, clearAttachmentSlashCommands, pickedFileSlashCommands, rejectedWorkspaceFileSummary, removeFileRefs, type AttachmentAction, type DesktopAttachment } from "./attachment-state.js"
import type { Attachment, ChatItem, PermissionMode, PermissionPrompt, PlanPrompt, Progress, RunMode } from "./app-types.js"
import { Composer } from "./composer.js"
import { ContextRail } from "./context-rail.js"
import { desktopCopy, type DesktopCopy } from "./desktop-copy.js"
import { firstDisplayUserTitle, fullSessionTitle, isGoalControlTool, isPlanControlTool, MessageStream, messagesToItems, safeSessionTitle, sessionTitle } from "./message-stream.js"
import { permissionPromptAfterRunDone, permissionRunSnapshot, permissionUiAfterRequest, type PermissionRunSnapshot } from "./permission-state.js"
import { goalAfterLifecycleEvent, goalLifecycleSummary, planStatusFromResult, runStatusForGoalPhase, runStatusFromGoalControlResult, runStatusFromRunDone, shouldClearBlockingPromptsAfterRunDone, shouldReloadSessionAfterGoalControl, shouldReloadSessionAfterGoalLifecycle, shouldReloadSessionAfterRunDone } from "./plan-goal-state.js"
import { PermissionModal, PlanModal } from "./prompt-modals.js"
import { ProviderSetupModal } from "./provider-setup-modal.js"
import { providerReadinessError } from "./provider-readiness.js"
import { composerStateAfterQueuedInput, createQueuedRunInput, dequeueQueuedRunInput, isCancelRunInput, queuedInputLabel, removeQueuedRunInput, shortQueuedPrompt, shouldDetachActiveRunForWorkspaceSwitch, shouldQueueRunInput, type QueuedRunInput } from "./run-queue.js"
import { readDesktopSessionSelection, resolveStartupSession, resolveStartupWorkspace, writeDesktopSessionSelection } from "./session-selection-state.js"
import { draftSessionId as createDraftSessionId, draftSessionPromptPlan, mergeSessionListPreservingOrder, planWorkspaceRemoval, removeSessionPreview, sessionIdFromPrompt, sessionSwitchSlashCommand, titleFromPrompt, upsertSessionPreview as upsertSessionPreviewState, workspaceRemovalClearsDraft, workspaceRoots, workspaceSwitchPatch } from "./session-workspace-state.js"
import { effortSettingsCommand, languageSettingsCommand, maxStepsSettingsCommand, maxTokensSettingsCommand, modelSettingsCommand, providerSettingsCommand, thinkingSettingsCommand } from "./settings-commands.js"
import { applyDirectDesktopSettings, reconcileDesktopSettingsFromSidecar, restoreLoadedSessionSettings } from "./settings-sync.js"
import { WorkspaceSidebar } from "./workspace-sidebar.js"
import { WorkspaceChangesBar } from "./workspace-status-bar.js"
import { WorkspaceDiffModal, type WorkspaceDiffModalState } from "./workspace-diff-modal.js"
import { workspaceDiffNavigation } from "./workspace-diff-navigation.js"

export function App() {
  const [settings, setSettings] = useState<DesktopSettings>()
  const [items, setItems] = useState<ChatItem[]>([])
  const [prompt, setPrompt] = useState("")
  const [running, setRunning] = useState(false)
  const [queuedInputs, setQueuedInputs] = useState<QueuedRunInput[]>([])
  const [runMode, setRunMode] = useState<RunMode>("build")
  const [permissionMode, setPermissionMode] = useState<PermissionMode>("ask")
  const [permission, setPermission] = useState<PermissionPrompt>()
  const [plan, setPlan] = useState<PlanPrompt>()
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [sessionsByWorkspace, setSessionsByWorkspace] = useState<Record<string, DesktopSessionSummary[]>>({})
  const [draftSession, setDraftSession] = useState(false)
  const [draftSessionId, setDraftSessionId] = useState<string>()
  const [draftSessionTitle, setDraftSessionTitle] = useState("")
  const [skills, setSkills] = useState<DesktopSkillInfo[]>([])
  const [goal, setGoal] = useState<DesktopGoalState>()
  const [planStatus, setPlanStatus] = useState<DesktopPlanStatusResult>()
  const [contextRailOpen, setContextRailOpen] = useState(false)
  const [providerSetupDismissed, setProviderSetupDismissed] = useState(false)
  const [workspaceStatus, setWorkspaceStatus] = useState<DesktopWorkspaceStatus>()
  const [workspaceStatusRefreshing, setWorkspaceStatusRefreshing] = useState(false)
  const [workspaceDiff, setWorkspaceDiff] = useState<WorkspaceDiffModalState>()
  const [providerOptions, setProviderOptions] = useState<string[]>([])
  const [providerReadiness, setProviderReadiness] = useState<DesktopProviderReadiness>()
  const [progress, setProgress] = useState<Progress>({ status: "idle", summary: "Ready for a local run.", toolCalls: 0, toolResults: 0 })
  const streamRef = useRef<HTMLDivElement>(null)
  const nextStreamScrollRef = useRef<"instant" | "smooth">("smooth")
  const progressRef = useRef<Progress>(progress)
  const settingsRef = useRef<DesktopSettings | undefined>(undefined)
  const runningRef = useRef(false)
  const draftSessionRef = useRef(false)
  const queuedInputsRef = useRef<QueuedRunInput[]>([])
  const activeRunWorkspaceRef = useRef<string | undefined>(undefined)
  const workspaceSwitchingRef = useRef(false)
  const workspaceDiffRequestRef = useRef(0)
  const workspaceStatusRequestRef = useRef(0)
  const activePermissionRef = useRef<PermissionRunSnapshot>(permissionRunSnapshot(runMode, permissionMode))

  const currentWorkspaceRoot = () => settingsRef.current?.workspaceRoot

  const isCurrentWorkspace = (workspaceRoot: string | undefined) => settingsRef.current?.workspaceRoot === workspaceRoot

  const isCurrentSession = (workspaceRoot: string | undefined, session: string | undefined) => isCurrentWorkspace(workspaceRoot) && settingsRef.current?.session === session

  useEffect(() => {
    void window.easycode.settings().then(setSettings)
    const off = window.easycode.onSidecarEvent(handleFrame)
    void window.easycode.initialize().then(async (result) => {
      const initialized = result as { root?: string; session?: string; settings?: DesktopSettings }
      if (initialized.settings) {
        const next = await window.easycode.updateSettings({
          ...initialized.settings,
          ...(initialized.root ? { workspaceRoot: initialized.root } : {}),
          ...(initialized.session ? { session: initialized.session } : {}),
        })
        const restored = await restoreStartupSelection(next)
        setSettings(restored)
        settingsRef.current = restored
      }
      await refreshAll(settingsRef.current?.session ?? initialized.session)
    }).catch((error) => {
      reportUiError(error, "Sidecar initialize failed.")
    })
    return off
  }, [])

  useLayoutEffect(() => {
    const stream = streamRef.current
    if (!stream) return
    const behavior = nextStreamScrollRef.current
    nextStreamScrollRef.current = "smooth"
    if (behavior === "instant") {
      stream.scrollTop = stream.scrollHeight
      return
    }
    stream.scrollTo({ top: stream.scrollHeight, behavior: "smooth" })
  }, [items])

  useEffect(() => {
    progressRef.current = progress
  }, [progress])

  useEffect(() => {
    settingsRef.current = settings
  }, [settings])

  useEffect(() => {
    runningRef.current = running
  }, [running])

  useEffect(() => {
    draftSessionRef.current = draftSession
  }, [draftSession])

  useEffect(() => {
    queuedInputsRef.current = queuedInputs
  }, [queuedInputs])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.metaKey && !event.ctrlKey) return
      if (event.key.toLowerCase() === "n") {
        event.preventDefault()
        void newSession()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [running, settings?.session])

  const workspaceName = useMemo(() => {
    const root = settings?.workspaceRoot || "easycode"
    return workspaceDisplayName(root)
  }, [settings?.workspaceRoot])
  const visibleWorkspaceRoots = workspaceRoots(settings?.workspaceRoot, settings?.recentWorkspaces)
  const sessions = settings?.workspaceRoot ? sessionsByWorkspace[settings.workspaceRoot] ?? [] : []
  const currentSession = sessions.find((session) => session.id === settings?.session)
  const fullPromptTitle = useMemo(() => firstDisplayUserTitle(items), [items])
  const copy = desktopCopy(settings?.language)
  const activeSessionTitle = safeSessionTitle(draftSession ? copy.newChat : fullPromptTitle || (currentSession ? fullSessionTitle(currentSession) : draftSessionTitle || settings?.session || copy.defaultSessionTitle))
  const providerSetupVisible = Boolean(settings && providerReadiness && providerReadiness.status !== "ready" && !providerSetupDismissed)
  const canStartProviderRun = !providerReadiness || providerReadiness.status === "ready"

  const handleFrame = (frame: SidecarFrame) => {
    if (!("type" in frame) || frame.type !== "event") return
    const event = frame.event
    if (event.type === "run_start") {
      updateProgress({ status: "running", stage: "thinking", startedAt: progressRef.current.startedAt ?? Date.now(), summary: `${event.provider}${event.model ? ` ${event.model}` : ""} started.`, provider: event.provider, model: event.model, mode: event.mode, toolCalls: 0, toolResults: 0 })
    } else if (event.type === "provider_progress") {
      updateProgress({ ...progressRef.current, status: "running", stage: "thinking", summary: `${event.provider}${event.model ? ` ${event.model}` : ""} ${event.phase ?? "working"}.` })
    } else if (event.type === "goal") {
      setGoal((current) => goalAfterLifecycleEvent(current, event))
      updateProgress({ ...progressRef.current, status: runStatusForGoalPhase(event.phase), stage: "thinking", startedAt: progressRef.current.startedAt ?? Date.now(), mode: "goal", summary: goalLifecycleSummary(event) })
      void refreshGoalStatus()
      if (shouldReloadSessionAfterGoalLifecycle(event.phase)) {
        void syncCurrentSessionMessages(undefined, { preserveVisible: true }).catch((error) => reportUiError(error, "Goal session sync failed."))
        void refreshPlanStatus()
        void refreshSessions()
      }
    } else if (event.type === "text_delta") {
      updateProgress({ ...progressRef.current, status: "running", stage: "responding", startedAt: progressRef.current.startedAt ?? Date.now(), summary: "Receiving response." })
      appendAssistant(event.text)
    }
    else if (event.type === "tool_call") {
      updateProgress({ ...progressRef.current, status: "running", stage: "tool", startedAt: progressRef.current.startedAt ?? Date.now(), summary: `Running ${event.call.name}.`, toolCalls: progressRef.current.toolCalls + 1 })
      appendTool(event.call.name, JSON.stringify(event.call.input, null, 2), "running")
    } else if (event.type === "tool_result") {
      updateProgress({ ...progressRef.current, status: "running", stage: "thinking", startedAt: progressRef.current.startedAt ?? Date.now(), summary: `${event.title || event.toolName} completed.`, toolResults: progressRef.current.toolResults + 1 })
      if (isPlanControlTool(event.toolName)) void refreshPlanStatus()
      else if (isGoalControlTool(event.toolName)) void refreshGoalStatus()
      else appendTool(event.title || event.toolName, event.output, "done")
    } else if (event.type === "permission_request") {
      const nextPermission = permissionUiAfterRequest(activePermissionRef.current.effectiveMode, event.request)
      if (nextPermission.prompt) {
        updateProgress({ ...progressRef.current, status: nextPermission.progressStatus, stage: "permission", summary: nextPermission.progressSummary })
        setPermission(nextPermission.prompt ? { ...nextPermission.prompt, workspaceRoot: settingsRef.current?.workspaceRoot } : undefined)
      } else {
        appendStatus(nextPermission.statusText)
        void window.easycode.replyPermission(event.request.id, nextPermission.autoReply, settingsRef.current?.workspaceRoot).catch((error) => reportUiError(error, "Permission auto-reply failed."))
      }
    } else if (event.type === "plan_approval_request") {
      updateProgress({ ...progressRef.current, status: "waiting_plan", stage: "plan", startedAt: progressRef.current.startedAt ?? Date.now(), summary: "Plan is waiting for approval." })
      setPlan({ runId: frame.runId!, markdown: event.markdown, workspaceRoot: settingsRef.current?.workspaceRoot })
    } else if (event.type === "provider_metrics") {
      updateProgress({ ...progressRef.current, status: "running", stage: "thinking", startedAt: progressRef.current.startedAt ?? Date.now(), summary: `${event.metrics.provider} metrics received.`, provider: event.metrics.provider, model: event.metrics.model })
    } else if (event.type === "failure") {
      appendAssistant(event.text)
      updateProgress({ ...progressRef.current, status: "failed", stage: undefined, summary: event.text })
    } else if (event.type === "run_done") {
      setRunning(false)
      runningRef.current = false
      activeRunWorkspaceRef.current = undefined
      if (event.status !== "completed") replacePendingAssistant(progressRef.current.summary || `Run ${event.status}.`)
      if (shouldClearBlockingPromptsAfterRunDone(event.status)) {
        setPermission((current) => permissionPromptAfterRunDone(current, event.status))
        setPlan(undefined)
      }
      updateProgress({ ...progressRef.current, status: runStatusFromRunDone(event.status), stage: undefined, startedAt: progressRef.current.startedAt, summary: `Run ${event.status}.` })
      if (shouldReloadSessionAfterRunDone(event.status)) void syncCurrentSessionMessages(undefined, { preserveVisible: true }).catch((error) => reportUiError(error, "Session message sync failed."))
      void refreshWorkspaceStatus()
      void refreshSessions()
      void refreshGoalStatus()
      void refreshPlanStatus()
      void refreshProviderReadiness()
      window.setTimeout(() => flushQueuedInput(), 0)
    } else if (event.type === "fatal") {
      setRunning(false)
      runningRef.current = false
      activeRunWorkspaceRef.current = undefined
      reportUiError(event.message)
    } else if (event.type === "session_changed") {
      if (workspaceSwitchingRef.current) return
      void syncSidecarSession(event.session).catch((error) => reportUiError(error, "Session sync failed."))
    }
  }

  const sendPrompt = async () => {
    await submitInput(prompt)
  }

  const submitInput = async (input: string, source: "composer" | "queue" = "composer", queuedRunInput?: QueuedRunInput) => {
    let text = input.trim()
    if (!text) return
    if (shouldQueueRunInput(text, runningRef.current)) {
      enqueueQueuedInput(text)
      if (source === "composer") {
        const cleared = composerStateAfterQueuedInput({ prompt, attachments })
        setPrompt(cleared.prompt)
        setAttachments(cleared.attachments)
      }
      return
    }
    if (runningRef.current && isCancelRunInput(text)) {
      if (source === "composer") setPrompt("")
      await cancelRun()
      return
    }
    if (text.startsWith("/")) {
      const workspaceRoot = settingsRef.current?.workspaceRoot
      try {
        const slash = await window.easycode.executeSlashCommand(text, queuedRunInput?.images.length ?? pendingImageCount(), queuedRunInput?.files.length ?? pendingFileCount(), workspaceRoot) as DesktopSlashCommandResult
        if (slash.handled) {
          if (source === "composer") setPrompt("")
          await applySlashResult(text, slash)
          if (source === "queue") window.setTimeout(() => flushQueuedInput(), 0)
          return
        }
        text = slash.promptText
        await runPromptText(text, slash.mode, queuedRunInput)
        return
      } catch (error) {
        appendStatus(error instanceof Error ? error.message : String(error))
        updateProgress({ ...progressRef.current, status: "failed", summary: error instanceof Error ? error.message : String(error) })
        if (source === "queue") window.setTimeout(() => flushQueuedInput(), 0)
        return
      }
    }
    await runPromptText(text, source === "queue" ? queuedRunInput?.mode ?? "build" : undefined, queuedRunInput)
  }

  const runPromptText = async (text: string, modeOverride?: RunMode, queuedRunInput?: QueuedRunInput) => {
    if (!ensureProviderReady()) return
    const images = queuedRunInput?.images ?? attachments.filter((file) => file.kind === "image").map((file) => file.path)
    const files = queuedRunInput?.files ?? attachments.filter((file) => file.kind === "file").map((file) => file.path)
    try {
      await prepareSessionForPrompt(text)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      appendStatus(message)
      updateProgress({ ...progressRef.current, status: "failed", summary: message })
      return
    }
    const runWorkspaceRoot = settingsRef.current?.workspaceRoot
    setPrompt("")
    setAttachments([])
    setRunning(true)
    runningRef.current = true
    activeRunWorkspaceRef.current = runWorkspaceRoot
    updateProgress({ status: "running", stage: "preparing", startedAt: Date.now(), summary: "Preparing run context.", toolCalls: 0, toolResults: 0 })
    setItems((current) => [...current, { id: crypto.randomUUID(), kind: "user", text, time: currentTime() }, { id: crypto.randomUUID(), kind: "assistant", text: copy.waitingForModel, time: currentTime(), pending: true }])
    try {
      const effectiveRunMode = modeOverride ?? runMode
      const permissionSnapshot = permissionRunSnapshot(effectiveRunMode, queuedRunInput?.permissionMode ?? permissionMode)
      activePermissionRef.current = permissionSnapshot
      await window.easycode.runPrompt(text, effectiveRunMode, images, permissionSnapshot.sidecarMode, files, runWorkspaceRoot)
    } catch (error) {
      if (settingsRef.current?.workspaceRoot !== runWorkspaceRoot) return
      const message = error instanceof Error ? error.message : String(error)
      replacePendingAssistant(message)
      setRunning(false)
      runningRef.current = false
      activeRunWorkspaceRef.current = undefined
      updateProgress({ ...progressRef.current, status: "failed", summary: message })
      window.setTimeout(() => flushQueuedInput(), 0)
    }
  }

  const cancelRun = async () => {
    if (!running) return
    updateProgress({ ...progressRef.current, status: "cancelled", stage: "cancelling", summary: "Cancelling run..." })
    try {
      const result = await window.easycode.cancelRun(activeRunWorkspaceRef.current ?? settingsRef.current?.workspaceRoot) as { cancelled?: boolean }
      if (!result.cancelled) updateProgress({ ...progressRef.current, status: "idle", summary: "No active run to cancel." })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      appendStatus(message)
      updateProgress({ ...progressRef.current, status: "failed", summary: message })
    }
  }

  const pendingImageCount = () => attachments.filter((file) => file.kind === "image").length
  const pendingFileCount = () => attachments.filter((file) => file.kind === "file").length

  const applySlashResult = async (commandText: string, result: Extract<DesktopSlashCommandResult, { handled: true }>) => {
    if (result.settings) {
      const next = await reconcileDesktopSettingsFromSidecar(window.easycode, result.settings)
      setSettings(next)
      await refreshSettingsSurfaces()
      updateProgress({ ...progressRef.current, status: "idle", summary: result.title, toolCalls: progressRef.current.toolCalls, toolResults: progressRef.current.toolResults })
      return
    }
    setItems((current) => [
      ...current,
      { id: crypto.randomUUID(), kind: "user", text: commandText, time: currentTime() },
      { id: crypto.randomUUID(), kind: "status", text: `${result.title}\n${result.text}` },
    ])
    const action = result.action
    if (isAttachmentAction(action)) {
      setAttachments((current) => applyAttachmentAction(current, action, crypto.randomUUID()))
    } else if (action?.type === "resumeGoal") {
      await resumeGoal()
      return
    }
    if (result.session) {
      await selectSession(result.session)
      return
    }
    await refreshAll()
    updateProgress({ ...progressRef.current, status: "idle", summary: result.title, toolCalls: progressRef.current.toolCalls, toolResults: progressRef.current.toolResults })
  }

  const applySettingsCommand = async (commandText: string, fallback?: Partial<DesktopSettings>) => {
    try {
      const result = await window.easycode.executeSlashCommand(commandText, pendingImageCount(), pendingFileCount(), settingsRef.current?.workspaceRoot) as DesktopSlashCommandResult
      if (!result.handled) {
        if (fallback) await updateSettings(fallback)
        return
      }
      if (result.settings) {
        const next = await reconcileDesktopSettingsFromSidecar(window.easycode, result.settings)
        setSettings(next)
      }
      await refreshSettingsSurfaces()
      updateProgress({ ...progressRef.current, status: "idle", summary: result.title, toolCalls: progressRef.current.toolCalls, toolResults: progressRef.current.toolResults })
    } catch (error) {
      reportUiError(error)
    }
  }

  const updateSettings = async (patch: Partial<DesktopSettings>) => {
    try {
      const next = await applyDirectDesktopSettings(window.easycode, patch)
      setSettings(next)
      await refreshSettingsSurfaces()
    } catch (error) {
      reportUiError(error, "Settings update failed.")
    }
  }

  const configureProvider = async (input: DesktopProviderSetup) => {
    const result = await window.easycode.configureProvider(input) as DesktopProviderSetupResult
    setSettings(result.settings)
    await window.easycode.initialize()
    const readiness = await window.easycode.getProviderReadiness(result.settings.workspaceRoot) as DesktopProviderReadiness
    setProviderReadiness(readiness)
    await refreshAll(result.settings.session)
    if (readiness.status !== "ready") {
      throw new Error(`Provider configuration saved locally in ${result.envPath}, but EasyCode is still not ready. ${providerReadinessError(readiness)}`)
    }
    return result
  }

  const ensureProviderReady = () => {
    if (!providerReadiness || providerReadiness.status === "ready") return true
    const text = `Provider is not ready. ${providerReadinessError(providerReadiness)}`
    setProviderSetupDismissed(false)
    setContextRailOpen(true)
    appendStatus(text)
    updateProgress({ ...progressRef.current, status: "failed", summary: text })
    return false
  }

  const refreshAll = async (session = settings?.session) => {
    const steps: Array<[string, () => Promise<void>]> = [
      ["providers", refreshProviders],
      ["provider readiness", refreshProviderReadiness],
      ["skills", refreshSkills],
      ["sessions", refreshSessions],
      ["goal", () => refreshGoalStatus(session)],
      ["plan", () => refreshPlanStatus(session)],
      ["workspace", refreshWorkspaceStatus],
    ]
    const results = await Promise.allSettled(steps.map(([, step]) => step()))
    const failures = results.flatMap((result, index) => result.status === "rejected" ? [`${steps[index][0]}: ${errorMessage(result.reason)}`] : [])
    if (failures.length > 0) {
      const text = `Refresh incomplete. ${failures.join("; ")}`
      appendStatus(text)
      updateProgress({ ...progressRef.current, status: "failed", summary: text })
    }
  }

  const refreshProviders = async () => {
    const result = await window.easycode.listProviders() as DesktopProviderListResult
    setProviderOptions(result.providers.filter((provider) => provider !== "fake" && provider !== "simulated"))
  }

  const refreshProviderReadiness = async () => {
    const workspaceRoot = currentWorkspaceRoot()
    const readiness = await window.easycode.getProviderReadiness(workspaceRoot)
    if (!isCurrentWorkspace(workspaceRoot)) return
    setProviderReadiness(readiness)
  }

  const refreshSkills = async () => {
    const workspaceRoot = currentWorkspaceRoot()
    const result = await window.easycode.listSkills(workspaceRoot) as DesktopListSkillsResult
    if (!isCurrentWorkspace(workspaceRoot)) return
    setSkills(result.skills)
    setSettings((current) => current ? {
      ...current,
      selectedSkills: result.selectedSkills,
      pendingSkillLoads: result.pendingSkillLoads,
    } : current)
  }

  const refreshSessions = async () => {
    const workspaceRoot = currentWorkspaceRoot()
    const result = await window.easycode.listSessions(workspaceRoot) as DesktopListSessionsResult
    if (!isCurrentWorkspace(workspaceRoot)) return
    setWorkspaceSessions(workspaceRoot, (current) => mergeSessionListPreservingOrder(current, result.sessions))
  }

  const restoreStartupSelection = async (settings: DesktopSettings) => {
    const roots = workspaceRoots(settings.workspaceRoot, settings.recentWorkspaces)
    const remembered = readDesktopSessionSelection()
    const workspaceRoot = resolveStartupWorkspace(roots, remembered)
    let next = settings
    if (workspaceRoot && workspaceRoot !== settings.workspaceRoot) {
      next = await window.easycode.updateSettings({ ...settings, workspaceRoot, session: "default" })
      await window.easycode.initialize()
    }

    const listed = await window.easycode.listSessions(next.workspaceRoot) as DesktopListSessionsResult
    const session = resolveStartupSession(listed.sessions, remembered, next.workspaceRoot, listed.currentSession || next.session)
    setWorkspaceSessions(next.workspaceRoot, (current) => mergeSessionListPreservingOrder(current, listed.sessions))
    if (!session) return next

    const loaded = await window.easycode.loadSession(session, next.workspaceRoot) as DesktopLoadSessionResult
    const restored = await restoreLoadedSessionSettings(window.easycode, session, loaded.settings)
    setSessionItems(messagesToItems(loaded.messages))
    rememberSessionSelection(restored.workspaceRoot, session)
    updateProgress({ status: "idle", summary: `Loaded session ${session}.`, toolCalls: 0, toolResults: 0 })
    return restored
  }

  const refreshGoalStatus = async (session = settings?.session) => {
    const workspaceRoot = currentWorkspaceRoot()
    const targetSession = session ?? settingsRef.current?.session
    const result = await window.easycode.getGoalStatus(targetSession, workspaceRoot) as DesktopGoalStatusResult
    if (!isCurrentSession(workspaceRoot, targetSession)) return
    setGoal(result.goal)
  }

  const refreshPlanStatus = async (session = settings?.session) => {
    const workspaceRoot = currentWorkspaceRoot()
    const targetSession = session ?? settingsRef.current?.session
    const result = await window.easycode.getPlanStatus(targetSession, workspaceRoot) as DesktopPlanStatusResult
    if (!isCurrentSession(workspaceRoot, targetSession)) return
    setPlanStatus(planStatusFromResult(result))
  }

  const refreshWorkspaceStatus = async () => {
    const workspaceRoot = currentWorkspaceRoot()
    const requestId = ++workspaceStatusRequestRef.current
    setWorkspaceStatusRefreshing(true)
    try {
      const status = await window.easycode.workspaceStatus(workspaceRoot)
      if (requestId !== workspaceStatusRequestRef.current || !isCurrentWorkspace(workspaceRoot)) return
      setWorkspaceStatus(status)
    } finally {
      if (requestId === workspaceStatusRequestRef.current && isCurrentWorkspace(workspaceRoot)) setWorkspaceStatusRefreshing(false)
    }
  }

  const refreshSettingsSurfaces = async () => {
    await Promise.allSettled([
      refreshProviderReadiness(),
      refreshWorkspaceStatus(),
      refreshSkills(),
    ])
  }

  const selectSession = async (session: string) => {
    if (running) return
    if (draftSession && session === draftSessionId) return
    try {
      const switched = await window.easycode.executeSlashCommand(sessionSwitchSlashCommand(session), pendingImageCount(), pendingFileCount(), settingsRef.current?.workspaceRoot) as DesktopSlashCommandResult
      if (!switched.handled) throw new Error(`Session switch was not handled: ${session}`)
      await loadSessionIntoUi(switched.session ?? session, `Loaded session ${switched.session ?? session}.`)
    } catch (error) {
      reportUiError(error, "Session load failed.")
      await refreshSessions()
    }
  }

  const loadSessionIntoUi = async (session: string, summary: string) => {
    const loaded = await window.easycode.loadSession(session, settingsRef.current?.workspaceRoot) as DesktopLoadSessionResult
    setDraftSession(false)
    setDraftSessionId(undefined)
    setDraftSessionTitle("")
    const restored = await restoreLoadedSessionSettings(window.easycode, session, loaded.settings)
    setSettings(restored)
    settingsRef.current = restored
    setSessionItems(messagesToItems(loaded.messages))
    rememberSessionSelection(restored.workspaceRoot, session)
    updateProgress({ status: "idle", summary, toolCalls: 0, toolResults: 0 })
    await refreshAll(session)
  }

  const syncSidecarSession = async (session: string) => {
    const current = settingsRef.current
    if (!current || current.session === session) return
    const loaded = await window.easycode.loadSession(session, current.workspaceRoot) as DesktopLoadSessionResult
    const next = await window.easycode.updateSettings({ ...loaded.settings, session })
    setSettings(next)
    settingsRef.current = next
    setDraftSession(false)
    setDraftSessionId(undefined)
    setDraftSessionTitle("")
    rememberSessionSelection(next.workspaceRoot, session)
    if (!runningRef.current && !draftSessionRef.current) {
      setSessionItems(messagesToItems(loaded.messages))
      updateProgress({ status: "idle", summary: `Loaded session ${session}.`, toolCalls: 0, toolResults: 0 })
    }
  }

  const syncCurrentSessionMessages = async (session = settingsRef.current?.session, options: { preserveVisible?: boolean } = {}) => {
    if (!session) return
    const loaded = await window.easycode.loadSession(session, settingsRef.current?.workspaceRoot) as DesktopLoadSessionResult
    const restored = messagesToItems(loaded.messages)
    if (options.preserveVisible) {
      setItems((current) => current.length > 0 ? current : restored)
      return
    }
    setSessionItems(restored)
  }

  const newSession = async () => {
    if (running) return
    const session = createDraftSessionId()
    try {
      const switched = await window.easycode.executeSlashCommand(sessionSwitchSlashCommand(session), 0, 0, settingsRef.current?.workspaceRoot) as DesktopSlashCommandResult
      if (!switched.handled) throw new Error(`Session create was not handled: ${session}`)
      const createdSession = switched.session ?? session
      const loaded = await window.easycode.loadSession(createdSession, settingsRef.current?.workspaceRoot) as DesktopLoadSessionResult
      const restored = await restoreLoadedSessionSettings(window.easycode, createdSession, loaded.settings)
      setSettings(restored)
      settingsRef.current = restored
      setDraftSession(true)
      draftSessionRef.current = true
      setDraftSessionId(createdSession)
      setDraftSessionTitle("")
      rememberSessionSelection(restored.workspaceRoot, createdSession)
      setWorkspaceSessions(restored.workspaceRoot, (current) => upsertSessionPreviewState(draftSessionId ? removeSessionPreview(current, draftSessionId) : current, createdSession, "New Chat"))
      setSessionItems([])
      setAttachments([])
      updateProgress({ status: "idle", summary: "New chat ready.", toolCalls: 0, toolResults: 0 })
      await refreshSessions()
    } catch (error) {
      reportUiError(error, "Session create failed.")
      await refreshSessions()
    }
  }

  const deleteSession = async (session: string) => {
    if (running) return
    if (draftSession && session === draftSessionId) {
      setWorkspaceSessions(settings?.workspaceRoot, (current) => removeSessionPreview(current, session))
      setDraftSession(false)
      setDraftSessionId(undefined)
      setDraftSessionTitle("")
      setSessionItems([])
      updateProgress({ status: "idle", summary: "Draft session removed.", toolCalls: 0, toolResults: 0 })
      return
    }
    try {
      const result = await window.easycode.deleteSession(session, settingsRef.current?.workspaceRoot) as DesktopDeleteSessionResult
      if (session === settings?.session) {
        if (result.currentSession) await selectSession(result.currentSession)
        else await newSession()
        return
      }
      await refreshSessions()
      updateProgress({ ...progressRef.current, status: "idle", summary: `Deleted session ${session}.` })
    } catch (error) {
      reportUiError(error, "Session delete failed.")
    }
  }

  const selectWorkspace = async (workspaceRoot: string) => {
    if (workspaceRoot === settings?.workspaceRoot) return
    workspaceSwitchingRef.current = true
    closeWorkspaceDiff()
    try {
      const patch = workspaceSwitchPatch(workspaceRoot)
      if (shouldDetachActiveRunForWorkspaceSwitch(settings?.workspaceRoot, workspaceRoot, runningRef.current)) {
        setRunning(false)
        runningRef.current = false
        activeRunWorkspaceRef.current = undefined
        replaceQueuedInputs([])
        setPermission(undefined)
        setPlan(undefined)
      }
      setDraftSession(false)
      setDraftSessionId(undefined)
      setDraftSessionTitle("")
      const next = await window.easycode.updateSettings(patch)
      setSettings(next)
      settingsRef.current = next
      await window.easycode.initialize()
      setAttachments([])
      const listed = await window.easycode.listSessions(next.workspaceRoot) as DesktopListSessionsResult
      setWorkspaceSessions(next.workspaceRoot, (current) => mergeSessionListPreservingOrder(current, listed.sessions))
      const session = resolveStartupSession(listed.sessions, readDesktopSessionSelection(), next.workspaceRoot, listed.sessions[0]?.id ?? listed.currentSession ?? patch.session)
      await loadSessionIntoUi(session, `Opened workspace ${workspaceRoot}.`)
    } catch (error) {
      reportUiError(error, "Workspace open failed.")
    } finally {
      workspaceSwitchingRef.current = false
    }
  }

  const addWorkspace = async () => {
    try {
      const workspaceRoot = await window.easycode.pickWorkspace()
      if (!workspaceRoot) return
      await selectWorkspace(workspaceRoot)
    } catch (error) {
      reportUiError(error, "Workspace picker failed.")
    }
  }

  const removeWorkspace = async (workspaceRoot?: string) => {
    const targetWorkspace = workspaceRoot ?? settings?.workspaceRoot
    if (running || !settings || !targetWorkspace) return
    try {
      const plan = planWorkspaceRemoval(settings.workspaceRoot, settings.recentWorkspaces, targetWorkspace)
      if (plan.type === "keep_last") return
      if (plan.type === "remove_inactive") {
        const next = await window.easycode.updateSettings({ recentWorkspaces: plan.recentWorkspaces })
        setSettings(next)
        await window.easycode.removeWorkspaceSidecar(targetWorkspace)
        updateProgress({ ...progressRef.current, status: "idle", summary: `Removed workspace ${targetWorkspace}.` })
        return
      }
      if (workspaceRemovalClearsDraft(plan)) {
        setDraftSession(false)
        setDraftSessionId(undefined)
        setDraftSessionTitle("")
      }
      const next = await window.easycode.updateSettings({ workspaceRoot: plan.workspaceRoot, recentWorkspaces: plan.recentWorkspaces, session: plan.session })
      setSettings(next)
      await window.easycode.initialize()
      setAttachments([])
      await loadSessionIntoUi(plan.session, `Removed workspace and opened ${plan.workspaceRoot}.`)
      await window.easycode.removeWorkspaceSidecar(targetWorkspace)
    } catch (error) {
      reportUiError(error, "Workspace remove failed.")
    }
  }

  const runWorkspaceAction = async (action: () => Promise<unknown> | unknown) => {
    try {
      await action()
    } catch (error) {
      reportUiError(error, "Workspace action failed.")
    }
  }

  const pickFiles = async () => {
    if (running) return
    try {
      const files = await window.easycode.pickFiles() as DesktopFileSelection[]
      if (files.length === 0) return
      const planned = pickedFileSlashCommands(files)
      if (planned.rejectedCount > 0) {
        const text = rejectedWorkspaceFileSummary(planned.rejectedCount)
        appendStatus(text)
        updateProgress({ ...progressRef.current, status: "idle", summary: text })
      }
      for (const command of planned.commands) {
        const result = await window.easycode.executeSlashCommand(command, pendingImageCount(), pendingFileCount(), settingsRef.current?.workspaceRoot) as DesktopSlashCommandResult
        if (result.handled) applyAttachmentSlashResult(result)
      }
    } catch (error) {
      reportUiError(error, "File picker failed.")
    }
  }

  const removeAttachment = (id: string) => {
    setAttachments((current) => {
      const removed = current.find((file) => file.id === id)
      if (removed?.kind === "file") setPrompt((text) => removeFileRefs(text, [removed.path]))
      return current.filter((file) => file.id !== id)
    })
  }

  const applyAttachmentSlashResult = (result: Extract<DesktopSlashCommandResult, { handled: true }>) => {
    const action = result.action
    if (isAttachmentAction(action)) setAttachments((current) => applyAttachmentAction(current, action, crypto.randomUUID()))
    updateProgress({ ...progressRef.current, status: "idle", summary: result.title })
  }

  const clearAttachments = async () => {
    if (running) return
    const commands = clearAttachmentSlashCommands(attachments)
    if (commands.length === 0) return
    const filePaths = attachments.filter((file) => file.kind === "file").map((file) => file.path)
    try {
      for (const command of commands) {
        const result = await window.easycode.executeSlashCommand(command, pendingImageCount(), pendingFileCount(), settingsRef.current?.workspaceRoot) as DesktopSlashCommandResult
        if (result.handled) applyAttachmentSlashResult(result)
      }
      if (filePaths.length > 0) setPrompt((text) => removeFileRefs(text, filePaths))
    } catch (error) {
      reportUiError(error, "Attachment clear failed.")
    }
  }

  const toggleSkill = async (skill: DesktopSkillInfo) => {
    if (running || !settings) return
    const selected = new Set(settings.selectedSkills ?? [])
    const activeById = selected.has(skill.id)
    const activeByName = selected.has(skill.name)
    const target = activeById ? skill.id : activeByName ? skill.name : skill.id
    await applySettingsCommand(activeById || activeByName ? `/skill remove ${target}` : `/skill use ${skill.id}`)
  }

  const clearSkills = async () => {
    if (running || !settings) return
    await applySettingsCommand("/skill clear")
  }

  const resumeGoal = async () => {
    if (running) return
    setRunning(true)
    runningRef.current = true
    updateProgress({ status: "running", stage: "preparing", startedAt: Date.now(), summary: "Resuming goal.", mode: "goal", toolCalls: 0, toolResults: 0 })
    try {
      const result = await window.easycode.resumeGoal(settings?.session, settingsRef.current?.workspaceRoot) as { status?: string; text?: string }
      setRunning(false)
      runningRef.current = false
      updateProgress({ ...progressRef.current, status: runStatusFromGoalControlResult(result, progressRef.current.status), summary: result.text ?? "Goal resume finished." })
      if (shouldReloadSessionAfterGoalControl(result)) await syncCurrentSessionMessages()
      await refreshGoalStatus()
      await refreshPlanStatus()
      await refreshWorkspaceStatus()
      await refreshSessions()
      window.setTimeout(() => flushQueuedInput(), 0)
    } catch (error) {
      appendStatus(error instanceof Error ? error.message : String(error))
      setRunning(false)
      runningRef.current = false
      updateProgress({ ...progressRef.current, status: "failed", summary: error instanceof Error ? error.message : String(error) })
      window.setTimeout(() => flushQueuedInput(), 0)
    }
  }

  const prepareSessionForPrompt = async (text: string) => {
    if (!draftSession) return
    const { session, title } = draftSessionPromptPlan(text, draftSessionId)
    const workspaceRoot = settingsRef.current?.workspaceRoot
    const next = await window.easycode.updateSettings({ ...(workspaceRoot ? { workspaceRoot } : {}), session })
    setSettings(next)
    settingsRef.current = next
    setDraftSession(false)
    draftSessionRef.current = false
    setDraftSessionId(undefined)
    setDraftSessionTitle(title)
    await window.easycode.initialize()
    await refreshSessions()
    upsertSessionPreview(session, title)
    rememberSessionSelection(next.workspaceRoot, session)
  }

  return (
    <main className={`shell ${contextRailOpen ? "" : "rail-collapsed"}`}>
      <WorkspaceSidebar
        copy={copy}
        draftSession={draftSession}
        draftSessionId={draftSessionId}
        onAddWorkspace={addWorkspace}
        onDeleteSession={deleteSession}
        onNewSession={newSession}
        onRemoveWorkspace={(root) => void runWorkspaceAction(() => removeWorkspace(root))}
        onSelectSession={selectSession}
        onSelectWorkspace={selectWorkspace}
        onShowWorkspace={(root) => void runWorkspaceAction(() => window.easycode.showWorkspace(root))}
        running={running}
        sessions={sessions}
        sessionTitle={sessionTitle}
        settings={settings}
        visibleWorkspaceRoots={visibleWorkspaceRoots}
        workspaceDisplayName={workspaceDisplayName}
      />

      <section className="workbench">
        <header className="topbar">
          <div className="topbar-title">
            <h1 title={activeSessionTitle}>{activeSessionTitle}</h1>
          </div>
          <div className="top-actions">
            <button className="topbar-settings" onClick={() => setContextRailOpen((open) => !open)} aria-label={copy.showSettings} title={copy.showSettings}>⚙</button>
          </div>
        </header>

        <MessageStream copy={copy} items={items} onOpenFile={openWorkspaceFileFromMessage} onSelectPrompt={setPrompt} streamRef={streamRef} />

        <div className="composer-stack">
          <WorkspaceChangesBar copy={copy} goal={goal} planStatus={planStatus} progress={progress} status={workspaceStatus} onOpen={openWorkspaceChanges} />
          <Composer
            attachments={attachments}
            onClearAttachments={clearAttachments}
            onClearQueuedInputs={() => replaceQueuedInputs([])}
            copy={copy}
            onPickFiles={pickFiles}
            onRemoveAttachment={removeAttachment}
            onRemoveQueuedInput={(id) => replaceQueuedInputs(removeQueuedRunInput(queuedInputsRef.current, id))}
            permissionMode={permissionMode}
            prompt={prompt}
            providerReady={canStartProviderRun}
            providerReadiness={providerReadiness}
            runMode={runMode}
            running={running}
            settings={settings}
            onCancelRun={cancelRun}
            onChangeEffort={(effort) => applySettingsCommand(effortSettingsCommand(effort))}
            onChangeModel={(model) => applySettingsCommand(modelSettingsCommand(model))}
            setPermissionMode={setPermissionMode}
            setPrompt={setPrompt}
            setRunMode={setRunMode}
            sendPrompt={sendPrompt}
            queuedInputs={queuedInputs}
          />
        </div>
      </section>

      <ContextRail
        copy={copy}
        onChangeContextLimit={(value) => applySettingsCommand(maxTokensSettingsCommand(value))}
        onChangeLanguage={(language) => applySettingsCommand(languageSettingsCommand(language))}
        onChangeMaxSteps={(maxSteps) => applySettingsCommand(maxStepsSettingsCommand(maxSteps))}
        onChangeProvider={(provider) => applySettingsCommand(providerSettingsCommand(provider))}
        onChangeThinking={(thinking) => applySettingsCommand(thinkingSettingsCommand(thinking))}
        onClearSkills={clearSkills}
        onRefreshWorkspaceStatus={() => void refreshWorkspaceStatus().catch((error) => reportUiError(error, "Workspace status refresh failed."))}
        onToggleSkill={toggleSkill}
        onViewFileDiff={(filePath) => void openWorkspaceDiff(filePath)}
        open={contextRailOpen}
        providerOptions={providerOptions}
        providerReadiness={providerReadiness}
        running={running}
        selectedSkills={settings?.selectedSkills ?? []}
        settings={settings}
        skills={skills}
        status={workspaceStatus}
        statusRefreshing={workspaceStatusRefreshing}
        workspaceName={workspaceName}
      />

      {permission && <PermissionModal prompt={permission} onClose={() => setPermission(undefined)} onError={reportUiError} />}
      {plan && <PlanModal prompt={plan} onClose={() => setPlan(undefined)} onError={reportUiError} />}
      {providerSetupVisible && settings && providerReadiness && <ProviderSetupModal
        providerOptions={providerOptions}
        readiness={providerReadiness}
        settings={settings}
        onClose={() => setProviderSetupDismissed(true)}
        onConfigured={configureProvider}
      />}
      {workspaceDiff && <WorkspaceDiffModal
        copy={copy}
        navigation={workspaceDiffNavigation(workspaceStatus?.files ?? [], workspaceDiff.status === "ready" ? workspaceDiff.result.path : workspaceDiff.path)}
        state={workspaceDiff}
        onClose={closeWorkspaceDiff}
        onNavigate={(filePath) => void openWorkspaceDiff(filePath)}
        onOpenFile={(filePath) => void openWorkspaceFileFromMessage(filePath)}
        onRefresh={(filePath) => void refreshWorkspaceDiff(filePath)}
      />}
    </main>
  )

  function appendAssistant(text: string) {
    setItems((current) => {
      const last = current.at(-1)
      if (last?.kind === "assistant") return current.map((item) => {
        if (item.id !== last.id || item.kind !== "assistant") return item
        if (item.pending) return { ...item, text, pending: false }
        return { ...item, text: item.text + text }
      })
      return [...current, { id: crypto.randomUUID(), kind: "assistant", text, time: currentTime() }]
    })
  }

  function replacePendingAssistant(text: string) {
    setItems((current) => {
      const last = current.at(-1)
      if (last?.kind !== "assistant" || !last.pending) return current
      return current.map((item) => item.id === last.id && item.kind === "assistant" ? { ...item, text, pending: false } : item)
    })
  }

  function appendTool(title: string, detail: string, status: "running" | "done") {
    if (isPlanControlTool(title) || isGoalControlTool(title)) return
    setItems((current) => [...current, { id: crypto.randomUUID(), kind: "tool", title, detail, status, open: false }])
  }

  function appendStatus(text: string) {
    setItems((current) => [...current, { id: crypto.randomUUID(), kind: "status", text }])
  }

  async function openWorkspaceFileFromMessage(filePath: string) {
    try {
      await window.easycode.openWorkspaceFile(filePath, settingsRef.current?.workspaceRoot)
    } catch (error) {
      appendStatus(copy.cannotOpenFile(filePath, errorMessage(error)))
    }
  }

  async function openWorkspaceDiff(filePath: string) {
    const workspaceRoot = settingsRef.current?.workspaceRoot
    if (!workspaceRoot) return
    const requestId = ++workspaceDiffRequestRef.current
    setWorkspaceDiff({ status: "loading", path: filePath })
    try {
      const result = await window.easycode.workspaceDiff(filePath, workspaceRoot)
      if (requestId !== workspaceDiffRequestRef.current || !isCurrentWorkspace(workspaceRoot)) return
      setWorkspaceDiff({ status: "ready", result })
    } catch (error) {
      if (requestId !== workspaceDiffRequestRef.current || !isCurrentWorkspace(workspaceRoot)) return
      setWorkspaceDiff({ status: "error", path: filePath, message: errorMessage(error) })
    }
  }

  async function refreshWorkspaceDiff(filePath: string) {
    const statusRefresh = refreshWorkspaceStatus().catch((error) => reportUiError(error, "Workspace status refresh failed."))
    await openWorkspaceDiff(filePath)
    await statusRefresh
  }

  function closeWorkspaceDiff() {
    workspaceDiffRequestRef.current += 1
    setWorkspaceDiff(undefined)
  }

  function openWorkspaceChanges() {
    setContextRailOpen(true)
  }

  function enqueueQueuedInput(text: string) {
    const input = createQueuedRunInput({
      text,
      mode: runMode,
      permissionMode,
      images: attachments.filter((file) => file.kind === "image").map((file) => file.path),
      files: attachments.filter((file) => file.kind === "file").map((file) => file.path),
    }, crypto.randomUUID(), Date.now())
    const next = [...queuedInputsRef.current, input]
    replaceQueuedInputs(next)
    const summary = `Queued next input: ${shortQueuedPrompt(text)}`
    appendStatus(summary)
    updateProgress({ ...progressRef.current, summary: `${summary} (${queuedInputLabel(next.length)}).` })
  }

  function flushQueuedInput() {
    const { next: nextInput, remaining } = dequeueQueuedRunInput(queuedInputsRef.current, runningRef.current)
    if (!nextInput) return
    replaceQueuedInputs(remaining)
    appendStatus(`Running queued input: ${shortQueuedPrompt(nextInput.text)}`)
    void submitInput(nextInput.text, "queue", nextInput)
  }

  function replaceQueuedInputs(next: QueuedRunInput[]) {
    queuedInputsRef.current = next
    setQueuedInputs(next)
  }

  function updateProgress(next: Progress) {
    progressRef.current = next
    setProgress(next)
  }

  function reportUiError(error: unknown, prefix?: string) {
    const message = errorMessage(error)
    const text = prefix ? `${prefix} ${message}` : message
    appendStatus(text)
    updateProgress({ ...progressRef.current, status: "failed", summary: text })
  }

  function upsertSessionPreview(session: string, title: string) {
    setWorkspaceSessions(settingsRef.current?.workspaceRoot, (current) => upsertSessionPreviewState(current, session, title))
  }

  function rememberSessionSelection(workspaceRoot: string | undefined, session: string | undefined) {
    if (!workspaceRoot || !session) return
    writeDesktopSessionSelection({ workspaceRoot, session })
  }

  function setWorkspaceSessions(workspaceRoot: string | undefined, update: (current: DesktopSessionSummary[]) => DesktopSessionSummary[]) {
    if (!workspaceRoot) return
    setSessionsByWorkspace((current) => ({
      ...current,
      [workspaceRoot]: update(current[workspaceRoot] ?? []),
    }))
  }

  function setSessionItems(next: ChatItem[]) {
    nextStreamScrollRef.current = "instant"
    setItems(next)
  }
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

function currentTime() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

function isAttachmentAction(action: Extract<DesktopSlashCommandResult, { handled: true }>["action"]): action is AttachmentAction {
  return action?.type === "addImage" || action?.type === "clearImages" || action?.type === "addFile" || action?.type === "clearFiles"
}

function workspaceDisplayName(root: string) {
  return root.split(/[\\/]/).filter(Boolean).at(-1) || root
}
