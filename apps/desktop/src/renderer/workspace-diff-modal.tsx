import { useEffect } from "react"
import type { DesktopWorkspaceDiff } from "../shared/protocol.js"
import type { WorkspaceDiffNavigation } from "./workspace-diff-navigation.js"

export type WorkspaceDiffModalState =
  | { status: "loading"; path: string }
  | { status: "ready"; result: DesktopWorkspaceDiff }
  | { status: "error"; path: string; message: string }

type WorkspaceDiffCopy = {
  binaryDiff: string
  close: string
  diffLoading: string
  diffPreview: string
  diffPosition: (position: number, total: number) => string
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
  onNavigate: (filePath: string) => void
  onOpenFile: (filePath: string) => void
  onRefresh: (filePath: string) => void
  state: WorkspaceDiffModalState
}) {
  const path = state.status === "ready" ? state.result.path : state.path

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.altKey || event.metaKey || event.ctrlKey) return
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return
      event.preventDefault()
      const target = event.key === "ArrowLeft" ? navigation.previous : navigation.next
      if (!target) return
      onNavigate(target)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [navigation.next, navigation.previous, onNavigate])

  return <div className="modal">
    <section className="diff-modal" role="dialog" aria-modal="true" aria-labelledby="workspace-diff-title">
      <div className="diff-modal-head">
        <div><h2 id="workspace-diff-title">{copy.diffPreview}</h2><p title={path}>{path}</p></div>
        <button className="diff-modal-close" type="button" onClick={onClose} aria-label={copy.close} title={copy.close}>×</button>
      </div>
      <div className="diff-navigation">
        <button className="diff-refresh" type="button" onClick={() => onRefresh(path)} disabled={state.status === "loading"} aria-label={copy.refreshCurrentDiff} title={copy.refreshCurrentDiff}><span className={state.status === "loading" ? "spinning" : ""} aria-hidden="true">↻</span></button>
        {navigation.total > 0 && <>
          <button type="button" onClick={() => navigation.previous && onNavigate(navigation.previous)} disabled={!navigation.previous} aria-label={copy.previousDiff} title={copy.previousDiff}><span aria-hidden="true">←</span></button>
          <span className="diff-position" aria-live="polite">{copy.diffPosition(navigation.position, navigation.total)}</span>
          <button type="button" onClick={() => navigation.next && onNavigate(navigation.next)} disabled={!navigation.next} aria-label={copy.nextDiff} title={copy.nextDiff}><span aria-hidden="true">→</span></button>
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
