import { afterEach, describe, expect, test } from "bun:test"
import { mkdir, mkdtemp, readFile, rm, unlink, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { runWorkspaceGitAction } from "../../apps/desktop/src/main/workspace-git-action"

describe("desktop workspace Git action", () => {
  const roots: string[] = []

  afterEach(async () => {
    await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
  })

  test("stages and unstages one file without changing working-tree content", async () => {
    const root = await gitFixture()
    const file = path.join(root, "src", "app.ts")
    await writeFile(file, "export const value = 2\n")

    expect(await runWorkspaceGitAction(root, "src/app.ts", "stage")).toEqual({ action: "stage", path: "src/app.ts" })
    expect(await git(root, "diff", "--cached", "--name-only")).toBe("src/app.ts\n")
    expect(await readFile(file, "utf8")).toBe("export const value = 2\n")

    expect(await runWorkspaceGitAction(root, "src/app.ts", "unstage")).toEqual({ action: "unstage", path: "src/app.ts" })
    expect(await git(root, "diff", "--cached", "--name-only")).toBe("")
    expect(await git(root, "diff", "--name-only")).toBe("src/app.ts\n")
    expect(await readFile(file, "utf8")).toBe("export const value = 2\n")
  })

  test("stages and unstages a deletion while leaving the file deleted", async () => {
    const root = await gitFixture()
    const file = path.join(root, "src", "app.ts")
    await unlink(file)

    await runWorkspaceGitAction(root, "src/app.ts", "stage")
    expect(await git(root, "diff", "--cached", "--name-status")).toBe("D\tsrc/app.ts\n")

    await runWorkspaceGitAction(root, "src/app.ts", "unstage")
    expect(await git(root, "diff", "--cached", "--name-only")).toBe("")
    expect(await git(root, "diff", "--name-status")).toBe("D\tsrc/app.ts\n")
  })

  test("rejects paths outside the workspace and unsupported actions", async () => {
    const root = await gitFixture()
    await expect(runWorkspaceGitAction(root, "../outside.ts", "stage")).rejects.toThrow("relative path inside the workspace")
    await expect(runWorkspaceGitAction(root, "src/app.ts", "invalid" as never)).rejects.toThrow("Unsupported workspace Git action")
    await writeFile(path.join(root, "other.ts"), "export const other = true\n")
    await expect(runWorkspaceGitAction(root, ":(glob)*.ts", "stage")).rejects.toThrow()
    expect(await git(root, "diff", "--cached", "--name-only")).toBe("")
  })

  async function gitFixture() {
    const root = await mkdtemp(path.join(os.tmpdir(), "easycode-workspace-git-action-"))
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
  return stdout
}
