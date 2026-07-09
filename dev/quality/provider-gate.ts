import path from "node:path"
import { mkdir } from "node:fs/promises"
import { easycodeDir } from "../../src/easycode-path"
import { runCacheBenchmark } from "./cache-benchmark"
import { loadEnvFile } from "../../src/cli/startup"
import { runEval, type EvalResult } from "./eval"
import { runAPIxEval } from "./apix"
import { diagnoseProviderReadiness, formatProviderReadinessSummary, hasProvider, listProviders, providerReadinessCheckStatus, type ProviderName } from "../../src/provider"

type CheckStatus = "passed" | "failed" | "skipped"

type GateCheck = {
  name: "readiness" | "env" | "smoke_eval" | "apix_subset" | "cache_benchmark"
  status: CheckStatus
  summary: string
  details?: unknown
}

type ProviderGateResult = {
  provider: ProviderName
  status: CheckStatus
  checks: GateCheck[]
}

export type ProviderGateReport = {
  schemaVersion: 1
  runID: string
  createdAt: string
  root: string
  status: CheckStatus
  providers: ProviderGateResult[]
}

export type ProviderGateOptions = {
  root?: string
  providers?: ProviderName[]
  reportDir?: string
  smokeTaskIDs?: string[]
  apix?: boolean
  apixIDs?: string[]
  apixLimit?: number
  cache?: boolean
  writeReport?: boolean
}

const defaultProviders = listProviders().filter((provider) => provider !== "fake" && provider !== "simulated")
export const defaultSmokeTaskIDs = ["EC-REAL-001", "EC-REAL-002"]
const defaultAPIxIDs = ["APIX-004", "APIX-011", "APIX-012"]

function applyTlsCliOverrides(argv: string[]) {
  const insecure = argv.includes("--insecure") || argv.includes("-k")
  if (insecure) process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"
  return insecure
}

export async function runProviderGate(options: ProviderGateOptions = {}) {
  const root = path.resolve(options.root ?? path.resolve(import.meta.dir, "../.."))
  await loadEnvFile(root)
  if (process.env.EASYCODE_REJECT_UNAUTHORIZED === "0" || process.env.NODE_TLS_REJECT_UNAUTHORIZED === "0") {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"
  }
  const providers = options.providers ?? defaultProviders
  for (const provider of providers) {
    if (!hasProvider(provider)) throw new Error(`Unknown provider: ${provider}. Available providers: ${listProviders().join(", ")}`)
  }

  const providerResults = []
  for (const provider of providers) {
    providerResults.push(await runProviderChecks(provider, root, options))
  }

  const report: ProviderGateReport = {
    schemaVersion: 1,
    runID: `${new Date().toISOString()}-provider-gate`,
    createdAt: new Date().toISOString(),
    root,
    status: combinedStatus(providerResults.map((item) => item.status)),
    providers: providerResults,
  }

  const reportDir = path.resolve(root, options.reportDir ?? path.join(easycodeDir(root), "reports/provider-gate"))
  const paths = options.writeReport === false ? undefined : await writeGateReport(report, reportDir)
  return { report, paths }
}

async function runProviderChecks(provider: ProviderName, root: string, options: ProviderGateOptions): Promise<ProviderGateResult> {
  const checks: GateCheck[] = []
  const readiness = diagnoseProviderReadiness(provider)
  const readinessStatus = providerReadinessCheckStatus(readiness)
  checks.push({
    name: "readiness",
    status: readinessStatus,
    summary: formatProviderReadinessSummary(readiness),
    details: readiness,
  })
  if (readinessStatus === "failed") {
    return { provider, status: "failed", checks }
  }

  const missingEnv = readiness.missingEnv
  if (missingEnv.length > 0) {
    checks.push({
      name: "env",
      status: "skipped",
      summary: `missing ${missingEnv.join(", ")}`,
      details: { missingEnv },
    })
    return { provider, status: "skipped", checks }
  }

  checks.push({ name: "env", status: "passed", summary: "required provider environment is configured" })
  checks.push(await smokeEvalCheck(provider, root, options.smokeTaskIDs ?? defaultSmokeTaskIDs))
  if (options.apix !== false) checks.push(await apixSubsetCheck(provider, root, options))
  if (options.cache !== false) checks.push(await cacheBenchmarkCheck(provider, root))

  return { provider, status: combinedStatus(checks.map((item) => item.status)), checks }
}

async function smokeEvalCheck(provider: ProviderName, root: string, ids: string[]): Promise<GateCheck> {
  try {
    const results = await runEval({ provider, root, ids })
    const applicable = results.filter((result) => !result.skipped)
    const failed = applicable.filter((result) => !result.passed)
    if (applicable.length === 0) {
      return {
        name: "smoke_eval",
        status: "skipped",
        summary: `no applicable smoke eval tasks for ${provider}`,
        details: { ids, results },
      }
    }
    return {
      name: "smoke_eval",
      status: failed.length === 0 ? "passed" : "failed",
      summary: `${applicable.length - failed.length}/${applicable.length} smoke eval tasks passed`,
      details: { ids, results: summarizeEvalResults(results) },
    }
  } catch (error) {
    return failedCheck("smoke_eval", error)
  }
}

