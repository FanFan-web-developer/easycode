import { execFile } from "node:child_process"
import { lstat, open } from "node:fs/promises"
import path from "node:path"
import { promisify } from "node:util"
import type { DesktopWorkspaceDiff } from "../shared/protocol.js"

const execFileAsync = promisify(execFile)
export const workspaceDiffLimit = 200_000
const gitOutputLimit = 1_000_000

export async function readWorkspaceDiff(workspaceRoot: string, requestedPath: string): Promise<DesktopWorkspaceDiff> {
  const target = resolveDiffTarget(workspaceRoot, requestedPath)
  const exists = await isRegularFile(target.absolutePath)
  const trackedDiff = await readTrackedDiff(target.root, target.relativePath)

  if (trackedDiff.trim()) {
    const bounded = boundDiff(trackedDiff)
    return {
      path: target.relativePath,
      diff: bounded.diff,
      status: "modified",
      binary: isBinaryDiff(trackedDiff),
      truncated: bounded.truncated,
      exists,
    }
  }

  const porcelain = await runGit(target.root, ["status", "--porcelain=v1", "--untracked-files=all", "--", target.relativePath])
  if (porcelain.split("\n").some((line) => line.startsWith("??"))) {
    if (!exists) throw new Error("Diff preview only supports regular workspace files.")
    return readUntrackedDiff(target.absolutePath, target.relativePath)
  }

  return {
    path: target.relativePath,
    diff: "",
    status: "clean",
    binary: false,
    truncated: false,
    exists,
  }
}

async function readTrackedDiff(root: string, relativePath: string) {
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

async function readUntrackedDiff(absolutePath: string, relativePath: string): Promise<DesktopWorkspaceDiff> {
  const handle = await open(absolutePath, "r")
  try {
    const buffer = Buffer.alloc(workspaceDiffLimit + 1)
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0)
    const truncated = bytesRead > workspaceDiffLimit
    const bytes = buffer.subarray(0, Math.min(bytesRead, workspaceDiffLimit))
    if (bytes.includes(0)) {
      return { path: relativePath, diff: "", status: "untracked", binary: true, truncated, exists: true }
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
    return { path: relativePath, diff: bounded.diff, status: "untracked", binary: false, truncated: bounded.truncated, exists: true }
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
