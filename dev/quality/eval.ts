import path from "node:path"
import os from "node:os"
import { mkdir, readdir, rm } from "node:fs/promises"
import { AgentRunner, createRunner } from "../../src/agent"
import type { AgentRunResult } from "../../src/agent"
import { collectDuplicateInspections } from "../../src/tool/utils/duplicate-inspection"
import type { AgentMode } from "../../src/message"
import { createProvider, hasProvider, listProviders, type ProviderName } from "../../src/provider"
import { createLogger, formatLogEvent } from "../../src/logger"
import type { ToolContext, ToolRegistryLike, ToolResult } from "../../src/tool"
import { loadEnvFile } from "../../src/cli/startup"

export type EvalTask = {
  id: string
  mode: AgentMode
  prompt: string
  fixture: string
  providers?: ProviderName[]
  tools?: "builtin" | "none"
  expected: {
    status: "passed"
    changedFiles?: string[]
    forbiddenFiles?: string[]
    requiredTools?: string[]
    maxToolCalls?: number
    outputContains?: string[]
    forbiddenPhrases?: string[]
    forbidDuplicateInspections?: boolean
  }
}

export type EvalResult = {
  id: string
  passed: boolean
  skipped?: boolean
  reason?: string
}

const emptyRegistry: ToolRegistryLike = {
  get: () => undefined,
  list: () => [],
  run: async (name: string, _input: unknown, _ctx: ToolContext): Promise<ToolResult> => ({
    title: "Unexpected tool",
    output: `Unexpected tool call: ${name}`,
    metadata: { status: "failed" },
  }),
}

async function copyDir(from: string, to: string) {
  await mkdir(to, { recursive: true })
  for (const entry of await readdir(from, { withFileTypes: true })) {
    const source = path.join(from, entry.name)
    const target = path.join(to, entry.name)
    if (entry.isDirectory()) {
      await copyDir(source, target)
      continue
    }
    await Bun.write(target, await Bun.file(source).arrayBuffer())
  }
}

async function snapshotFiles(root: string) {
  const out = new Map<string, string>()
  const walk = async (dir: string) => {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      if (entry.name === "node_modules") continue
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        await walk(full)
        continue
      }
      out.set(path.relative(root, full), await Bun.file(full).text().catch(() => ""))
    }
  }
  await walk(root)
  return out
}

type EvalProvider = ProviderName

