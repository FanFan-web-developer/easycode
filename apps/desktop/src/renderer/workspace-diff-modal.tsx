import type { DesktopWorkspaceDiff } from "../shared/protocol.js"

export type WorkspaceDiffModalState =
  | { status: "loading"; path: string }
  | { status: "ready"; result: DesktopWorkspaceDiff }
  | { status: "error"; path: string; message: string }

type WorkspaceDiffCopy = {
  binaryDiff: string
  close: string
  diffLoading: string
  diffPreview: string
  diffTruncated: string
  noDiffAvailable: string
  openFileInVscode: string
}

export function WorkspaceDiffModal({ copy, onClose, onOpenFile, state }: {
  copy: WorkspaceDiffCopy
  onClose: () => void
  onOpenFile: (filePath: string) => void
  state: WorkspaceDiffModalState
}) {
  const path = state.status === "ready" ? state.result.path : state.path
  return <div className="modal">
    <section className="diff-modal" role="dialog" aria-modal="true" aria-labelledby="workspace-diff-title">
      <div className="diff-modal-head">
        <div><h2 id="workspace-diff-title">{copy.diffPreview}</h2><p title={path}>{path}</p></div>
        <button className="diff-modal-close" type="button" onClick={onClose} aria-label={copy.close} title={copy.close}>×</button>
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
