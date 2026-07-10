#!/usr/bin/env bun
import path from "node:path"
import { mkdir } from "node:fs/promises"
import { loadEnvFile } from "../../src/cli/startup"
import { easycodeDir } from "../../src/easycode-path"
import { runEval } from "./eval"
import { runAPIxEval } from "./apix"
import { runCacheBenchmark } from "./cache-benchmark"
import { runProviderGate, type ProviderGateReport } from "./provider-gate"
import type { ProviderName } from "../../src/provider"

type CheckStatus = "passed" | "failed" | "skipped"
type QualityGateCheckName =
  | "typecheck"
  | "tests"
  | "eval_fake"
  | "apix_subset"
  | "cache_benchmark"
  | "build"
  | "provider_gate"

type QualityGateCheck = {
  name: QualityGateCheckName
  status: CheckStatus
  summary: string
  details?: unknown
}

export type QualityGateReport = {
  schemaVersion: 1
  runID: string
  createdAt: string
  root: string
  status: CheckStatus
  checks: QualityGateCheck[]
}

export type QualityGateOptions = {
  root?: string
  reportDir?: string
  providers?: ProviderName[]
  checks?: QualityGateCheckName[]
  smokeTaskIDs?: string[]
  apixIDs?: string[]
  apixLimit?: number
  providerApix?: boolean
  providerCache?: boolean
  writeReport?: boolean
}

const defaultSubsetAPIxIDs = ["APIX-001", "APIX-004", "APIX-005"]

function applyTlsCliOverrides(argv: string[]) {
  const insecure = argv.includes("--insecure") || argv.includes("-k")
  if (insecure) process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"
  return insecure
}

export function plannedChecks(): QualityGateCheckName[] {
  return ["typecheck", "tests", "eval_fake", "apix_subset", "cache_benchmark", "build", "provider_gate"]
}

export async function runQualityGate(options: QualityGateOptions = {}) {
  const root = path.resolve(options.root ?? path.resolve(import.meta.dir, "../.."))
  await loadEnvFile(root)
  if (process.env.EASYCODE_REJECT_UNAUTHORIZED === "0" || process.env.NODE_TLS_REJECT_UNAUTHORIZED === "0") {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"
  }
  const checks: QualityGateCheck[] = []

  for (const name of options.checks ?? plannedChecks()) {
    checks.push(await runCheck(name, root, options))
  }

  const report: QualityGateReport = {
    schemaVersion: 1,
    runID: `${new Date().toISOString()}-quality-gate`,
    createdAt: new Date().toISOString(),
    root,
    status: combinedStatus(checks.map((check) => check.status)),
    checks,
  }

  const reportDir = path.resolve(root, options.reportDir ?? path.join(easycodeDir(root), "reports/quality-gate"))
  const paths = options.writeReport === false ? undefined : await writeGateReport(report, reportDir)
  return { report, paths }
}

async function runCheck(name: QualityGateCheckName, root: string, options: QualityGateOptions): Promise<QualityGateCheck> {
  switch (name) {
    case "typecheck":
      return runCommandCheck("typecheck", [process.execPath, "run", "typecheck"], root)
    case "tests":
      return runCommandCheck("tests", [process.execPath, "test"], root)
    case "build":
      return runCommandCheck("build", [process.execPath, "run", "build"], root)
    case "eval_fake":
      return evalFakeCheck(root)
    case "apix_subset":
      return apixCheck("apix_subset", root, { ids: options.apixIDs ?? defaultSubsetAPIxIDs, limit: options.apixLimit })
    case "cache_benchmark":
      return cacheBenchmarkCheck(root)
    case "provider_gate":
      return providerGateCheck(root, options)
  }
}

async function runCommandCheck(name: Extract<QualityGateCheckName, "typecheck" | "tests" | "build">, cmd: string[], cwd: string): Promise<QualityGateCheck> {
  const startedAt = Date.now()
  const env = name === "tests"
    ? testCommandEnv()
    : process.env
  const proc = Bun.spawn(cmd, {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
    env,
  })
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])
  const durationMs = Date.now() - startedAt
  return {
    name,
    status: exitCode === 0 ? "passed" : "failed",
    summary: exitCode === 0 ? `passed in ${formatDuration(durationMs)}` : `failed with exit ${exitCode} in ${formatDuration(durationMs)}`,
    details: {
      command: commandLabel(cmd),
      exitCode,
      durationMs,
      stdoutTail: tailLines(stdout),
      stderrTail: tailLines(stderr),
    },
  }
}

