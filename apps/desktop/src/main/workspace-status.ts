import type { DesktopWorkspaceChange, DesktopWorkspaceChangeScope, DesktopWorkspaceStatus } from "../shared/protocol.js"

export function parseGitStatus(output: string, unstagedNumstat = "", stagedNumstat = ""): DesktopWorkspaceStatus {
  const lines = output.trim().split("\n").filter(Boolean)
  const branchLine = lines.find((line) => line.startsWith("## "))
  const branchInfo = parseBranchLine(branchLine)
  const unstagedStats = parseGitNumstat(unstagedNumstat)
  const stagedStats = parseGitNumstat(stagedNumstat)
  const files: DesktopWorkspaceChange[] = []
  let added = 0
  let deleted = 0

  for (const line of lines) {
    if (line.startsWith("## ")) continue
    const status = line.slice(0, 2)
    const filePath = normalizeGitStatusPath(line.slice(3).trim())
    const untracked = status === "??"
    const staged = untracked ? undefined : changeScope(status[0], stagedStats.get(filePath))
    const unstaged = untracked ? undefined : changeScope(status[1], unstagedStats.get(filePath))
    files.push({
      path: filePath,
      status: status.trim() || "M",
      added: (staged?.added ?? 0) + (unstaged?.added ?? 0),
      deleted: (staged?.deleted ?? 0) + (unstaged?.deleted ?? 0),
      staged,
      unstaged,
      untracked,
    })
    if (status.includes("A") || untracked) added += 1
    if (status.includes("D")) deleted += 1
  }

  return {
    branch: branchInfo.branch,
    clean: files.length === 0,
    added,
    deleted,
    changedFiles: files.length,
    files,
    ahead: branchInfo.ahead,
    behind: branchInfo.behind,
  }
}

function changeScope(status: string | undefined, stats: { added: number; deleted: number } | undefined): DesktopWorkspaceChangeScope | undefined {
  if (!status || status === " " || status === "?" || status === "!") return undefined
  return { status, added: stats?.added ?? 0, deleted: stats?.deleted ?? 0 }
}

function parseGitNumstat(output: string) {
  const stats = new Map<string, { added: number; deleted: number }>()
  for (const line of output.trim().split("\n").filter(Boolean)) {
    const [addedText, deletedText, ...pathParts] = line.split("\t")
    const filePath = normalizeGitStatusPath(pathParts.join("\t").trim())
    if (!filePath) continue
    stats.set(filePath, {
      added: parseNumstatValue(addedText),
      deleted: parseNumstatValue(deletedText),
    })
  }
  return stats
}

function parseNumstatValue(value: string | undefined) {
  if (!value || value === "-") return 0
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : 0
}

function normalizeGitStatusPath(filePath: string) {
  const renamed = filePath.split(" -> ").at(-1) ?? filePath
  return renamed.replace(/^"|"$/g, "")
}

function parseBranchLine(line: string | undefined) {
  if (!line) return { branch: "unknown" }
  const body = line.slice(3)
  const [branchPart, trackingPart] = body.split("...")
  const branch = branchPart || "unknown"
  const ahead = trackingPart?.match(/ahead (\d+)/)?.[1]
  const behind = trackingPart?.match(/behind (\d+)/)?.[1]
  return {
    branch,
    ahead: ahead ? Number(ahead) : undefined,
    behind: behind ? Number(behind) : undefined,
  }
}
