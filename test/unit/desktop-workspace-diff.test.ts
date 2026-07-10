import { afterEach, describe, expect, test } from "bun:test"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { readWorkspaceDiff, workspaceDiffLimit } from "../../apps/desktop/src/main/workspace-diff"

describe("desktop workspace diff", () => {
  const roots: string[] = []

  afterEach(async () => {
    await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
  })

  test("reads unstaged and staged changes against HEAD", async () => {
    const root = await gitFixture()
    const file = path.join(root, "src", "app.ts")

    const clean = await readWorkspaceDiff(root, "src/app.ts")
    expect(clean).toMatchObject({ status: "clean", diff: "", exists: true })

    await writeFile(file, "export const value = 2\n")

    const unstaged = await readWorkspaceDiff(root, "src/app.ts")
    expect(unstaged).toMatchObject({ path: "src/app.ts", status: "modified", binary: false, truncated: false, exists: true })
    expect(unstaged.diff).toContain("-export const value = 1")
    expect(unstaged.diff).toContain("+export const value = 2")

    await git(root, "add", "src/app.ts")
    const staged = await readWorkspaceDiff(root, "src/app.ts")
    expect(staged.diff).toContain("+export const value = 2")

    await git(root, "reset", "--hard", "HEAD")
    await rm(file)
    const deleted = await readWorkspaceDiff(root, "src/app.ts")
    expect(deleted).toMatchObject({ status: "modified", exists: false })
    expect(deleted.diff).toContain("-export const value = 1")
  })

  test("renders bounded untracked text and identifies binary files", async () => {
    const root = await gitFixture()
    await writeFile(path.join(root, "notes.txt"), `${"x".repeat(workspaceDiffLimit + 100)}\n`)
    await writeFile(path.join(root, "image.bin"), Buffer.from([0, 1, 2, 3]))

    const text = await readWorkspaceDiff(root, "notes.txt")
    expect(text).toMatchObject({ status: "untracked", binary: false, truncated: true, exists: true })
    expect(text.diff.length).toBeLessThanOrEqual(workspaceDiffLimit)
    expect(text.diff).toContain("--- /dev/null")

    const binary = await readWorkspaceDiff(root, "image.bin")
    expect(binary).toMatchObject({ status: "untracked", binary: true, exists: true })
    expect(binary.diff).toBe("")
  })

  test("rejects paths that can escape the workspace", async () => {
    const root = await gitFixture()
    await expect(readWorkspaceDiff(root, "../outside.txt")).rejects.toThrow("relative path inside the workspace")
    await expect(readWorkspaceDiff(root, path.resolve(root, "src/app.ts"))).rejects.toThrow("relative path inside the workspace")
  })

  async function gitFixture() {
    const root = await mkdtemp(path.join(os.tmpdir(), "easycode-workspace-diff-"))
    roots.push(root)
    await mkdir(path.join(root, "src"), { recursive: true })
    await writeFile(path.join(root, "src", "app.ts"), "export const value = 1\n")
    await git(root, "init")
    await git(root, "config", "user.email", "easycode@example.test")
    await git(root, "config", "user.name", "EasyCode Test")
    await git(root, "add", "src/app.ts")
    await git(root, "commit", "-m", "fixture")
    return root
  }
})

async function git(root: string, ...args: string[]) {
  const proc = Bun.spawn(["git", ...args], { cwd: root, stdout: "pipe", stderr: "pipe" })
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])
  if (exitCode !== 0) throw new Error(`git ${args.join(" ")} failed: ${stderr || stdout}`)
}