export function testCommandEnv() {
  const env: Record<string, string | undefined> = { ...process.env, EASYCODE_DISABLE_GLOBAL_ENV: "1" }
  for (const key of Object.keys(env)) {
    if (
      key === "EASYCODE_DISABLE_GLOBAL_ENV" ||
      key === "EASYCODE_TEST_FORCE_TTY"
    ) {
      continue
    }
    if (
      key.startsWith("EASYCODE_") ||
      key.startsWith("DEEPSEEK_") ||
      key.startsWith("OPENAI_") ||
      key.startsWith("OPENAI_COMPAT_") ||
      key === "NODE_EXTRA_CA_CERTS" ||
      key === "NODE_TLS_REJECT_UNAUTHORIZED" ||
      key === "TAVILY_API_KEY"
    ) {
      delete env[key]
    }
  }
  return env
}

async function evalFakeCheck(root: string): Promise<QualityGateCheck> {
  try {
    const results = await runEval({ provider: "fake", root })
    const applicable = results.filter((result) => !result.skipped)
    const failed = applicable.filter((result) => !result.passed)
    return {
      name: "eval_fake",
      status: failed.length === 0 ? "passed" : "failed",
      summary: `${applicable.length - failed.length}/${applicable.length} fake eval tasks passed`,
      details: {
        results: results.map((result) => ({
          id: result.id,
          status: result.skipped ? "skipped" : result.passed ? "passed" : "failed",
          ...(result.reason ? { reason: result.reason } : {}),
        })),
      },
    }
  } catch (error) {
    return failedCheck("eval_fake", error)
  }
}

async function apixCheck(name: "apix_subset", root: string, options: { ids?: string[]; limit?: number }): Promise<QualityGateCheck> {
  try {
    const report = await runAPIxEval({
      root,
      provider: "simulated",
      ids: options.ids,
      limit: options.ids ? undefined : options.limit,
      thinking: false,
      json: true,
      table: false,
      quiet: true,
    })
    const passed = report.quality.gatedPassed
    const total = report.quality.gatedTotal
    return {
      name,
      status: total > 0 && passed === total ? "passed" : "failed",
      summary: `${passed}/${total} hard-gate APIx cases passed`,
      details: {
        runID: report.runID,
        ids: report.results.map((result) => result.id),
        failures: report.failures,
        usage: report.usage,
        latency: report.latency,
      },
    }
  } catch (error) {
    return failedCheck(name, error)
  }
}

async function cacheBenchmarkCheck(root: string): Promise<QualityGateCheck> {
  try {
    const report = await runCacheBenchmark({ root, provider: "simulated", suite: "real", quiet: true })
    const summary = report.summary
    const passed = Boolean(summary && summary.calls > 0)
    return {
      name: "cache_benchmark",
      status: passed ? "passed" : "failed",
      summary: summary
        ? `cache benchmark calls=${summary.calls} hit_rate=${percent(summary.hitRate)} effective_input=${Math.round(summary.effectiveTotalTokens)}`
        : "cache benchmark produced no summary",
      details: summary ?? { summaries: report.summaries },
    }
  } catch (error) {
    return failedCheck("cache_benchmark", error)
  }
}

async function providerGateCheck(root: string, options: QualityGateOptions): Promise<QualityGateCheck> {
  try {
    const { report } = await runProviderGate({
      root,
      providers: options.providers,
      smokeTaskIDs: options.smokeTaskIDs,
      apix: options.providerApix,
      apixIDs: options.apixIDs,
      apixLimit: options.apixLimit,
      cache: options.providerCache,
      writeReport: false,
    })
    return {
      name: "provider_gate",
      status: report.status,
      summary: summarizeProviderGate(report.providers),
      details: report,
    }
  } catch (error) {
    return failedCheck("provider_gate", error)
  }
}

async function writeGateReport(report: QualityGateReport, reportDir: string) {
  await mkdir(reportDir, { recursive: true })
  const fileBase = report.runID.replaceAll(":", "-")
  const jsonPath = path.join(reportDir, `${fileBase}.json`)
  const markdownPath = path.join(reportDir, `${fileBase}.md`)
  await Bun.write(jsonPath, `${JSON.stringify(report, null, 2)}\n`)
  await Bun.write(markdownPath, `${formatQualityGateReport(report)}\n`)
  return { jsonPath, markdownPath }
}

export function formatQualityGateReport(report: QualityGateReport) {
  const lines = [
    `# Quality Gate ${report.createdAt}`,
    "",
    `status: ${report.status}`,
    `root: ${report.root}`,
    "",
  ]
  for (const check of report.checks) {
    lines.push(`- ${check.name}: ${check.status} - ${check.summary}`)
    lines.push(...providerSmokeFailureLines(check))
  }
  return lines.join("\n").trimEnd()
}

