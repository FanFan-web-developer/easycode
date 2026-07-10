import { describe, expect, test } from "bun:test"
import { workspaceDiffNavigation } from "../../apps/desktop/src/renderer/workspace-diff-navigation"

const files = [
  { path: "src/first.ts" },
  { path: "src/second.ts" },
  { path: "src/third.ts" },
]

describe("desktop workspace diff navigation", () => {
  test("points forward from the first changed file", () => {
    expect(workspaceDiffNavigation(files, "src/first.ts")).toEqual({
      position: 1,
      total: 3,
      previous: undefined,
      next: "src/second.ts",
    })
  })

  test("points both ways from a middle changed file", () => {
    expect(workspaceDiffNavigation(files, "src/second.ts")).toEqual({
      position: 2,
      total: 3,
      previous: "src/first.ts",
      next: "src/third.ts",
    })
  })

  test("points backward from the last changed file", () => {
    expect(workspaceDiffNavigation(files, "src/third.ts")).toEqual({
      position: 3,
      total: 3,
      previous: "src/second.ts",
      next: undefined,
    })
  })

  test("does not invent targets for empty or missing paths", () => {
    expect(workspaceDiffNavigation([], "src/missing.ts")).toEqual({ position: 0, total: 0 })
    expect(workspaceDiffNavigation(files, "src/missing.ts")).toEqual({ position: 0, total: 3 })
  })
})
