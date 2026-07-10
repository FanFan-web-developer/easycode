import type { DesktopPermissionMode, DesktopRunMode } from "../shared/protocol.js"

export type QueuedRunInput = {
  id: string
  text: string
  mode: DesktopRunMode
  permissionMode: DesktopPermissionMode
  images: string[]
  files: string[]
  createdAt: number
}

export type QueuedRunInputDraft = {
  text: string
  mode: DesktopRunMode
  permissionMode: DesktopPermissionMode
  images: string[]
  files: string[]
}

export type QueueComposerState<Attachment> = {
  prompt: string
  attachments: Attachment[]
}

export function createQueuedRunInput(draft: QueuedRunInputDraft, id: string, createdAt: number): QueuedRunInput {
  return {
    id,
    text: draft.text.trim(),
    mode: draft.mode,
    permissionMode: draft.permissionMode,
    images: [...draft.images],
    files: [...draft.files],
    createdAt,
  }
}

export function composerStateAfterQueuedInput<Attachment>(_state: QueueComposerState<Attachment>): QueueComposerState<Attachment> {
  return { prompt: "", attachments: [] }
}

export function isCancelRunInput(text: string) {
  return ["/cancel", "cancel", ":cancel", "stop", "/stop"].includes(text.trim().toLowerCase())
}

export function isRunProducingSlashInput(text: string) {
  const trimmed = text.trim()
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return false
  const [name = "", action = ""] = trimmed.slice(1).split(/\s+/)
  if (name.toLowerCase() === "plan") return true
  if (name.toLowerCase() !== "goal") return false
  if (!action) return false
  return !["status", "show", "list", "pause", "resume", "clear", "stop", "cancel", "rm"].includes(action.toLowerCase())
}

export function shouldQueueRunInput(text: string, running: boolean) {
  const trimmed = text.trim()
  if (!running || trimmed.length === 0 || isCancelRunInput(trimmed)) return false
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return true
  return isRunProducingSlashInput(trimmed)
}

export function shortQueuedPrompt(text: string) {
  const trimmed = text.trim()
  return trimmed.length <= 80 ? trimmed : `${trimmed.slice(0, 77)}...`
}

export function queuedInputLabel(count: number) {
  if (count <= 0) return "No queued input"
  return count === 1 ? "1 queued input" : `${count} queued inputs`
}

export function dequeueQueuedRunInput(queue: QueuedRunInput[], running: boolean) {
  if (running || queue.length === 0) return { next: undefined, remaining: queue }
  const [next, ...remaining] = queue
  return { next, remaining }
}

export function removeQueuedRunInput(queue: QueuedRunInput[], id: string) {
  return queue.filter((input) => input.id !== id)
}

export function shouldDetachActiveRunForWorkspaceSwitch(currentWorkspace: string | undefined, nextWorkspace: string, running: boolean) {
  return running && Boolean(currentWorkspace) && currentWorkspace !== nextWorkspace
}
