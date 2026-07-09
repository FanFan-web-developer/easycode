import { describe, expect, test } from "bun:test"
import path from "node:path"
import { formatQualityGateReport, parseArgs, plannedChecks, runQualityGate, testCommandEnv } from "../../dev/quality/quality-gate"

describe("quality gate", () => {
  test("plans the unified gate checks", () => {
    expect(plannedChecks()).toEqual(["typecheck", "tests", "eval_fake", "apix_subset", "cache_benchmark", "build", "provider_gate"])
  })

  test("parses provider arguments", () => {
    expect(parseArgs(["--providers", "openai,deepseek,openai-compatible", "--apix-limit", "2", "--no-cache"])).toMatchObject({
      providers: ["openai", "deepseek", "openai-compatible"],
      apixLimit: 2,
      providerCache: false,
    })
  })

  test("parses insecure TLS override flags", () => {
    const originalValue = process.env.NODE_TLS_REJECT_UNAUTHORIZED
    try {
      delete process.env.NODE_TLS_REJECT_UNAUTHORIZED
      expect(parseArgs(["--provider", "deepseek", "--insecure"])).toMatchObject({
        insecure: true,
        providers: ["deepseek"],
      })
      expect(process.env.NODE_TLS_REJECT_UNAUTHORIZED as string | undefined).toBe("0")
    } finally {
      if (originalValue === undefined) delete process.env.NODE_TLS_REJECT_UNAUTHORIZED
      else process.env.NODE_TLS_REJECT_UNAUTHORIZED = originalValue
    }
  })

  test("sanitizes test command environment from runtime provider and TLS config", () => {
    const keys = [
      "EASYCODE_PROVIDER",
      "EASYCODE_EXTRA_CA_CERTS",
      "EASYCODE_DISABLE_GLOBAL_ENV",
      "NODE_EXTRA_CA_CERTS",
      "NODE_TLS_REJECT_UNAUTHORIZED",
      "DEEPSEEK_API_KEY",
      "TAVILY_API_KEY",
    ]
    const originalValues = new Map(keys.map((key) => [key, process.env[key]]))
    try {
      process.env.EASYCODE_PROVIDER = "deepseek"
      process.env.EASYCODE_EXTRA_CA_CERTS = "/tmp/easycode-ca.pem"
      process.env.EASYCODE_DISABLE_GLOBAL_ENV = "0"
      process.env.NODE_EXTRA_CA_CERTS = "/tmp/node-ca.pem"
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"
      process.env.DEEPSEEK_API_KEY = "secret"
      process.env.TAVILY_API_KEY = "secret"

      const env = testCommandEnv()

      expect(env.EASYCODE_DISABLE_GLOBAL_ENV).toBe("1")
      expect(env.EASYCODE_PROVIDER).toBeUndefined()
      expect(env.EASYCODE_EXTRA_CA_CERTS).toBeUndefined()
      expect(env.NODE_EXTRA_CA_CERTS).toBeUndefined()
      expect(env.NODE_TLS_REJECT_UNAUTHORIZED).toBeUndefined()
      expect(env.DEEPSEEK_API_KEY).toBeUndefined()
      expect(env.TAVILY_API_KEY).toBeUndefined()
    } finally {
      for (const key of keys) {
        const value = originalValues.get(key)
        if (value === undefined) delete process.env[key]
        else process.env[key] = value
      }
    }
  })

  test("formats a concise report", () => {
    const markdown = formatQualityGateReport({
      schemaVersion: 1,
      runID: "test-run",
      createdAt: "2026-06-02T00:00:00.000Z",
      root: "/tmp/easycode",
      status: "passed",
      checks: [
        { name: "typecheck", status: "passed", summary: "passed in 1.0s" },
        { name: "tests", status: "passed", summary: "passed in 2.0s" },
      ],
    })

    expect(markdown).toContain("# Quality Gate 2026-06-02T00:00:00.000Z")
    expect(markdown).toContain("status: passed")
    expect(markdown).toContain("- typecheck: passed - passed in 1.0s")
  })

  test("can run the unified gate with fake provider checks only", async () => {
    const { report, paths } = await runQualityGate({
      root: path.resolve(import.meta.dir, "../.."),
      checks: ["provider_gate"],
      providers: ["fake"],
      smokeTaskIDs: ["EC-001"],
      providerApix: false,
      providerCache: false,
      writeReport: false,
    })

    expect(report.status).toBe("passed")
    expect(report.checks.at(-1)).toMatchObject({
      name: "provider_gate",
      status: "passed",
    })
    expect(paths).toBeUndefined()
  })
})