async function apixSubsetCheck(provider: ProviderName, root: string, options: ProviderGateOptions): Promise<GateCheck> {
  try {
    const ids = options.apixIDs ?? (options.apixLimit === undefined ? defaultAPIxIDs : undefined)
    const report = await runAPIxEval({
      root,
      provider,
      ids,
      limit: ids ? undefined : options.apixLimit,
      thinking: false,
      json: true,
      table: false,
      quiet: true,
    })
    const passed = report.quality.gatedPassed
    const total = report.quality.gatedTotal
    return {
      name: "apix_subset",
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
    return failedCheck("apix_subset", error)
  }
}

async function cacheBenchmarkCheck(provider: ProviderName, root: string): Promise<GateCheck> {
  try {
    const report = await runCacheBenchmark({ root, provider, suite: "real", quiet: true })
    const summary = report.summary
    const passed = Boolean(summary && summary.calls > 0)
    return {
      name: "cache_benchmark",
      status: passed ? "passed" : "failed",
      summary: summary
        ? `cache benchmark calls=${summary.calls} hit_rate=${percent(summary.hitRate)} effective_input=${Math.round(summary.effectiveTotalTokens)}`
        : "cache benchmark produced no summary",
      details: summary
        ? {
            calls: summary.calls,
            inputTokens: summary.inputTokens,
            outputTokens: summary.outputTokens,
            cacheHitTokens: summary.cacheHitTokens,
            cacheMissTokens: summary.cacheMissTokens,
            hitRate: summary.hitRate,
            effectiveTotalTokens: summary.effectiveTotalTokens,
            finalStrategyState: summary.finalStrategyState,
          }
        : { summaries: report.summaries },
    }
  } catch (error) {
    return failedCheck("cache_benchmark", error)
  }
}

function summarizeEvalResults(results: EvalResult[]) {
  return results.map((result) => ({
    id: result.id,
    status: result.skipped ? "skipped" : result.passed ? "passed" : "failed",
    ...(result.reason ? { reason: result.reason } : {}),
  }))
}

function failedCheck(name: GateCheck["name"], error: unknown): GateCheck {
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

async function writeGateReport(report: ProviderGateReport, reportDir: string) {
  await mkdir(reportDir, { recursive: true })
  const fileBase = report.runID.replaceAll(":", "-")
  const jsonPath = path.join(reportDir, `${fileBase}.json`)
  const markdownPath = path.join(reportDir, `${fileBase}.md`)
  await Bun.write(jsonPath, `${JSON.stringify(report, null, 2)}\n`)
  await Bun.write(markdownPath, `${formatProviderGateReport(report)}\n`)
  return { jsonPath, markdownPath }
}

export function formatProviderGateReport(report: ProviderGateReport) {
  const lines = [
    `# Provider Gate ${report.createdAt}`,
    "",
    `status: ${report.status}`,
    `root: ${report.root}`,
    "",
  ]
  for (const provider of report.providers) {
    lines.push(`## ${provider.provider}: ${provider.status}`)
    for (const check of provider.checks) {
      lines.push(`- ${check.name}: ${check.status} - ${check.summary}`)
    }
    lines.push("")
  }
  return lines.join("\n").trimEnd()
}

function percent(value: number) {
  return `${(value * 100).toFixed(1)}%`
}

export function parseArgs(argv: string[]): ProviderGateOptions & { json?: boolean; insecure?: boolean } {
  const insecure = applyTlsCliOverrides(argv)
  const provider = valueAfter(argv, "--provider")
  const providers = valueAfter(argv, "--providers")
  const apixIDs = valueAfter(argv, "--apix-ids")
  const apixLimit = valueAfter(argv, "--apix-limit")
  const smokeTaskIDs = valueAfter(argv, "--smoke-ids")
  const parsedProviders = provider ? [provider] : providers ? splitCSV(providers) : undefined
  if (parsedProviders && parsedProviders.length === 0) throw new Error("--providers requires at least one provider")
  return {
    root: valueAfter(argv, "--root"),
    providers: parsedProviders,
    reportDir: valueAfter(argv, "--report-dir"),
    smokeTaskIDs: smokeTaskIDs ? splitCSV(smokeTaskIDs) : undefined,
    apix: !argv.includes("--no-apix"),
    apixIDs: apixIDs ? splitCSV(apixIDs) : undefined,
    apixLimit: apixLimit === undefined ? undefined : positiveInteger(apixLimit, "--apix-limit"),
    cache: !argv.includes("--no-cache"),
    insecure,
    json: argv.includes("--json"),
  }
}

function splitCSV(value: string) {
  return value.split(",").map((item) => item.trim()).filter(Boolean)
}

function positiveInteger(value: string, name: string) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`${name} requires a positive number`)
  return Math.round(parsed)
}

function valueAfter(argv: string[], flag: string) {
  const index = argv.indexOf(flag)
  return index === -1 ? undefined : argv[index + 1]
}

if (import.meta.main) {
  const options = parseArgs(process.argv.slice(2))
  const { report, paths } = await runProviderGate(options)
  console.log(options.json ? JSON.stringify({ report, paths }, null, 2) : formatProviderGateReport(report))
  if (paths) console.error(`[provider-gate] wrote ${paths.jsonPath} and ${paths.markdownPath}`)
  if (report.status === "failed") process.exit(1)
}
