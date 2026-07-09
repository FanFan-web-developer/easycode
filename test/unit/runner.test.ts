import { describe, expect, test } from "bun:test"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { AgentRunner } from "../../src/agent"
import { buildSubagentTaskPrompt } from "../../src/agent/runner/helpers"
import { PlanTracker } from "../../src/agent/planner"
import { prepareProviderTurnRequest } from "../../src/agent/runner/runner-turn-prep"
import { recordToolOutcome } from "../../src/agent/runner/tool-execution"
import { runValidatedProviderTurnLoop } from "../../src/agent/runner/validated-provider-turn"
import { textMessage } from "../../src/message"
import { createBuiltinRegistry } from "../../src/tool"
import { createProvider } from "../../src/provider"
import { PermissionService, defaultPermissionRules } from "../../src/permission"
import { ContextManager } from "../../src/context"
import type { LogEvent } from "../../src/logger"
import type { ProviderTurnResult } from "../../src/agent/runner/provider-turn"
import type { Provider, ProviderEvent } from "../../src/provider"

async function tmpdir() {
  return mkdtemp(path.join(os.tmpdir(), "easycode-runner-"))
}

describe("agent runner ui events", () => {
  test("subagent task prompts are role-specific and reuse prior subagent results compactly", () => {
    const prompt = buildSubagentTaskPrompt({
      requestId: 1,
      role: "explorer",
      task: "Inspect src/add.ts",
      successCriteria: "Identify the exported function.",
      maxProviderCalls: 8,
    }, "current_plan_id=plan_1\n".repeat(80), "summary ".repeat(200), [
      JSON.stringify({ role: "reviewer", status: "succeeded", summary: "Previous reviewer found src/add.ts returns a - b." }),
    ])

    expect(prompt).toContain("Role Contract:")
    expect(prompt).toContain("Collect repo-local facts only")
    expect(prompt).toContain("deterministic tool failure")
    expect(prompt).toContain("Use at most 8 model turns")
    expect(prompt).toContain("Prior Subagent Conclusions In This Run:")
    expect(prompt).toContain("returns a - b")
    expect(prompt).toContain("[truncated]")
    expect(prompt).not.toContain("current_plan_id=plan_1\n".repeat(80))
  })

  test("subagent task prompts cap prior subagent conclusions to the most recent bounded subset", () => {
    const prompt = buildSubagentTaskPrompt({
      requestId: 2,
      role: "reviewer",
      task: "Review the latest bounded slice.",
      maxProviderCalls: 5,
    }, "", undefined, [
      "Result 1 " + "alpha ".repeat(80),
      "Result 2 " + "beta ".repeat(80),
      "Result 3 " + "gamma ".repeat(80),
      "Result 4 " + "delta ".repeat(80),
    ])

    expect(prompt).toContain("Prior Subagent Conclusions In This Run:")
    expect(prompt).not.toContain("Result 1")
    expect(prompt).toContain("Result 2")
    expect(prompt).toContain("Result 4")
    expect(prompt).toContain("[truncated]")
  })

  test("subagent task prompts include wall clock and assigned step timeout budgets", () => {
    const prompt = buildSubagentTaskPrompt({
      requestId: 3,
      role: "tester",
      task: "Run bounded checks",
      maxProviderCalls: 2,
      timeoutMs: 1_500,
      assignedStep: {
        planId: "plan_timeout",
        stepId: "step_1",
        goal: "Verify bounded execution",
        timeoutMs: 1_500,
      },
    }, "", undefined)

    expect(prompt).toContain("Wall Clock Timeout:")
    expect(prompt).toContain("Finish or hand off within 1500ms.")
    expect(prompt).toContain("Timeout: 1500ms")
  })

  test("validated provider loop retries plan-gate violations without converting them into provider errors", async () => {
    let attempts = 0
    const invalidTurn: ProviderTurnResult = {
      text: "Here is a plain status update instead of a plan.",
      reasoningText: "",
      toolCalls: [],
      replayEvents: [],
    }

    const result = await runValidatedProviderTurnLoop({
      runProviderTurn: async () => {
        attempts += 1
        return invalidTurn
      },
      emitProviderTurn: () => {},
      updateActiveHypothesis: () => {},
      recordHypothesisViolation: () => {},
      hypothesisCorrectionMessage: () => "hypothesis correction",
      validateTurn: () => ({
        correction: "Planning mode hard gate:\n- Return a proposal plan.",
        failureText: "Planning mode hard gate failed.",
      }),
      evidenceRevision: 0,
    }, {
      agent: { kind: "build", name: "run", depth: 0, mode: "build", tools: "enabled", systemPrompt: "test" },
      prompt: "review the code",
      messages: [],
      providerMessages: [],
      tools: [],
    })

    expect(attempts).toBe(2)
    expect(result.failureText).toBeUndefined()
    expect(result.retryMessage).toContain("Planning mode hard gate")
    expect(result.validationFailureCount).toBe(2)
    expect(result.lastRejectedTurn).toEqual({
      text: "Here is a plain status update instead of a plan.",
      reasoningText: "",
      toolNames: [],
    })
    expect(result.toolCalls).toHaveLength(0)
  })

  test("validated provider loop returns provider failures without running plan gates", async () => {
    let validationCalls = 0
    let emittedFailure = false
    const result = await runValidatedProviderTurnLoop({
      runProviderTurn: async () => ({
        text: "",
        reasoningText: "",
        toolCalls: [],
        failureText: "Unable to connect. Is the computer able to access the url?",
        replayEvents: [{ type: "failure", text: "Unable to connect. Is the computer able to access the url?", source: "provider", category: "network" }],
      }),
      emitProviderTurn: (turn) => {
        emittedFailure = turn.failureText?.includes("Unable to connect") ?? false
      },
      updateActiveHypothesis: () => {},
      recordHypothesisViolation: () => {},
      hypothesisCorrectionMessage: () => "hypothesis correction",
      validateTurn: () => {
        validationCalls += 1
        return {
          correction: "Planning mode hard gate:\n- Return a proposal plan.",
          failureText: "Planning mode hard gate failed.",
        }
      },
      evidenceRevision: 0,
    }, {
      agent: { kind: "build", name: "run", depth: 0, mode: "build", tools: "enabled", systemPrompt: "test" },
      prompt: "review the code",
      messages: [],
      providerMessages: [],
      tools: [],
    })

    expect(result.failureText).toContain("Unable to connect")
    expect(result.retryMessage).toBeUndefined()
    expect(result.validationFailureCount).toBeUndefined()
    expect(validationCalls).toBe(0)
    expect(emittedFailure).toBe(true)
  })

  test("validated provider loop accepts raw proposed plan text without forcing plan_exit", async () => {
    const result = await runValidatedProviderTurnLoop({
      runProviderTurn: async () => ({
        text: "<proposed_plan>\n# Plan\n- Inspect\n</proposed_plan>",
        reasoningText: "",
        toolCalls: [],
        replayEvents: [],
      }),
      emitProviderTurn: () => {},
      updateActiveHypothesis: () => {},
      recordHypothesisViolation: () => {},
      hypothesisCorrectionMessage: () => "hypothesis correction",
      validateTurn: (turn) => turn.text.includes("<proposed_plan>")
        ? undefined
        : { correction: "need plan", failureText: "failed" },
      evidenceRevision: 0,
    }, {
      agent: { kind: "build", name: "run", depth: 0, mode: "build", tools: "enabled", systemPrompt: "test" },
      prompt: "plan the work",
      messages: [],
      providerMessages: [],
      tools: [],
    })

    expect(result.retryMessage).toBeUndefined()
    expect(result.text).toContain("<proposed_plan>")
  })

  test("validated provider loop appends correction messages as system prompts", async () => {
    const observedMessages: Array<Array<{ role: string; content: string }>> = []
    await runValidatedProviderTurnLoop({
      runProviderTurn: async (input) => {
        observedMessages.push(input.providerMessages.map((message) => ({ role: message.role, content: message.content })))
        return {
          text: observedMessages.length >= 2 ? "<proposed_plan>\n# Plan\n- Fix\n</proposed_plan>" : "not a plan",
          reasoningText: "",
          toolCalls: [],
          replayEvents: [],
        }
      },
      emitProviderTurn: () => {},
      updateActiveHypothesis: () => {},
      recordHypothesisViolation: () => {},
      hypothesisCorrectionMessage: () => "hypothesis correction",
      validateTurn: (turn) => turn.text.includes("<proposed_plan>")
        ? undefined
        : { correction: "Return a proposed plan.", failureText: "Planning mode hard gate failed." },
      evidenceRevision: 0,
    }, {
      agent: { kind: "build", name: "run", depth: 0, mode: "build", tools: "enabled", systemPrompt: "test" },
      prompt: "plan the work",
      messages: [],
      providerMessages: [{ role: "user", content: "plan the work" }],
      tools: [],
    })

    expect(observedMessages).toHaveLength(2)
    expect(observedMessages[0]).toEqual([{ role: "user", content: "plan the work" }])
    expect(observedMessages[1]).toEqual([
      { role: "user", content: "plan the work" },
      { role: "system", content: "Return a proposed plan." },
    ])
  })

  test("runner surfaces retry messages and falls back after repeated plan-gate failures", async () => {
    const root = await tmpdir()
    try {
      const events: string[] = []
      let providerCalls = 0
      const provider: Provider = {
        name: "custom",
        capabilities: {
          apiStyle: "local",
          supportsImages: false,
          supportsThinking: false,
          supportsReasoningEffort: false,
          effortValues: [],
          supportsJsonObjectResponse: false,
          supportsMaxOutputTokens: false,
          promptCacheMode: "none",
        },
        async *stream(): AsyncGenerator<ProviderEvent, void, unknown> {
          providerCalls += 1
          yield { type: "text_delta", text: "status only, no plan" }
          yield { type: "done" }
        },
      }

      const runner = new AgentRunner({
        root,
        provider,
        registry: createBuiltinRegistry(),
        permission: PermissionService.autoApprove(defaultPermissionRules("build")),
        forcePlanning: true,
        onEvent: (event) => {
          if (event.type === "failure") events.push(event.text)
        },
      })

      const result = await runner.run("review 当前代码", "build")

      expect(providerCalls).toBe(2)
      expect(result.status).toBe("completed")
      expect(result.text).toContain("<proposed_plan>")
      expect(result.text).toContain("Fallback Investigation Plan")
      expect(events.some((text) => text.includes("Planning mode hard gate"))).toBe(false)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("runner injects a stronger review planning template for review prompts", async () => {
    const root = await tmpdir()
    try {
      const capturedSystemMessages: string[] = []
      const provider: Provider = {
        name: "custom",
        capabilities: {
          apiStyle: "local",
          supportsImages: false,
          supportsThinking: false,
          supportsReasoningEffort: false,
          effortValues: [],
          supportsJsonObjectResponse: false,
          supportsMaxOutputTokens: false,
          promptCacheMode: "none",
        },
        async *stream(input): AsyncGenerator<ProviderEvent, void, unknown> {
          capturedSystemMessages.push(...input.providerMessages.filter((message) => message.role === "system").map((message) => message.content))
          yield { type: "text_delta", text: "<proposed_plan>\n# Review Plan\n- Research\n</proposed_plan>" }
          yield { type: "done" }
        },
      }

      const runner = new AgentRunner({
        root,
        provider,
        registry: createBuiltinRegistry(),
        permission: PermissionService.autoApprove(defaultPermissionRules("build")),
        forcePlanning: true,
      })

      const result = await runner.run("review 当前代码", "build")

      expect(result.status).toBe("completed")
      expect(capturedSystemMessages.some((content) => content.includes("Review Planning Gate Template:"))).toBe(true)
      expect(capturedSystemMessages.some((content) => content.includes("Call plan_exit with a low-risk review plan once the review scope is clear."))).toBe(true)
      expect(capturedSystemMessages.some((content) => content.includes("first use git_diff in summary/files/stat mode"))).toBe(true)
      expect(capturedSystemMessages.some((content) => content.includes("Delegation is optional"))).toBe(true)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("planning mode exposes only narrow bounded inspection tools before the plan hard gate", async () => {
    const root = await tmpdir()
    try {
      let providerCalls = 0
      let firstTurnTools: string[] = []
      const provider: Provider = {
        name: "custom",
        capabilities: {
          apiStyle: "local",
          supportsImages: false,
          supportsThinking: false,
          supportsReasoningEffort: false,
          effortValues: [],
          supportsJsonObjectResponse: false,
          supportsMaxOutputTokens: false,
          promptCacheMode: "none",
        },
        async *stream(input): AsyncGenerator<ProviderEvent, void, unknown> {
          providerCalls += 1
          if (providerCalls === 1) firstTurnTools = input.tools.map((tool) => tool.name)
          const corrections = input.providerMessages
            .filter((message) => message.role === "system")
            .map((message) => message.content)
            .join("\n")
          if (providerCalls === 1) {
            expect(corrections.includes("Coordinator delegation gate")).toBe(false)
            yield { type: "text_delta", text: "<proposed_plan>\n# Plan\n- Inspect src/add.ts\n</proposed_plan>" }
            yield { type: "done" }
            return
          }
        },
      }

      const runner = new AgentRunner({
        root,
        provider,
        registry: createBuiltinRegistry(),
        permission: PermissionService.autoApprove(defaultPermissionRules("build")),
        forcePlanning: true,
      })

      const result = await runner.run("review 当前代码", "build")

      expect(providerCalls).toBe(1)
      expect(result.status).toBe("completed")
      expect(firstTurnTools).toEqual(["rg_search", "read_lines", "find_definition", "find_references", "call_graph", "repo_map", "git_diff", "git_status", "plan_exit"])
      expect(result.usedTools).toEqual([])
      expect(result.text).toContain("# Plan")
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("read-only review build prompts expose a narrow inspection toolset", async () => {
    const root = await tmpdir()
    try {
      let toolNames: string[] = []
      const events: LogEvent[] = []
      const provider: Provider = {
        name: "custom",
        capabilities: {
          apiStyle: "local",
          supportsImages: false,
          supportsThinking: false,
          supportsReasoningEffort: false,
          effortValues: [],
          supportsJsonObjectResponse: false,
          supportsMaxOutputTokens: false,
          promptCacheMode: "none",
        },
        async *stream(input): AsyncGenerator<ProviderEvent, void, unknown> {
          toolNames = input.tools.map((tool) => tool.name)
          yield { type: "text_delta", text: "Review summary: no findings." }
          yield { type: "done" }
        },
      }

      const runner = new AgentRunner({
        root,
        provider,
        registry: createBuiltinRegistry(),
        permission: PermissionService.autoApprove(defaultPermissionRules("build")),
        logger: ((event: LogEvent) => events.push(event)),
      })

      const result = await runner.run("review 当前代码", "build")

      expect(result.status).toBe("completed")
      expect(toolNames).toEqual(["rg_search", "read_lines", "find_definition", "find_references", "call_graph", "repo_map", "git_diff", "git_status"])
      expect(toolNames).not.toContain("patch")
      expect(toolNames).not.toContain("edit")
      expect(toolNames).not.toContain("git_stage")
      expect(toolNames).not.toContain("git_commit")
      const toolsetEvent = events.find((event) => event.name === "provider.toolset")
      expect(toolsetEvent?.detail).toMatchObject({
        reason: "read_only_review",
        narrowed: true,
        requestedToolCount: 8,
        availableToolCount: 8,
      })
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("coordinator delegation retries do not upgrade when delegate_subagent is already available", async () => {
    const root = await tmpdir()
    try {
      await mkdir(path.join(root, "src"), { recursive: true })
      await writeFile(path.join(root, "src", "add.ts"), "export const add = (a: number, b: number) => a + b\n")
      const context = new ContextManager()
      await PlanTracker.activatePlan(context, root, "default", {
        id: "plan_review_upgrade",
        title: "Review current diff",
        lowRisk: true,
        steps: [
          {
            id: "step_1",
            goal: "Review current changes for regressions",
            kind: "inspect",
            doneWhen: "The review findings are summarized.",
          },
        ],
      }, {
        currentStepId: "step_1",
        stepStatuses: { step_1: "running" },
        status: "running",
      })

      const toolsets: string[][] = []
      const events: LogEvent[] = []
      const provider: Provider = {
        name: "custom",
        capabilities: {
          apiStyle: "local",
          supportsImages: false,
          supportsThinking: false,
          supportsReasoningEffort: false,
          effortValues: [],
          supportsJsonObjectResponse: false,
          supportsMaxOutputTokens: false,
          promptCacheMode: "none",
        },
        async *stream(input): AsyncGenerator<ProviderEvent, void, unknown> {
          toolsets.push(input.tools.map((tool) => tool.name))
          if (toolsets.length <= 2) {
            yield { type: "tool_call", call: { id: `call_rg_${toolsets.length}`, name: "rg_search", input: { query: "add", dir: "src", maxResults: 10 } } }
            yield { type: "done" }
            return
          }
          yield { type: "text_delta", text: "Review summary: no findings after delegation bypass." }
          yield { type: "done" }
        },
      }

      const result = await new AgentRunner({
        root,
        provider,
        context,
        registry: createBuiltinRegistry(),
        permission: PermissionService.autoApprove(defaultPermissionRules("build")),
        logger: ((event: LogEvent) => events.push(event)),
      }).run("review 当前代码", "build")

      expect(result.status).toBe("completed")
      expect(toolsets[0]).toEqual(["rg_search", "read_lines", "find_definition", "find_references", "call_graph", "repo_map", "git_diff", "git_status", "delegate_subagent", "plan_step_complete", "plan_step_fail"])
      expect(toolsets[1]).toEqual(toolsets[0])
      expect(toolsets[2]).toEqual(toolsets[0])
      expect(toolsets[2]).not.toContain("patch")
      expect(toolsets[2]).not.toContain("git_commit")
      expect(events.some((event) => event.name === "provider.toolset_upgrade")).toBe(false)
      expect(events.filter((event) => event.name === "provider.toolset").at(-1)?.detail).toMatchObject({
        narrowed: true,
        reason: "active_plan_read_only_review",
      })
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("active read-only review plan steps expose delegate_subagent with the narrow toolset", async () => {
    const root = await tmpdir()
    try {
      const context = new ContextManager()
      await PlanTracker.activatePlan(context, root, "default", {
        id: "plan_review_tools",
        title: "Review current diff",
        lowRisk: true,
        steps: [
          {
            id: "step_1",
            goal: "Review current changes for regressions",
            kind: "inspect",
            doneWhen: "The review findings are summarized.",
          },
        ],
      }, {
        currentStepId: "step_1",
        stepStatuses: { step_1: "running" },
        status: "running",
      })

      let toolNames: string[] = []
      const provider: Provider = {
        name: "custom",
        capabilities: {
          apiStyle: "local",
          supportsImages: false,
          supportsThinking: false,
          supportsReasoningEffort: false,
          effortValues: [],
          supportsJsonObjectResponse: false,
          supportsMaxOutputTokens: false,
          promptCacheMode: "none",
        },
        async *stream(input): AsyncGenerator<ProviderEvent, void, unknown> {
          toolNames = input.tools.map((tool) => tool.name)
          yield { type: "text_delta", text: "Review summary: no findings." }
          yield { type: "done" }
        },
      }

      const result = await new AgentRunner({
        root,
        provider,
        context,
        registry: createBuiltinRegistry(),
        permission: PermissionService.autoApprove(defaultPermissionRules("build")),
      }).run("review 当前代码", "build")

      expect(result.status).toBe("completed")
      expect(toolNames).toEqual(["rg_search", "read_lines", "find_definition", "find_references", "call_graph", "repo_map", "git_diff", "git_status", "delegate_subagent", "plan_step_complete", "plan_step_fail"])
      expect(toolNames).not.toContain("patch")
      expect(toolNames).not.toContain("edit")
      expect(toolNames).not.toContain("git_stage")
      expect(toolNames).not.toContain("git_commit")
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("active plan steps suppress the exploration checkpoint prompt", () => {
    const context = new ContextManager()
    context.add(textMessage("user", "Review the current changes"))
    const prepared = prepareProviderTurnRequest({
      context,
      step: 7,
      maxSteps: 10,
      agent: { kind: "build", name: "run", depth: 0, mode: "build", tools: "enabled", systemPrompt: "test" },
      instructions: [],
      skills: [],
      selectedSkills: [],
      pendingSkillLoads: [],
      tools: [],
      usedTools: ["git_diff", "read_lines"],
      activeHypothesisMessages: [],
      activePlanStepId: "step_5",
    })

    expect(prepared.providerMessages.some((message) => message.content.includes("Exploration checkpoint reached"))).toBe(false)
  })

  test("active plan steps still receive context budget checkpoints", () => {
    const context = new ContextManager()
    context.add(textMessage("user", "Review the current changes"))
    const prepared = prepareProviderTurnRequest({
      context,
      step: 4,
      maxSteps: 66,
      agent: { kind: "build", name: "run", depth: 0, mode: "build", tools: "enabled", systemPrompt: "test" },
      instructions: [],
      skills: [],
      selectedSkills: [],
      pendingSkillLoads: [],
      tools: [{ name: "git_diff" } as never],
      usedTools: Array.from({ length: 8 }, () => "git_diff"),
      activeHypothesisMessages: [],
      activePlanStepId: "step_3",
    })

    expect(prepared.availableTools).toEqual([])
    expect(prepared.providerMessages.some((message) => message.content.includes("Context budget checkpoint reached"))).toBe(true)
    expect(prepared.providerMessages.some((message) => message.content.includes("plan_step_complete"))).toBe(true)
  })

  test("emits immediate provider wait state after a tool result before the next model output", async () => {
    const root = await tmpdir()
    try {
      const skillDir = path.join(root, ".easycode", "skills", "demo")
      await mkdir(skillDir, { recursive: true })
      await Bun.write(path.join(skillDir, "SKILL.md"), "---\nname: demo\ndescription: Demo skill\n---\nDemo content")

      const events: string[] = []
      const runner = new AgentRunner({
        root,
        provider: createProvider("fake"),
        registry: createBuiltinRegistry(),
        permission: PermissionService.autoApprove(defaultPermissionRules("build")),
        onEvent: (event) => {
          if (event.type === "tool_result") events.push(`tool_result:${event.toolName}`)
          if (event.type === "provider_progress") events.push(`provider_progress:${event.elapsedMs}`)
          if (event.type === "text_delta") events.push(`text_delta:${event.text}`)
        },
      })

      const result = await runner.run("skill", "build")

      expect(result.status).toBe("completed")
      const toolResultIndex = events.indexOf("tool_result:skill")
      expect(toolResultIndex).toBeGreaterThan(-1)
      expect(events[toolResultIndex + 1]).toBe("provider_progress:0")
      expect(events.slice(toolResultIndex + 2)).toContain("text_delta:Skill loaded.")
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("selected skills and pending loads are recorded in the ledger for compaction continuity", async () => {
    const root = await tmpdir()
    try {
      const skillDir = path.join(root, ".easycode", "skills", "demo")
      await mkdir(skillDir, { recursive: true })
      await Bun.write(path.join(skillDir, "SKILL.md"), "---\nname: demo\ndescription: Demo skill\n---\nDemo content")

      const runner = new AgentRunner({
        root,
        provider: createProvider("fake"),
        registry: createBuiltinRegistry(),
        permission: PermissionService.autoApprove(defaultPermissionRules("build")),
        settings: {
          provider: "fake",
          language: "en",
          thinking: true,
          effort: "high",
          selectedSkills: ["demo"],
          pendingSkillLoads: ["demo"],
          maxTokens: 32_000,
          maxSteps: 66,
        },
      })

      await runner.run("skill", "build")
      const current = runner.context.state.ledger?.current ?? []
      expect(current).toContainEqual(expect.objectContaining({ subject: "active_skills", value: "demo" }))
      expect(current).toContainEqual(expect.objectContaining({ subject: "pending_skill_loads", value: "none" }))
      expect(current).toContainEqual(expect.objectContaining({ subject: "active_capability_surface", value: expect.stringContaining("skills=demo") }))
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("successful retrieval tools update the active capability ledger state", () => {
    const context = new ContextManager()
    context.updateLedger({
      current: [
        {
          id: "skills",
          kind: "checkpoint",
          subject: "active_skills",
          value: "demo",
          status: "current",
          createdAtTurn: 1,
          updatedAtTurn: 1,
          evidence: { source: "assistant" },
        },
      ],
    })

    recordToolOutcome(
      { context },
      { id: "call_mcp", name: "mcp_read_resource", input: { server: "local-docs", uri: "doc://agent/retrieval" } },
      { title: "Retrieval design", output: "ok", metadata: { status: "succeeded", source: { id: "local-docs:doc://agent/retrieval" } } },
      "inspect retrieval design",
      { truncateForLedger: (text) => text, compactLine: (text) => text },
    )
    recordToolOutcome(
      { context },
      { id: "call_connector", name: "connector_call", input: { name: "docs" } },
      { title: "docs", output: "ok", metadata: { status: "succeeded", connector: "docs" } },
      "inspect docs",
      { truncateForLedger: (text) => text, compactLine: (text) => text },
    )
    recordToolOutcome(
      { context },
      { id: "call_web", name: "web_search", input: { query: "prompt caching" } },
      { title: "prompt caching", output: "ok", metadata: { status: "succeeded", engine: "tavily" } },
      "inspect web evidence",
      { truncateForLedger: (text) => text, compactLine: (text) => text },
    )

    const current = context.state.ledger?.current ?? []
    expect(current).toContainEqual(expect.objectContaining({ subject: "active_mcp_servers", value: "local-docs" }))
    expect(current).toContainEqual(expect.objectContaining({ subject: "active_mcp_resources", value: "doc://agent/retrieval" }))
    expect(current).toContainEqual(expect.objectContaining({ subject: "active_connectors", value: "docs" }))
    expect(current).toContainEqual(expect.objectContaining({ subject: "active_web_search_engine", value: "tavily" }))
    expect(current).toContainEqual(expect.objectContaining({
      subject: "active_capability_surface",
      value: expect.stringContaining("mcp_servers=local-docs"),
    }))
    expect(current).toContainEqual(expect.objectContaining({
      subject: "active_capability_surface",
      value: expect.stringContaining("web_search=tavily"),
    }))
  })
})
