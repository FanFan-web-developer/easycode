import type { DesktopWorkspaceChange } from "../shared/protocol.js"

export type WorkspaceDiffNavigation = {
  position: number
  total: number
  previous?: string
  next?: string
}

export function workspaceDiffNavigation(files: readonly Pick<DesktopWorkspaceChange, "path">[], currentPath: string): WorkspaceDiffNavigation {
  const index = files.findIndex((file) => file.path === currentPath)
  if (index === -1) return { position: 0, total: files.length }
  return {
    position: index + 1,
    total: files.length,
    previous: files[index - 1]?.path,
    next: files[index + 1]?.path,
  }
}
