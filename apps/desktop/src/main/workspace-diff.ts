import { execFile } from "node:child_process"
import { lstat, open } from "node:fs/promises"
import path from "node:path"
import { promisify } from "node:util"
import type { DesktopWorkspaceDiff, DesktopWorkspaceDiffScope } from "../shared/protocol.js"

const execFileAsync = promisify(execFile)
export const workspaceDiffLimit = 200_000
const gitOutputLimit = 1_000_000

export async function readWorkspaceDiff(workspaceRoot: string, requestedPath: string, scope: DesktopWorkspaceDiffScope = "all"): Promise<DesktopWorkspaceDiff> {
  if (!workspaceDiffScopes.includes(scope)) throw new Error(`Unsupported workspace diff scope: ${String(scope)}`)
  const target = resolveDiffTarget(workspaceRoot, requestedPath)
  const exists = await isRegularFile(target.absolutePath)
  if (scope === "untracked") return readUntrackedScope(target.root, target.absolutePath, target.relativePath, exists, scope)

  const trackedDiff = await readTrackedDiff(target.root, target.relativePath, scope)

  if (trackedDiff.trim()) {
    const bounded = boundDiff(trackedDiff)
    return {
      path: target.relativePath,
      diff: bounded.diff,
      scope,
      status: "modified",
      binary: isBinaryDiff(trackedDiff),
      truncated: bounded.truncated,
      exists,
    }
  }

  if (scope === "all") return readUntrackedScope(target.root, target.absolutePath, target.relativePath, exists, scope)

  return {
    path: target.relativePath,
    diff: "",
    scope,
    status: "clean",
    binary: false,
    truncated: false,
    exists,
  }
}

const workspaceDiffScopes: readonly DesktopWorkspaceDiffScope[] = ["all", "staged", "unstaged", "untracked"]

async function readTrackedDiff(root: string, relativePath: string, scope: Exclude<DesktopWorkspaceDiffScope, "untracked">) {
  if (scope === "staged") return runGit(root, ["diff", "--no-ext-diff", "--no-textconv", "--unified=3", "--cached", "--", relativePath])
  if (scope === "unstaged") return runGit(root, ["diff", "--no-ext-diff", "--no-textconv", "--unified=3", "--", relativePath])
  const args = ["diff", "--no-ext-diff", "--no-textconv", "--unified=3", "HEAD", "--", relativePath]
  try {
    return await runGit(root, args)
  } catch {
    const [staged, working] = await Promise.all([
      runGit(root, ["diff", "--no-ext-diff", "--no-textconv", "--unified=3", "--cached", "--", relativePath]),
      runGit(root, ["diff", "--no-ext-diff", "--no-textconv", "--unified=3", "--", relativePath]),
    ])
    return [staged, working].filter((value) => value.trim()).join("\n")
  }
}

async function readUntrackedScope(root: string, absolutePath: string, relativePath: string, exists: boolean, scope: DesktopWorkspaceDiffScope): Promise<DesktopWorkspaceDiff> {
  const porcelain = await runGit(root, ["status", "--porcelain=v1", "--untracked-files=all", "--", relativePath])
  if (!porcelain.split("\n").some((line) => line.startsWith("??"))) {
    return { path: relativePath, diff: "", scope, status: "clean", binary: false, truncated: false, exists }
  }
  if (!exists) throw new Error("Diff preview only supports regular workspace files.")
  return readUntrackedDiff(absolutePath, relativePath, scope)
}

async function readUntrackedDiff(absolutePath: string, relativePath: string, scope: DesktopWorkspaceDiffScope): Promise<DesktopWorkspaceDiff> {
  const handle = await open(absolutePath, "r")
  try {
    const buffer = Buffer.alloc(workspaceDiffLimit + 1)
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0)
    const truncated = bytesRead > workspaceDiffLimit
    const bytes = buffer.subarray(0, Math.min(bytesRead, workspaceDiffLimit))
    if (bytes.includes(0)) {
      return { path: relativePath, diff: "", scope, status: "untracked", binary: true, truncated, exists: true }
    }

    const text = bytes.toString("utf8").replace(/\r\n/g, "\n")
    const hasTrailingNewline = text.endsWith("\n")
    const content = hasTrailingNewline ? text.slice(0, -1) : text
    const lines = content ? content.split("\n") : []
    const diff = [
      `diff --git a/${relativePath} b/${relativePath}`,
      "new file mode 100644",
      "--- /dev/null",
      `+++ b/${relativePath}`,
      `@@ -0,0 +1,${lines.length} @@`,
      ...lines.map((line) => `+${line}`),
      ...(!hasTrailingNewline && lines.length > 0 ? ["\\ No newline at end of file"] : []),
    ].join("\n")
    const bounded = boundDiff(diff, truncated)
    return { path: relativePath, diff: bounded.diff, scope, status: "untracked", binary: false, truncated: bounded.truncated, exists: true }
  } finally {
    await handle.close()
  }
}

async function runGit(root: string, args: string[]) {
  const { stdout } = await execFileAsync("git", args, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: gitOutputLimit,
  })
  return String(stdout)
}

function resolveDiffTarget(workspaceRoot: string, requestedPath: string) {
  const cleanPath = requestedPath.trim().replace(/^["']|["']$/g, "")
  if (!cleanPath || path.isAbsolute(cleanPath) || cleanPath.includes("\0") || cleanPath.split(/[\\/]/).some((part) => part === "..")) {
    throw new Error("File must be a relative path inside the workspace.")
  }
  const root = path.resolve(workspaceRoot)
  const absolutePath = path.resolve(root, cleanPath)
  const relativePath = path.relative(root, absolutePath)
  if (!relativePath || relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error("File must be a relative path inside the workspace.")
  }
  return {
    root,
    absolutePath,
    relativePath: relativePath.split(path.sep).join("/"),
  }
}

async function isRegularFile(filePath: string) {
  try {
    return (await lstat(filePath)).isFile()
  } catch {
    return false
  }
}

function isBinaryDiff(diff: string) {
  return /(^|\n)(Binary files .* differ|GIT binary patch)(\n|$)/.test(diff)
}

function boundDiff(diff: string, alreadyTruncated = false) {
  if (diff.length <= workspaceDiffLimit) return { diff, truncated: alreadyTruncated }
  return { diff: diff.slice(0, workspaceDiffLimit), truncated: true }
}
