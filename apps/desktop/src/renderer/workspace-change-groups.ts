import type { DesktopWorkspaceChange, DesktopWorkspaceDiffScope } from "../shared/protocol.js"

export type WorkspaceChangeRow = {
  path: string
  status: string
  added: number
  deleted: number
  scope: Exclude<DesktopWorkspaceDiffScope, "all">
}

export type WorkspaceChangeGroup = {
  scope: Exclude<DesktopWorkspaceDiffScope, "all">
  rows: WorkspaceChangeRow[]
}

export function workspaceChangeGroups(files: readonly DesktopWorkspaceChange[]): WorkspaceChangeGroup[] {
  const staged = files.flatMap((file) => file.staged ? [{ path: file.path, ...file.staged, scope: "staged" as const }] : [])
  const unstaged = files.flatMap((file) => file.unstaged ? [{ path: file.path, ...file.unstaged, scope: "unstaged" as const }] : [])
  const untracked = files.flatMap((file) => file.untracked ? [{ path: file.path, status: "??", added: file.added, deleted: file.deleted, scope: "untracked" as const }] : [])
  const groups: WorkspaceChangeGroup[] = [
    { scope: "staged", rows: staged },
    { scope: "unstaged", rows: unstaged },
    { scope: "untracked", rows: untracked },
  ]
  return groups.filter((group) => group.rows.length > 0)
}

export function workspaceChangePaths(files: readonly DesktopWorkspaceChange[], scope: DesktopWorkspaceDiffScope) {
  if (scope === "all") return files
  return workspaceChangeGroups(files).find((group) => group.scope === scope)?.rows ?? []
}
