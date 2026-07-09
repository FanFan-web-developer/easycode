import { Provider, ProviderInput, ProviderEvent } from "./types"
import { hasToolResult, call, latestToolResult } from "./utils"
import type { ProviderCapabilities, ProviderOptions } from "./types"
import { toolResults } from "../message"

export class FakeProvider implements Provider {
  readonly name = "fake"
  readonly model?: string
  readonly runtime: ProviderOptions
  readonly capabilities: ProviderCapabilities = { apiStyle: "local", supportsImages: true, supportsThinking: true, supportsReasoningEffort: true, effortValues: ["low", "medium", "high", "max"], supportsJsonObjectResponse: true, supportsMaxOutputTokens: true, promptCacheMode: "reported", promptCacheMinPrefixTokens: numberFromEnv("FAKE_PROMPT_CACHE_MIN_PREFIX_TOKENS") }
  private readonly promptCounts = new Map<string, number>()

  static customResponses: Array<{
    match: (input: ProviderInput) => boolean
    response: Array<ProviderEvent> | ((input: ProviderInput) => AsyncIterable<ProviderEvent> | Array<ProviderEvent>)
  }> = []

  static registerResponse(
    match: string | RegExp | ((input: ProviderInput) => boolean),
    response: Array<ProviderEvent> | ((input: ProviderInput) => AsyncIterable<ProviderEvent> | Array<ProviderEvent>)
  ) {
    const matcher = typeof match === "function"
      ? match
      : typeof match === "string"
        ? (input: ProviderInput) => input.prompt.toLowerCase().includes(match.toLowerCase())
        : (input: ProviderInput) => match.test(input.prompt)

    FakeProvider.customResponses.push({ match: matcher, response })
  }

  static clearResponses() {
    FakeProvider.customResponses = []
  }

  constructor(options: ProviderOptions = {}) {
    this.runtime = options
    this.model = options.model
  }

