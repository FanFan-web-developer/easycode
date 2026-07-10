import { describe, expect, test } from "bun:test"
import path from "node:path"

const repoRoot = path.resolve(import.meta.dir, "../..")

type CapabilityEvidence = {
  capability: string
  unit: Array<{ file: string; patterns: string[] }>
  integration: Array<{ file: string; patterns: string[] }>
}

const alignmentEvidence: CapabilityEvidence[] = [
  {
    capability: "sidecar slash settings persistence",
    unit: [
      { file: "test/unit/sidecar-protocol.test.ts", patterns: ["parses supported JSONL requests", "validates updateSettings params before session persistence"] },
      { file: "test/unit/sidecar-slash-result.test.ts", patterns: ["slashResultShouldPersist"] },
      { file: "test/unit/desktop-settings-sync.test.ts", patterns: ["preserves explicit reset semantics", "covers every desktop-controlled sidecar setting", "does not echo sidecar slash settings"] },
    ],
    integration: [
      { file: "test/integration/sidecar.test.ts", patterns: ["persists slash setting changes", "saves current session before slash session switch"] },
    ],
  },
  {
    capability: "running input queue and cancel",
    unit: [
      { file: "test/unit/desktop-run-queue.test.ts", patterns: ["queues non-cancel input", "classifies slash commands", "dequeues the next input", "clears composer draft attachments"] },
    ],
    integration: [
      { file: "test/integration/sidecar.test.ts", patterns: ["renderer queued plan run", "renderer queued plain prompt", "service cancels an active run through slash cancel", "local slash commands immediately"] },
    ],
  },
  {
    capability: "workspace diff preview",
    unit: [
      { file: "test/unit/desktop-workspace-status.test.ts", patterns: ["separates staged unstaged and untracked file state", "keeps staged additions and working-tree deletions"] },
      { file: "test/unit/desktop-workspace-change-groups.test.ts", patterns: ["groups each file by real git scope", "keeps mixed files in both scoped navigation lists"] },
      { file: "test/unit/desktop-workspace-diff.test.ts", patterns: ["reads unstaged and staged changes", "keeps staged and unstaged diff scopes separate", "renders bounded untracked text", "rejects paths that can escape"] },
      { file: "test/unit/desktop-workspace-diff-navigation.test.ts", patterns: ["points forward from the first changed file", "points both ways from a middle changed file", "does not invent targets"] },
      { file: "test/unit/desktop-preload-api.test.ts", patterns: ["desktop:workspaceDiff"] },
      { file: "test/unit/desktop-renderer-ui.test.ts", patterns: ["refreshes workspace review surfaces with latest-request wins"] },
    ],
    integration: [
      { file: "test/integration/desktop-renderer-ui.test.ts", patterns: ["wires changed files to the bounded workspace diff modal", "refreshes workspace status and the active diff through existing desktop APIs"] },
    ],
  },
  {
    capability: "slash command UI coverage",
    unit: [
      { file: "test/unit/slash.test.ts", patterns: ["parses prompt escape and common commands", "returns error for model and provider with no args"] },
      { file: "test/unit/desktop-slash-coverage.test.ts", patterns: ["tracks the canonical CLI slash command set", "covers every required CLI slash command", "binds required slash commands to concrete desktop UI surfaces"] },
    ],
    integration: [
      { file: "test/integration/sidecar.test.ts", patterns: ["desktop slash coverage example", "desktop quick slash command"] },
    ],
  },
  {
    capability: "session and workspace behavior",
    unit: [
      { file: "test/unit/desktop-session-workspace-state.test.ts", patterns: ["draft session promotion", "keeps a local empty-session title", "plans workspace removal"] },
      { file: "test/unit/desktop-settings-sync.test.ts", patterns: ["restores loaded session settings into the sidecar"] },
      { file: "test/unit/desktop-sidecar-registry.test.ts", patterns: ["keeps one sidecar bridge per workspace"] },
      { file: "test/unit/desktop-sidecar-registry-remove.test.ts", patterns: ["stops and forgets a removed inactive workspace bridge", "keeps the fallback workspace active after removing the previously active workspace"] },
    ],
    integration: [
      { file: "test/integration/sidecar.test.ts", patterns: ["desktop-created empty session", "desktop restore can reinitialize", "deleteSession moves current session", "deleteSession falls back to persisted default", "isolated default sessions", "separate workspace sidecar instances", "pending runs and persisted sessions isolated", "slash session delete active session matches CLI switching semantics"] },
    ],
  },
  {
    capability: "plan and goal synchronization",
    unit: [
      { file: "test/unit/desktop-plan-goal-state.test.ts", patterns: ["maps goal control responses without inventing state", "clears visible plan and goal state", "reloads persisted session messages", "reloads persisted session and status after terminal goal lifecycle phases", "clears blocking approval prompts"] },
    ],
    integration: [
      { file: "test/integration/sidecar.test.ts", patterns: ["plan approval requests", "cancelRun resolves a pending plan approval", "pauses and resumes a persisted goal", "runs goal mode through shared goal controller", "goal-delegated-e2e completed after delegated inspection", "reads and clears persisted goal status", "goalLedgerSubjects", "reads and clears persisted plan status", "planLedgerSubjects"] },
    ],
  },
  {
    capability: "permission approval interaction",
    unit: [
      { file: "test/unit/desktop-permission-state.test.ts", patterns: ["shows manual permission prompts only for Ask mode", "forces goal runs through the restricted CLI goal permission path", "maps permission request events to concrete UI state updates", "clears visible permission prompts after terminal run completion", "maps modal actions to exact sidecar permission replies"] },
    ],
    integration: [
      { file: "test/integration/sidecar.test.ts", patterns: ["emits permission requests and accepts replies", "No pending permission request exists", "auto-review mode uses real permission review", "goal mode uses restricted permission policy"] },
    ],
  },
  {
    capability: "attachments",
    unit: [
      { file: "test/unit/desktop-attachment-state.test.ts", patterns: ["turns picker results into real sidecar slash commands", "applies only real sidecar attachment actions"] },
      { file: "test/unit/desktop-attachment-state.test.ts", patterns: ["clears attachments through real sidecar slash commands"] },
      { file: "test/unit/desktop-workspace-path.test.ts", patterns: ["marks files inside the workspace", "rejects files outside the workspace"] },
      { file: "test/unit/attachment.test.ts", patterns: ["formats attached files as workspace-relative prompt references", "rejects files outside the workspace"] },
      { file: "test/unit/image.test.ts", patterns: ["uses compact display labels"] },
      { file: "test/unit/cli-file-slash.test.ts", patterns: ["adds and clears pending workspace files"] },
    ],
    integration: [
      { file: "test/integration/sidecar.test.ts", patterns: ["forwards image inputs", "validates image slash add and clear", "validates file slash add and clear", "desktop picker slash actions become real image and file run attachments", "renderer queued file attachment", "unsupported image providers", "rejects attached files outside the workspace"] },
    ],
  },
  {
    capability: "configuration consistency",
    unit: [
      { file: "test/unit/desktop-settings-commands.test.ts", patterns: ["covers every desktop config key", "maps settings controls to shared CLI slash commands"] },
      { file: "test/unit/i18n.test.ts", patterns: ["welcome copy exposes every canonical slash command"] },
      { file: "test/unit/desktop-settings-sync.test.ts", patterns: ["covers every desktop-controlled sidecar setting"] },
      { file: "test/unit/desktop-provider-env.test.ts", patterns: ["maps provider setup to the same env keys used by the CLI", "reads CLI global env defaults"] },
      { file: "test/unit/desktop-settings.test.ts", patterns: ["persists explicit model reset", "preserves recent workspace order", "normalizes run limits"] },
      { file: "test/unit/desktop-sidecar-bridge-env.test.ts", patterns: ["spawns restarted sidecars with the latest main-process environment"] },
    ],
    integration: [
      { file: "test/integration/sidecar.test.ts", patterns: ["desktop config commands persist through sidecar slash settings", "desktop config commands round-trip every UI control", "desktop config commands apply every setting immediately", "desktop config commands apply language immediately", "provider readiness without exposing secret values", "persists updateSettings into the current session"] },
    ],
  },
]

describe("desktop capability alignment coverage", () => {
  test("keeps every user-facing desktop capability backed by unit and integration evidence", async () => {
    for (const item of alignmentEvidence) {
      expect(item.unit.length, `${item.capability} needs unit evidence`).toBeGreaterThan(0)
      expect(item.integration.length, `${item.capability} needs integration evidence`).toBeGreaterThan(0)
      for (const evidence of [...item.unit, ...item.integration]) {
        const text = await Bun.file(path.join(repoRoot, evidence.file)).text()
        for (const pattern of evidence.patterns) {
          expect(text.includes(pattern), `${item.capability} missing "${pattern}" in ${evidence.file}`).toBe(true)
        }
      }
    }
  })
})
