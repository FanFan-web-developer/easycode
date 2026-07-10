import { describe, expect, test } from "bun:test"
import { composerStateAfterQueuedInput, createQueuedRunInput, dequeueQueuedRunInput, isCancelRunInput, isRunProducingSlashInput, queuedInputLabel, removeQueuedRunInput, shouldDetachActiveRunForWorkspaceSwitch, shouldQueueRunInput, shortQueuedPrompt } from "../../apps/desktop/src/renderer/run-queue"

describe("desktop run queue", () => {
  test("matches CLI cancel inputs while a run is active", () => {
    expect(isCancelRunInput("/cancel")).toBe(true)
    expect(isCancelRunInput("cancel")).toBe(true)
    expect(isCancelRunInput(":cancel")).toBe(true)
    expect(isCancelRunInput("stop")).toBe(true)
    expect(isCancelRunInput("/stop")).toBe(true)
    expect(isCancelRunInput("/settings")).toBe(false)
  })

  test("queues non-cancel input only while running", () => {
    expect(shouldQueueRunInput("next prompt", true)).toBe(true)
    expect(shouldQueueRunInput("//literal slash prompt", true)).toBe(true)
    expect(shouldQueueRunInput("/plan fix tests", true)).toBe(true)
    expect(shouldQueueRunInput("/goal ship desktop", true)).toBe(true)
    expect(shouldQueueRunInput("/settings", true)).toBe(false)
    expect(shouldQueueRunInput("/help", true)).toBe(false)
    expect(shouldQueueRunInput("/sessions", true)).toBe(false)
    expect(shouldQueueRunInput("/image clear", true)).toBe(false)
    expect(shouldQueueRunInput("/file clear", true)).toBe(false)
    expect(shouldQueueRunInput("/goal status", true)).toBe(false)
    expect(shouldQueueRunInput("/cancel", true)).toBe(false)
    expect(shouldQueueRunInput("next prompt", false)).toBe(false)
    expect(shouldQueueRunInput("   ", true)).toBe(false)
  })

  test("classifies slash commands that create a follow-up run", () => {
    expect(isRunProducingSlashInput("/plan fix tests")).toBe(true)
    expect(isRunProducingSlashInput("/goal ship desktop")).toBe(true)
    expect(isRunProducingSlashInput("/goal status")).toBe(false)
    expect(isRunProducingSlashInput("/goal pause")).toBe(false)
    expect(isRunProducingSlashInput("/goal clear")).toBe(false)
    expect(isRunProducingSlashInput("/settings")).toBe(false)
    expect(isRunProducingSlashInput("//literal slash prompt")).toBe(false)
  })

  test("formats queued input labels without resizing the composer", () => {
    expect(queuedInputLabel(0)).toBe("No queued input")
    expect(queuedInputLabel(1)).toBe("1 queued input")
    expect(queuedInputLabel(2)).toBe("2 queued inputs")
    expect(shortQueuedPrompt(` ${"x".repeat(90)} `)).toBe(`${"x".repeat(77)}...`)
  })

  test("captures queued input as an immutable run snapshot", () => {
    const draft = {
      text: "  next prompt  ",
      mode: "plan" as const,
      permissionMode: "auto-review" as const,
      images: ["/repo/screen.png"],
      files: ["/repo/src/file.ts"],
    }
    const queued = createQueuedRunInput(draft, "queue_1", 123)

    expect(queued).toEqual({
      id: "queue_1",
      text: "next prompt",
      mode: "plan",
      permissionMode: "auto-review",
      images: ["/repo/screen.png"],
      files: ["/repo/src/file.ts"],
      createdAt: 123,
    })

    draft.images.push("/repo/later.png")
    draft.files.push("/repo/src/later.ts")
    expect(queued.images).toEqual(["/repo/screen.png"])
    expect(queued.files).toEqual(["/repo/src/file.ts"])

    queued.images.push("/mutated.png")
    const second = createQueuedRunInput({ text: "next", mode: "goal", permissionMode: "ask", images: [], files: [] }, "queue_2", 124)
    expect(second.mode).toBe("goal")
    expect(second.images).toEqual([])
  })

  test("clears composer draft attachments after the queued run takes its snapshot", () => {
    const state = {
      prompt: "next prompt",
      attachments: [
        { id: "image_1", kind: "image" as const, path: "/repo/screen.png", label: "screen.png" },
        { id: "file_1", kind: "file" as const, path: "/repo/src/file.ts", label: "src/file.ts" },
      ],
    }

    const queued = createQueuedRunInput({
      text: state.prompt,
      mode: "build",
      permissionMode: "ask",
      images: state.attachments.filter((file) => file.kind === "image").map((file) => file.path),
      files: state.attachments.filter((file) => file.kind === "file").map((file) => file.path),
    }, "queue_1", 123)

    expect(queued.images).toEqual(["/repo/screen.png"])
    expect(queued.files).toEqual(["/repo/src/file.ts"])
    expect(composerStateAfterQueuedInput(state)).toEqual({ prompt: "", attachments: [] })
  })

  test("dequeues the next input only after the active run is idle", () => {
    const first = createQueuedRunInput({ text: "first", mode: "build", permissionMode: "ask", images: [], files: [] }, "queue_1", 1)
    const second = createQueuedRunInput({ text: "second", mode: "plan", permissionMode: "auto-review", images: [], files: [] }, "queue_2", 2)
    const queue = [first, second]

    expect(dequeueQueuedRunInput(queue, true)).toEqual({ next: undefined, remaining: queue })
    expect(dequeueQueuedRunInput([], false)).toEqual({ next: undefined, remaining: [] })
    expect(dequeueQueuedRunInput(queue, false)).toEqual({ next: first, remaining: [second] })
  })

  test("removes only the selected queued input", () => {
    const first = createQueuedRunInput({ text: "first", mode: "build", permissionMode: "ask", images: [], files: [] }, "queue_1", 1)
    const second = createQueuedRunInput({ text: "second", mode: "plan", permissionMode: "auto-review", images: [], files: [] }, "queue_2", 2)

    expect(removeQueuedRunInput([first, second], "queue_1")).toEqual([second])
    expect(removeQueuedRunInput([first, second], "missing")).toEqual([first, second])
  })

  test("detaches the active run lock only when switching to a different workspace", () => {
    expect(shouldDetachActiveRunForWorkspaceSwitch("/repo/a", "/repo/b", true)).toBe(true)
    expect(shouldDetachActiveRunForWorkspaceSwitch("/repo/a", "/repo/a", true)).toBe(false)
    expect(shouldDetachActiveRunForWorkspaceSwitch("/repo/a", "/repo/b", false)).toBe(false)
    expect(shouldDetachActiveRunForWorkspaceSwitch(undefined, "/repo/b", true)).toBe(false)
  })
})