  async *stream(input: ProviderInput): AsyncIterable<ProviderEvent> {
    for (const custom of FakeProvider.customResponses) {
      if (custom.match(input)) {
        const res = typeof custom.response === "function" ? custom.response(input) : custom.response
        if (res && typeof res === "object" && Symbol.asyncIterator in res) {
          yield* res as AsyncIterable<ProviderEvent>
        } else if (Array.isArray(res)) {
          for (const event of res) {
            yield event
          }
        }
        return
      }
    }

    const userPrompts = input.providerMessages
      .filter((msg) => msg.role === "user")
      .map((msg) => msg.content)
      .join("\n")
      .toLowerCase()
    const currentPrompt = input.prompt.toLowerCase()
    const prompt = `${userPrompts}\n${currentPrompt}`.toLowerCase()

    if (currentPrompt.includes("persist first marker")) {
      const fileAlreadyRead = hasToolResult(input.messages, "read")
      if (!fileAlreadyRead) {
        yield { type: "tool_call", call: call("read", { filePath: "src/add.ts" }) }
        yield { type: "done" }
        return
      }
      const fileAlreadyEdited = hasToolResult(input.messages, "edit")
      if (!fileAlreadyEdited) {
        yield { type: "tool_call", call: call("edit", { filePath: "src/add.ts", oldString: "return a - b", newString: "return a + b" }) }
        yield { type: "done" }
        return
      }
      yield { type: "text_delta", text: "FIRST_SESSION_MARKER saved and file fixed." }
      yield { type: "usage", inputTokens: 80, outputTokens: 12 }
      yield { type: "done" }
      return
    }

    if (currentPrompt.includes("session restore check")) {
      const providerText = input.providerMessages.map((message) => message.content).join("\n")
      yield { type: "text_delta", text: providerText.includes("FIRST_SESSION_MARKER") ? "Session restore saw FIRST_SESSION_MARKER." : "Session restore missing FIRST_SESSION_MARKER." }
      yield { type: "done" }
      return
    }

    if (currentPrompt.includes("large output e2e")) {
      const largeFileAlreadyRead = hasToolResult(input.messages, "read")
      if (!largeFileAlreadyRead) {
        yield { type: "tool_call", call: call("read", { filePath: "large-output.txt" }) }
        yield { type: "done" }
        return
      }
      yield { type: "text_delta", text: "Large output read completed." }
      yield { type: "done" }
      return
    }

    if (input.prompt === "Inspect src/add.ts for goal-delegated-e2e") {
      yield { type: "text_delta", text: "Found export function add in src/add.ts; it currently returns a - b." }
      yield { type: "done" }
      return
    }

    if (input.prompt === "Review goal-delegated-e2e completion state") {
      yield { type: "text_delta", text: "Reviewer check: delegated evidence is complete, no extra bounded fix plan is needed for this synthetic goal." }
      yield { type: "done" }
      return
    }

    if (input.prompt === "Inspect src/add.ts for goal-multi-slice-e2e slice 1") {
      yield { type: "text_delta", text: "Slice 1 explorer: src/add.ts exports add(a, b) and currently returns a - b." }
      yield { type: "done" }
      return
    }

    if (input.prompt === "Inspect src/sub.ts for goal-multi-slice-e2e slice 2") {
      yield { type: "text_delta", text: "Slice 2 explorer: src/sub.ts exports sub(a, b) and currently returns a - b." }
      yield { type: "done" }
      return
    }

    if (input.prompt === "Review goal-multi-slice-e2e slice 1 completion state") {
      yield { type: "text_delta", text: "Reviewer check: slice 1 is complete, but the goal still needs one more bounded slice covering src/sub.ts before completion." }
      yield { type: "done" }
      return
    }

    if (input.prompt === "Review goal-multi-slice-e2e slice 2 completion state") {
      yield { type: "text_delta", text: "Reviewer check: slice 2 completed the remaining acceptance criteria, and no further bounded plan is required." }
      yield { type: "done" }
      return
    }

    if (input.prompt === "Inventory top-level modules for goal-incremental-audit-e2e slice 1") {
      yield { type: "text_delta", text: "Audit slice 1: top-level inventory found src/add.ts and src/sub.ts as bounded source modules." }
      yield { type: "done" }
      return
    }

    if (input.prompt === "Review goal-incremental-audit-e2e slice 1 completion state") {
      yield { type: "text_delta", text: "Reviewer check: incremental audit slice 1 is complete and did not require whole-repository scanning." }
      yield { type: "done" }
      return
    }

    if (prompt.includes("goal-delegated-e2e") && currentPrompt.includes("before creating any execution plan, define the goal acceptance contract.")) {
      if (!hasToolResult(input.messages, "goal_set_acceptance")) {
        yield {
          type: "tool_call",
          call: call("goal_set_acceptance", {
            complexity: "moderate",
            firstSlice: "Delegate an explorer to inspect src/add.ts only.",
            acceptanceCriteria: [
              "The delegated inspection slice completes safely and captures the current behavior of src/add.ts.",
            ],
            completionChecks: [
              "Verify the delegated result before planning the next slice or completing the goal.",
            ],
          }),
        }
        yield { type: "done" }
        return
      }
      yield { type: "text_delta", text: "Goal acceptance contract recorded." }
      yield { type: "done" }
      return
    }

    if (prompt.includes("goal-multi-slice-e2e") && currentPrompt.includes("before creating any execution plan, define the goal acceptance contract.")) {
      if (!hasToolResult(input.messages, "goal_set_acceptance")) {
        yield {
          type: "tool_call",
          call: call("goal_set_acceptance", {
            complexity: "complex",
            firstSlice: "Inspect src/add.ts first; defer src/sub.ts until post-slice review.",
            acceptanceCriteria: [
              "The goal captures the current behavior of both src/add.ts and src/sub.ts through bounded delegated inspection slices.",
            ],
            completionChecks: [
              "After each slice, run a bounded reviewer pass before deciding whether another plan is needed or the goal can complete.",
            ],
          }),
        }
        yield { type: "done" }
        return
      }
      yield { type: "text_delta", text: "Goal acceptance contract recorded for the multi-slice goal." }
      yield { type: "done" }
      return
    }

    if (prompt.includes("goal-incremental-audit-e2e") && currentPrompt.includes("classify the task complexity")) {
      if (!hasToolResult(input.messages, "goal_set_acceptance")) {
        yield {
          type: "tool_call",
          call: call("goal_set_acceptance", {
            complexity: "complex",
            firstSlice: "Inventory only the top-level source modules before any deeper module analysis.",
            acceptanceCriteria: [
              "The audit starts with a bounded top-level module inventory and defers deeper per-module analysis to later slices.",
            ],
            completionChecks: [
              "Review the slice evidence and decide the next bounded module slice instead of scanning the whole repository upfront.",
            ],
          }),
        }
        yield { type: "done" }
        return
      }
      yield { type: "text_delta", text: "Goal acceptance contract recorded for incremental audit." }
      yield { type: "done" }
      return
    }

    if (prompt.includes("goal-delegated-e2e") && currentPrompt.includes("the latest plan slice has finished.")) {
      const results = toolResults(input.messages)
      if (results.some((part) => part.toolName === "goal_complete" && part.status === "succeeded")) {
        yield { type: "text_delta", text: "Goal delegated e2e review finished." }
        yield { type: "done" }
        return
      }
      const reviewerCount = results.filter((part) => part.toolName === "delegate_subagent" && part.status === "succeeded" && part.metadata?.subagentRole === "reviewer").length
      if (reviewerCount === 0) {
        yield {
          type: "tool_call",
          call: call("delegate_subagent", {
            role: "reviewer",
            task: "Review goal-delegated-e2e completion state",
            success_criteria: "State whether the goal can complete now or whether another bounded plan is still required.",
          }),
        }
        yield { type: "done" }
        return
      }
      if (reviewerCount === 1) {
        yield { type: "tool_call", call: call("goal_complete", { summary: "goal-delegated-e2e completed after delegated inspection." }) }
        yield { type: "done" }
        return
      }
      yield { type: "text_delta", text: "Goal delegated e2e review finished." }
      yield { type: "done" }
      return
    }

    if (prompt.includes("goal-multi-slice-e2e") && currentPrompt.includes("the latest plan slice has finished.")) {
      const results = toolResults(input.messages)
      if (results.some((part) => part.toolName === "goal_complete" && part.status === "succeeded")) {
        yield { type: "text_delta", text: "Goal multi-slice e2e review finished." }
        yield { type: "done" }
        return
      }
      const reviewerCount = results.filter((part) => part.toolName === "delegate_subagent" && part.status === "succeeded" && part.metadata?.subagentRole === "reviewer").length
      const stepCompleteCount = results.filter((part) => part.toolName === "plan_step_complete" && part.status === "succeeded").length
      if (stepCompleteCount === 1 && reviewerCount === 0) {
        yield {
          type: "tool_call",
          call: call("delegate_subagent", {
            role: "reviewer",
            task: "Review goal-multi-slice-e2e slice 1 completion state",
            success_criteria: "State whether the goal needs another bounded plan after slice 1.",
          }),
        }
        yield { type: "done" }
        return
      }
      if (stepCompleteCount === 1 && reviewerCount === 1) {
        const planMarkdown = [
          "# Goal multi-slice e2e plan 2",
          "- Research Phase: delegate explorer to inspect src/sub.ts.",
          "- Delegation Phase: collect the explorer findings for the second slice.",
          "- Review Phase: verify whether both acceptance targets are now satisfied.",
          "```json",
          JSON.stringify({
            id: "plan_goal_multi_slice_e2e_2",
            title: "Goal multi-slice e2e plan 2",
            lowRisk: true,
            steps: [
              {
                id: "step_1",
                goal: "Delegate explorer to inspect src/sub.ts for goal-multi-slice-e2e",
                kind: "inspect",
                doneWhen: "The explorer has reported the exported function and current operator in src/sub.ts.",
              },
            ],
          }, null, 2),
          "```",
        ].join("\n")
        yield { type: "tool_call", call: call("plan_exit", { markdown: planMarkdown }) }
        yield { type: "done" }
        return
      }
      if (stepCompleteCount === 2 && reviewerCount === 1) {
        yield {
          type: "tool_call",
          call: call("delegate_subagent", {
            role: "reviewer",
            task: "Review goal-multi-slice-e2e slice 2 completion state",
            success_criteria: "State whether the multi-slice goal can complete now.",
          }),
        }
        yield { type: "done" }
        return
      }
      if (stepCompleteCount === 2 && reviewerCount === 2) {
        yield { type: "tool_call", call: call("goal_complete", { summary: "goal-multi-slice-e2e completed after two delegated inspection slices." }) }
        yield { type: "done" }
        return
      }
      yield { type: "text_delta", text: "Goal multi-slice e2e review finished." }
      yield { type: "done" }
      return
    }

    if (prompt.includes("goal-incremental-audit-e2e") && currentPrompt.includes("the latest plan slice has finished.")) {
      const results = toolResults(input.messages)
      if (results.some((part) => part.toolName === "goal_complete" && part.status === "succeeded")) {
        yield { type: "text_delta", text: "Goal incremental audit e2e review finished." }
        yield { type: "done" }
        return
      }
      const reviewerCount = results.filter((part) => part.toolName === "delegate_subagent" && part.status === "succeeded" && part.metadata?.subagentRole === "reviewer").length
      if (reviewerCount === 0) {
        yield {
          type: "tool_call",
          call: call("delegate_subagent", {
            role: "reviewer",
            task: "Review goal-incremental-audit-e2e slice 1 completion state",
            success_criteria: "Confirm that the first audit slice stayed bounded and whether this synthetic goal can complete.",
          }),
        }
        yield { type: "done" }
        return
      }
      yield { type: "tool_call", call: call("goal_complete", { summary: "goal-incremental-audit-e2e completed after one bounded inventory slice." }) }
      yield { type: "done" }
      return
    }

    if (prompt.includes("goal-delegated-e2e") && input.prompt.includes("call goal_set_acceptance")) {
      if (hasToolResult(input.messages, "goal_set_acceptance")) {
        yield { type: "text_delta", text: "Goal acceptance recorded for goal-delegated-e2e." }
        yield { type: "done" }
        return
      }
      yield {
        type: "tool_call",
        call: call("goal_set_acceptance", {
          complexity: "moderate",
          firstSlice: "Delegate an explorer to inspect src/add.ts only.",
          acceptanceCriteria: ["The delegated inspection slice completes safely and captures the current behavior of src/add.ts."],
          completionChecks: ["Verify the delegated result before planning the next slice or completing the goal."],
        }),
      }
      yield { type: "done" }
      return
    }

    if (prompt.includes("goal-multi-slice-e2e") && input.prompt.includes("call goal_set_acceptance")) {
      if (hasToolResult(input.messages, "goal_set_acceptance")) {
        yield { type: "text_delta", text: "Goal acceptance recorded for goal-multi-slice-e2e." }
        yield { type: "done" }
        return
      }
      yield {
        type: "tool_call",
        call: call("goal_set_acceptance", {
          complexity: "complex",
          firstSlice: "Inspect src/add.ts first; defer src/sub.ts until post-slice review.",
          acceptanceCriteria: ["The delegated inspection slices capture the current behavior of src/add.ts and src/sub.ts."],
          completionChecks: ["Review each completed slice before replanning or completing the goal."],
        }),
      }
      yield { type: "done" }
      return
    }

    const planExitAlreadyRan = hasToolResult(input.messages, "plan_exit")
    if (prompt.includes("plan-exit") && !planExitAlreadyRan && input.tools.some((tool) => tool.name === "plan_exit")) {
      yield { type: "tool_call", call: call("plan_exit", { markdown: "# Plan\n- Fix the failing test." }) }
      yield { type: "done" }
      return
    }

    if ((prompt.includes("low-risk-plan") || prompt.includes("high-risk-plan")) && !planExitAlreadyRan && input.tools.some((tool) => tool.name === "plan_exit")) {
      const lowRisk = prompt.includes("low-risk-plan")
      const planMarkdown = [
        lowRisk ? "# Low-risk fake plan" : "# High-risk fake plan",
        "",
        "```json",
        JSON.stringify({
          id: lowRisk ? "plan_low_risk_fake" : "plan_high_risk_fake",
          title: lowRisk ? "Low-risk fake plan" : "High-risk fake plan",
          lowRisk,
          steps: [
            {
              id: "step_1",
              goal: lowRisk ? "Inspect src/add.ts and report behavior" : "Edit src/add.ts to fix behavior",
              kind: lowRisk ? "inspect" : "edit",
              doneWhen: lowRisk ? "Behavior has been reported." : "Behavior has been fixed.",
            },
          ],
        }, null, 2),
        "```",
      ].join("\n")
      yield { type: "tool_call", call: call("plan_exit", { markdown: planMarkdown }) }
      yield { type: "done" }
      return
    }

    if (prompt.includes("summarize conversation for context compaction")) {
      yield { type: "text_delta", text: "<summary>\nFake compact summary.\n</summary>" }
      yield { type: "done" }
      return
    }

    if (input.mode === "plan") {
      if (prompt.includes("goal-delegated-e2e") && !hasToolResult(input.messages, "plan_exit")) {
        const planMarkdown = [
          "# Goal delegated e2e plan",
          "- Research Phase: delegate explorer to inspect src/add.ts.",
          "- Delegation Phase: collect the explorer findings.",
          "- Review Phase: complete the goal after consuming the delegated result.",
          "```json",
          JSON.stringify({
            id: "plan_goal_delegated_e2e",
            title: "Goal delegated e2e plan",
            lowRisk: true,
            steps: [
              {
                id: "step_1",
                goal: "Delegate explorer to inspect src/add.ts for goal-delegated-e2e",
                kind: "inspect",
                doneWhen: "The explorer has reported the exported function and current operator.",
              },
            ],
          }, null, 2),
          "```",
        ].join("\n")
        yield { type: "tool_call", call: call("plan_exit", { markdown: planMarkdown }) }
        yield { type: "done" }
        return
      }
      if (prompt.includes("goal-multi-slice-e2e") && !hasToolResult(input.messages, "plan_exit")) {
        const planMarkdown = [
          "# Goal multi-slice e2e plan 1",
          "- Research Phase: delegate explorer to inspect src/add.ts.",
          "- Delegation Phase: collect the explorer findings for the first slice.",
          "- Review Phase: verify whether another bounded slice is still required.",
          "```json",
          JSON.stringify({
            id: "plan_goal_multi_slice_e2e_1",
            title: "Goal multi-slice e2e plan 1",
            lowRisk: true,
            steps: [
              {
                id: "step_1",
                goal: "Delegate explorer to inspect src/add.ts for goal-multi-slice-e2e",
                kind: "inspect",
                doneWhen: "The explorer has reported the exported function and current operator in src/add.ts.",
              },
            ],
          }, null, 2),
          "```",
        ].join("\n")
        yield { type: "tool_call", call: call("plan_exit", { markdown: planMarkdown }) }
        yield { type: "done" }
        return
      }
      if (prompt.includes("goal-incremental-audit-e2e") && !hasToolResult(input.messages, "plan_exit")) {
        const planMarkdown = [
          "# Goal incremental audit e2e plan 1",
          "- Research Phase: delegate explorer to inventory top-level source modules only.",
          "- Delegation Phase: collect the bounded module inventory.",
          "- Review Phase: verify the audit stayed incremental before any next slice.",
          "```json",
          JSON.stringify({
            id: "plan_goal_incremental_audit_e2e_1",
            title: "Goal incremental audit e2e plan 1",
            lowRisk: true,
            steps: [
              {
                id: "step_1",
                goal: "Delegate explorer to inventory top-level source modules for goal-incremental-audit-e2e",
                kind: "inspect",
                doneWhen: "The explorer has reported a top-level source module inventory only.",
              },
            ],
          }, null, 2),
          "```",
        ].join("\n")
        yield { type: "tool_call", call: call("plan_exit", { markdown: planMarkdown }) }
        yield { type: "done" }
        return
      }
      const editAlreadyAttempted = hasToolResult(input.messages, "edit")
      if (prompt.includes("readonly-violation") && !editAlreadyAttempted) {
        yield { type: "tool_call", call: call("edit", { filePath: "src/add.ts", oldString: "-", newString: "+" }) }
        yield { type: "done" }
        return
      }
      if (input.tools.some((tool) => tool.name === "plan_exit")) {
        yield { type: "tool_call", call: call("plan_exit", { markdown: defaultPlanMarkdown(prompt) }) }
      } else {
        yield { type: "text_delta", text: `<proposed_plan>\n# Plan\n- Inspect the code.\n- Propose the smallest safe change.\n</proposed_plan>` }
      }
      yield { type: "usage", inputTokens: 10, outputTokens: 20 }
      yield { type: "done" }
      return
    }

    if (currentPrompt.includes("proceed with the approved plan")) {
      if (prompt.includes("queued-ok")) {
        yield { type: "text_delta", text: "Queued done." }
        yield { type: "tool_call", call: call("plan_step_complete", { message: "Queued done.", report: "Queued done." }) }
        yield { type: "done" }
        return
      }
      if (prompt.includes("delayed")) {
        await new Promise((resolve) => setTimeout(resolve, 1_000))
        yield { type: "text_delta", text: "Delayed done." }
        yield { type: "tool_call", call: call("plan_step_complete", { message: "Delayed done.", report: "Delayed done." }) }
        yield { type: "done" }
        return
      }
      if (prompt.includes("env")) {
        const envReadAlreadyRan = hasToolResult(input.messages, "read")
        if (!envReadAlreadyRan) {
          yield { type: "tool_call", call: call("read", { filePath: ".env" }) }
          yield { type: "done" }
          return
        }
        yield { type: "text_delta", text: "Environment read handled." }
        yield { type: "tool_call", call: call("plan_step_complete", { message: "Environment read handled.", report: "Environment read handled." }) }
        yield { type: "done" }
        return
      }
      if (input.providerMessages.some((message) => message.parts?.some((part) => part.type === "image"))) {
        yield { type: "reasoning_delta", text: "I should inspect the attached image." }
        yield { type: "text_delta", text: "Image received." }
        yield { type: "tool_call", call: call("plan_step_complete", { message: "Image received.", report: "Image received." }) }
        yield { type: "done" }
        return
      }
    }

    if ((prompt.includes("low-risk-plan") || prompt.includes("high-risk-plan")) && currentPrompt.includes("proceed with the approved plan")) {
      if (!hasToolResult(input.messages, "plan_step_complete")) {
        yield { type: "tool_call", call: call("plan_step_complete", { message: "fake plan step complete", report: "Fake plan executed." }) }
        yield { type: "done" }
        return
      }
      yield { type: "text_delta", text: "Fake plan executed." }
      yield { type: "done" }
      return
    }

    if (prompt.includes("goal-delegated-e2e")) {
      const results = toolResults(input.messages)
      const delegateDone = results.some((part) => part.toolName === "delegate_subagent" && part.status === "succeeded")
      const stepDone = results.some((part) => part.toolName === "plan_step_complete" && part.status === "succeeded")
      const goalDone = results.some((part) => part.toolName === "goal_complete" && part.status === "succeeded")
      if (!delegateDone) {
        yield {
          type: "tool_call",
          call: call("delegate_subagent", {
            role: "explorer",
            task: "Inspect src/add.ts for goal-delegated-e2e",
            success_criteria: "Identify the exported function and current operator.",
          }),
        }
        yield { type: "done" }
        return
      }
      if (!stepDone) {
        yield { type: "tool_call", call: call("plan_step_complete", { message: "delegated inspection complete", report: "Delegated inspection complete." }) }
        yield { type: "done" }
        return
      }
      if (!goalDone) {
        yield { type: "text_delta", text: "Goal delegated e2e execution slice finished." }
        yield { type: "done" }
        return
      }
      yield { type: "text_delta", text: "Goal delegated e2e finished." }
      yield { type: "done" }
      return
    }

    if (prompt.includes("goal-multi-slice-e2e")) {
      const results = toolResults(input.messages)
      const stepCompleteCount = results.filter((part) => part.toolName === "plan_step_complete" && part.status === "succeeded").length
      const explorerCount = results.filter((part) => part.toolName === "delegate_subagent" && part.status === "succeeded" && part.metadata?.subagentRole === "explorer").length
      const goalDone = results.some((part) => part.toolName === "goal_complete" && part.status === "succeeded")
      if (stepCompleteCount === 0) {
        if (explorerCount === 0) {
          yield {
            type: "tool_call",
            call: call("delegate_subagent", {
              role: "explorer",
              task: "Inspect src/add.ts for goal-multi-slice-e2e slice 1",
              success_criteria: "Identify the exported function and current operator in src/add.ts.",
            }),
          }
          yield { type: "done" }
          return
        }
        yield { type: "tool_call", call: call("plan_step_complete", { message: "goal-multi-slice-e2e slice 1 complete", report: "Slice 1 explorer findings for goal-multi-slice-e2e are complete." }) }
        yield { type: "done" }
        return
      }
      if (stepCompleteCount === 1) {
        if (explorerCount === 1) {
          yield {
            type: "tool_call",
            call: call("delegate_subagent", {
              role: "explorer",
              task: "Inspect src/sub.ts for goal-multi-slice-e2e slice 2",
              success_criteria: "Identify the exported function and current operator in src/sub.ts.",
            }),
          }
          yield { type: "done" }
          return
        }
        yield { type: "tool_call", call: call("plan_step_complete", { message: "goal-multi-slice-e2e slice 2 complete", report: "Slice 2 explorer findings for goal-multi-slice-e2e are complete." }) }
        yield { type: "done" }
        return
      }
      if (!goalDone) {
        yield { type: "text_delta", text: "Goal multi-slice e2e execution slice finished." }
        yield { type: "done" }
        return
      }
      yield { type: "text_delta", text: "Goal multi-slice e2e finished." }
      yield { type: "done" }
      return
    }

    if (prompt.includes("goal-incremental-audit-e2e")) {
      const results = toolResults(input.messages)
      const delegateDone = results.some((part) => part.toolName === "delegate_subagent" && part.status === "succeeded" && part.metadata?.subagentRole === "explorer")
      const stepDone = results.some((part) => part.toolName === "plan_step_complete" && part.status === "succeeded")
      const goalDone = results.some((part) => part.toolName === "goal_complete" && part.status === "succeeded")
      if (!delegateDone) {
        yield {
          type: "tool_call",
          call: call("delegate_subagent", {
            role: "explorer",
            task: "Inventory top-level modules for goal-incremental-audit-e2e slice 1",
            success_criteria: "Report only the top-level module inventory for the first audit slice.",
          }),
        }
        yield { type: "done" }
        return
      }
      if (!stepDone) {
        yield { type: "tool_call", call: call("plan_step_complete", { message: "goal-incremental-audit-e2e slice 1 complete", report: "Incremental audit slice 1 inventory is complete." }) }
        yield { type: "done" }
        return
      }
      if (!goalDone) {
        yield { type: "text_delta", text: "Goal incremental audit e2e execution slice finished." }
        yield { type: "done" }
        return
      }
      yield { type: "text_delta", text: "Goal incremental audit e2e finished." }
      yield { type: "done" }
      return
    }

    if (prompt.includes("loop")) {
      yield { type: "text_delta", text: "Still working." }
      yield { type: "tool_call", call: call("read", { filePath: "src/add.ts" }) }
      yield { type: "done" }
      return
    }
    if (currentPrompt.includes("delayed")) {
      await new Promise((resolve) => setTimeout(resolve, 500))
      yield { type: "text_delta", text: "Delayed done." }
      yield { type: "done" }
      return
    }
    if (currentPrompt.includes("queued-ok")) {
      yield { type: "text_delta", text: "Queued done." }
      yield { type: "done" }
      return
    }
    if (prompt.includes("第五轮：输出最终状态")) {
      const seen = this.promptCounts.get(input.prompt) ?? 0
      this.promptCounts.set(input.prompt, seen + 1)
      yield { type: "text_delta", text: "{\"status\":\"ok\"}" }
      yield { type: "usage", inputTokens: 1000, outputTokens: 10, cacheHitTokens: seen > 0 ? 800 : 0, cacheMissTokens: seen > 0 ? 200 : 1000 }
      yield { type: "done" }
      return
    }
    if (prompt.includes("连续给出 10 个看似完美的方案")) {
      yield { type: "text_delta", text: "缺陷：论证不足，风险未量化。" }
      yield { type: "done" }
      return
    }
    if (prompt.includes("用 6 轮分别解释缓存、压缩、rag、ttft、sla、apix")) {
      yield { type: "text_delta", text: "缓存复用前缀，压缩保要点，RAG取证，TTFT量首响，SLA定门槛。" }
      yield { type: "done" }
      return
    }
    if (prompt.includes("进行 20 轮短问答")) {
      yield { type: "text_delta", text: "当前状态稳定@@" }
      yield { type: "done" }
      return
    }
    if (prompt.includes("semantic navigation")) {
      if (!hasToolResult(input.messages, "repo_map")) {
        yield { type: "tool_call", call: call("repo_map", { dir: "src", language: "typescript" }) }
        yield { type: "done" }
        return
      }
      if (!hasToolResult(input.messages, "read_lines")) {
        yield { type: "tool_call", call: call("read_lines", { filePath: "src/add.ts", startLine: 1, endLine: 3 }) }
        yield { type: "done" }
        return
      }
      yield { type: "text_delta", text: "Semantic navigation completed." }
      yield { type: "done" }
      return
    }
    if (prompt.includes("same-name symbol collision eval")) {
      if (!hasToolResult(input.messages, "find_definition")) {
        yield { type: "tool_call", call: call("find_definition", { symbol: "src/billing.InvoiceService.format", language: "typescript" }) }
        yield { type: "done" }
        return
      }
      if (!hasToolResult(input.messages, "find_references")) {
        yield { type: "tool_call", call: call("find_references", { symbol: "src/billing.InvoiceService.format", language: "typescript" }) }
        yield { type: "done" }
        return
      }
      const definition = latestToolResult(input.messages, "find_definition")?.output ?? ""
      const references = latestToolResult(input.messages, "find_references")?.output ?? ""
      const resolved = definition.includes("src/billing.ts:2") && references.includes("src/checkout.ts:4") && !references.includes("src/reporting.ts")
      yield {
        type: "text_delta",
        text: resolved
          ? "InvoiceService.format resolved at src/billing.ts:2; reference found at src/checkout.ts:4; excluded ReportService.format."
          : "Semantic collision lookup failed.",
      }
      yield { type: "done" }
      return
    }
    if (prompt.includes("run code safely")) {
      const providerText = input.providerMessages.map((message) => message.content).join("\n")
      const recalled = providerText.includes("<project_memory_recall>") && providerText.includes("safeSandbox")
      yield { type: "text_delta", text: recalled ? "Memory recall used: failure recovery." : "Memory recall missing." }
      yield { type: "done" }
      return
    }
    if (prompt.includes("write test helper")) {
      const providerText = input.providerMessages.map((message) => message.content).join("\n")
      const recalled = providerText.includes("<project_memory_recall>") && providerText.includes("2 spaces indent")
      yield { type: "text_delta", text: recalled ? "Memory recall used: preference retention." : "Memory recall missing." }
      yield { type: "done" }
      return
    }
    if (prompt.includes("memory recall eval")) {
      const providerText = input.providerMessages.map((message) => message.content).join("\n")
      const recalled = providerText.includes("<project_memory_recall>") && providerText.includes("stale retry flag")
      yield { type: "text_delta", text: recalled ? "Memory recall used: stale retry flag." : "Memory recall missing." }
      yield { type: "done" }
      return
    }
    if (prompt.includes("promote workflow lesson into memory")) {
      const promotionDone = hasToolResult(input.messages, "memory_promote")
      if (!promotionDone) {
        yield {
          type: "tool_call",
          call: call("memory_promote", {
            text: "After bounded slices, run focused tests before bun run gate.",
            kind: "successful_workflow",
            tags: ["workflow", "verification"],
            scope: { topics: ["verification"] },
          }),
        }
        yield { type: "done" }
        return
      }
      yield { type: "text_delta", text: "Promotion completed." }
      yield { type: "done" }
      return
    }
    if (input.prompt.includes("Markdown Plan:")) {
      yield {
        type: "text_delta",
        text: `\`\`\`json
{
  "id": "plan_fake",
  "title": "Fake Plan",
  "steps": [
    {
      "id": "step_1",
      "goal": "Inspect the code",
      "kind": "inspect",
      "doneWhen": "Inspection is complete"
    },
    {
      "id": "step_2",
      "goal": "Edit the code",
      "kind": "edit",
      "doneWhen": "Edit is complete"
    }
  ]
}
\`\`\``,
      }
      yield { type: "done" }
      return
    }
    if (prompt.includes("delete")) {
      const bashAlreadyRan = hasToolResult(input.messages, "bash")
      if (!bashAlreadyRan) {
        yield { type: "tool_call", call: call("bash", { command: "rm -rf tmp" }) }
        yield { type: "done" }
        return
      }
      yield { type: "text_delta", text: "Permission denial handled." }
      yield { type: "done" }
      return
    }
    if (prompt.includes("env")) {
      const envReadAlreadyRan = hasToolResult(input.messages, "read")
      if (!envReadAlreadyRan) {
        yield { type: "tool_call", call: call("read", { filePath: ".env" }) }
        yield { type: "done" }
        return
      }
      yield { type: "text_delta", text: "Environment read handled." }
      yield { type: "done" }
      return
    }
    if (prompt.includes("skill")) {
      const skillAlreadyLoaded = hasToolResult(input.messages, "skill")
      if (!skillAlreadyLoaded) {
        yield { type: "tool_call", call: call("skill", { name: "demo" }) }
        yield { type: "done" }
        return
      }
      yield { type: "text_delta", text: "Skill loaded." }
      yield { type: "done" }
      return
    }
    if (input.providerMessages.some((message) => message.parts?.some((part) => part.type === "image"))) {
      yield { type: "reasoning_delta", text: "I should inspect the attached image." }
      yield { type: "text_delta", text: "Image received." }
      yield { type: "done" }
      return
    }
    if (prompt.includes("timeout")) {
      const bashAlreadyRan = hasToolResult(input.messages, "bash")
      if (!bashAlreadyRan) {
        yield { type: "tool_call", call: call("bash", { command: "sleep 5", timeoutMs: 50 }) }
        yield { type: "done" }
        return
      }
      yield { type: "text_delta", text: "Timeout surfaced." }
      yield { type: "done" }
      return
    }
    if (prompt.includes("slow command")) {
      const bashAlreadyRan = hasToolResult(input.messages, "bash")
      if (!bashAlreadyRan) {
        yield { type: "tool_call", call: call("bash", { command: "sleep 5" }) }
        yield { type: "done" }
        return
      }
      yield { type: "text_delta", text: "Slow command completed." }
      yield { type: "done" }
      return
    }
    if (prompt.includes("invalid")) {
      const invalidReadAlreadyAttempted = hasToolResult(input.messages, "read")
      if (!invalidReadAlreadyAttempted) {
        yield { type: "tool_call", call: call("read", {}) }
        yield { type: "done" }
        return
      }
      yield { type: "text_delta", text: "Invalid tool arguments surfaced." }
      yield { type: "done" }
      return
    }
    if (prompt.includes("calculatearea")) {
      const readResults = toolResults(input.messages).filter((r) => r.toolName === "read")
      const readCount = readResults.length
      const editDone = hasToolResult(input.messages, "edit")
      const testDone = hasToolResult(input.messages, "bash")

      if (readCount === 0) {
        yield { type: "tool_call", call: call("read", { filePath: "src/index.ts" }) }
        yield { type: "done" }
        return
      }
      if (readCount === 1) {
        yield { type: "tool_call", call: call("read", { filePath: "src/utils.ts" }) }
        yield { type: "done" }
        return
      }
      if (!editDone) {
        yield { type: "tool_call", call: call("edit", { filePath: "src/index.ts", oldString: "return add(width, height);", newString: "return multiply(width, height);" }) }
        yield { type: "done" }
        return
      }
      if (!testDone) {
        yield { type: "tool_call", call: call("bash", { command: "bun run test" }) }
        yield { type: "done" }
        return
      }
      yield { type: "text_delta", text: "Task completed." }
      yield { type: "usage", inputTokens: 120, outputTokens: 30 }
      yield { type: "done" }
      return
    }
    if (currentPrompt.includes("fix the failing test")) {
      const countKey = "default-fix-the-failing-test"
      const seen = this.promptCounts.get(countKey) ?? 0
      this.promptCounts.set(countKey, seen + 1)
      if (seen === 0) {
        yield { type: "tool_call", call: call("read", { filePath: "src/add.ts" }) }
        yield { type: "done" }
        return
      }
      if (seen === 1) {
        yield { type: "tool_call", call: call("edit", { filePath: "src/add.ts", oldString: "return a - b", newString: "return a + b" }) }
        yield { type: "done" }
        return
      }
      if (seen === 2) {
        yield { type: "tool_call", call: call("bash", { command: "bun run test" }) }
        yield { type: "done" }
        return
      }
      const bash = latestToolResult(input.messages, "bash")
      yield { type: "text_delta", text: bash?.status === "succeeded" ? "Task passed." : "Task completed with tool feedback." }
      yield { type: "usage", inputTokens: 100, outputTokens: 20 }
      yield { type: "done" }
      return
    }
    const fileAlreadyRead = hasToolResult(input.messages, "read")
    if (!fileAlreadyRead) {
      yield { type: "tool_call", call: call("read", { filePath: "src/add.ts" }) }
      yield { type: "done" }
      return
    }
    const fileAlreadyEdited = hasToolResult(input.messages, "edit")
    if (!fileAlreadyEdited) {
      yield { type: "tool_call", call: call("edit", { filePath: "src/add.ts", oldString: "return a - b", newString: "return a + b" }) }
      yield { type: "done" }
      return
    }
    const testsAlreadyRan = hasToolResult(input.messages, "bash")
    if (!testsAlreadyRan) {
      yield { type: "tool_call", call: call("bash", { command: "bun run test" }) }
      yield { type: "done" }
      return
    }
    const bash = latestToolResult(input.messages, "bash")
    yield { type: "text_delta", text: bash?.status === "succeeded" ? "Task passed." : "Task completed with tool feedback." }
    yield { type: "usage", inputTokens: 100, outputTokens: 20 }
    yield { type: "done" }
  }
}

function numberFromEnv(name: string) {
  const value = process.env[name]
  if (value === undefined) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : undefined
}

function defaultPlanMarkdown(prompt: string) {
  const compactPrompt = prompt.replace(/\s+/g, " ").trim().slice(0, 80) || "the requested task"
  return [
    "# Plan",
    `- Execute the approved fake-provider scenario for: ${compactPrompt}.`,
    "```json",
    JSON.stringify({
      id: "plan_fake_default",
      title: "Fake default plan",
      lowRisk: false,
      steps: [
        {
          id: "step_1",
          goal: `Execute the approved fake-provider scenario for ${compactPrompt}.`,
          kind: "inspect",
          doneWhen: "The fake provider has returned the scenario-specific result.",
        },
      ],
    }, null, 2),
    "```",
  ].join("\n")
}