export async function runEval(input: { provider: EvalProvider; root?: string; logger?: boolean; ids?: string[] }) {
  const projectRoot = input.root ?? path.resolve(import.meta.dir, "../..")
  await loadEnvFile(projectRoot)
  const taskDir = path.join(projectRoot, "evals", "tasks")
  const tasks = (await readdir(taskDir)).filter((file) => file.endsWith(".json")).sort((left, right) => left.localeCompare(right))
  const idFilter = input.ids ? new Set(input.ids) : undefined
  const results: EvalResult[] = []
  for (const file of tasks) {
    const task = JSON.parse(await Bun.file(path.join(taskDir, file)).text()) as EvalTask
    if (idFilter && !idFilter.has(task.id)) continue
    const providers = task.providers ?? ["fake", "openai", "deepseek"]
    if (!providers.includes(input.provider)) {
      results.push({ id: task.id, passed: true, skipped: true, reason: `not configured for provider ${input.provider}` })
      continue
    }
    const workdir = path.join(os.tmpdir(), `easycode-${task.id}-${Date.now()}`)
    await copyDir(path.join(projectRoot, task.fixture), workdir)
    await mkdir(path.join(workdir, ".easycode"), { recursive: true })
    const before = await snapshotFiles(workdir)
    const logger = input.logger ? (() => {
      const base = createLogger({ root: workdir, session: task.id })
      return Object.assign((event: any) => {
        console.log(formatLogEvent(event))
        base(event)
      }, { filePath: base.filePath, transcriptFilePath: base.transcriptFilePath })
    })() : undefined
    const result = task.tools === "none"
      ? await new AgentRunner({ root: workdir, provider: createProvider(input.provider), registry: emptyRegistry, logger }).run(task.prompt, task.mode)
      : await createRunner({ root: workdir, provider: input.provider, mode: task.mode, logger }).run(task.prompt, task.mode)
    const after = await snapshotFiles(workdir)
    const expected = expectedForProvider(task, input.provider)
    const missingTool = expected.requiredTools?.find((tool) => !result.usedTools.includes(tool))
    const tooManyTools = expected.maxToolCalls !== undefined && result.usedTools.length > expected.maxToolCalls
    const missingChange = expected.changedFiles?.find((filePath) => before.get(filePath) === after.get(filePath))
    const forbiddenChange = expected.forbiddenFiles?.find((filePath) => before.get(filePath) !== after.get(filePath))
    const missingOutput = expected.outputContains?.find((text) => !result.text.toLowerCase().includes(text.toLowerCase()))
    const forbiddenPhrase = expected.forbiddenPhrases?.find((text) => outputContainsText([result.reasoning, result.text], text))
    const duplicateInspection = expected.forbidDuplicateInspections ? collectDuplicateInspections(result.messages)[0] : undefined
    const runFailure = failureReasonForEvalResult(result)
    const passed = result.status === "completed" && !missingTool && !tooManyTools && !missingChange && !forbiddenChange && !missingOutput && !forbiddenPhrase && !duplicateInspection
    results.push({
      id: task.id,
      passed,
      reason: runFailure
        ? runFailure
        : missingTool
        ? `missing tool ${missingTool}`
        : tooManyTools
          ? "too many tool calls"
          : missingChange
            ? `missing expected change ${missingChange}`
            : forbiddenChange
              ? `forbidden file changed ${forbiddenChange}`
              : missingOutput
                ? `missing output ${missingOutput}`
                : forbiddenPhrase
                  ? `forbidden phrase ${forbiddenPhrase}`
                  : duplicateInspection
                    ? `duplicate inspection ${duplicateInspection.description}`
                    : undefined,
    })
    await rm(workdir, { recursive: true, force: true })
  }
  return results
}

function outputContainsText(values: Array<string | undefined>, expected: string) {
  const lowered = expected.toLowerCase()
  return values.some((value) => value?.toLowerCase().includes(lowered))
}

export function failureReasonForEvalResult(result: AgentRunResult) {
  if (result.status === "completed") return undefined
  const line = firstMeaningfulLine(result.text) ?? result.failureReason ?? result.status
  return `run ${result.status}: ${truncateReason(line)}`
}

function expectedForProvider(task: EvalTask, provider: EvalProvider): EvalTask["expected"] {
  if (provider === "fake" || task.expected.maxToolCalls === undefined) return task.expected
  return { ...task.expected, maxToolCalls: Math.max(task.expected.maxToolCalls, 20) }
}

function firstMeaningfulLine(text: string) {
  return text.split(/\r?\n/).map((line) => line.trim()).find(Boolean)
}

function truncateReason(text: string, max = 200) {
  if (text.length <= max) return text
  return `${text.slice(0, max - 1)}...`
}

if (import.meta.main) {
  const provider = process.argv.includes("--provider") ? process.argv[process.argv.indexOf("--provider") + 1] : "deepseek"
  if (!hasProvider(provider)) throw new Error(`Unknown provider: ${provider}. Available providers: ${listProviders().join(", ")}`)
  const ids = process.argv.includes("--ids") ? process.argv[process.argv.indexOf("--ids") + 1].split(",") : undefined
  const results = await runEval({ provider, logger: process.argv.includes("--logger"), ids })
  for (const result of results) console.log(`${result.skipped ? "SKIP" : result.passed ? "PASS" : "FAIL"} ${result.id}${result.reason ? ` - ${result.reason}` : ""}`)
  if (results.some((result) => !result.skipped && !result.passed)) process.exit(1)
}
