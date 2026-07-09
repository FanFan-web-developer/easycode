import { describe, expect, test } from "bun:test"
import os from "node:os"
import path from "node:path"
import { mkdtemp, rm } from "node:fs/promises"
import { defaultSmokeTaskIDs, formatProviderGateReport, parseArgs, runProviderGate } from "../../dev/quality/provider-gate"

describe("provider gate", () => {
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

  test("defaults real-provider smoke coverage to no-tool and semantic planning tasks", () => {
    expect(defaultSmokeTaskIDs).toEqual(["EC-REAL-001", "EC-REAL-002"])
  })

  test("defaults to all public real providers", async () => {
    const previous = {
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
      DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY,
      OPENAI_COMPAT_API_KEY: process.env.OPENAI_COMPAT_API_KEY,
      OPENAI_COMPAT_API_URL: process.env.OPENAI_COMPAT_API_URL,
    }
    delete process.env.OPENAI_API_KEY
    delete process.env.DEEPSEEK_API_KEY
    delete process.env.OPENAI_COMPAT_API_KEY
    delete process.env.OPENAI_COMPAT_API_URL
    try {
      const { report } = await runProviderGate({
        root: path.resolve(import.meta.dir, "../.."),
        apix: false,
        cache: false,
        writeReport: false,
      })

      expect(report.status).toBe("skipped")
      expect(report.providers.map((provider) => provider.provider)).toEqual(["deepseek", "openai", "openai-compatible"])
      expect(report.providers.every((provider) => provider.status === "skipped")).toBe(true)
    } finally {
      if (previous.OPENAI_API_KEY === undefined) delete process.env.OPENAI_API_KEY
      else process.env.OPENAI_API_KEY = previous.OPENAI_API_KEY
      if (previous.DEEPSEEK_API_KEY === undefined) delete process.env.DEEPSEEK_API_KEY
      else process.env.DEEPSEEK_API_KEY = previous.DEEPSEEK_API_KEY
      if (previous.OPENAI_COMPAT_API_KEY === undefined) delete process.env.OPENAI_COMPAT_API_KEY
      else process.env.OPENAI_COMPAT_API_KEY = previous.OPENAI_COMPAT_API_KEY
      if (previous.OPENAI_COMPAT_API_URL === undefined) delete process.env.OPENAI_COMPAT_API_URL
      else process.env.OPENAI_COMPAT_API_URL = previous.OPENAI_COMPAT_API_URL
    }
  })

  test("records missing provider environment as an explicit skip", async () => {
    const previous = process.env.OPENAI_API_KEY
    delete process.env.OPENAI_API_KEY
    const reportDir = await mkdtemp(path.join(os.tmpdir(), "easycode-provider-gate-skip-"))
    try {
      const { report, paths } = await runProviderGate({
        root: path.resolve(import.meta.dir, "../.."),
        providers: ["openai"],
        reportDir,
        apix: false,
        cache: false,
      })

      expect(report.status).toBe("skipped")
      expect(report.providers[0]).toMatchObject({
        provider: "openai",
        status: "skipped",
      })
      expect(report.providers[0].checks[0]).toMatchObject({
        name: "readiness",
        status: "skipped",
      })
      expect(report.providers[0].checks[1]).toMatchObject({
        name: "env",
        status: "skipped",
      })
      expect(report.providers[0].checks[0].details).toMatchObject({
        missingEnv: ["OPENAI_API_KEY"],
      })
      expect(paths?.jsonPath.startsWith(reportDir)).toBe(true)
      expect(await Bun.file(paths?.jsonPath ?? "").exists()).toBe(true)
      expect(await Bun.file(paths?.markdownPath ?? "").exists()).toBe(true)
    } finally {
      if (previous === undefined) delete process.env.OPENAI_API_KEY
      else process.env.OPENAI_API_KEY = previous
      await rm(reportDir, { recursive: true, force: true })
    }
  })

  test("can run a deterministic smoke gate and render the report", async () => {
    const reportDir = await mkdtemp(path.join(os.tmpdir(), "easycode-provider-gate-pass-"))
    try {
      const { report } = await runProviderGate({
        root: path.resolve(import.meta.dir, "../.."),
        providers: ["fake"],
        reportDir,
        smokeTaskIDs: ["EC-001"],
        apix: false,
        cache: false,
      })
      const markdown = formatProviderGateReport(report)

      expect(report.status).toBe("passed")
      expect(report.providers[0].checks.map((check) => check.name)).toEqual(["readiness", "env", "smoke_eval"])
      expect(markdown).toContain("## fake: passed")
      expect(markdown).toContain("smoke_eval: passed")
    } finally {
      await rm(reportDir, { recursive: true, force: true })
    }
  })

  test("uses apixLimit when explicit APIx ids are not supplied", async () => {
    const { report } = await runProviderGate({
      root: path.resolve(import.meta.dir, "../.."),
      providers: ["fake"],
      smokeTaskIDs: ["EC-001"],
      apixLimit: 1,
      cache: false,
      writeReport: false,
    })
    const apix = report.providers[0].checks.find((check) => check.name === "apix_subset")

    expect(report.status).toBe("passed")
    expect(apix).toMatchObject({
      status: "passed",
      summary: "1/1 hard-gate APIx cases passed",
    })
    expect((apix?.details as { ids?: string[] }).ids).toEqual(["APIX-001"])
  })
})
