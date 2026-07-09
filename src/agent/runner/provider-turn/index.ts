import type { ContextUsageObservation } from "../../../context/types"
import { ProviderError, StreamXmlFilter, textToolProtocolOutputToProviderEvents, type Provider } from "../../../provider"
import type { ToolDef } from "../../../tool"
import type { ToolCall, Message, ProviderInputMessage } from "../../../message"
import type { RunUiEvent } from "../../../ui/timeline"
import type { Agent } from "../../types"
import { finalizeProviderMetrics, finishProviderMetricCall, observeProviderMetricEvent, startProviderMetricCall, type ProviderMetricsAccumulator } from "../../metrics"

export type ProviderTurnResult = {
  text: string
  reasoningText: string
  toolCalls: ToolCall[]
  failureText?: string
  failureCategory?: "network" | "api" | "validation" | "runtime"
  retryMessage?: string
  validationFailureCount?: number
  lastRejectedTurn?: {
    text: string
    reasoningText: string
    toolNames: string[]
  }
  cancelledOutput?: string
  replayEvents: Array<
    | { type: "reasoning_delta"; text: string }
    | { type: "text_delta"; text: string }
    | { type: "tool_call"; call: ToolCall }
    | { type: "failure"; text: string; source?: "provider" | "system"; category?: "network" | "api" | "validation" | "runtime" }
  >
}

export type ProviderTurnInput = {
  agent: Agent
  prompt: string
  messages: Message[]
  providerMessages: ProviderInputMessage[]
  tools: ToolDef[]
  provider?: Provider
  signal?: AbortSignal
  providerMetrics?: ProviderMetricsAccumulator
  emitDeltas?: boolean
  emitProgressEvents?: boolean
  observeContextUsage?: boolean
}

type ProviderTurnDeps = {
  provider: Provider
  providerProgressIntervalMs: number
  onEvent?: (event: RunUiEvent) => void
  onTextDelta?: (text: string) => void
  onUsage?: (event: ContextUsageObservation) => void
}