function providerSmokeFailureLines(check: QualityGateCheck) {
  if (check.name !== "provider_gate" || !isProviderGateReport(check.details)) return []

  const lines: string[] = []
  for (const provider of check.details.providers) {
    const smokeCheck = provider.checks.find((item) => item.name === "smoke_eval" && item.status === "failed")
    const results = (smokeCheck?.details as { results?: Array<{ id: string; status: CheckStatus; reason?: string }> } | undefined)?.results
    const failures = results?.filter((result) => result.status === "failed") ?? []
    if (failures.length === 0) continue

    lines.push(`  - ${provider.provider} smoke_eval failures:`)
    for (const failure of failures) {
      const reason = failure.reason ? ` - ${failure.reason.replace(/\s+/g, " ").trim()}` : ""
      lines.push(`    - ${failure.id}: ${failure.status}${reason}`)
    }
  }
  return lines
}

function isProviderGateReport(value: unknown): value is ProviderGateReport {
  return Boolean(value && typeof value === "object" && Array.isArray((value as { providers?: unknown }).providers))
}

export function parseArgs(argv: string[]): QualityGateOptions & { json?: boolean; insecure?: boolean } {
  const insecure = applyTlsCliOverrides(argv)
  const provider = valueAfter(argv, "--provider")
  const providers = valueAfter(argv, "--providers")
  const checks = valueAfter(argv, "--checks")
  const apixIDs = valueAfter(argv, "--apix-ids")
  const smokeTaskIDs = valueAfter(argv, "--smoke-ids")
  const parsedProviders = provider ? [provider] : providers ? splitCSV(providers) : undefined
  return {
    root: valueAfter(argv, "--root"),
    reportDir: valueAfter(argv, "--report-dir"),
    checks: checks ? parseChecks(checks) : undefined,
    providers: parsedProviders as ProviderName[] | undefined,
    smokeTaskIDs: smokeTaskIDs ? splitCSV(smokeTaskIDs) : undefined,
    apixIDs: apixIDs ? splitCSV(apixIDs) : undefined,
    apixLimit: valueAfter(argv, "--apix-limit") ? positiveInteger(valueAfter(argv, "--apix-limit") as string, "--apix-limit") : undefined,
    providerApix: argv.includes("--no-apix") ? false : undefined,
    providerCache: argv.includes("--no-cache") ? false : undefined,
    insecure,
    json: argv.includes("--json"),
  }
}

function parseChecks(value: string): QualityGateCheckName[] {
  const allowed = new Set<QualityGateCheckName>(plannedChecks())
  const checks = splitCSV(value)
  const unknown = checks.filter((check): check is string => !allowed.has(check as QualityGateCheckName))
  if (unknown.length > 0) throw new Error(`--checks contains unknown checks: ${unknown.join(", ")}. Available checks: ${plannedChecks().join(", ")}`)
  return checks as QualityGateCheckName[]
}

function summarizeProviderGate(results: Array<{ provider: string; status: CheckStatus }>) {
  return results.map((result) => `${result.provider}:${result.status}`).join(", ")
}

function failedCheck(name: QualityGateCheckName, error: unknown): QualityGateCheck {
  return {
    name,
    status: "failed",
    summary: error instanceof Error ? error.message : String(error),
  }
}

function combinedStatus(statuses: CheckStatus[]): CheckStatus {
  if (statuses.some((status) => status === "failed")) return "failed"
  if (statuses.length === 0 || statuses.every((status) => status === "skipped")) return "skipped"
  return "passed"
}

function tailLines(text: string, maxLines = 20) {
  return text.trim().split("\n").filter(Boolean).slice(-maxLines)
}

function commandLabel(cmd: string[]) {
  return cmd.map((part) => (part.includes(" ") ? JSON.stringify(part) : part)).join(" ")
}

function formatDuration(durationMs: number) {
  return durationMs >= 1000 ? `${(durationMs / 1000).toFixed(1)}s` : `${durationMs}ms`
}

function percent(value: number) {
  return `${(value * 100).toFixed(1)}%`
}

function positiveInteger(value: string, name: string) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`${name} requires a positive number`)
  return Math.round(parsed)
}

function splitCSV(value: string) {
  return value.split(",").map((item) => item.trim()).filter(Boolean)
}

function valueAfter(argv: string[], flag: string) {
  const index = argv.indexOf(flag)
  return index === -1 ? undefined : argv[index + 1]
}

if (import.meta.main) {
  const options = parseArgs(process.argv.slice(2))
  const { report, paths } = await runQualityGate(options)
  console.log(options.json ? JSON.stringify({ report, paths }, null, 2) : formatQualityGateReport(report))
  if (paths) console.error(`[quality-gate] wrote ${paths.jsonPath} and ${paths.markdownPath}`)
  if (report.status === "failed") process.exit(1)
}
