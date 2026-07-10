import { describe, expect, test } from "bun:test"
import type { DesktopWorkspaceChange } from "../../apps/desktop/src/shared/protocol"
import { workspaceChangeGroups, workspaceChangePaths } from "../../apps/desktop/src/renderer/workspace-change-groups"

const files: DesktopWorkspaceChange[] = [
  { path: "staged.ts", status: "M", added: 7, deleted: 0, staged: { status: "M", added: 7, deleted: 0 }, untracked: false },
  { path: "unstaged.ts", status: "M", added: 3, deleted: 1, unstaged: { status: "M", added: 3, deleted: 1 }, untracked: false },
  { path: "both.ts", status: "MM", added: 16, deleted: 6, staged: { status: "M", added: 11, deleted: 4 }, unstaged: { status: "M", added: 5, deleted: 2 }, untracked: false },
  { path: "notes.txt", status: "??", added: 0, deleted: 0, untracked: true },
]

describe("desktop workspace change groups", () => {
  test("groups each file by real git scope and keeps scoped stats", () => {
    expect(workspaceChangeGroups(files)).toEqual([
      { scope: "staged", rows: [
        { path: "staged.ts", status: "M", added: 7, deleted: 0, scope: "staged" },
        { path: "both.ts", status: "M", added: 11, deleted: 4, scope: "staged" },
      ] },
      { scope: "unstaged", rows: [
        { path: "unstaged.ts", status: "M", added: 3, deleted: 1, scope: "unstaged" },
        { path: "both.ts", status: "M", added: 5, deleted: 2, scope: "unstaged" },
      ] },
      { scope: "untracked", rows: [
        { path: "notes.txt", status: "??", added: 0, deleted: 0, scope: "untracked" },
      ] },
    ])
  })

  test("keeps mixed files in both scoped navigation lists", () => {
    expect(workspaceChangePaths(files, "staged").map((file) => file.path)).toEqual(["staged.ts", "both.ts"])
    expect(workspaceChangePaths(files, "unstaged").map((file) => file.path)).toEqual(["unstaged.ts", "both.ts"])
    expect(workspaceChangePaths(files, "untracked").map((file) => file.path)).toEqual(["notes.txt"])
    expect(workspaceChangePaths(files, "all").map((file) => file.path)).toEqual(files.map((file) => file.path))
  })
})
