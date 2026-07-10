import { useState } from "react"
import type { DesktopWorkspaceGitAction } from "../shared/protocol.js"

type WorkspaceGitActionCopy = {
  cancel: string
  confirmWorkspaceGitAction: (action: DesktopWorkspaceGitAction) => string
  workspaceGitActionDetail: string
  workspaceGitActionTitle: (action: DesktopWorkspaceGitAction) => string
  running: string
}

export function WorkspaceGitActionModal({ action, copy, onClose, onConfirm, onError, path }: {
  action: DesktopWorkspaceGitAction
  copy: WorkspaceGitActionCopy
  onClose: () => void
  onConfirm: () => Promise<void>
  onError: (error: unknown, prefix?: string) => void
  path: string
}) {
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const confirm = async () => {
    setSubmitting(true)
    setError("")
    try {
      await onConfirm()
      onClose()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setError(message)
      onError(error, "Workspace Git action failed.")
    } finally {
      setSubmitting(false)
    }
  }
  return <div className="modal">
    <section className="workspace-git-action-modal" role="dialog" aria-modal="true" aria-labelledby="workspace-git-action-title">
      <h2 id="workspace-git-action-title">{copy.workspaceGitActionTitle(action)}</h2>
      <p className="workspace-git-action-path" title={path}>{path}</p>
      <small>{copy.workspaceGitActionDetail}</small>
      {error && <p className="setup-error">{error}</p>}
      <div className="modal-actions">
        <button className="secondary" type="button" onClick={onClose} disabled={submitting}>{copy.cancel}</button>
        <button type="button" onClick={() => void confirm()} disabled={submitting}>{submitting ? copy.running : copy.confirmWorkspaceGitAction(action)}</button>
      </div>
    </section>
  </div>
}
