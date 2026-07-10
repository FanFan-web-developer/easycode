import { describe, expect, test } from "bun:test"
import { failureReasonForEvalResult, missingRequiredToolCount } from "../../dev/quality/eval"
import type { AgentRunResult } from "../../src/agent"

describe("eval failure reasons", () => {
  test("preserves provider failure text for non-completed runs", () => {
    const result: AgentRunResult = {
      status: "failed",
      failureReason: "provider_error",
      text: "DeepSeek API failed: unable to get local issuer certificate\nextra detail",
      messages: [],
      usedTools: [],
      state: "failed",
    }

    expect(failureReasonForEvalResult(result)).toBe("run failed: DeepSeek API failed: unable to get local issuer certificate")
  })

  test("keeps provider diagnostic context ahead of friendly output", () => {
    const result: AgentRunResult = {
      status: "failed",
      failureReason: "provider_error",
      text: "DeepSeek API failed: Unable to connect. Is the computer able to access the url? (cause: unable to get local issuer certificate)\nWas there a typo in the url or port?",
      messages: [],
      usedTools: [],
      state: "failed",
    }

    expect(failureReasonForEvalResult(result)).toBe("run failed: DeepSeek API failed: Unable to connect. Is the computer able to access the url? (cause: unable to get local issuer certificate)")
  })

  test("returns undefined for completed runs", () => {
    const result: AgentRunResult = {
      status: "completed",
      text: "easycode real eval ok",
      messages: [],
      usedTools: [],
      state: "completed",
    }

    expect(failureReasonForEvalResult(result)).toBeUndefined()
  })

  test("detects missing required repeated tool calls", () => {
    expect(missingRequiredToolCount(["find_definition", "find_references", "edit", "find_references"], {
      find_references: 3,
      edit: 1,
    })).toEqual({
      tool: "find_references",
      actual: 2,
      minimum: 3,
    })
  })

  test("accepts required repeated tool calls when counts are met", () => {
    expect(missingRequiredToolCount(["find_definition", "find_references", "edit", "find_references", "find_references"], {
      find_references: 3,
      edit: 1,
    })).toBeUndefined()
  })
})
