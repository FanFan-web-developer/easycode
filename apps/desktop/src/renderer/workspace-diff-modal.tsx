import { useEffect, useRef } from "react"
import type { DesktopWorkspaceDiff, DesktopWorkspaceDiffScope } from "../shared/protocol.js"
import { useLatestRef } from "./hooks/use-latest-ref.js"
import type { WorkspaceDiffNavigation } from "./workspace-diff-navigation.js"

export type WorkspaceDiffModalState =
  | { status: "loading"; path: string; scope: DesktopWorkspaceDiffScope }
  | { status: "ready"; result: DesktopWorkspaceDiff }
  | { status: "error"; path: string; scope: DesktopWorkspaceDiffScope; message: string }

type WorkspaceDiffCopy = {
  binaryDiff: string
  close: string
  diffLoading: string
  diffPreview: string
  diffPosition: (position: number, total: number) => string
  diffScopeLabel: (scope: DesktopWorkspaceDiffScope) => string
  diffTruncated: string
  nextDiff: string
  noDiffAvailable: string
  openFileInVscode: string
  previousDiff: string
  refreshCurrentDiff: string
}

export function WorkspaceDiffModal({ copy, navigation, onClose, onNavigate, onOpenFile, onRefresh, state }: {
  copy: WorkspaceDiffCopy
  navigation: WorkspaceDiffNavigation
  onClose: () => void
  onNavigate: (filePath: string, scope: DesktopWorkspaceDiffScope) => void
  onOpenFile: (filePath: string) => void
  onRefresh: (filePath: string, scope: DesktopWorkspaceDiffScope) => void
  state: WorkspaceDiffModalState
}) {
  const modalRef = useRef<HTMLElement>(null)
  const closeRef = useLatestRef(onClose)
  const path = state.status === "ready" ? state.result.path : state.path
  const scope = state.status === "ready" ? state.result.scope : state.scope

  useEffect(() => {
    modalRef.current?.focus()
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        closeRef.current()
        return
      }
      if (!event.altKey || event.metaKey || event.ctrlKey) return
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return
      event.preventDefault()
      const target = event.key === "ArrowLeft" ? navigation.previous : navigation.next
      if (!target) return
      onNavigate(target, scope)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [closeRef, navigation.next, navigation.previous, onNavigate, scope])

  return <div className="modal">
    <section className="diff-modal" ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="workspace-diff-title" tabIndex={-1}>
      <div className="diff-modal-head">
        <div><h2 id="workspace-diff-title">{copy.diffPreview}</h2><div className="diff-path-row"><span>{copy.diffScopeLabel(scope)}</span><p title={path}>{path}</p></div></div>
        <button className="diff-modal-close" type="button" onClick={onClose} aria-label={copy.close} title={copy.close}>×</button>
      </div>
      <div className="diff-navigation">
        <button className="diff-refresh" type="button" onClick={() => onRefresh(path, scope)} disabled={state.status === "loading"} aria-label={copy.refreshCurrentDiff} title={copy.refreshCurrentDiff}><span className={state.status === "loading" ? "spinning" : ""} aria-hidden="true">↻</span></button>
        {navigation.total > 0 && <>
          <button type="button" onClick={() => navigation.previous && onNavigate(navigation.previous, scope)} disabled={!navigation.previous} aria-label={copy.previousDiff} title={copy.previousDiff}><span aria-hidden="true">←</span></button>
          <span className="diff-position" aria-live="polite">{copy.diffPosition(navigation.position, navigation.total)}</span>
          <button type="button" onClick={() => navigation.next && onNavigate(navigation.next, scope)} disabled={!navigation.next} aria-label={copy.nextDiff} title={copy.nextDiff}><span aria-hidden="true">→</span></button>
        </>}
      </div>
      {state.status === "loading" && <div className="diff-empty">{copy.diffLoading}</div>}
      {state.status === "error" && <p className="setup-error">{state.message}</p>}
      {state.status === "ready" && <>
        {state.result.truncated && <div className="diff-notice">{copy.diffTruncated}</div>}
        {state.result.binary
          ? <div className="diff-empty">{copy.binaryDiff}</div>
          : state.result.diff
            ? <div className="diff-preview" aria-label={`${copy.diffPreview}: ${path}`}><code>{state.result.diff.split("\n").map((line, index) => <span className={`diff-line ${diffLineClass(line)}`} key={`${index}-${line}`}>{line || " "}</span>)}</code></div>
            : <div className="diff-empty">{copy.noDiffAvailable}</div>}
      </>}
      <div className="modal-actions">
        <button className="secondary" type="button" onClick={onClose}>{copy.close}</button>
        <button type="button" onClick={() => onOpenFile(path)} disabled={state.status !== "ready" || !state.result.exists}>{copy.openFileInVscode}</button>
      </div>
    </section>
  </div>
}

function diffLineClass(line: string) {
  if (line.startsWith("@@")) return "hunk"
  if (line.startsWith("+") && !line.startsWith("+++")) return "added"
  if (line.startsWith("-") && !line.startsWith("---")) return "deleted"
  if (line.startsWith("diff ") || line.startsWith("index ") || line.startsWith("---") || line.startsWith("+++")) return "header"
  return "context"
}
