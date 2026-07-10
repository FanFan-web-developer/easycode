import { describe, expect, test } from "bun:test"
import { parseGitStatus } from "../../apps/desktop/src/main/workspace-status"

describe("desktop workspace status", () => {
  test("separates staged unstaged and untracked file state", () => {
    const status = parseGitStatus([
      "## main...origin/main [ahead 2, behind 1]",
      "M  staged.ts",
      " M unstaged.ts",
      "MM both.ts",
      "?? notes.txt",
    ].join("\n"), [
      "3\t1\tunstaged.ts",
      "5\t2\tboth.ts",
    ].join("\n"), [
      "7\t0\tstaged.ts",
      "11\t4\tboth.ts",
    ].join("\n"))

    expect(status).toMatchObject({ branch: "main", ahead: 2, behind: 1, clean: false, changedFiles: 4, added: 1, deleted: 0 })
    expect(status.files).toEqual([
      { path: "staged.ts", status: "M", added: 7, deleted: 0, staged: { status: "M", added: 7, deleted: 0 }, unstaged: undefined, untracked: false },
      { path: "unstaged.ts", status: "M", added: 3, deleted: 1, staged: undefined, unstaged: { status: "M", added: 3, deleted: 1 }, untracked: false },
      { path: "both.ts", status: "MM", added: 16, deleted: 6, staged: { status: "M", added: 11, deleted: 4 }, unstaged: { status: "M", added: 5, deleted: 2 }, untracked: false },
      { path: "notes.txt", status: "??", added: 0, deleted: 0, staged: undefined, unstaged: undefined, untracked: true },
    ])
  })

  test("keeps staged additions and working-tree deletions in the file summary", () => {
    const status = parseGitStatus([
      "## feature/no-upstream",
      "A  added.ts",
      " D removed.ts",
    ].join("\n"), "-\t-\tremoved.ts", "4\t0\tadded.ts")

    expect(status).toMatchObject({ branch: "feature/no-upstream", changedFiles: 2, added: 1, deleted: 1 })
    expect(status.files[0].staged).toEqual({ status: "A", added: 4, deleted: 0 })
    expect(status.files[1].unstaged).toEqual({ status: "D", added: 0, deleted: 0 })
  })

  test("reports a clean branch without inventing file scopes", () => {
    expect(parseGitStatus("## main")).toEqual({
      branch: "main",
      clean: true,
      added: 0,
      deleted: 0,
      changedFiles: 0,
      files: [],
      ahead: undefined,
      behind: undefined,
    })
  })
})