export async function runProviderTurnStream(
  deps: ProviderTurnDeps,
  input: ProviderTurnInput,
  failureFormatter: (text: string) => string,
) : Promise<ProviderTurnResult> {
  const textChunks: string[] = []
  const reasoningChunks: string[] = []
  const toolCalls: ToolCall[] = []
  const replayEvents: ProviderTurnResult["replayEvents"] = []
  const tools = input.agent.tools === "none" ? [] : input.tools
  const emitDeltas = input.emitDeltas ?? true
  const emitProgressEvents = input.emitProgressEvents ?? true
  const observeContextUsage = input.observeContextUsage ?? true
  let failureText: string | undefined
  let failureCategory: ProviderTurnResult["failureCategory"]
  const startedAt = Date.now()
  let currentPhase: "waiting" | "thinking" | "answering" = "waiting"
  const stopProviderProgress = startProviderProgressTimer(deps, input, startedAt, () => currentPhase, emitProgressEvents)
  const metricCall = startProviderMetricCall(input.providerMetrics)
  if (emitProgressEvents && input.providerMetrics && deps.onEvent) {
    deps.onEvent({ type: "provider_metrics", metrics: finalizeProviderMetrics(input.providerMetrics), interim: true })
  }
  const currentText = () => textChunks.join("")
  const currentReasoning = () => reasoningChunks.join("")
  const xmlFilter = new StreamXmlFilter()
  try {
    for await (const event of deps.provider.stream({ mode: input.agent.mode, prompt: input.prompt, messages: input.messages, providerMessages: input.providerMessages, tools, signal: input.signal })) {
      observeProviderMetricEvent(input.providerMetrics, metricCall, event)
      if (emitProgressEvents && event.type === "usage" && input.providerMetrics && deps.onEvent) {
        deps.onEvent({ type: "provider_metrics", metrics: finalizeProviderMetrics(input.providerMetrics), interim: true })
      }
      if (input.signal?.aborted) return { text: currentText(), reasoningText: currentReasoning(), toolCalls, cancelledOutput: appendOutput(currentText(), "Run cancelled by user."), replayEvents }
      if (event.type === "reasoning_delta") {
        stopProviderProgress()
        if (currentPhase === "waiting") {
          currentPhase = "thinking"
          if (emitProgressEvents) deps.onEvent?.({ type: "provider_progress", provider: deps.provider.name, model: deps.provider.model, elapsedMs: Date.now() - startedAt, phase: currentPhase })
        }
        reasoningChunks.push(event.text)
        replayEvents.push({ type: "reasoning_delta", text: event.text })
        if (emitDeltas) {
          deps.onEvent?.({ type: "reasoning_delta", text: event.text })
          deps.onTextDelta?.(event.text)
        }
      }
      if (event.type === "text_delta") {
        stopProviderProgress()
        if (currentPhase !== "answering") {
          currentPhase = "answering"
          if (emitProgressEvents) deps.onEvent?.({ type: "provider_progress", provider: deps.provider.name, model: deps.provider.model, elapsedMs: Date.now() - startedAt, phase: currentPhase })
        }
        textChunks.push(event.text)
        replayEvents.push({ type: "text_delta", text: event.text })
        if (emitDeltas) {
          const safeText = xmlFilter.feed(event.text)
          if (safeText) {
            deps.onEvent?.({ type: "text_delta", text: safeText })
            deps.onTextDelta?.(safeText)
          }
        }
      }
      if (event.type === "failure") {
        stopProviderProgress()
        failureText = failureFormatter(event.error.output || event.error.message)
        const classified = classifyProviderFailure({ ...event.error, explicitProviderFailure: true })
        failureCategory = classified.category
        replayEvents.push({ type: "failure", text: failureText, source: "provider", category: classified.category })
        if (emitDeltas) {
          deps.onEvent?.({ type: "failure", text: failureText, source: "provider", category: classified.category })
        }
        continue
      }
      if (event.type === "tool_call") {
        stopProviderProgress()
        toolCalls.push(event.call)
        replayEvents.push({ type: "tool_call", call: event.call })
        if (emitDeltas) deps.onEvent?.({ type: "tool_call", call: event.call })
      }
      if (event.type === "usage" && observeContextUsage) deps.onUsage?.(event)
    }
    const leftover = xmlFilter.flush()
    if (emitDeltas && leftover) {
      deps.onEvent?.({ type: "text_delta", text: leftover })
      deps.onTextDelta?.(leftover)
    }
    if (leftover) replayEvents.push({ type: "text_delta", text: leftover })
    return extractFallbackToolCalls({ text: currentText(), reasoningText: currentReasoning(), toolCalls, failureText, failureCategory, replayEvents }, emitDeltas, deps)
  } catch (error) {
    if (input.signal?.aborted) return { text: currentText(), reasoningText: currentReasoning(), toolCalls, cancelledOutput: appendOutput(currentText(), "Run cancelled by user."), replayEvents }
    const message = error instanceof ProviderError
      ? providerFailureText(error)
      : error instanceof Error
        ? error.message
        : String(error)
    const formattedFailure = failureFormatter(message)
    const classified = classifyProviderFailure({
      code: error instanceof ProviderError ? error.code : errorCode(error),
      status: error instanceof ProviderError ? error.status : undefined,
      message,
      output: error instanceof ProviderError ? error.output ?? message : message,
    })
    replayEvents.push({ type: "failure", text: formattedFailure, source: "provider", category: classified.category })
    if (emitDeltas) deps.onEvent?.({ type: "failure", text: formattedFailure, source: "provider", category: classified.category })
    return { text: currentText(), reasoningText: currentReasoning(), toolCalls, failureText: formattedFailure, failureCategory: classified.category, replayEvents }
  } finally {
    finishProviderMetricCall(input.providerMetrics, metricCall)
    stopProviderProgress()
    if (emitProgressEvents && input.providerMetrics && deps.onEvent) {
      deps.onEvent({ type: "provider_metrics", metrics: finalizeProviderMetrics(input.providerMetrics), interim: true })
    }
  }
}

