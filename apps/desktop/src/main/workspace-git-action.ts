import { execFile } from "node:child_process"
import { promisify } from "node:util"
import type { DesktopWorkspaceGitAction, DesktopWorkspaceGitActionResult } from "../shared/protocol.js"
import { resolveWorkspaceRelativePath } from "./workspace-path.js"

const execFileAsync = promisify(execFile)
const gitOutputLimit = 1_000_000
const workspaceGitActions: readonly DesktopWorkspaceGitAction[] = ["stage", "unstage"]

export async function runWorkspaceGitAction(workspaceRoot: string, requestedPath: string, action: DesktopWorkspaceGitAction): Promise<DesktopWorkspaceGitActionResult> {
  if (!workspaceGitActions.includes(action)) throw new Error(`Unsupported workspace Git action: ${String(action)}`)
  const target = resolveWorkspaceRelativePath(workspaceRoot, requestedPath)
  const args = action === "stage" ? ["--literal-pathspecs", "add", "--", target.relativePath] : ["--literal-pathspecs", "reset", "--", target.relativePath]
  await execFileAsync("git", args, { cwd: target.root, encoding: "utf8", maxBuffer: gitOutputLimit })
  return { action, path: target.relativePath }
}