export function emitProviderTurnEvents(turn: ProviderTurnResult, handlers: Pick<ProviderTurnDeps, "onEvent" | "onTextDelta">) {
  for (const event of turn.replayEvents) {
    if (event.type === "reasoning_delta") {
      handlers.onEvent?.({ type: "reasoning_delta", text: event.text })
      handlers.onTextDelta?.(event.text)
      continue
    }
    if (event.type === "text_delta") {
      handlers.onEvent?.({ type: "text_delta", text: event.text })
      handlers.onTextDelta?.(event.text)
      continue
    }
    if (event.type === "tool_call") {
      handlers.onEvent?.({ type: "tool_call", call: event.call })
      continue
    }
    handlers.onEvent?.({ type: "failure", text: event.text, source: event.source, category: event.category })
  }
}

function extractFallbackToolCalls(result: ProviderTurnResult, emitDeltas: boolean, deps: Pick<ProviderTurnDeps, "onEvent">): ProviderTurnResult {
  if (result.toolCalls.length > 0 || !result.text || result.failureText || result.cancelledOutput) return result
  const events = textToolProtocolOutputToProviderEvents(result.text)
  const extractedCalls = events.filter((e): e is { type: "tool_call"; call: ToolCall } => e.type === "tool_call").map((e) => e.call)
  if (extractedCalls.length === 0) return result
  const textParts = events.filter((e): e is { type: "text_delta"; text: string } => e.type === "text_delta").map((e) => e.text)
  const replayEvents: ProviderTurnResult["replayEvents"] = [...result.replayEvents.filter((event) => event.type === "reasoning_delta")]
  for (const event of events) {
    if (event.type === "text_delta") replayEvents.push({ type: "text_delta", text: event.text })
    if (event.type === "tool_call") replayEvents.push({ type: "tool_call", call: event.call })
  }
  if (emitDeltas) {
    for (const call of extractedCalls) deps.onEvent?.({ type: "tool_call", call })
  }
  return { ...result, text: textParts.join(""), toolCalls: extractedCalls, replayEvents }
}

function startProviderProgressTimer(
  deps: Pick<ProviderTurnDeps, "onEvent" | "providerProgressIntervalMs" | "provider">,
  input: ProviderTurnInput,
  startedAt: number,
  getPhase: () => "waiting" | "thinking" | "answering",
  emitProgressEvents: boolean,
) {
  if (!emitProgressEvents || !deps.onEvent || deps.providerProgressIntervalMs <= 0) return () => {}
  let stopped = false
  deps.onEvent({ type: "provider_progress", provider: deps.provider.name, model: deps.provider.model, elapsedMs: 0, phase: getPhase() })
  const timer = setInterval(() => {
    if (stopped) return
    deps.onEvent?.({ type: "provider_progress", provider: deps.provider.name, model: deps.provider.model, elapsedMs: Date.now() - startedAt, phase: getPhase() })
  }, deps.providerProgressIntervalMs)
  return () => {
    if (stopped) return
    stopped = true
    clearInterval(timer)
  }
}

function providerFailureText(error: ProviderError) {
  const message = error.message.trim()
  const output = error.output?.trim()
  if (!output || output === message) return message
  return `${message}\n${output}`
}

function errorCode(error: unknown) {
  if (typeof error === "object" && error !== null && "code" in error && typeof (error as { code?: unknown }).code === "string") {
    return (error as { code: string }).code
  }
  return undefined
}

function classifyProviderFailure(error: { code?: string; status?: number; message: string; output: string; explicitProviderFailure?: boolean }) {
  const code = (error.code ?? "").toLowerCase()
  if (isNetworkErrorCode(code)) return { category: "network" as const }
  if (error.explicitProviderFailure || isProviderApiStatus(error.status) || isProviderApiErrorCode(code)) {
    return { category: "api" as const }
  }
  return { category: "runtime" as const }
}

function isNetworkErrorCode(code: string) {
  return /\b(econnrefused|econnreset|enotfound|eai_again|etimedout|etls|cert_|self_signed_cert|unable_to_get_issuer_cert|socket|fetch_failed|network_error)\b/.test(code)
}

function isProviderApiStatus(status: number | undefined) {
  return status !== undefined && (status < 200 || status >= 300)
}

function isProviderApiErrorCode(code: string) {
  return code.length > 0
}

function appendOutput(output: string, part: string) {
  if (!part) return output
  if (!output || output.endsWith("\n")) return `${output}${part}`
  return `${output}\n${part}`
}
