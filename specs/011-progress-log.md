# Progress Log

Status: Draft

## Current Roadmap Pointer

- Active stabilization priority: keep the default quality gate deterministic under machine-local EasyCode env files, especially TLS/provider configuration loaded from `~/.easycode/.env`.
- Active documentation priority: keep roadmap specs aligned with implemented modules instead of leaving implemented slices marked as drafts.
- Current product priority after stabilization: desktop V1 readiness and release hygiene on top of the local sidecar boundary.

## Step 77: Desktop Confirmed Git Index Actions

- Scope: let desktop users stage or unstage one reviewed file while keeping repository writes explicit, bounded, and separate from diff opening.
- Implementation:
  - Added a typed `desktop:workspaceGitAction` main/preload boundary with runtime action validation and shared workspace-relative path validation.
  - Implemented single-file stage and unstage with Git literal-pathspec mode so pathspec magic cannot expand the target; neither command changes working-tree file content.
  - Split each Git row into an accessible diff-open control and a compact stage/unstage icon action, disabled during agent runs and status refreshes.
  - Added a localized confirmation modal with exact target path, index-only consequence text, cancellation, submitting, and error states.
  - Refreshes authoritative workspace status after success so files move between groups, and records the result in run progress without adding timeline noise.
  - Added real Git fixture, deleted-file, path/action rejection, preload, renderer, integration, capability-alignment, responsive UI, and running GUI coverage.
- Verification:
  - `bun test test/unit/desktop-workspace-status.test.ts test/unit/desktop-workspace-change-groups.test.ts test/unit/desktop-workspace-diff.test.ts test/unit/desktop-workspace-git-action.test.ts test/unit/desktop-preload-api.test.ts test/unit/desktop-renderer-ui.test.ts test/unit/desktop-capability-alignment.test.ts test/integration/desktop-renderer-ui.test.ts --timeout 30000`: 40 pass, 0 fail.
  - `bun run typecheck`: pass.
  - Real Git fixtures staged and unstaged modified and deleted files without changing working-tree content, and rejected escaping paths and unsupported actions.
  - `bun run desktop:build`: pass; sidecar compile, preload bundle, TypeScript, and Vite renderer build all completed.
  - `bun run electron` from `apps/desktop` launched the latest final desktop build without preload, IPC, module-resolution, or runtime startup errors.
  - Playwright verified cancel made no IPC call, confirm exposed a submitting state, stage moved `notes/draft.md` from Untracked to Staged, and unstage moved it back.
  - The two captured calls contained only the exact path, action, and workspace root; row action clicks produced no diff call, and the final success path added no timeline message noise.
  - At 920 x 700, `scrollWidth` matched `innerWidth`; the compact confirmation dialog stayed inside `200..720`, its path field inside `221..699`, and its primary action inside `631..699`.
  - Final `bun run gate` passed local checks (`typecheck`, full tests, 18/18 fake evals, 3/3 hard-gate APIx cases, cache benchmark, and build); `provider_gate` failed only because the configured DeepSeek URL was unreachable for `EC-REAL-001` and `EC-REAL-002`.

## Step 76: Desktop Scoped Git Change Groups

- Scope: make desktop Git review distinguish index, working-tree, and untracked changes instead of presenting a misleading combined file list and combined diff.
- Implementation:
  - Extracted Git porcelain and numstat parsing into a focused main-process module that preserves staged and unstaged status codes and line counts per unique file.
  - Added Staged Changes, Unstaged Changes, and Untracked Files renderer groups; mixed files appear in both tracked groups with scope-specific stats.
  - Extended the existing `desktop:workspaceDiff` request with a read-only scope while keeping its default all-changes behavior backward compatible.
  - Made modal scope labeling, previous/next navigation, refresh, loading/error state, and untracked preview preserve the selected group.
  - Added real Git fixture, parser, group projection, preload, renderer, integration, capability-alignment, responsive UI, and running GUI coverage.
- Verification:
  - `bun test test/unit/desktop-workspace-status.test.ts test/unit/desktop-workspace-change-groups.test.ts test/unit/desktop-workspace-diff.test.ts test/unit/desktop-preload-api.test.ts test/unit/desktop-renderer-ui.test.ts test/unit/desktop-capability-alignment.test.ts test/integration/desktop-renderer-ui.test.ts --timeout 30000`: 35 pass, 0 fail.
  - `bun run typecheck`: pass.
  - Direct parsing of the current worktree reported 20 unique files as 16 unstaged and 4 untracked, matching the real Git state with no invented staged files.
  - `bun run desktop:build`: pass; sidecar compile, preload bundle, TypeScript, and Vite renderer build all completed.
  - `bun run electron` from `apps/desktop` launched the latest final desktop build without preload, IPC, module-resolution, or runtime startup errors.
  - Playwright rendered 2 staged rows, 2 unstaged rows, and 1 untracked row from 4 unique files; the mixed file appeared in both tracked groups with its scoped stats.
  - Playwright opened the mixed file from both groups and observed distinct staged and unstaged request scopes/content. `Alt+Left` navigation and current-diff refresh retained staged scope, and the untracked row requested untracked scope.
  - At 920 x 700, `scrollWidth` matched `innerWidth`; the modal stayed inside `24..896`, the diff preview inside `45..875`, and the scope/path row remained visible without overlap.
  - Final `bun run gate` passed local checks (`typecheck`, full tests, 18/18 fake evals, 3/3 hard-gate APIx cases, cache benchmark, and build); `provider_gate` failed only because the configured DeepSeek URL was unreachable for `EC-REAL-001` and `EC-REAL-002`.

## Step 75: Desktop Workspace Review Refresh

- Scope: let desktop users explicitly synchronize Git status and reread the current diff while reviewing changes created outside the current run.
- Implementation:
  - Added accessible icon refresh controls to the Changes panel and current diff modal, with localized tooltips and visible loading rotation.
  - Reused the existing `workspaceStatus` and `workspaceDiff` preload APIs; no sidecar protocol or filesystem boundary was expanded.
  - Added latest-request-wins sequencing for workspace-status refreshes so overlapping automatic and manual requests cannot apply stale snapshots.
  - Kept current diff request invalidation intact and refreshes both the selected diff and its surrounding changed-file list.
  - Added focused renderer, integration, capability-alignment, responsive UI, and running GUI coverage.
- Verification:
  - `bun test test/unit/desktop-renderer-ui.test.ts test/unit/desktop-capability-alignment.test.ts test/integration/desktop-renderer-ui.test.ts --timeout 30000`: 20 pass, 0 fail.
  - `bun run typecheck`: pass.
  - `bun run desktop:build`: pass; sidecar compile, preload bundle, TypeScript, and Vite renderer build all completed.
  - `bun run electron` from `apps/desktop` launched the latest final desktop build without preload, IPC, module-resolution, or runtime startup errors.
  - Playwright started a deliberately slow manual Git refresh, injected a faster `run_done` refresh, and confirmed the final panel retained the newer one-file `+7/-2` snapshot after both requests settled.
  - Playwright refreshed the active diff, observed the disabled rotating control while loading, and confirmed rendered content advanced from revision 1 to revision 2 while the surrounding status also refreshed. A follow-up clean snapshot removed file navigation and showed the empty-diff state while retaining the current-diff refresh control.
  - At 920 x 700, `scrollWidth` matched `innerWidth`; the modal stayed inside `24..896`, the diff preview inside `45..875`, the modal refresh control inside `45..75`, and the Changes refresh control inside its `550..910` rail.
  - Final `bun run gate` passed local checks (`typecheck`, full tests, 18/18 fake evals, 3/3 hard-gate APIx cases, cache benchmark, and build); `provider_gate` failed only because the configured DeepSeek URL was unreachable for `EC-REAL-001` and `EC-REAL-002`.

## Step 74: Desktop Workspace Diff Navigation

- Scope: review multiple changed files inside the existing diff modal without returning to the context rail after each file.
- Implementation:
  - Added deterministic previous/next navigation over the existing workspace-status file order, with localized position and accessible icon controls.
  - Added `Alt+Left` and `Alt+Right` keyboard navigation while retaining disabled boundaries for the first and last files.
  - Added request sequencing so rapid navigation, modal close, or workspace switching invalidates older in-flight diff results.
  - Added focused navigation-state, renderer wiring, capability alignment, and responsive GUI coverage.
- Verification:
  - `bun test test/unit/desktop-workspace-diff-navigation.test.ts test/unit/desktop-workspace-diff.test.ts test/unit/desktop-preload-api.test.ts test/unit/desktop-renderer-ui.test.ts test/unit/desktop-capability-alignment.test.ts test/integration/desktop-renderer-ui.test.ts --timeout 30000`: 31 pass, 0 fail.
  - `bun run typecheck`: pass.
  - `bun run desktop:build`: pass; sidecar compile, preload bundle, TypeScript, and Vite renderer build all completed.
  - `bun run electron` from `apps/desktop` launched the latest final desktop build without preload, IPC, module-resolution, or runtime startup errors.
  - Playwright traversed `1 / 3` through `3 / 3`, verified `Alt+Left` returned to `2 / 3` without browser navigation, and confirmed a deliberately delayed second-file result could not overwrite the third file.
  - Playwright also closed the modal during an in-flight request and confirmed it stayed closed. At 920 x 700, `scrollWidth` matched `innerWidth`; the modal stayed inside `24..896`, the diff preview inside `45..875`, and the next-file control inside `845..875`.
  - Final `bun run gate` passed local checks (`typecheck`, full tests, 18/18 fake evals, 3/3 hard-gate APIx cases, cache benchmark, and build); `provider_gate` failed only because the configured DeepSeek URL was unreachable for `EC-REAL-001` and `EC-REAL-002`.

## Step 73: Desktop Workspace Diff Preview

- Scope: let desktop users inspect a changed file without leaving EasyCode while preserving the local main/preload/renderer security boundary.
- Implementation:
  - Added a bounded `desktop:workspaceDiff` IPC path with relative-path validation, external diff/textconv suppression, tracked/staged/deleted support, and safe untracked text generation.
  - Added explicit binary, clean, truncated, file-existence, and error states with a 200,000-character output limit.
  - Made context-rail change rows open a read-only syntax-colored diff modal with close and VS Code file-open actions.
  - Added focused Git fixture, preload channel, renderer wiring, capability alignment, and responsive UI coverage.
- Verification:
  - `bun test test/unit/desktop-workspace-diff.test.ts test/unit/desktop-preload-api.test.ts test/unit/desktop-renderer-ui.test.ts test/unit/desktop-capability-alignment.test.ts test/integration/desktop-renderer-ui.test.ts --timeout 30000`: 27 pass, 0 fail.
  - `bun run typecheck`: pass.
  - Direct helper checks against the current worktree returned bounded real Git patches for both modified `App.tsx` and untracked `workspace-diff.ts`.
  - `bun run desktop:build`: pass; sidecar compile, preload bundle, TypeScript, and Vite renderer build all completed.
  - `bun run electron` launched the final desktop build without preload, IPC, module-resolution, or Electron runtime startup errors.
  - Playwright opened the context rail, previewed tracked and untracked files, verified diff colors and close behavior, and confirmed the VS Code action received the selected relative path.
  - At 920 x 700, `scrollWidth` matched `innerWidth`; the modal stayed inside `24..896` and the diff preview inside `45..875`.
  - Final `bun run gate` passed local checks (`typecheck`, `tests`, `eval_fake`, `apix_subset`, `cache_benchmark`, and `build`); `provider_gate` failed only because the configured DeepSeek provider was unreachable, with `EC-REAL-001` and `EC-REAL-002` listed inline.

## Step 72: Desktop Run Queue Controls And Minimum-Width Layout

- Scope: turn the existing background follow-up queue into a visible, controllable desktop workflow and verify it in a running GUI.
- Implementation:
  - Added an ordered queue panel above the composer with mode and attachment context, single-item removal, and clear-all controls.
  - Added a pure queued-input removal helper and synchronized renderer state/ref updates so a removed item cannot flush after the active run completes.
  - Added Chinese and English queue copy, bounded queue scrolling, and responsive composer wrapping at the Electron minimum width.
  - Added focused queue-state and renderer UI contract coverage, and documented the desktop queue contract in `specs/017-desktop-sidecar.md`.
- Verification:
  - `bun test test/unit/desktop-run-queue.test.ts test/unit/desktop-renderer-ui.test.ts test/integration/desktop-renderer-ui.test.ts --timeout 30000`: 25 pass, 0 fail.
  - `bun run typecheck`: pass.
  - `bun run desktop:build`: pass; sidecar compile, preload bundle, TypeScript, and Vite renderer build all completed.
  - `bun run electron` launched the latest desktop build without preload, module-resolution, or Electron runtime startup errors.
  - Playwright ran the built renderer with the preload contract mocked locally: queued two inputs during an active run, removed the first, verified automatic renumbering, cleared all, and confirmed the active run remained cancellable.
  - Playwright desktop and 920 x 700 screenshots confirmed the queue is readable and the composer remains usable. At 920 px, `scrollWidth` matched `innerWidth`, and the queue clear/cancel controls stayed inside the composer boundary.
  - `bun run gate` passed local checks (`typecheck`, `tests`, `eval_fake`, `apix_subset`, `cache_benchmark`, and `build`); `provider_gate` failed only because the configured DeepSeek provider was unreachable, with `EC-REAL-001` and `EC-REAL-002` listed inline.
- Notes: `EC-REAL-003` remains unverified because workspace fixture/code export to the configured external DeepSeek endpoint was rejected by execution policy; no external-provider workaround was used.

## Step 71: Provider Smoke Failure Details In Unified Gate Reports

- Scope: make real-provider stabilization failures directly actionable from the canonical `bun run gate` Markdown report.
- Implementation:
  - Updated the unified quality-gate formatter to include failed provider smoke task ids and reasons under the `provider_gate` summary.
  - Kept passing smoke tasks and non-provider checks concise, and normalized multiline failure reasons onto one Markdown line.
  - Added focused unit coverage for task-level failure rendering and documented the report contract in `specs/006-evals.md`.
- Verification:
  - `bun test test/unit/quality-gate.test.ts --timeout 30000`: 7 pass, 0 fail.
  - `bun run typecheck`: pass.
  - `bun run gate` passed local checks (`typecheck`, `tests`, `eval_fake`, `apix_subset`, `cache_benchmark`, and `build`); `provider_gate` failed because the configured DeepSeek provider was unreachable, and the generated Markdown listed the failures for both `EC-REAL-001` and `EC-REAL-002` inline.
- Notes: this improves evidence for stabilizing `EC-REAL-003`; it does not add that execution eval to the default provider smoke set.

## Step 70: Eval Tool Count Assertions

- Scope: make symbol-aware edit evals prove repeated semantic verification instead of only requiring each tool name once.
- Implementation:
  - Added optional `requiredToolCounts` support to the local eval runner.
  - Added unit coverage for missing and satisfied repeated tool-count requirements.
  - Updated `EC-017`, `EC-018`, and `EC-REAL-003` to require enough `find_definition`, `find_references`, `edit`, and rollback calls to cover pre-edit lookup plus post-edit or post-restore semantic verification.
  - Updated `specs/006-evals.md` and `specs/010-lsp-ast.md` with the stronger eval contract.
- Verification:
  - `bun test test/unit/eval.test.ts --timeout 30000`: 5 pass, 0 fail.
  - `bun run dev/quality/eval.ts --provider fake --ids EC-017,EC-018`: both passed with repeated tool-count assertions.
  - `bun run typecheck`: pass.
  - `bun run dev/quality/eval.ts --provider fake`: 18/18 fake eval tasks passed; real-provider tasks skipped for fake as expected.
  - `bun run gate` passed local checks (`typecheck`, `tests`, `eval_fake`, `apix_subset`, `cache_benchmark`, and `build`); the final report failed only at `provider_gate` because the configured DeepSeek provider was unreachable.
- Notes: this is still a local eval-contract hardening; it does not promote `EC-REAL-003` into the default provider gate.

## Step 69: Explicit Real Provider Bounded Execution Eval

- Scope: define the next real-provider LSP/AST promotion target without adding an unstable execution eval to the default provider gate.
- Implementation:
  - Added `EC-REAL-003`, an explicit build-mode real-provider eval for the bounded `InvoiceService.format` to `formatInvoice` rename path.
  - The eval requires semantic lookup tools before editing, expects only `src/billing.ts` and `src/checkout.ts` to change, and preserves `ReportService.format`.
  - Updated `specs/006-evals.md` and `specs/010-lsp-ast.md` to distinguish default smoke coverage from explicit execution-oriented real-provider validation.
- Verification:
  - `bun run dev/quality/eval.ts --provider fake --ids EC-REAL-003`: skipped as expected because `EC-REAL-003` is real-provider only.
  - `bun test test/unit/provider-gate.test.ts --timeout 30000`: 6 pass, 0 fail.
  - `bun run typecheck`: pass.
  - `bun run dev/quality/eval.ts --provider fake`: 18/18 fake eval tasks passed; `EC-REAL-001`, `EC-REAL-002`, and `EC-REAL-003` skipped for fake as expected.
  - `bun run gate` passed local checks (`typecheck`, `tests`, `eval_fake`, `apix_subset`, `cache_benchmark`, and `build`); the final report failed only at `provider_gate` because the configured DeepSeek provider was unreachable. The provider-gate smoke details still include only `EC-REAL-001` and `EC-REAL-002`.
- Notes: keep `EC-REAL-003` out of the default smoke set until a healthy provider run proves it is stable enough for routine gates.

## Step 68: Real Provider Semantic Planning Smoke

- Scope: move LSP/AST real-provider promotion beyond the no-tool smoke check without enabling generic symbol-aware edit execution.
- Implementation:
  - Added `EC-REAL-002`, a read-only plan-mode real-provider eval that requires `find_definition`, `find_references`, and `plan_exit` on the same-name `InvoiceService.format` fixture.
  - Updated the provider gate default smoke task list to include both `EC-REAL-001` and `EC-REAL-002`.
  - Added unit coverage for the default real-provider smoke task list.
  - Updated `specs/006-evals.md` and `specs/010-lsp-ast.md` so the real-provider smoke contract and LSP/AST roadmap match the implemented gate surface.
- Verification:
  - `bun test test/unit/provider-gate.test.ts test/integration/quality-gate.test.ts --timeout 30000`: 9 pass, 0 fail.
  - `bun run dev/quality/eval.ts --provider fake`: 18/18 fake eval tasks passed; `EC-REAL-001` and `EC-REAL-002` skipped for fake as expected.
  - `bun run typecheck`: pass.
  - `bun run gate` passed local checks (`typecheck`, `tests`, `eval_fake`, `apix_subset`, `cache_benchmark`, and `build`); the final report failed only at `provider_gate` because the configured DeepSeek provider was unreachable. The provider-gate smoke details include both `EC-REAL-001` and `EC-REAL-002`.
- Notes: this still keeps generic symbol-aware edits gated; the next roadmap step is real-provider bounded execution behavior once provider connectivity is healthy.

## Step 67: Gate TLS Env Cleanup And Spec Roadmap Hygiene

- Scope: close the quality-gate divergence where the test sub-check inherited Node TLS configuration from global EasyCode env, then align roadmap specs with the implemented LSP/AST and desktop-sidecar state.
- Implementation:
  - Updated `dev/quality/quality-gate.ts` so the `tests` check sanitizes `NODE_EXTRA_CA_CERTS` and `NODE_TLS_REJECT_UNAUTHORIZED` in addition to EasyCode/provider/search runtime config.
  - Added focused `test/unit/quality-gate.test.ts` coverage for the sanitized test command environment.
  - Updated `specs/010-lsp-ast.md` from Draft to Partial implementation and separated implemented read-only symbol navigation from remaining edit/eval roadmap work.
  - Added a desktop V1 readiness checklist to `specs/017-desktop-sidecar.md`.
- Verification:
  - `bun test test/unit/quality-gate.test.ts test/unit/tls-config.test.ts`: 11 pass, 0 fail.
  - `bun run typecheck`: pass.
  - `bun run gate` passed local checks (`typecheck`, `tests`, `eval_fake`, `apix_subset`, `cache_benchmark`, and `build`); the final report failed only at `provider_gate` because the configured DeepSeek provider was unreachable.

## Step 66: Soften Coordinator Delegation Retry For Main Plan Steps

- Scope: keep explicit subagent-assigned plan steps strict while preventing inferred coordinator-delegation suggestions from stopping active main-executor plan steps after validation retries.
- Implementation:
  - Updated `src/agent/runner/index.ts` so repeated `Coordinator delegation gate` validation failures on an active non-subagent plan step arm a one-turn bypass instead of ending with the validation fallback message.
  - Kept `Plan step delegation gate` unchanged for steps with `executorHint: "subagent"`, so explicitly delegated steps still must call `delegate_subagent` while that role is available.
  - Added integration coverage for a main plan step whose provider repeatedly ignores the delegation correction and then successfully executes `read_lines` directly before `plan_step_complete`.
- Verification:
  - `bun test test/integration/agent.test.ts --test-name-pattern "active main plan steps can fall back|plan-step delegation gate does not block direct coordinator tools when the assigned subagent role is exhausted|build mode does not fail closed on coordinator delegation suggestions without an active plan step"`
  - `bun run typecheck`
  - `bun run gate` failed after typecheck/build/eval/cache checks passed: the full test suite still has the unrelated `web_fetch returns bounded structured HTTP evidence` failure from `Bun.serve({ port: 0 })`, and provider gate failed because DeepSeek was unreachable.
- Notes: this intentionally does not bypass planning gates, plan-step report gates, reviewer-delegation gates, or explicit subagent executor hints.

## Step 65: Truncate Intermediate plan_step_complete Reports

- Scope: soften the Step 64 intermediate-report cap so goal-backed plans are not interrupted by validation retries when an intermediate `plan_step_complete.report` is too long.
- Implementation:
  - Updated `src/agent/runner/index.ts` so oversized non-final `plan_step_complete.report` values no longer trigger the validation retry loop.
  - Added `truncateIntermediatePlanStepReport` in `src/plans.ts` and applied it in `src/tool/builtins/retrieval-tools.ts` before advancing from an intermediate plan step.
  - Preserved the required-report validation gate for missing/empty reports, and kept the active-step prompt guidance that intermediate reports should stay concise.
  - Updated `test/integration/agent.test.ts` so oversized intermediate reports are truncated and the plan continues to the final step.
- Verification:
  - `bun test test/integration/agent.test.ts --test-name-pattern "plan_step_complete without a report is rejected by the validation gate|non-final plan_step_complete report is truncated instead of blocking the plan"`
  - `bun run gate` failed after typecheck/build/eval/cache checks passed: the full test suite still has an unrelated `web_fetch returns bounded structured HTTP evidence` failure from `Bun.serve({ port: 0 })`, and provider gate failed because DeepSeek was unreachable.
- Notes: Step 64 is superseded for overlong intermediate reports; final-step report behavior is unchanged.

## Step 64: Cap Intermediate plan_step_complete Reports

- Scope: keep `plan_step_complete.report` strict enough for final deliverables while preventing intermediate plan steps from smuggling full final writeups through oversized progress reports.
- Implementation:
  - Updated `src/plans.ts` with shared concise-report limits for intermediate plan steps: at most 240 characters or 4 lines.
  - Updated `src/agent/runner/index.ts` and `src/prompt/agent.ts` so the active-step reminder plus validation gate now distinguish final vs non-final steps: intermediate `plan_step_complete` calls must stay within the concise-report limit, while the final step may still emit the full user-facing deliverable.
  - Updated `src/tool/builtins/retrieval-tools.ts` so tool execution also fails closed if a non-final `plan_step_complete.report` exceeds the shared concise-report threshold, preserving the same rule even if validation is bypassed.
  - Expanded `test/integration/agent.test.ts` so final-step long reports remain allowed, while non-final oversized reports are rejected before the plan can advance.
- Verification:
  - `bun test test/integration/agent.test.ts --test-name-pattern "running plans continue across steps without another user prompt|plan_step_complete without a report is rejected by the validation gate|non-final plan_step_complete report must stay concise|goal-backed plans still return to the controller immediately after the final step|forced planning can activate a delegated inspect step and continue in the same session|plan-step delegation gate does not block direct coordinator tools when the assigned subagent role is exhausted"`
  - `bun run typecheck`
  - `bun run gate`
- Notes: this is the narrower “final-step only” hardening on top of Step 63; placeholder finals are still governed by the existing final-deliverable wording rather than a placeholder-specific classifier.

## Step 63: Harden plan_step_complete With Required Reports

- Scope: replace the soft post-completion synthesis fallback with a stricter plan-step completion contract, so every `plan_step_complete` carries an explicit report and final plan completion can end immediately without losing the promised user-facing output.
- Implementation:
  - Updated `src/tool/builtins/common.ts` and `src/tool/builtins/retrieval-tools.ts` so `plan_step_complete` now requires a non-empty `report`, preserves optional `message` as a short label only, includes progress reports in intermediate-step tool output, and returns the final report itself when the last step completes the plan.
  - Updated `src/agent/runner/index.ts` and `src/prompt/agent.ts` so the active-step reminder plus validation gate now reject `plan_step_complete` calls that omit `report`, and the final-step instruction explicitly requires the final user-facing deliverable inside that report instead of a later placeholder turn.
  - Updated `src/provider/fake.ts` plus `test/integration/agent.test.ts` so fake/default plan execution paths, delegated plan slices, goal slices, and exhausted-subagent fallbacks all comply with the new required-report protocol, including a regression test that fails closed when `plan_step_complete` omits `report`.
- Verification:
  - `bun test test/integration/agent.test.ts --test-name-pattern "running plans continue across steps without another user prompt|goal-backed plans still return to the controller immediately after the final step|plan_step_complete without a report is rejected by the validation gate|forced planning can activate a delegated inspect step and continue in the same session|plan-step delegation gate does not block direct coordinator tools when the assigned subagent role is exhausted"`
  - `bun test test/integration/cli.test.ts --test-name-pattern "session queues input typed during an active run|logger session renders like normal mode and writes session logs"`
  - `bun run typecheck`
  - `bun run gate`
- Notes: this supersedes the softer non-goal follow-up-turn workaround from Step 62; final plan completion is immediate again, but only after the model supplies the actual report inside `plan_step_complete.report`.

## Step 62: Restore Final Output After Non-Goal Plan Completion

- Scope: stop ordinary plan executions from terminating on the last `plan_step_complete` before the promised user-facing report or summary is emitted, while preserving the immediate handoff from goal execution back to goal review.
- Implementation:
  - Updated `src/agent/runner/index.ts` so only goal-backed executing slices still exit immediately on the final `plan_step_complete`; ordinary build-plan runs now schedule one follow-up assistant turn for the final user-facing answer instead of ending on the generic "Plan Completed" tool result.
  - Updated `src/prompt/agent.ts` so the active-step contract tells the model not to mark the final step complete before its report, review, summary, or explanation is actually ready.
  - Updated `src/provider/fake.ts` and `test/integration/agent.test.ts` so the fake provider and runner integration coverage follow the new contract: final plan completion yields a final synthesis turn, while goal execution still returns directly to the outer controller.
- Verification:
  - `bun test test/integration/agent.test.ts --test-name-pattern "running plans continue across steps without another user prompt|goal-backed plans still return to the controller immediately after the final step|forced planning can activate a delegated inspect step and continue in the same session|plan-step delegation gate does not block direct coordinator tools when the assigned subagent role is exhausted"`
  - `bun test test/integration/cli.test.ts --test-name-pattern "session queues input typed during an active run|logger session renders like normal mode and writes session logs"`
  - `bun run typecheck`
  - `bun run gate`
- Notes: the original regression came from the deliberate "exit immediately after final plan_step_complete" runner rule; that behavior remains correct for goal review boundaries, but ordinary plan execution now gets a dedicated final-answer turn.

## Step 61: Guarded Bash Default-Allow And Command Review

- Scope: reduce main-flow bash approval fatigue while preserving hard boundaries for deletion, git remote operations, and outside-project paths.
- Implementation:
  - Added a shared bash safety classifier that returns `allow`, `review`, or `deny`; main-flow bash and bash-capable subagents now share the same deny/review policy while role-specific tool availability remains unchanged.
  - Changed default bash permissions so ordinary bash, inline script pipelines, verification commands, readonly commands, and project-local skill scripts run without repeated manual approval.
  - Hard-denied file deletion and git remote commands, and routed high-risk non-denied commands such as `sudo`, container commands, remote script execution, package mutations, chmod/chown, background processes, sensitive paths, and upload/sync forms through a provider-backed command-review auto-reviewer.
  - Removed the `sandbox_bypass` retry flow: outside-project command paths now return structured `path_boundary_blocked` feedback to the model, while `/tmp`, `/private/tmp`, the system temp root, `/dev/null`, and `/private/dev/null` are allowed scratch exceptions.
  - Stopped blocking replaceable bash commands solely because an internal tool exists; bash results still carry `commandClass` and `replaceableBy` audit metadata.
- Verification:
  - `bun test test/unit/permission.test.ts test/unit/command-review.test.ts test/unit/sandbox.test.ts test/unit/tool.test.ts`
  - `bun test test/integration/agent.test.ts --test-name-pattern "sandbox path-boundary|permission|subagent|bash"`
  - `bun run typecheck`
- Notes: command-review is an approval reducer, not a security boundary; hard denies, path boundaries, and sandbox behavior still enforce the real limits.

## Step 60: Scope Skill Script Bash Approval And Pre-Assign Script Delegation

- Scope: stop repeated permission prompts for the same project-local skill script without widening shell auto-approval, and make script inspection / script troubleshooting plans explicitly delegate before execution starts.
- Implementation:
  - Updated `src/tool/bash.ts` so direct interpreter launches of project-local `.easycode/skills/*/scripts/*` files now use a stable reviewed scope keyed by interpreter plus resolved script path, instead of treating every argument change as a brand-new exact bash approval.
  - Kept the first run of those skill scripts on the manual-review path by leaving `src/permission.ts` auto-review behavior unchanged for non-readonly script execution scopes.
  - Updated `src/plans.ts` plus `src/agent/planner.ts` so “查脚本 / inspect script entrypoint” style steps infer `executorHint: "subagent"` with `subagentRole: "explorer"`, while bounded script failure diagnosis infers `subagentRole: "debugger"` even when the markdown plan forgot to say “delegate”.
  - Added focused regression coverage in `test/unit/tool.test.ts`, `test/unit/permission.test.ts`, and `test/unit/planning-layer.test.ts`, and synchronized `specs/005-boundary-conditions.md` plus `specs/acceptance.md` with the refined approval/delegation contract.
- Verification:
  - `bun test test/unit/tool.test.ts test/unit/permission.test.ts test/unit/planning-layer.test.ts`
  - `bun test test/integration/agent.test.ts --test-name-pattern "forced planning can activate a delegated inspect step and continue in the same session|coordinator retries pure fact-finding turns through delegate_subagent|coordinator retries even a single fact-finding tool through delegate_subagent"`
  - `bun run typecheck`
  - `bun run gate` was started but produced no sub-check output for over two minutes, so it was manually stopped instead of being treated as a local assertion failure.
- Notes: this slice deliberately narrows reuse to the same interpreter + same skill script entrypoint; it does not auto-approve arbitrary `node` / `python` commands, and different script files still require separate approval.

## Step 59: Evidence-First Tool Result Budgeting

- Scope: replace scattered provider-visible large-output truncation with a single evidence-first tool result budget, while keeping run-specific evidence out of static prompts.
- Implementation:
  - Updated `src/message.ts` so provider-visible tool results render as fixed-order evidence blocks with `status`, `source`, diagnostics, omission state, retrieval hints, and budgeted excerpts.
  - Connected `ContextStrategyState.toolResultTokenBudget` through `src/context/manager.ts` and `src/context/manager-compose.ts` for compose, compaction input, token estimates, and the public estimate helper.
  - Updated `src/sandbox.ts` so bash stdout/stderr extract diagnostic lines before byte truncation and carry raw-length metadata into tool result metadata.
  - Preserved `delegate_subagent` coordinator summaries in full after the budgeted raw evidence, and marked delegate results partial when the coordinator summary is missing.
  - Bounded oversized evidence metadata itself so diagnostics and retrieval hints are prioritized without letting long commands or repeated diagnostic lines consume the whole provider result.
- Verification:
  - `bun test test/unit/message.test.ts test/unit/sandbox.test.ts test/unit/context.test.ts test/unit/provider.test.ts test/unit/logger.test.ts test/integration/agent.test.ts`
  - `bun run typecheck`
  - `bun run cache:bench -- --provider simulated --suite real --quiet` (`effective_input=61992`, below the 5% increase cap versus the 61258 live baseline)
  - `bun test test/integration/cli.test.ts`
  - `bun run gate` passed typecheck, tests, eval_fake, apix_subset, cache_benchmark, and build; repeated full-gate retries failed only because the external DeepSeek provider gate intermittently could not connect.
  - `bun run dev/quality/provider-gate.ts` passed independently after the failed full-gate runs, confirming the remaining failure is provider/network flakiness rather than a local assertion failure.
- Notes: this slice does not persist full raw large outputs as artifacts; it focuses on provider-visible evidence fidelity, cost bounds, and actionable retrieval hints. The CLI SIGINT cancellation regression was also tightened to wait for the active execution-run cancellation prompt before sending SIGINT, removing a full-suite timing race in `test/integration/cli.test.ts`.

## Step 58: Auto-Approve Bounded Build Verification Bash

- Scope: cut down pointless manual bash approvals in ordinary build sessions without reopening arbitrary shell execution or plan-mode mutation paths.
- Implementation:
  - Updated `src/permission.ts` so the default auto-reviewer now auto-approves the existing exact verification/test bash allowlist in `build` mode, in addition to the already-supported non-replaceable readonly fallback scopes.
  - Expanded the verification allowlist to cover direct `vitest` / `jest` / `mocha` entrypoints plus common `bunx` / `npx` / `pnpm exec vitest` forms, while leaving arbitrary repo-local scripts and other shell mutations on the manual-review path.
  - Updated `src/tool/builtins/git-tools.ts` and `src/tool/git.ts` so `git_branch` no longer reuses a readonly permission scope for branch creation, and branch creation now fails closed in `plan` mode instead of being prompt-approvable there.
  - Added focused regression coverage in `test/unit/permission.test.ts` and `test/unit/tool.test.ts`, and synchronized `specs/005-boundary-conditions.md` plus `specs/acceptance.md` with the refined bash approval contract.
- Verification:
  - `bun test test/unit/permission.test.ts test/unit/tool.test.ts`
  - `bun run typecheck`
  - `bun run gate` was started, produced no intermediate output for over two minutes, and was manually stopped; no failing sub-check output surfaced before termination.
- Notes: this slice deliberately does not auto-approve arbitrary `node`/`python` project scripts or any `sandbox_bypass` retry; the goal is to remove repetitive verification friction without widening script-execution trust by default.

## Step 57: Harden Subagent Role Routing And Failure Handoffs

- Scope: make subagent delegation intent-based instead of tool-availability-based, and stop repeated deterministic tool failures from consuming the full turn budget.
- Implementation:
  - Extended `SubagentExecutionResult` and task state with `blockerClass`, `retryable`, `recommendedNextRole`, `recommendedNextTool`, and per-tool failure fingerprints.
  - Added subagent failure classification and fuse logic so repeated permission, unavailable-tool, invalid-tool-use, large-read/output, and network/provider failures return a structured `handoff` instead of looping.
  - Updated role routing and plan-step inference so HTTP/API/public data/web/MCP/connector retrieval routes to `docs_researcher`, repo-local read/search routes to `explorer`, tests/gates route to `tester`, and `debugger` is reserved for concrete failure diagnosis.
  - Updated coordinator and subagent prompts with explicit role boundaries, `web_fetch` preference for known public endpoints, and a no-repeat rule for deterministic failures.
  - Changed validation retry handling so repeated gate corrections fail closed after three attempts, and cancellation history now stores canonicalized reasoning instead of full repeated reasoning transcripts.
- Verification:
  - `bun test test/unit/subagent-routing.test.ts test/unit/runner.test.ts test/unit/message.test.ts`
  - `bun test test/integration/agent.test.ts`
  - `bun test test/integration/agent.test.ts test/unit/runner.test.ts test/unit/message.test.ts`
  - `bun test test/integration/cli.test.ts --test-name-pattern "SIGINT|queues input"`
  - `bun test test/unit/subagent-routing.test.ts`
  - `bun test`
  - `bun run typecheck`
  - `bun run cache:bench -- --provider simulated --suite real --quiet` (`effective_input=61992`)
  - `bun run gate` passed typecheck, tests, eval_fake, apix_subset, cache_benchmark, build, and provider_gate.
- Notes: `handoff` still maps to a successful outer `delegate_subagent` tool result while exposing `subagentStatus`, blocker metadata, and coordinator summary in metadata for the next coordinator turn.

## Step 55: Bundle Directly Runnable Local SWE-bench Smoke Sets

- Scope: make the new SWE-bench adapter usable immediately by adding a local dataset exporter plus bundled smoke JSONL subsets, so users can benchmark EasyCode without first hand-curating task rows.
- Implementation:
  - Added `dev/quality/swebench-dataset.ts` plus the `bun run swebench:dataset` script entry so the repo can fetch `Lite` or `Verified` rows from the Hugging Face datasets server, export contiguous slices or specific `instance_id`s, and write trimmed local JSONL files containing the exact fields the adapter expects.
  - Added `test/unit/swebench-dataset.test.ts` to lock the exporter CLI parsing contract.
  - Updated `README.md` so the benchmark workflow now starts with generating `evals/swebench/lite-smoke.jsonl` or `evals/swebench/verified-smoke.jsonl`, then feeding those directly into `bun run swebench:predictions`.
- Verification:
  - `bun run swebench:dataset --preset lite`
  - `bun run swebench:dataset --preset verified`
  - `bun test test/unit/swebench.test.ts test/unit/swebench-dataset.test.ts`
  - `bun run typecheck`
- Notes: the bundled local datasets are intentionally small smoke subsets, not full benchmark mirrors; full-size runs should still export larger subsets or consume the upstream dataset directly.

## Step 56: Default SWE-bench Predictions To Temp Dataset And Cwd Output

- Scope: remove the mandatory `--dataset` and `--output` ceremony from the SWE-bench prediction flow so a user can run `bun run swebench:predictions --provider ...` directly, with the dataset fetched ephemerally and predictions written to the current directory by default.
- Implementation:
  - Updated `dev/quality/swebench.ts` so `--dataset` is optional, `--preset` selects the remote smoke source when no local dataset is supplied, the script fetches the trimmed dataset into a temporary directory through the existing exporter, removes that temp dataset after the run, and prints a terminal summary table with per-instance status, patch presence, plan rounds, and failure reason.
  - Changed prediction output defaults so omitted `--output` writes a provider/preset-labeled JSONL file into the current working directory instead of forcing a manually chosen path.
  - Expanded `test/unit/swebench.test.ts` and `README.md` to lock and document the new zero-prep CLI behavior.
- Verification:
  - `bun test test/unit/swebench.test.ts test/unit/swebench-dataset.test.ts`
  - `bun run typecheck`
  - `bun run swebench:predictions --help`
- Notes: repository mirrors/worktrees still use the configured workspace directory; the “temporary only” change in this slice applies to the fetched dataset input, not the git checkout workspace cache.

## Step 54: Add A Minimal SWE-bench Prediction Adapter

- Scope: let EasyCode run unattended against SWE-bench-style task instances by adding a local adapter that mirrors target repos, auto-approves proposal-plan handoff, and emits official-harness-compatible `predictions.jsonl`.
- Implementation:
  - Added `dev/quality/swebench.ts` plus the `bun run swebench:predictions` script entry so the repo can load local SWE-bench JSON/JSONL task files, prepare per-instance worktrees from GitHub + `base_commit`, drive `createRunner(...)` directly, auto-continue past `<proposed_plan>` turns, and capture `git diff --binary` as `model_patch`.
  - Added `test/unit/swebench.test.ts` to lock the CLI parsing, dataset loading, prompt construction, and git-diff extraction helpers without touching the main runtime contract.
  - Updated `README.md` with the benchmark caveats and the exact adapter contract: this path only generates predictions, while official SWE-bench Docker evaluation still happens in the upstream harness.
- Verification:
  - `bun test test/unit/swebench.test.ts`
  - `bun run typecheck`
  - `bun run swebench:predictions --help`
  - `bun run gate` was started but did not return in a reasonable time and was terminated; no failing local sub-check output was produced before termination.
- Notes: the adapter deliberately runs in unattended mode with auto-approved build permissions and auto-approved proposal-plan continuation, because benchmark generation cannot stop for human approval mid-instance.

## Step 53: Centralize Goal Phase Guards And Tighten Resume/Prompt Bounds

- Scope: close review findings around goal lifecycle consistency by moving phase validation into the shared goal module, making paused-goal resume count as a new iteration, and bounding subagent prompt carry-over so prior delegated results do not expand indefinitely.
- Implementation:
  - Updated `src/goal.ts` with shared phase assertions plus a dedicated `GoalStateError`, and changed `activateGoalPlan(...)` so activation from `paused` advances the iteration the same way activation from `reviewing` already does.
  - Updated `src/tool/builtins/retrieval-tools.ts` so `goal_set_acceptance` now reuses the shared goal-phase guard from `src/goal.ts` instead of keeping that lifecycle rule only in the tool implementation.
  - Updated `src/agent/runner/helpers.ts` so subagent prompts include only the most recent bounded subset of prior subagent conclusions, each compacted aggressively, instead of appending every prior result in the run.
  - Expanded `test/unit/goal.test.ts` and `test/unit/runner.test.ts` to cover paused-goal iteration advancement, shared phase assertions, and capped prior-subagent prompt injection.
- Verification:
  - Pending in this slice: rerun focused goal/runner/tool/permission tests and then verify the repo gate remains green.
- Notes: this slice does not change the outer goal controller loop; it tightens lifecycle enforcement and context-size discipline inside the existing design.

## Step 52: Force Plan Exit Back To Goal Review And Harden Goal Tool Gates

- Scope: close the controller gap where a finished goal slice could keep running inside the same execution turn instead of returning to goal review, and harden goal-tool semantics so completion cannot bypass the recorded acceptance/review contract.
- Implementation:
  - Updated `src/agent/runner/index.ts` so a successful final `plan_step_complete` exits the current run immediately, returning control to the outer goal controller instead of relying on the model to stop voluntarily after plan completion.
  - Updated `src/tool/builtins/retrieval-tools.ts` so `goal_set_acceptance` now fails outside the `defining` phase, and `goal_complete` fails closed while an active plan slice is still running and has not yet gone through the required review boundary.
  - Expanded `test/integration/agent.test.ts` to lock the new runner contract: a plan that finishes on its final `plan_step_complete` no longer requires an extra assistant text turn, including the delegated-plan path used by goal-mode slices.
  - Expanded `test/unit/tool.test.ts` with fail-closed coverage for out-of-phase acceptance recording and premature goal completion while a plan is still active.
  - Updated `specs/016-goal-mode.md` so the design explicitly states that final plan completion must hand control back to goal review before completion or replanning.
- Verification:
  - Pending in this slice after the code/test alignment changes: rerun focused goal and runner suites, then `bun run gate`.
- Notes: this is the execution-side enforcement of the stricter goal contract, not just a prompt preference; it removes the path where a goal could accidentally skip review because the same run kept going after the last plan step closed.

## Step 51: Surface Goal Lifecycle In TUI And Live Status Panel

- Scope: make goal mode observable while it is running by surfacing the active goal state in the live TUI status panel and timeline, instead of requiring users to inspect session logs after the fact.
- Implementation:
  - Updated `src/ui/tui/tui-types.ts`, `src/ui/tui/index.ts`, and `src/cli.ts` so goal lifecycle updates now flow through the same UI event path as provider/tool/subagent activity, with the TUI tracking the current goal status, objective, iteration, active plan, and blocker independently from the generic session configuration card.
  - Updated `src/ui/timeline.ts` and `src/i18n.ts` so goal lifecycle events render as first-class timeline rows and the live monitor panel shows a dedicated goal summary/detail section during execution.
  - Updated `src/ui/tui/tui-status-panel.ts` so the running panel now includes the active goal contract summary without breaking width alignment or truncation behavior.
  - Fixed TUI goal-context cleanup on session switches so one session’s active goal state cannot leak visually into another session after `/session switch` or similar control-flow changes.
  - Added coverage in `test/unit/tui.test.ts` for goal panel rendering, width alignment, and goal lifecycle timeline events, while keeping the existing goal CLI integration flow green.
- Verification:
  - `bun run typecheck`
  - `bun test test/unit/tui.test.ts test/integration/cli.test.ts --test-name-pattern "goal|tui"`
  - `bun run gate`
- Notes: the goal runtime now has three aligned observability surfaces: durable session logs, timeline lifecycle events, and live status-panel context. The remaining work is now more about refining the goal controller contract than making the mode visible or auditable.

## Step 50: Fix Goal Iteration Semantics And Add Goal Lifecycle Logs

- Scope: fix the goal iteration counter so the first plan slice stays on iteration 1 and only a new post-review slice advances to the next iteration; add dedicated goal lifecycle log events so goal automation is auditable beyond plain stdout text.
- Implementation:
  - Updated `src/goal.ts` with an `activateGoalPlan(...)` helper so the transition into `executing` now follows state semantics instead of the old incidental `reason ? iteration + 1` rule.
  - Updated `src/cli.ts` so the first planning round no longer skips directly to iteration 2, while a new plan activated from `reviewing` now advances to the next iteration as intended.
  - Added explicit logger state events for `goal.started`, `goal.definition`, `goal.planning`, `goal.executing`, `goal.reviewing`, `goal.paused`, `goal.blocked`, `goal.completed`, and `goal.cleared`, each carrying goal id, objective, iteration, blocker, active plan, and acceptance-check counts.
  - Updated `test/unit/goal.test.ts` and `test/integration/cli.test.ts` to lock the fixed iteration behavior and require the new lifecycle log events in the delegated goal end-to-end run.
- Verification:
  - `bun run typecheck`
  - `bun test test/unit/goal.test.ts test/integration/cli.test.ts --test-name-pattern "goal"`
- Notes: this keeps goal mode in-process and auto-running, but makes the state machine less misleading during multi-slice execution and gives session logs enough structure to audit how a goal actually progressed.

## Step 48: Close Goal Planning And Delegated Subagent E2E Loop

- Scope: fix the forced-planning path so plan mode can do bounded read-only inspection before submitting a proposal plan, while still blocking implementation/delegation until approval; add an end-to-end CLI regression for `/goal` auto-planning through delegated subagent execution and completion.
- Implementation:
  - Updated `src/prompt/agent.ts` and `src/goal.ts` so the initial planning gate permits bounded read-only inspection, then requires a proposal plan; implementation edits and delegation stay expressed as approved plan steps.
  - Updated `src/plans.ts` and `src/agent/planner.ts` so delegation-oriented plan steps preserve or infer hidden `executorHint: "subagent"` and `subagentRole`, letting approved plans actually drive `delegate_subagent` execution.
  - Increased foreground subagent budgets in `src/agent/subagent-runtime.ts` and `src/agent/subagent-routing.ts`, added role-specific compact subagent prompts, and passed recent successful subagent results into follow-up subagents so one main run can reuse delegated findings.
  - Made `lowRisk` a required structured-plan boolean in prompts/parser output and added conservative fallback inference for missing `lowRisk`: read-only inspect/verify/document plans can auto-classify low-risk, while edits, gates, debugger/tester work, secrets/auth/payment/database/deploy keywords, or explicit `lowRisk: false` stay non-auto-approved.
  - Fixed normal CLI sessions so `forcePlanning` applies only while a goal is actively planning, not to every build prompt; fixed the fake provider plan/summary/cache benchmark interactions exposed by the full gate.
  - Fixed sandbox command timeout/cancel behavior by explicitly terminating the spawned process when the timeout or abort signal fires.
  - Fixed the low-risk approval message in `src/cli.ts` to use `activeSettings.language` instead of a non-existent parsed `args.language` field.
  - Added `test/unit/goal.test.ts`, expanded planning/prompt coverage, added a runner-level delegated-plan regression, and added a real CLI e2e test that starts `/goal goal-delegated-e2e`, auto-activates the plan, delegates to an explorer subagent, completes the plan step, and calls `goal_complete`.
- Verification:
  - `bun test test/unit/prompt.test.ts test/unit/goal.test.ts test/unit/runner.test.ts test/unit/planning-layer.test.ts test/unit/subagent-routing.test.ts test/unit/sandbox.test.ts test/unit/cache-benchmark.test.ts`
  - `bun test test/integration/agent.test.ts --test-name-pattern "build-simple-edit|legacy plan alias can still request|summary compaction uses a derived subagent route|plan mode allows bounded readonly exploration|plan mode fails closed|forced planning can activate"`
  - `bun test test/integration/cli.test.ts`
  - `bun test test/integration/cli.test.ts --test-name-pattern "goal mode auto-plans"`
  - `bun test test/integration/agent.test.ts --test-name-pattern "forced planning can activate a delegated inspect step and continue in the same session|delegate_subagent task packets include the active plan step assignment"`
  - `bun run typecheck`
- Notes: this slice keeps normal non-goal plan approval behavior unchanged; the bypass is only for active goal automation.

## Step 49: Require Goal Acceptance Contracts And Post-Slice Review

- Scope: tighten goal mode so each goal must define explicit acceptance criteria before the first plan, and every completed plan slice must pass a bounded review/verification stage before EasyCode either finishes the goal or creates the next plan.
- Implementation:
  - Updated `src/goal.ts`, `src/cli.ts`, `src/context/ledger.ts`, and `src/tool/builtins/retrieval-tools.ts` so goals now start in `defining`, persist `acceptanceCriteria` plus `completionChecks`, require the new `goal_set_acceptance` internal tool before planning, and move through a `reviewing` phase after each completed plan slice instead of jumping directly to `goal_complete` or another planning round.
  - Updated `src/tool/builtins/common.ts` and `src/permission.ts` so `goal_set_acceptance` has a typed schema and is allowed only inside the dedicated goal/build automation path; `goal_complete` now fails closed when no acceptance contract was recorded.
  - Updated `src/provider/fake.ts` so the fake provider drives the new goal lifecycle in tests: define acceptance, run a delegated execution slice, invoke a reviewer subagent after the slice, and only then call `goal_complete`.
  - Updated `test/unit/goal.test.ts`, `test/unit/tool.test.ts`, `test/unit/permission.test.ts`, and `test/integration/cli.test.ts` to cover the definition prompt, assessment prompt, acceptance persistence, fail-closed completion semantics, and the end-to-end `define -> plan -> execute -> review -> complete` CLI loop.
  - Updated `specs/016-goal-mode.md` so the design contract now matches runtime behavior: explicit goal acceptance definition, a `reviewing` state, `goal_set_acceptance`, and post-slice verification before completion or replanning.
- Verification:
  - `bun run typecheck`
  - `bun test test/unit/goal.test.ts test/unit/tool.test.ts test/unit/permission.test.ts test/integration/cli.test.ts --test-name-pattern "goal|goal profile auto-allows goal tools and bounded verification bash"`
- Notes: goal mode still bypasses manual plan approval only for bounded low-risk continuation, but completion is now stricter because every slice must survive an explicit review/verification gate before the controller can finish or continue the goal.

## Step 47: Implement In-Process Goal Mode V1

- Scope: turn the English goal-mode design into a working in-process v1 execution layer so `/goal` can start one long-lived objective, auto-approve its bounded plans, keep running through plan slices, and fail closed on high-risk tool requests instead of stopping for manual approval.
- Implementation:
  - Added `src/goal.ts` plus CLI wiring in `src/cli.ts` and `src/slash.ts` so EasyCode now supports `/goal <objective>`, `/goal status`, `/goal pause`, `/goal resume`, and `/goal clear`, tracks one transient goal in ledger state, auto-queues planning prompts, auto-activates proposed plans inside goal mode, and replans the next slice after a goal plan completes.
  - Updated `src/tool/builtins/common.ts`, `src/tool/builtins/retrieval-tools.ts`, `src/permission.ts`, `src/context/ledger.ts`, `src/session/index.ts`, and `src/i18n.ts` so goal mode has explicit `goal_complete` / `goal_blocked` internal tools, a dedicated fail-closed permission profile with verification-bash allowlisting, goal ledger subjects carried through the current process but stripped on session restore, and CLI/TUI help text that exposes the new command surface.
  - Added regression coverage in `test/unit/slash.test.ts`, `test/unit/session.test.ts`, `test/unit/permission.test.ts`, `test/unit/tool.test.ts`, `test/unit/tui.test.ts`, and `test/integration/cli.test.ts` for `/goal` parsing, transient goal-ledger cleanup, goal permission behavior, goal tool semantics, and the updated TUI welcome command list.
- Verification:
  - `bun run typecheck`
  - `bun test test/unit/slash.test.ts test/unit/session.test.ts test/unit/permission.test.ts test/unit/tool.test.ts`
  - `bun test test/unit/tui.test.ts test/integration/cli.test.ts -t "renders session context, command bar, timeline events, and status updates|tui session covers settings, sessions, and prompt rendering"`
  - `bun run gate`
- Notes: v1 keeps goal state in-process only, reuses the existing unified build/plan runtime, and deliberately auto-rejects non-allowlisted bash or other approval-gated requests during active goal automation so the controller can pause or block instead of surfacing a manual approval prompt.

## Step 46: Tighten Subagent Shell Boundaries And Add Goal-Mode Design

- Scope: close the gap where debugger/tester subagents could inherit build-mode shell auto-approval for arbitrary mutating commands, make session deletion clean up subagent transcript files too, and land an English goal-mode design doc for the next execution layer.
- Implementation:
  - Updated `src/permission.ts` and `src/agent/runner/index.ts` so subagents now use a dedicated permission profile: non-debug roles deny shell outright, debugger/tester roles only allow a bounded verification command allowlist, and unmatched subagent shell requests are rejected instead of being auto-approved through the main build profile.
  - Updated `src/session/index.ts` so `/session delete` now removes `.subagents.jsonl` and `.subagents.txt` alongside the main session transcript and structured plan directory.
  - Added regression coverage in `test/unit/permission.test.ts`, `test/unit/session.test.ts`, and `test/integration/agent.test.ts` for bounded debugger/tester shell permissions, subagent transcript cleanup on session deletion, and a debugger subagent attempting a mutating shell command.
  - Added `specs/016-goal-mode.md` as the technical plan for v1 goal mode, covering GoalState, GoalController, goal-specific tools, layered permissions, state machines, TUI/logging, and phased rollout boundaries.
- Verification:
  - `bun test test/unit/permission.test.ts test/unit/session.test.ts test/integration/agent.test.ts -t "subagent|deletes session files and archives a summary to project memory|subagent permissions allow only bounded verification bash for debugger and tester roles"`
  - `bun run typecheck`
  - `bun run gate`
- Notes: this slice keeps explicit subagent delegation and bounded verification bash, but removes the accidental path where goal-mode automation would otherwise inherit an unsafe mutating shell escape hatch through debugger/tester roles.

## Step 45: Narrow macOS Temp-Root Sandbox Allowlist

- Scope: reduce repeated macOS native sandbox bypass prompts for ordinary HTTPS/toolchain commands without widening shell writes to the entire system temp tree.
- Implementation:
  - Updated `src/sandbox.ts` so the native macOS write sandbox still defaults to project-root-only writes, but now also allows the current session's per-user temp/cache root under `var/folders`, including `/private` path variants, to cover implicit TLS and runtime scratch writes.
  - Kept the broader project-root path boundary and explicit `sandbox_bypass` approval flow unchanged, so direct references to outside paths like `/tmp/...` still require an explicit bypass instead of being silently opened up.
  - Added regression coverage in `test/unit/sandbox.test.ts` to lock the new per-session temp-root allowlist and ensure the profile does not expand to the whole `/private/var/folders` tree; updated `specs/005-boundary-conditions.md` and `specs/acceptance.md` to document the refined contract.
- Verification:
  - `bun test test/unit/sandbox.test.ts`
  - `bun run typecheck`
  - `bun run gate`
- Notes: this slice is intentionally narrower than allowing `/tmp` or the full `var/folders` subtree; it targets only the current macOS session's scratch area to reduce prompt fatigue without giving arbitrary global temp writes a free pass.

## Step 44: Restore Separate Summary-Compaction Budgeting

- Scope: fix the regression where background `summary` compaction accidentally started consuming the same per-run budget line as foreground `delegate_subagent` tasks, which surfaced bogus `Subagent summary failed` timeline errors.
- Implementation:
  - Updated `src/agent/runner/index.ts` so background summary compaction no longer calls `reserveSubagentBudget()` and instead runs on its own lifecycle again: one background summary at a time, with its own route-level `maxProviderCalls`, but without sharing the foreground subagent invocation/role counters.
  - Kept `delegate_subagent` budgeting unchanged for explicit foreground roles, restored the original `summary` role cap in `src/agent/subagent-runtime.ts`, and kept the TUI invocation accounting change so only actually scheduled subagents affect visible per-role counts.
  - Added regression coverage in `test/integration/agent.test.ts` proving that summary compaction still runs even when the foreground subagent counters are already exhausted, and that no fake summary failure event is emitted.
- Verification:
  - `bun test test/integration/agent.test.ts -t "summary compaction is budgeted separately from foreground subagents"`
  - `bun test test/integration/agent.test.ts -t "context compaction"`
  - `bun test test/unit/tui.test.ts test/unit/timeline.test.ts`
  - `bun run typecheck`
  - `bun run gate`
- Notes: the intended contract is that background context compaction is an internal maintenance path, not a consumer of the foreground subagent budget pool.

## Step 43: Subagent Detail Visibility And Delegation Gate

- Scope: make subagent usage readable enough to diagnose whether work was actually delegated, and add a narrow coordinator retry gate for obvious pure-search turns so the model stops doing all bounded exploration itself.
- Implementation:
  - Updated `src/ui/timeline.ts`, `src/ui/tui/index.ts`, `src/ui/tui/tui-state.ts`, `src/ui/tui/tui-cards.ts`, and `src/i18n.ts` so timeline rows now include the subagent request id, closeout cards distinguish subagent invocation count from internal turns, and round summaries show a per-role breakdown such as `explorer x2`.
  - Kept persisted session accounting backward-compatible, but relabeled the existing cumulative `subagentCalls` display as internal turns instead of user-facing invocation count so the TUI no longer implies that provider turns equal `delegate_subagent` calls.
  - Updated `src/agent/subagent-runtime.ts`, `src/agent/runner/index.ts`, `src/agent/runner/validated-provider-turn.ts`, `src/prompt/agent.ts`, and `src/tool/builtins/retrieval-tools.ts` so the coordinator now retries a turn when it proposes an obvious pure bounded search/navigation burst (`repo_map` / semantic search style tools) without delegating first, while preserving the old hypothesis-drift retry budget and leaving normal read-before-edit flows alone.
  - Added regression coverage in `test/unit/timeline.test.ts`, `test/unit/tui.test.ts`, and `test/integration/agent.test.ts` for subagent detail rendering and the new delegation-gate retry path.
- Verification:
  - `bun test test/unit/timeline.test.ts`
  - `bun test test/unit/tui.test.ts`
  - `bun test test/integration/agent.test.ts`
  - `bun run typecheck`
  - `bun run gate`
- Notes: this slice intentionally gates only obvious pure exploration bursts and external research turns; single-file reads and normal coordinator edit flows still stay local to avoid forcing subagents into every trivial patch.

## Step 42: Web Fetch Tool And Curl Interception

- Scope: replace readonly `curl` shell usage with a first-class internal `web_fetch` tool, so common HTTP fetches stop consuming bash approvals and can be audited/compacted like other retrieval tools.
- Implementation:
  - Added `web_fetch` in `src/retrieval/index.ts`, `src/retrieval/retrieval-format.ts`, `src/tool/builtins/common.ts`, and `src/tool/builtins/retrieval-tools.ts` with bounded GET/HEAD fetch support, safe-header validation, redirects/retries/timeouts, TLS override, structured citations, and compactable tool output.
  - Updated `src/tool/bash.ts` and `src/tool/registry.ts` so `curl` is now classified as replaceable `http_fetch`, blocked before sandbox execution, and when possible translated into a suggested `web_fetch` input payload for the next model turn.
  - Updated `src/permission.ts`, `src/message.ts`, `src/agent/subagent-runtime.ts`, and `src/tool/utils/duplicate-inspection.ts` so `web_fetch` is default-allowed, subagent-safe, history-compacted, and participates in duplicate-inspection suppression, while fallback bash auto-review no longer treats `curl` as an allowed readonly path.
  - Added regression coverage in `test/unit/retrieval.test.ts`, `test/unit/tool.test.ts`, and `test/unit/permission.test.ts` for bounded fetch output, safe-header enforcement, default permission behavior, and `curl -> web_fetch` interception with translated suggestions.
  - Followed up on review findings by aligning `web_fetch` defaults with plain `curl` semantics (`followRedirects=false` unless explicitly requested), narrowing bash interception to only the `curl` shapes that can be safely translated into readonly `web_fetch`, and expanding the coordinator delegation gate so even a single pure fact-finding tool call or `web_fetch` docs lookup is redirected through `delegate_subagent`.
- Verification:
  - `bun test test/unit/retrieval.test.ts test/unit/tool.test.ts test/unit/permission.test.ts`
  - `bun run typecheck`
  - `bun test`
  - `bun run gate`
- Notes: this slice intentionally keeps `web_fetch` readonly. Auth-bearing headers, request bodies, and file-output curl patterns are not rewritten into `web_fetch`; they fall back to ordinary bash review/approval instead of losing capability.

## Step 41: Planning Hard Gate And Auto-Continue Execution

- Scope: make planning-stage assistant responses fail closed unless the model actually returns a proposal plan, and make approved plans continue across steps in the same run instead of asking the user whether to proceed after each completed step.
- Implementation:
  - Updated `src/agent/protocol.ts`, `src/agent/runner/validated-provider-turn.ts`, and `src/agent/runner/index.ts` so planning-stage turns now run through an explicit hard validator: if the final turn has no tool calls and is neither a `<proposed_plan>...</proposed_plan>` response nor a `plan_exit` call, EasyCode injects a correction prompt and retries; repeated non-compliance now fails the run closed.
  - Updated `src/prompt/agent.ts`, the active-step reminder in `src/agent/runner/index.ts`, and `src/tool/builtins/retrieval-tools.ts` so approved plans explicitly continue to the next step after `plan_step_complete` without re-asking the user, and the tool result itself nudges the next-turn model call to keep going.
  - Updated `test/integration/agent.test.ts` to cover retry-on-invalid-plan, fail-closed refusal, the draft-plan status path without reopening the replan branch, and same-run multi-step auto-continuation.
- Verification:
  - `bun test test/integration/agent.test.ts`
  - `bun run typecheck`
- Notes: exploratory read/search turns remain allowed before the final plan; the hard gate only applies when the model tries to finish a planning-stage turn without returning a proposal plan, while execution-mode auto-continue only affects approved running plans.

## Step 40: Live Subagent Runtime, Hidden Delegation Metadata, And Isolated Logs

- Scope: ship the first live multi-role subagent runtime where the coordinator can explicitly delegate bounded tasks, the runner intercepts and executes them internally, plan-mode executor hints stay hidden from user-facing plans, and subagent logs/transcripts are isolated from the main agent.
- Implementation:
  - Added `delegate_subagent` as a coordinator-only internal action plus `src/agent/subagent-runtime.ts`, expanded `src/agent/subagent-routing.ts`, and updated `src/agent/runner/index.ts` / `src/agent/runner/summary-subagent.ts` so six roles now resolve deterministic routes, enforce hard invocation/turn caps, block nested delegation and coordinator-only actions inside subagents, and run with derived provider instances including the DeepSeek `deepseek-v4-flash` override for all subagents.
  - Extended the live runtime with subagent task packets and task-state tracking, so delegated work now carries `task`, `successCriteria`, `maxProviderCalls`, and any active plan-step assignment into the subagent prompt instead of relying on an ad hoc one-line request.
  - Changed subagent budget exhaustion from a hard failure into a structured `handoff` result that returns staged findings, artifacts, and the next narrow follow-up for the coordinator; the main agent receives that handoff as a successful tool result and can decide whether to re-scope and delegate again.
  - Updated `src/agent/protocol.ts`, `src/agent/types.ts`, `src/prompt/agent.ts`, `src/plans.ts`, and `src/agent/planner.ts` so internal subagent roles exist as distinct agent metadata, structured plans can carry hidden `executorHint` / `subagentRole` fields, and rendered user-visible plan markdown strips those internal delegation details.
  - Updated logging, metrics, session/TUI/timeline surfaces, and failure rendering across `src/logger.ts`, `src/agent/metrics.ts`, `src/instrumentation/index.ts`, `src/session/index.ts`, `src/cli.ts`, `src/ui/timeline.ts`, `src/ui/tui/*`, and related provider wrappers so subagent lifecycle events, routed model/thinking/effort, separate transcript files, and subagent token usage are visible without mixing provider turns into the main transcript; the closeout failure card now wraps full follow-up guidance instead of truncating it.
  - Added regression coverage across `test/integration/agent.test.ts`, `test/integration/cli.test.ts`, `test/unit/subagent-routing.test.ts`, `test/unit/agent.test.ts`, `test/unit/timeline.test.ts`, `test/unit/tui.test.ts`, `test/unit/context.test.ts`, and `test/unit/session.test.ts` for route resolution, runner interception, nesting blocks, separate log files, hidden plan metadata, task-packet plan-step assignment, stage handoff behavior, TUI visibility, and max-step continuation output.
- Verification:
  - `bun run typecheck`
  - `bun test test/unit/subagent-routing.test.ts test/unit/agent.test.ts test/unit/logger.test.ts test/integration/agent.test.ts`
  - `bun test test/unit/context.test.ts test/unit/session.test.ts test/unit/timeline.test.ts test/unit/tui.test.ts`
  - `bun test test/integration/cli.test.ts -t "session continues after max steps"`
  - `bun test`
  - `bun run cache:bench -- --provider simulated --suite real --quiet`
  - `bun run gate`
- Notes: v1 keeps subagent spawning explicit for non-summary roles, allows only one background `summary` task at a time, keeps the coordinator on the user-selected main-session model, and now treats subagent turn exhaustion as a coordinator handoff rather than a hard failure.

## Step 39: TUI Closeout Ordering And No-Op Compaction Guard

- Scope: stop final answer text from being rendered underneath the TUI summary card, remove the redundant closeout `status: completed` line, and prevent context compaction from immediately re-summarizing the exact same preserved tail.
- Implementation:
  - Updated `src/ui/tui/index.ts` so `run_done` / `failure` now flush the timeline before drawing the closeout card, keep the final status only in renderer state, and avoid printing an extra `[status] completed` line after the summary.
  - Updated `src/context/manager.ts` so `compactionSnapshot()` now skips background summary work when a prior summary already exists, no older messages remain to compact, and the preserved provider-safe tail would be byte-for-byte identical after another pass.
  - Added regression coverage in `test/unit/tui.test.ts` and `test/unit/context.test.ts` to lock the answer-before-summary ordering, the removed redundant status line, and the no-op compaction guard.
- Verification:
  - `bun test test/unit/tui.test.ts test/unit/context.test.ts test/unit/session.test.ts test/unit/timeline.test.ts test/integration/agent.test.ts`
  - `bun run typecheck`
  - `bun run cache:bench -- --provider simulated --suite real --quiet`
  - `bun run gate`
- Notes: this slice does not change the normal first-pass compaction behavior; it only blocks repeated summaries when the live tail would not shrink any further.

## Step 38: Separate Subagent Token Accounting

- Scope: make subagent cost visible and durable without folding it into the coordinator's main-round token summary, so token blowups can be diagnosed quickly from the TUI and persisted session state.
- Implementation:
  - Updated `src/session/index.ts` and `src/cli.ts` so session token usage now persists separate cumulative `subagentInputTokens`, `subagentOutputTokens`, and `subagentCalls`, while keeping the main-agent counters unchanged.
  - Updated `src/ui/tui/index.ts`, `src/ui/tui/tui-state.ts`, `src/ui/tui/tui-render-loop.ts`, `src/ui/tui/tui-cards.ts`, and `src/i18n.ts` so completed runs now show both round-level and session-level subagent usage in the TUI closeout summary.
  - Added regression coverage in `test/unit/session.test.ts` and `test/unit/tui.test.ts` to lock the new session persistence shape and the visible subagent usage lines in the TUI output.
- Verification:
  - `bun test test/unit/session.test.ts test/unit/tui.test.ts test/unit/timeline.test.ts test/integration/agent.test.ts`
  - `bun run typecheck`
  - `bun run gate`
- Notes: this slice is accounting-only; it does not change when subagents spawn or how the main-agent provider metrics are computed.

## Step 37: Deterministic Subagent Routing, Budgeting, And TUI Visibility

- Scope: add a deterministic internal routing policy for subagents, keep v1 on the same provider/model family, and make background subagent scheduling visible without letting it silently explode token usage.
- Implementation:
  - Added `src/agent/subagent-routing.ts` as the internal routing layer with role-based reasoning presets, provider-capability clamping, and explicit execution budgets including `maxProviderCalls` plus optional `maxOutputTokens`.
  - Updated `src/agent/runner/index.ts`, `src/agent/runner/summary-subagent.ts`, `src/agent/runner/provider-turn.ts`, and provider/runtime wrappers so the summary subagent now resolves a route, derives a provider instance when supported, runs with a bounded one-call budget, and avoids hijacking the main run's provider progress loop.
  - Updated instrumentation, logging, timeline/TUI rendering, and tests so routed subagent provider/model/thinking/effort/output-cap are visible in logs and the TUI timeline, while the main-session `/thinking` and `/effort` semantics remain unchanged.
- Verification:
  - `bun test test/unit/subagent-routing.test.ts test/unit/agent.test.ts test/unit/timeline.test.ts test/unit/tui.test.ts test/integration/agent.test.ts`
  - `bun run typecheck`
  - `bun run gate`
- Notes: v1 still avoids automatic model-name tiering; the live consumer is summary compaction only, but the route/role metadata is now ready for future explorer/reviewer/debugger-style subagents.

## Step 36: Unified Run Mode And Planning UX Convergence

- Scope: remove the public `build` vs `plan` split, make direct prompts the default single-run entrypoint without requiring `--once`, and keep the new planning layer operating behind one unified runtime contract.
- Implementation:
  - Updated `src/cli.ts`, `src/prompt/agent.ts`, `src/agent/runner/index.ts`, `src/agent/protocol.ts`, `src/provider/fake.ts`, and `src/tool/builtins/retrieval-tools.ts` so EasyCode now exposes one user-facing run mode, accepts prompt-first single runs, allows `plan_exit` during normal runs, and keeps plan approval plus step execution in the same session flow.
  - Updated TUI/timeline rendering to show a unified `RUN` state instead of separate `BUILD` / `PLAN` badges while preserving the same execution engine underneath.
  - Updated README, acceptance criteria, data-structure/state-machine specs, and TUI/LSP planning docs to describe plan-as-a-stage rather than plan-as-a-separate-mode.
- Verification:
  - `bun test test/unit/agent.test.ts test/unit/cli.test.ts test/unit/permission.test.ts test/unit/tool.test.ts test/unit/sandbox.test.ts test/unit/tui.test.ts test/integration/agent.test.ts`
  - `bun test test/unit/prompt.test.ts test/unit/timeline.test.ts`
  - `bun run eval --provider fake`
  - `bun run typecheck`
  - `bun run gate`
- Notes: legacy `easycode build ...`, `easycode plan ...`, and `--once` parsing remain tolerated as compatibility aliases for now, but they are no longer the documented primary interface.

## Step 35: Planning Layer Safety And Checkpoint Hardening

- Scope: fix the first structured-planning rollout regressions by restoring the build-vs-plan CLI contract, making structured-plan activation fail closed, and persisting active-plan state as a real checkpoint instead of reconstructing it from scattered ledger fields.
- Implementation:
  - Updated `src/cli.ts` so the default CLI mode is back to `build`, `easycode plan --once ...` stays read-only, and interactive plan approval only auto-queues execution after an explicit approval step.
  - Updated `src/plans.ts`, `src/agent/planner.ts`, `src/agent/runner/index.ts`, and `src/tool/builtins/retrieval-tools.ts` so structured plans now validate strictly, persist a typed checkpoint (`currentStepId`, step-status map, lifecycle status, blocker/replan metadata), and only trigger replanning for explicit revision prompts rather than for every non-approval follow-up.
  - Updated planning-layer, CLI, and integration coverage to lock the fail-closed parser behavior, active-plan checkpoint persistence, default build-mode CLI contract, status-question non-replanning, and explicit replanning path.
- Verification:
  - `bunx tsc --noEmit`
  - `bun test test/unit/planning-layer.test.ts test/unit/cli.test.ts test/integration/agent.test.ts`
  - `bun run gate`
- Notes: markdown plan output remains the compatibility baseline; the structured execution layer is now best-effort and safe to skip when parsing fails instead of silently downgrading into an unconstrained edit step.

## Step 34: Compaction Tail Retention And 64k Default Window

- Scope: reduce summary-mode continuity loss by keeping a materially larger raw conversation tail after compaction and raising the default context budget to a 64k window.
- Implementation:
  - Updated `src/context/strategy.ts`, `src/context/manager.ts`, and `src/settings.ts` so the default session/context budget is now `64_000` tokens and the default post-compaction preserved-tail budget scales with the window instead of staying pinned at `3_000`.
  - Kept the active-window contract at three recent user turns, and aligned `src/context/tokens.ts` plus session persistence behavior so compacted contexts and restored sessions now keep the last three completed user/assistant rounds by default under normal-sized turns.
  - Updated boundary/acceptance specs and added regression coverage in `test/unit/context.test.ts` and `test/unit/session.test.ts` for default three-turn retention.
- Verification:
  - `bun test test/unit/context.test.ts test/unit/session.test.ts test/unit/slash.test.ts`
  - `bun run typecheck`
  - `bun run cache:bench -- --provider simulated --suite real --quiet`
  - `bun run gate`
- Notes: explicit user overrides for `maxTokens`, `preserveRecentUserTurns`, or `compactPreserveTokens` still win; this slice changes only the default continuation policy.

## Step 33: Durable Memory Promotion Paths

- Scope: add an explicit promotion path for durable cross-session memory so the model can store stable lessons intentionally, instead of overloading generic `memory_add` for every long-term use case.
- Implementation:
  - Updated `src/memory.ts` with `ProjectMemoryPromotableKind`, a `promote()` API, and concise-text guardrails that reject oversized narrative payloads for durable lessons.
  - Added `memory_promote` in `src/tool/builtins/workspace-tools.ts` plus the corresponding schema in `src/tool/builtins/common.ts`, limiting promotion to `preference`, `repo_fact`, `failure_pattern`, `successful_workflow`, and, at that time, `task_state`.
  - Tightened the build-mode prompt contract in `src/prompt/agent.ts` so the model is explicitly told when long-term memory promotion is appropriate and when it is not.
- Verification:
  - `bun test test/unit/memory.test.ts test/unit/tool.test.ts test/unit/prompt.test.ts`
  - `bun run typecheck`
  - `bun run gate`
- Notes: this phase adds explicit promotion mechanics only; automatic reflection-driven promotion of repeated lessons remains a later roadmap phase.

## Step 32: Structured Project Memory And Auto Recall

- Scope: turn project memory from a text-only archive into a structured long-term memory layer with bounded automatic recall for continuation-style prompts, without introducing embeddings or external storage.
- Implementation:
  - Added [specs/015-memory-module-roadmap.md](specs/015-memory-module-roadmap.md) to define EasyCode's memory architecture, typed long-term record model, write/recall policy, and phased roadmap.
  - Updated `src/memory.ts` so project memory records now carry `kind` and optional `scope`, old note-style records remain readable, and formatted/queryable structured output is available to tools and runtime recall paths.
  - Updated `src/tool/builtins/workspace-tools.ts` and `src/tool/builtins/common.ts` so `memory_add` can write typed records with optional scope and `memory_query` renders structured records instead of anonymous free-text lines.
  - Updated `src/session/index.ts` so deleted sessions are archived as `session_archive` records, and updated `src/agent/runner/index.ts` so prompts like `继续`, `上次`, `resume`, or `continue` can inject a bounded `<project_memory_recall>` block into the current run.
- Verification:
  - `bun test test/unit/memory.test.ts test/unit/session.test.ts test/unit/tool.test.ts test/integration/agent.test.ts`
  - `bun run typecheck`
  - `bun run gate`
- Notes: this phase keeps retrieval local and deterministic; vector search, reflection-driven promotion, and broader task checkpointing remain later phases.

## Step 31: Receiver-Type-Aware Method Resolution

- Scope: make semantic code navigation distinguish same-name class/interface methods by receiver type instead of collapsing back to bare-name matching when the call site is `service.login()` or `this.login()`.
- Implementation:
  - Updated `src/tool/code-navigator/ast.ts` so TypeScript local-binding scopes now retain high-confidence receiver type hints from parameter annotations, local variable annotations, `new T()` initializers, and enclosing class context for `this`.
  - Updated `src/tool/code-navigator/code-index.ts` so TypeScript method declarations record owner-aware ids and qualified names like `src/auth.AuthService.login`, and call-edge resolution now prefers methods attached to the hinted receiver type before import/local/global name fallback.
  - Bumped the code-index cache generator version and added a regression test covering same-name `login` methods on different classes, including both `service.login()` and `this.login()` call sites.
- Verification:
  - `bun test test/unit/code-navigator.test.ts`
  - `bun run typecheck`
  - `bun run gate`
- Notes: this is intentionally a high-confidence heuristic pass, not a full type checker; it handles the common annotated/local-construction cases without trying to infer arbitrary property chains or dynamic dispatch.

## Step 30: Sharpen Tool Capability Descriptions

- Scope: make the code-navigation and shell tool descriptions more decision-oriented so models choose semantic tools before falling back to `grep` or `bash` for repository exploration.
- Implementation:
  - Updated tool descriptions in `src/tool/builtins/code-tools.ts` so `repo_map`, `find_definition`, `find_references`, `call_graph`, `rg_search`, `grep`, `read`, and `read_lines` now explain priority, best-fit use cases, and fallback boundaries instead of only naming the primitive.
  - Updated the `bash` description in `src/tool/builtins/workspace-tools.ts` so it is explicitly framed as a last-resort escape hatch, not a normal exploration tool.
  - Strengthened `src/prompt/agent.ts` and `src/prompt/context.ts` so the stable system prefix tells the model when semantic tools outrank `rg_search`, `grep`, and `bash`, and when each fallback is appropriate.
  - Added unit coverage for both the tool descriptions and the prompt contract to lock the wording that steers tool choice.
- Verification:
  - `bun test test/unit/tool.test.ts test/unit/prompt.test.ts`
  - `bun run gate`
- Notes: this slice changes selection guidance only; it does not alter tool permissions, schemas, or runtime execution behavior.

## Step 29: Qualified Symbol Selectors For Definition And Reference Lookup

- Scope: close a code-navigation gap where `find_definition` and `find_references` still behaved like bare-name search under same-name collisions, even though `call_graph` already accepted qualified symbol selectors.
- Implementation:
  - Updated `src/tool/code-navigator/code-index.ts` so definition/reference lookup now accepts the same selector families as call-graph starts: bare symbol name, qualified name, or symbol id.
  - Updated `src/tool/code-navigator/cli.ts` so qualified/id queries stay semantic-only instead of falling back to misleading text-pattern search when the code index has no match.
  - Updated tool descriptions in `src/tool/builtins/code-tools.ts` and added a regression test proving same-name `leaf` exports can be disambiguated via `src/impl.leaf` and `src/other.ts#leaf`.
- Verification:
  - `bun test test/unit/code-navigator.test.ts`
  - `bun run gate`
- Notes: this slice improves selector precision for existing read-only navigation tools; it does not yet add receiver-type-aware method resolution.

## Step 28: Expose Provider Failures In Smoke Eval

- Scope: stop provider-gate smoke eval from hiding real provider failures behind a derived `missing output ...` message when the run never completed successfully.
- Implementation:
  - Updated `dev/quality/eval.ts` so non-completed `AgentRunResult`s now surface a direct `run failed: ...` reason using the first meaningful provider failure line before falling back to expectation-diff messages.
  - Added a focused unit test for the new eval-failure summarizer so provider-level errors such as TLS or network failures remain visible in gate details.
- Verification:
  - `bun test test/unit/eval.test.ts test/unit/provider.test.ts`
  - `bun run typecheck`
  - `bun run gate`
- Notes: this keeps the gate red when the provider is actually unavailable, but it removes an unnecessary layer of indirection from the diagnosis.

## Step 27: Preserve Provider Fetch Failure Causes

- Scope: keep actionable network and TLS root causes visible when provider fetches fail, so quality-gate and provider-gate reports do not collapse everything into an unhelpful generic connection error.
- Implementation:
  - Updated `src/provider/http-sse.ts` to wrap transport-level `fetch(...)` failures in `ProviderError` instead of letting raw runtime exceptions escape past the provider adapter boundary.
  - Added nested error-cause extraction so messages such as `unable to get local issuer certificate` survive alongside the outer Bun/Node connectivity text in gate reports and interactive failures.
  - Added unit coverage that simulates a DeepSeek network failure with a nested TLS cause and asserts both messages remain visible.
- Verification:
  - `bun test test/unit/provider.test.ts`
  - `bun run gate`
- Notes: this does not make an unreachable provider succeed; it makes the failure diagnosable enough to distinguish certificate issues from broader network or proxy reachability problems.

## Step 26: Spec Contract Convergence

- Scope: reconcile drifted specs with the current runtime contract after retrieval-permission changes, global EasyCode env setup, and runtime/module boundary cleanup.
- Implementation:
  - Updated `specs/009-mcp-websearch.md` so it now reflects the shipped retrieval defaults: MCP reads and `web_search` are default-allowed, Tavily remains the only live engine, and startup guidance points to global `~/.easycode/.env` instead of repo-local `.env`.
  - Clarified that live retrieval follows timeout, TLS, and runtime network boundaries without fabricating results, matching the current `tls-config` and retrieval/provider behavior.
  - Updated `specs/acceptance.md` so the quality section now describes the actual architecture constraint in this repo: focused runtime responsibilities plus development-only tooling outside `src/`, and corrected the OpenAI credential wording.
- Verification:
  - `bun run gate`
- Notes: this slice is documentation-only; in the current environment the local checks are healthy, but `provider_gate` still depends on external DeepSeek reachability.

## Step 25: Compaction User-Trace And Capability Retention

- Scope: stop context compaction from dropping the exact current user ask or the active skill/MCP/connector capability surface, so restored sessions can continue without re-asking what "this" referred to.
- Implementation:
  - Expanded `src/prompt/compact.ts` and `src/prompt/agent.ts` so the summary contract explicitly preserves current user requirements, a direct user-input trace, and active capability state alongside the existing repo facts and next step.
  - Updated `src/agent/runner/hypothesis-state.ts`, `src/agent/runner/index.ts`, and `src/agent/runner/tool-execution.ts` so the ledger now records `current_user_input`, selected/pending skills, and observed MCP/connector/web-search usage, then folds them into a stable `active_capability_surface` record for compaction.
  - Tightened `src/context/ledger.ts` selection so those records stay current even when unrelated file-scope records are dropped, and extended prompt/context/runner/integration coverage to lock the behavior.
- Verification:
  - `bun test test/unit/prompt.test.ts test/unit/context.test.ts test/unit/runner.test.ts test/integration/agent.test.ts`
  - `bun run typecheck`
  - `bun run cache:bench -- --provider simulated --suite real --quiet`
  - `bun run gate`
- Notes: EasyCode still has no standalone plugin runtime in v1, so the capability surface records `plugins=none (EasyCode v1 runtime)` unless future runtime work adds one.

## Step 24: Permission Friction Reduction For Readonly Retrieval

- Scope: reduce repeated approval friction for high-frequency readonly retrieval without weakening the existing dangerous-command, secret-path, or sandbox-bypass protections.
- Implementation:
  - Updated `src/permission.ts` so `web_search` is default-allowed and readonly bash auto-review now covers safe `curl` GET/HEAD fetch scopes plus project-local `cat`, `rg`, `grep`, and `sed -n` reads.
  - Updated `src/tool/bash.ts` to classify those readonly commands into narrow repeat-safe scopes, while still falling back to exact-command approval for large file reads, unsafe curl flags, or more complex command shapes.
  - Synchronized README and specs so the documented permission contract matches the runtime behavior.
- Verification:
  - `bun test test/unit/permission.test.ts test/unit/tool.test.ts`
  - `bun run typecheck`
- Notes: secret-adjacent paths like `.env*` and `secrets/**` still avoid auto-approval, and outside-path/native-sandbox bypasses still require an explicit risk prompt.

## Step 23: Immediate Provider Wait State After Tool Completion

- Scope: remove the misleading “工具已完成” stall after a tool returns by surfacing the next provider-wait state immediately, without adding extra waiting spam to the timeline transcript.
- Implementation:
  - Updated `src/agent/runner.ts` so each provider turn emits an immediate `provider_progress` event with `elapsedMs: 0` before the timed progress loop starts.
  - Updated `src/ui/timeline.ts` to treat that zero-elapsed wait event as status-only, so the TUI panel refreshes while the textual timeline stays quiet.
  - Added `test/unit/runner.test.ts` to lock the event ordering after a successful `skill` tool result.
- Verification:
  - `bun test test/unit/runner.test.ts test/unit/tui.test.ts test/unit/timeline.test.ts`
- Notes: this change does not alter provider/tool execution semantics; it only fixes the handoff state the user sees between tool completion and the next model turn.

## Step 22: TUI Helper Extraction

- Scope: execute Phase 1 of the readability roadmap by shrinking `src/ui/tui.ts` into a clearer renderer façade while preserving the existing TUI contract and timeline behavior.
- Implementation:
  - Added `src/ui/tui-types.ts` for shared TUI context/output types.
  - Added `src/ui/tui-ansi.ts` for width, truncation, card, duration, and newline helpers that were previously embedded in `tui.ts`.
  - Added `src/ui/tui-cards.ts` for configured/session/welcome/success/failure card construction.
  - Added `src/ui/tui-status-panel.ts` for live monitor line generation and spinner-frame ownership.
  - Reduced `src/ui/tui.ts` so it focuses on state transitions, event handling, prompt status, and output orchestration instead of also owning the full rendering helper stack.
- Verification:
  - `bun test test/unit/tui.test.ts test/unit/timeline.test.ts`
  - `bun test test/unit/cli.test.ts`
  - `bun run gate`
- Notes: this slice is intentionally structural; `RunUiEvent`, prompt strings, TUI interaction flow, and session/timeline wiring are intended to remain behaviorally stable.

## Step 21: Singular XML Tool-Call Fallback

- Scope: recover tool execution when a model prints a single `<tool_call>...</tool_call>` wrapper instead of native tool calls, and suppress that wrapper from the visible TUI stream.
- Implementation:
  - Extended `src/provider/text-tool-protocol.ts` to parse singular XML wrappers that carry `<invoke_name>` plus nested `<args>` tags, including the observed `bash` + `<invoke>` command shape.
  - Added stream-filter coverage for singular `<tool_call>` blocks so raw wrapper markup no longer leaks into live text deltas before fallback extraction runs.
  - Added unit and integration coverage for the exact wrapper family that previously rendered verbatim instead of executing.
- Verification:
  - `bun test test/unit/provider.test.ts test/integration/agent.test.ts`
  - `bun run typecheck`
  - `bun run gate`
- Notes: this change is intentionally additive; the existing EasyCode text protocol, Anthropic-style XML fallback, and DSML variants remain unchanged.

## Step 20: TUI UI Language Selection

- Scope: localize fixed interactive CLI/TUI copy across six languages and add durable language selection at first startup plus a `/lang` session command.
- Implementation:
  - Added `src/i18n.ts` as the shared fixed-copy catalog for `en`, `zh`, `ja`, `fr`, `ko`, and `de`, covering slash help, session/setup prompts, TUI panels, live monitor status text, and timeline headings.
  - Extended `SessionSettings` with persisted `language`, wired startup to prompt for `EASYCODE_LANG` on first interactive launch, and saved the chosen default into `~/.easycode/.env`.
  - Added `/lang <code>` handling so the current session, future startup defaults, and TUI rendering can all switch languages without restarting the app.
  - Updated CLI/TUI tests to cover first-start language setup, `/lang` persistence, and the localized startup/web-search flow.
- Verification:
  - `bun test test/unit/slash.test.ts test/unit/session.test.ts test/unit/tui.test.ts test/unit/cli.test.ts`
  - `bun run typecheck`
- Notes: runtime/model/tool error strings outside the fixed TUI/session surface remain unchanged for now; this slice targets user-facing shell copy and startup/session UX.

## Step 19: Single Unified Gate

- Scope: collapse the public verification surface to one `bun run gate` command and make it include the former full gate plus real-provider checks by default.
- Implementation:
  - Simplified `dev/quality/quality-gate.ts` to a single fixed check plan: typecheck, tests, fake eval, simulated APIx subset, simulated cache benchmark, build, and provider readiness.
  - Removed public `gate:full`, `gate:provider`, `test:real`, `eval:real`, and `apix:real` scripts from `package.json`.
  - Updated `scripts/release.sh`, README, acceptance criteria, and eval spec so the repo now documents one gate vocabulary and one release verification entrypoint.
- Verification:
  - `bun test test/unit/quality-gate.test.ts test/unit/provider-gate.test.ts`
  - `bun run gate`
- Notes: the provider-gate implementation still exists internally, but it is now only an engine behind the unified gate instead of a separate public workflow.

## Step 18: Readability Refactor Roadmap

- Scope: convert the readability discussion into a repo-grounded structural-refactor plan that improves code navigation, sequencing, and verification discipline without changing runtime behavior.
- Implementation:
  - Added `specs/014-readability-refactor-roadmap.md` as the source-of-truth plan for phased readability and architecture cleanup.
  - Documented the current hotspot modules, target module boundaries, refactor ordering, per-phase risks, and required verification gates.
  - Captured the rule that each structural slice remains single-theme, updates the progress log, and runs `bun run gate`.
- Verification:
  - Reviewed current hotspot files and current `specs/` structure to ground the roadmap in the existing repo layout and constraints.
- Notes: this step is planning-only by design; it is intended to reduce future refactor risk and keep architecture work behavior-preserving rather than to change runtime semantics directly.

## Step 17: Gate Command Cleanup

- Scope: remove stage-specific verification aliases from the public CLI surface and make the repo speak one gate vocabulary consistently.
- Implementation:
  - Reduced `package.json` gate entrypoints to `bun run gate`, `bun run gate:full`, and `bun run gate:provider`.
  - Updated `scripts/release.sh` to use the unified gate names for local and real-provider verification before tagging.
  - Synchronized README and current specs so they no longer advertise `verify:v1`, `verify:full`, `verify:provider`, or the separate `provider:gate` entrypoint.
- Verification:
  - `bun run gate`
  - `bun run gate:full`
  - `bun run gate:provider -- --provider fake --no-apix --no-cache`
- Notes: the underlying quality-gate presets and provider-gate implementation remain intact; only the public command surface was simplified.

## Step 16: Compaction Summary Prompt Hardening

- Scope: make context-compaction summaries more production-safe by giving the summary subagent an explicit budget target, language/hypothesis preservation rules, stronger tool-noise distillation guidance, and safer malformed-output recovery.
- Implementation:
  - Expanded `src/prompt/compact.ts` so the compaction prompt now encodes role weighting, tool-output distillation, summary-language continuity, stricter summary-instruction inheritance, and a minimal `<summary>` example.
  - Added runtime prompt injection for `dynamicSummaryTokenBudget`, current active hypothesis, and latest-user language hints in `src/agent/runner.ts`.
  - Replaced the all-or-nothing summary extraction fallback with `extractCompactSummary(...)`, which recovers from fenced output, partial `<summary>` wrappers, and stray `<analysis>` blocks.
  - Added summary token telemetry to context-compaction timeline events and extended prompt/timeline/integration tests to lock the new behavior.
- Verification:
  - `bun test test/unit/prompt.test.ts test/unit/timeline.test.ts test/integration/agent.test.ts`
  - `bun run gate`
- Notes: this keeps the existing one-pass summary flow but makes the prompt contract and parser materially more robust for bilingual and tool-heavy coding sessions.

## Step 15: CLI Structure Refactor

- Scope: reduce `src/cli.ts` spaghetti by separating startup/env setup, session command handling, and line-reading primitives into dedicated modules without changing CLI behavior.
- Implementation:
  - Added `src/cli/line-reader.ts` for the readline queueing/abort mechanics so the entrypoint no longer owns low-level prompt plumbing.
  - Added `src/cli/startup.ts` for `.env` parsing/loading, provider startup configuration, live model preset lookup, and interactive Tavily/provider setup.
  - Added `src/cli/session-helpers.ts` for session selection, slash command handling, permission prompting, queued-input handling, and startup web-search hints.
  - Reduced `src/cli.ts` to the main orchestration path plus public re-exports for the existing CLI helper API used by tests.
- Verification:
  - `bun test test/unit/cli.test.ts`
  - `bun run gate`
- Notes: this slice is intentionally structural; the public CLI contract, startup prompts, slash commands, and session workflow are meant to stay unchanged while future work can target smaller modules instead of a 1k-line entrypoint.

## Step 14: Prompt Dedup Pass

- Scope: reduce repeated prompt guidance after centralization, focusing on the fixed agent prefix and duplicated selected-skill descriptions in context composition.
- Implementation:
  - Split the large agent prompt anchor into `operatingCore`, `navigationAndCacheContract`, and `symbolEditPlanContract` in `src/prompt/agent.ts` so shared rules stay explicit without repeating full symbol-planning text in multiple sections.
  - Shortened build/plan mode reminders to reference the shared symbol-aware edit-plan contract instead of restating the full checklist.
  - Changed `src/prompt/context.ts` so selected skills are no longer repeated inside the generic available-skill list; selected and unselected skills are now rendered separately.
- Verification:
  - `bun test test/unit/agent.test.ts test/unit/context.test.ts test/integration/agent.test.ts`
  - `bun run typecheck`
  - `bun run gate`
- Notes: this pass is intended to shrink static prefix noise without changing the public runtime model or the skill-loading workflow.

## Step 13: EasyCode Summary Prompt Rewrite

- Scope: replace the borrowed Claude-style compaction summary prompt with a shorter EasyCode-native prompt and trim obvious prompt duplication now that prompt templates live under one module.
- Implementation:
  - Replaced the old compaction summary prompt example pack, `<analysis>` requirement, and long checklist with a compact EasyCode continuation-summary contract in `src/prompt/compact.ts`.
  - Added `buildCompactPrompt(...)` so summary prompt assembly stays inside the prompt module instead of being hand-built in `src/agent/runner.ts`.
  - Trimmed duplicated context prompt instructions by removing the extra `Mode:` wrapper line and shortening the repeated symbol-aware edit-plan reminder in `src/prompt/context.ts`.
- Verification:
  - `bun test test/integration/agent.test.ts test/unit/agent.test.ts test/unit/context.test.ts`
  - `bun run typecheck`
  - `bun run gate`
- Notes: the summary subagent still returns `<summary>` payloads and keeps the same logging/compaction lifecycle; the change is about prompt quality and token discipline, not behavior surface.

## Step 12: Unified Prompt Module

- Scope: centralize EasyCode's model-facing prompt templates so agent protocol, context composition, compaction, and text-tool fallback no longer maintain separate prompt strings inline.
- Implementation:
  - Added `src/prompt/` as the shared prompt module for agent system prompts, context/system wrappers, compaction summary prompt, and text-tool protocol prompt generation.
  - Changed `src/agent/protocol.ts`, `src/context/manager.ts`, and `src/provider/text-tool-protocol.ts` to consume shared prompt builders instead of owning prompt text directly.
  - Kept `src/context/prompt.ts` as a compatibility re-export so existing imports continue to work while the source of truth moves under `src/prompt/`.
- Verification:
  - `bun test test/unit/agent.test.ts test/unit/context.test.ts test/unit/provider.test.ts`
  - `bun run typecheck`
  - `bun run gate`
- Notes: this is a structural consolidation; prompt content and ordering are intended to remain behaviorally stable so cache-prefix expectations and existing tests keep matching.

## Step 11: Provider TLS Gate + Symbol-Aware Edit Planning

- Scope: make real-provider verification usable in TLS-constrained environments, enforce that verification during release when credentials are configured, and require symbol-aware edit planning in both build and plan mode for symbol-affecting code changes.
- Implementation:
  - Added `--insecure` / `-k` handling to `bun run verify:provider` and the underlying provider-gate CLI so real-provider checks can reuse the same TLS override path as interactive CLI sessions.
  - Updated `scripts/release.sh` to run `bun run verify:provider` automatically for any configured real providers before tagging, while still skipping explicitly when no real-provider credentials are present.
  - Added stable build/plan prompt guidance that requires symbol-aware edit planning to identify target symbols, owning definitions, affected references/callers, excluded same-name matches, and verification before symbol-affecting work.
  - Extended the shared code-exploration directive so symbol-aware edit planning is part of the normal semantic-navigation workflow rather than an ad hoc instruction.
- Verification:
  - `bun test test/unit/provider-gate.test.ts test/unit/quality-gate.test.ts test/unit/agent.test.ts test/unit/context.test.ts`
  - `bun run verify:provider -- --provider deepseek --insecure`
  - `bun run gate`
- Notes: missing provider credentials remain an explicit skip, but once credentials are present the release path now expects a passing real-provider gate before tagging.

## Step 10: Local MCP Test Server

- Scope: add a standalone local MCP stdio fixture so MCP clients can be smoke-tested from this repository without changing EasyCode's own runtime contract.
- Implementation:
  - Added `dev/mcp/test-server.ts` as a dependency-light MCP server using `Content-Length` framed JSON-RPC over stdio.
  - Exposed fixed test tools (`echo`, `sum`, `get_server_state`), resources (`sample://readme`, `sample://config`), and prompt (`summarize-change`).
  - Added `bun run mcp:test:server` plus README usage docs and a dedicated spec for the fixture contract.
  - Added an integration smoke test that spawns the server and verifies initialize, tool call, resource read, prompt get, and ping round-trips.
- Verification:
  - `bun test test/integration/mcp-test-server.test.ts`
  - `bun run typecheck`
  - `bun run gate`
- Notes: this fixture is intentionally separate from EasyCode's `.easycode/mcp.json` retrieval path; it exists to test external MCP client behavior, not to alter current EasyCode tool loading.

## Step 9: TTY Startup Coverage + Global Tavily Setup

- Scope: cover the interactive startup branch in tests and make Tavily setup writable to the global EasyCode env instead of only hinting after startup.
- Implementation:
  - Added a test-only forced-TTY startup path so CLI tests can execute the same interactive startup branch that production uses when `stdin` is a terminal.
  - Added interactive `TAVILY_API_KEY` setup during startup and saved it to the global `~/.easycode/.env`.
  - Applied saved startup env entries back into the current process immediately, so empty-string env placeholders do not block runtime use.
  - Changed Tavily setup hints from repo-local `.env` wording to the global EasyCode env recommendation.
- Verification:
  - `bun test test/unit/cli.test.ts test/unit/retrieval.test.ts`
  - `bun run typecheck`
  - `bun run gate`
- Notes: the new forced-TTY tests are prompt-driven instead of sleep-driven so startup coverage stays stable across multiple sequential readline prompts.

## Step 8: Provider Matrix + Startup Model Presets

- Scope: align the default real-provider gate with the public provider surface and make interactive startup model selection less guessy for DeepSeek and OpenAI.
- Implementation:
  - Changed `dev/quality/provider-gate.ts` default provider matrix from a hand-maintained pair to all public real providers (`deepseek`, `openai`, `openai-compatible`).
  - Expanded `evals/tasks/EC-REAL-001.json` so the shared real-provider smoke eval covers `openai-compatible`.
  - Added startup model discovery for `deepseek` and `openai` in `src/cli.ts`: prefer the providers' public `GET /models` APIs, keep only the two most recent versions, and still allow direct custom model input.
  - Switched OpenAI provider-specific startup config to write/read `OPENAI_MODEL` before the global `EASYCODE_MODEL` fallback.
- Verification:
  - `bun test test/unit/provider-gate.test.ts test/unit/quality-gate.test.ts test/unit/cli.test.ts`
  - `bun run typecheck`
  - `bun run gate`
- Notes: startup provider selection now hides internal `simulated`, and provider gate defaults no longer drift from the documented supported provider surface.

## Step 6: Unified Test And Eval Gate

- Scope: consolidate typecheck, tests, fake evals, APIx, cache benchmark, build, and provider readiness behind one reportable gate entrypoint.
- Implementation:
  - Added `dev/quality/quality-gate.ts` as the shared gate runner and reporter.
  - Added `bun run gate`, `bun run verify:full`, and `bun run verify:provider` scripts.
  - Changed `bun run verify:v1` from a shell chain into the same unified gate preset.
- Verification:
  - `bun test test/unit/quality-gate.test.ts test/unit/provider-gate.test.ts`
  - `bun run typecheck`
  - `bun run gate`
- Notes: the intended workflow is now explicit: every new requirement must clear `bun run gate` before it is considered done locally.

## Step 1: Provider Readiness Gate

- Commit: `ee7b9ac Add provider readiness gate`
- Scope: real-provider readiness command, explicit missing-credential skips, smoke/APIx/cache report generation.
- Verification:
  - `bun test`
  - `bun run typecheck`
  - `bun run provider:gate -- --provider deepseek --no-apix --no-cache`
  - `bun run eval --provider fake`
  - `bun run cache:bench -- --provider simulated --suite real --quiet`
  - `bun run build`
- Notes: full external gate was blocked by approval policy, so the recorded full-gate attempt is preserved as a failed report and the approved DeepSeek smoke gate is preserved as a passed report under `.easycode/reports/provider-gate`.

## Step 2: Usable TUI Mode

- Scope: opt-in `--tui` mode covering the same session, slash command, permission, cancellation, plan approval, timeline, and logger paths as the plain CLI.
- Specs updated:
  - `specs/000-product.md`
  - `specs/acceptance.md`
  - `specs/008-tui.md`
  - `specs/009-mcp-websearch.md`
  - `specs/010-lsp-ast.md`
- Code Complete review result:
  - Correctness: TUI reuses the existing runner and CLI control flow, avoiding a separate execution path.
  - Complexity: TUI output is isolated in `src/ui/tui.ts`; `src/cli.ts` only routes prompts/status through the optional renderer.
  - Maintainability: `--tui` is explicit and line-oriented, so normal CLI behavior and tests remain stable.
  - Verification gap found and fixed: added tests for plan approval and `--logger --tui` compatibility after the first TUI test pass.
- Verification:
  - `bun test test/unit/tui.test.ts test/unit/cli.test.ts`: 27 pass, 0 fail.
  - `bun run typecheck`: pass.
  - `bun test`: 257 pass, 2 skip, 0 fail.
  - `bun run build`: pass.
  - `bun run verify:v1`: pass; includes typecheck, 259 tests, fake eval, and cache benchmark.

## Next Target: MCP + WebSearch

- Goal: add MCP and WebSearch as dual retrieval surfaces with shared permission, citation, logging, timeout, and eval contracts.
- First implementation slice should be read-only and fixture-backed before any live network path becomes default.

## Step 3: MCP + WebSearch Retrieval Slice

- Scope: read-only MCP-style resources and WebSearch fixtures with shared source metadata.
- External research used:
  - OpenCode official docs and repository.
  - Claude Code official overview and architecture docs.
  - OpenAI Codex CLI official docs.
- Implementation:
  - `mcp_list_resources`
  - `mcp_read_resource`
  - `web_search`
  - `.easycode/mcp.json` and `.easycode/websearch.json` fixture contracts.
- Code Complete review result:
  - Correctness: fixed duplicate MCP citation generation so `source` and `sources[0]` share one timestamp.
  - Defensive behavior: added missing-fixture tests to prove retrieval tools return empty cited results instead of fabricated sources.
- Verification so far:
  - `bun test test/unit/tool.test.ts test/unit/permission.test.ts`: 42 pass, 0 fail before review fixes.
  - `bun run typecheck`: pass.
  - `bun test test/unit/tool.test.ts test/unit/permission.test.ts`: 43 pass, 0 fail after review fixes.
  - `bun run verify:v1`: pass; includes typecheck, 262 tests, fake eval, and cache benchmark.
  - `bun run build`: pass.

## Step 4: LSP/AST Scope-Aware Indexing Slice

- Scope: improve TypeScript semantic indexing where text search and regex indexing are weakest.
- Advantage over current behavior:
  - Same-name function parameters and local variables no longer count as references to imported or global symbols.
  - Local indented declarations are not promoted to top-level symbols.
  - Symbol/reference lookup becomes safer for rename planning and impact analysis than plain `grep`.
- Code Complete review result:
  - Correctness: targeted a real false-positive class instead of adding broad AST complexity.
  - Complexity: kept AST logic isolated inside `code-index.ts` and preserved regex/non-TypeScript fallbacks.
  - Verification: added a same-name collision test that fails under the previous text-style reference model.
- Verification so far:
  - `bun test test/unit/code-navigator.test.ts`: 17 pass, 0 fail.
  - `bun run typecheck`: pass.
  - `bun run verify:v1`: pass; includes typecheck, 263 tests, fake eval, and cache benchmark.
  - `bun run build`: pass.

## Step 5: Live WebSearch Engine Configuration

- Scope: replace fixture-only WebSearch with real search engine support while preserving deterministic fixtures.
- External source check:
  - Brave Search API requires `X-Subscription-Token` and uses `https://api.search.brave.com/res/v1/web/search`.
  - Tavily Search API uses `POST https://api.tavily.com/search` with `Authorization: Bearer <api-key>`.
- Implementation:
  - Built-in `brave` engine with endpoint, auth header, query parameter, limit parameter, and response mapping defaults.
  - Built-in `tavily` engine with endpoint, bearer auth, JSON body, max-results, and response mapping defaults.
  - `custom` JSON engine configuration for user-provided search APIs.
  - `web_search` tool accepts `engine` and `live`; fixtures remain available with `live: false`.
- Code Complete review result:
  - Correctness: live search is config-driven and keeps fixture mode for stable tests.
  - Correctness fix: explicit unknown engines and `live: true` without an engine now fail clearly instead of silently falling back to local fixtures.
  - Resource hygiene: live request timeout timers are cleaned up after fetch completion.
  - Security: API keys are designed to come from environment variables; docs discourage committing secrets.
  - Verification: added mocked live-engine tests for Brave and custom engines, fixture fallback, missing-engine errors, and explicit live-without-engine errors.
- Verification:
  - `bun test test/unit/retrieval.test.ts test/unit/tool.test.ts test/unit/permission.test.ts`: 48 pass, 0 fail.
  - `bun run typecheck`: pass after fixing callback metrics typing in `src/cli.ts`.
  - `bun test test/unit/retrieval.test.ts test/unit/tool.test.ts test/unit/provider.test.ts test/integration/agent.test.ts`: 117 pass, 0 fail.
  - `bun run build`: pass.
  - `bun test`: 282 pass, 2 skip, 0 fail.
  - `bun run verify:v1`: pass; includes typecheck, 282 tests, fake eval, and cache benchmark.

## Step 6: Default WebSearch Engine Switched to Google

- Scope: add a built-in `google` engine and make Google the default documented live-search configuration.
- External source check:
  - Google Programmable Search JSON API uses `GET https://customsearch.googleapis.com/customsearch/v1`.
  - The request requires `q` and `cx`; API key is passed as `key`.
- Implementation:
  - Added built-in `google` engine defaults for endpoint, `q`, `num`, `items[].title`, `items[].link`, and `items[].snippet`.
  - Added generic `apiKeyParam` support so engines can send auth as a query parameter instead of an HTTP header.
  - Updated docs so the default `websearch.json` live example uses Google.
- Code Complete review result:
  - Correctness: `google` fails fast when `extraParams.cx` is missing, instead of issuing an invalid live request.
  - Maintainability: query-param auth is implemented generically rather than special-casing Google in the request path.
  - Verification: added live Google request coverage and the missing-`cx` error path.
- Verification:
  - `bun test test/unit/retrieval.test.ts test/unit/tool.test.ts test/unit/permission.test.ts`: 50 pass, 0 fail.
  - `bun run typecheck`: pass.
  - `bun run build`: pass.
  - `bun run verify:v1`: pass; includes typecheck, 284 tests, fake eval, and cache benchmark.

## Step 7: Implicit Runtime Google WebSearch Default

- Scope: remove the runtime gap where docs said Google was the default, but `web_search` still failed without an explicit engine entry.
- Implementation:
  - Runtime now injects an implicit `google` engine when `GOOGLE_SEARCH_API_KEY` and `GOOGLE_SEARCH_CX` or `GOOGLE_SEARCH_ENGINE_ID` are present.
  - Existing configured `google` engines inherit `cx` from env when omitted in JSON.
  - The no-engine live-search error now points directly to the Google env vars needed to enable search.
- Code Complete review result:
  - Correctness: fixed the mismatch between documented default behavior and actual runtime behavior.
  - Maintainability: implicit defaults are isolated in one config-normalization helper instead of spread across request execution.
  - Verification: added no-config implicit Google coverage, env-based `cx` fill-in coverage, and more actionable error-message assertions.

## Step 8: Tavily-Only WebSearch and Startup Setup Hint

- Scope: remove Google, Brave, and custom-engine support so `web_search` exposes one supported live provider, and prompt users to configure it when interactive sessions start.
- Implementation:
  - Runtime implicit defaults now only inject `tavily` from `TAVILY_API_KEY`.
  - Non-Tavily engine entries fail with a direct Tavily-only migration error instead of partially working.
  - CLI session startup now prints a `Web Search` hint when Tavily is not configured, pointing users to the repo-root `.env` file or shell environment.
  - Tool descriptions, README, and MCP/WebSearch specs now document Tavily as the only supported live engine.
  - Removed leftover generic auth branches that only existed for non-Tavily engines.
- Code Complete review result:
  - Correctness: startup guidance closes the usability gap where `web_search` failed later without telling users where to configure it.
  - Complexity: the live-search path now has one supported provider instead of dead branches for retired providers.
  - Maintainability: docs, tool description, and runtime behavior now match; there is no longer a split between supported and merely parseable engines.
  - Verification: added CLI startup coverage for the setup hint and retained explicit unsupported-engine assertions for legacy configs.
- Verification:
  - `bun test test/unit/retrieval.test.ts test/unit/cli.test.ts`: pass.
  - `bun run typecheck`: pass.
  - `bun test test/unit/tool.test.ts`: pass.
  - `bun run verify:v1`: pass; includes typecheck, full tests, fake eval, APIx subset, and cache benchmark.

## Step 9: TUI Helper Extraction

- Scope: break `src/ui/tui.ts` into smaller UI-focused modules without changing the public TUI flow or `RunUiEvent` handling contract.
- Implementation:
  - Extracted shared TUI types into `src/ui/tui-types.ts`.
  - Extracted ANSI and width helpers into `src/ui/tui-ansi.ts`.
  - Extracted welcome/status/summary card builders into `src/ui/tui-cards.ts`.
  - Extracted status-panel line generation into `src/ui/tui-status-panel.ts`.
  - Reduced `src/ui/tui.ts` to orchestration, event handling, and output coordination.
- Code Complete review result:
  - Correctness: rendering contracts stayed inside the existing `TuiRenderer` facade, so CLI and timeline callers did not need behavior changes.
  - Maintainability: card layout, ANSI helpers, and panel rendering can now evolve independently instead of sharing one 600+ line file.
  - Verification: preserved existing TUI/timeline assertions rather than replacing them with looser snapshots.
- Verification:
  - `bun test test/unit/tui.test.ts test/unit/timeline.test.ts`: pass.
  - `bun test test/unit/cli.test.ts`: pass.
  - `bun test`: pass.

## Step 10: TUI Runtime State Isolation + Gate Env Cleanup

- Scope: keep Phase 1 moving by extracting TUI runtime state transitions, then fix the quality gate so test runs do not inherit global EasyCode runtime configuration.
- Implementation:
  - Added `src/ui/tui-state.ts` to hold run lifecycle state such as streaming, prompt-paused mode, spinner frame, elapsed timing, queued input, and provider metrics.
  - Simplified `src/ui/tui.ts` so it delegates run-state transitions to `TuiState` and stays focused on rendering orchestration.
  - Updated `src/cli/startup.ts` so global `~/.easycode/.env` loading can be disabled explicitly with `EASYCODE_DISABLE_GLOBAL_ENV=1`.
  - Updated `dev/quality/quality-gate.ts` so the `tests` check runs with a sanitized env and does not inherit provider/search config from the global EasyCode env file.
  - Added CLI coverage for the explicit global-env skip path in `test/unit/cli.test.ts`.
- Code Complete review result:
  - Correctness: gate test runs now behave like direct `bun test`, instead of silently depending on machine-local provider env.
  - Maintainability: `TuiRenderer` no longer owns both state machine data and rendering details, which lowers the risk of future TUI edits.
  - Verification: quality-gate divergence was validated by fixing the env boundary and then re-running the full gate.
- Verification:
  - `bun run typecheck`: pass.
  - `bun test test/unit/tui.test.ts test/unit/timeline.test.ts test/unit/cli.test.ts`: 53 pass, 0 fail.
  - `bun run gate`: all local checks pass; remaining failure is `provider_gate` for real `deepseek` connectivity only.

## Step 11: Builtin Tool Registry Family Split

- Scope: reduce `src/tool/builtins.ts` from a single long registration file into focused family modules without changing any tool names, input schemas, permissions, or runtime behavior.
- Implementation:
  - Kept `createBuiltinRegistry()` as the only public entrypoint in `src/tool/builtins.ts`.
  - Split filesystem/code navigation tools into `src/tool/builtins/code-tools.ts`.
  - Split git workflow tools into `src/tool/builtins/git-tools.ts`.
  - Split edit/bash/memory/connector tools into `src/tool/builtins/workspace-tools.ts`.
  - Split MCP/web search/skill/plan tools into `src/tool/builtins/retrieval-tools.ts`.
  - Centralized small shared schema helpers in `src/tool/builtins/common.ts`.
- Code Complete review result:
  - Correctness: registration order and tool contracts stayed stable because the public registry constructor still wires the same definitions into one `ToolRegistry`.
  - Maintainability: adding or auditing a tool family no longer requires editing a 500+ line mixed-responsibility file.
  - Verification: focused regression coverage was kept at the registry/tool/provider layer so the move stayed behavior-preserving rather than snapshot-driven.
- Verification:
  - `bun run typecheck`: pass.
  - `bun test test/unit/tool.test.ts test/unit/provider.test.ts test/unit/context.test.ts test/unit/runner.test.ts`: 111 pass, 0 fail.

## Step 12: Runner Provider-Turn And Background Task Split

- Scope: start decomposing `src/agent/runner.ts` by extracting low-risk orchestration-adjacent responsibilities while keeping the main run loop behavior stable.
- Implementation:
  - Extracted provider stream consumption, XML-safe delta replay, fallback text-to-tool-call parsing, and provider progress handling into `src/agent/provider-turn.ts`.
  - Extracted background summary compaction task creation/execution into `src/agent/summary-subagent.ts`.
  - Extracted repo-map prewarm and query-targeted repo-map ledger/event updates into `src/agent/repo-map-refresh.ts`.
  - Kept hypothesis validation and the top-level run loop in `runner.ts`, so this slice changed structure without rewriting core step semantics.
- Code Complete review result:
  - Correctness: provider replay events, cancellation behavior, summary compaction, and repo-map warmup stayed behind the same `AgentRunner` call sites.
  - Maintainability: `runner.ts` now focuses more on orchestration and less on embedded IO/event helper logic.
  - Verification: validated at provider, tool, context, and runner layers after each extraction step instead of relying on one broad smoke test.
- Verification:
  - `bun run typecheck`: pass.
  - `bun test test/unit/tool.test.ts test/unit/provider.test.ts test/unit/context.test.ts test/unit/runner.test.ts`: 111 pass, 0 fail.
  - `bun run gate`: all local checks pass; remaining failure is `provider_gate` for real `deepseek` connectivity only.

## Step 13: Runner Tool Execution And Hypothesis Side-Effect Split

- Scope: continue shrinking `runner.ts` by moving tool-execution plumbing and hypothesis/intent ledger side effects behind focused helpers, without changing tool loop order or ledger semantics.
- Implementation:
  - Extracted tool execution, bash progress timing, tool-result UI event emission, and tool outcome ledger updates into `src/agent/tool-execution.ts`.
  - Extracted active hypothesis hydration/messages, hypothesis drift ledger updates, run-intent ledger setup, and shared ledger string helpers into `src/agent/hypothesis-state.ts`.
  - Rewired `runner.ts` to call those helpers while preserving the same tool loop, hypothesis discipline checks, and cancellation paths.
- Code Complete review result:
  - Correctness: tool result ordering, plan-exit handling, and hypothesis correction prompting stayed in the same run-loop sequence.
  - Maintainability: `runner.ts` no longer mixes orchestration with repetitive ledger-side-effect construction and tool-progress boilerplate.
  - Verification: repeated the same focused regression set and full gate after each extraction to catch structural drift early.
- Verification:
  - `bun run typecheck`: pass.
  - `bun test test/unit/tool.test.ts test/unit/provider.test.ts test/unit/context.test.ts test/unit/runner.test.ts`: 111 pass, 0 fail.
  - `bun run gate`: all local checks pass; remaining failure is `provider_gate` for real `deepseek` connectivity only.

## Step 14: Runner Support Helper Split

- Scope: remove the remaining low-level settings and mode/permission helper logic from `runner.ts` so the class focuses more narrowly on orchestration.
- Implementation:
  - Extracted selected-skill resolution, pending-skill filtering, skill-load bookkeeping, effective plan/build mode switching, and permission-service mode selection into `src/agent/runner-support.ts`.
  - Kept the existing `AgentRunner` call sites and return shapes unchanged, so the move is structural rather than behavioral.
- Code Complete review result:
  - Correctness: skill selection, plan approval mode switching, and permission rule reuse still flow through the same run loop decisions.
  - Maintainability: runner support logic is now isolated from the main execution class, which makes future policy changes easier to review independently.
  - Verification: reran the same focused provider/tool/context/runner suite and full gate after the extraction.
- Verification:
  - `bun run typecheck`: pass.
  - `bun test test/unit/tool.test.ts test/unit/provider.test.ts test/unit/context.test.ts test/unit/runner.test.ts`: 111 pass, 0 fail.
  - `bun run gate`: all local checks pass; remaining failure is `provider_gate` for real `deepseek` connectivity only.

## Step 15: Runner Validation Loop And Helper Extraction

- Scope: keep shrinking `src/agent/runner.ts` by moving the hypothesis-validation retry loop and trailing pure helper functions into focused support modules, without changing run-loop semantics.
- Implementation:
  - Extracted validated provider-turn retry and hypothesis-correction orchestration into `src/agent/validated-provider-turn.ts`.
  - Extracted pure helper functions for failure text shaping, assistant message assembly, exploration checkpoint prompts, compact-summary prompt building, and summary-language hinting into `src/agent/runner-helpers.ts`.
  - Rewired `runner.ts` to delegate to those helpers while preserving the same event emission, hypothesis discipline, and context-compaction behavior.
- Code Complete review result:
  - Correctness: provider-turn validation still retries at most once, emits the same replayed output, and returns the same synthetic failure when hypothesis drift remains unresolved.
  - Maintainability: `runner.ts` is now closer to a lifecycle/orchestration class instead of carrying policy-neutral text and prompt helper utilities inline.
  - Verification: reran the focused runner/provider/context/tool suite after each extraction step, then revalidated through the unified local gate.
- Verification:
  - `bun run typecheck`: pass.
  - `bun test test/unit/tool.test.ts test/unit/provider.test.ts test/unit/context.test.ts test/unit/runner.test.ts`: 111 pass, 0 fail.
  - `bun run gate`: all local checks pass; remaining failure is `provider_gate` for real `deepseek` connectivity only.

## Step 16: Context Manager Helper Split

- Scope: reduce `src/context/manager.ts` by moving pure cache-window, prefix-budget, and summary truncation helpers into a dedicated support module, without changing any context composition or compaction behavior.
- Implementation:
  - Extracted `WindowStats` plus static-prefix sizing, cache-window accumulation, strategy cloning, effective window cost, and summary token-budget truncation helpers into `src/context/manager-helpers.ts`.
  - Kept `ContextManager` state transitions and budgeting decisions unchanged; the class now delegates to the helper module for pure calculations.
  - Fixed an intermediate import regression during the extraction by sourcing `estimateTextTokens` from `src/context/tokens.ts`, then reran the same focused suite to re-establish a clean baseline.
- Code Complete review result:
  - Correctness: planning, cache accounting, and summary truncation still use the same formulas and thresholds because only the function location changed.
  - Maintainability: `ContextManager` now keeps mutation and policy logic local while moving calculation-only helpers into a dedicated file that can be reused or reviewed independently.
  - Verification: validated the structural move with focused provider/tool/context/runner tests after fixing the helper import issue, then re-ran the unified local gate.
- Verification:
  - `bun run typecheck`: pass.
  - `bun test test/unit/tool.test.ts test/unit/provider.test.ts test/unit/context.test.ts test/unit/runner.test.ts`: 111 pass, 0 fail.
  - `bun run gate`: all local checks pass; remaining failure is `provider_gate` for real `deepseek` connectivity only.

## Step 17: Instrumentation Provider Logging Split

- Scope: reduce `src/instrumentation.ts` by extracting provider-specific logging, transcript rendering, cache-hit markup, and provider-error shaping helpers into a focused module, without changing `RunAspect` behavior.
- Implementation:
  - Added `src/instrumentation-provider.ts` for provider input token estimation, usage normalization, provider event logging, transcript emission, cache-hit input marking, raw response error detection, and provider error detail formatting.
  - Rewired `LoggingRunAspect.instrumentProvider()` to delegate to those helpers while keeping the same emitted log event names and detail shapes.
  - Fixed an intermediate regression where `ProviderError` was no longer imported in `src/instrumentation.ts`, then reran the focused suite to restore a clean baseline.
- Code Complete review result:
  - Correctness: provider transcript logging, usage logging, and provider error shaping still run at the same stream lifecycle points because only the helper location changed.
  - Maintainability: `instrumentation.ts` now keeps the aspect wrappers and control flow visible while moving provider-formatting noise into a dedicated helper file.
  - Verification: reran the focused provider/tool/context/runner suite after the import fix, then revalidated through the unified local gate.
- Verification:
  - `bun run typecheck`: pass.
  - `bun test test/unit/tool.test.ts test/unit/provider.test.ts test/unit/context.test.ts test/unit/runner.test.ts`: 111 pass, 0 fail.
  - `bun run gate`: all local checks pass; remaining failure is `provider_gate` for real `deepseek` connectivity only.

## Step 18: Instrumentation Context Decorator Split

- Scope: finish the low-risk `instrumentation` decomposition by extracting the logging context decorator and its snapshot helpers into a dedicated module, without changing any emitted context log event names or detail shapes.
- Implementation:
  - Added `src/instrumentation-context.ts` for `LoggingContextDecorator`, context snapshot capture, and ledger detail formatting.
  - Rewired `LoggingRunAspect.instrumentContext()` to instantiate the extracted decorator while leaving `RunAspect` and logger usage unchanged.
  - Kept `instrumentation.ts` focused on the `RunAspect` interface plus the `LoggingRunAspect` orchestration shell.
- Code Complete review result:
  - Correctness: context add/ledger/compaction/compose logging still occurs at the same wrapper methods because only the decorator definition moved.
  - Maintainability: `instrumentation.ts` is now a small aspect assembly file, while provider logging and context logging each live in their own focused modules.
  - Verification: reran the focused provider/tool/context/runner suite after the extraction, then revalidated through the unified local gate.
- Verification:
  - `bun run typecheck`: pass.
  - `bun test test/unit/tool.test.ts test/unit/provider.test.ts test/unit/context.test.ts test/unit/runner.test.ts`: 111 pass, 0 fail.
  - `bun run gate`: all local checks pass; remaining failure is `provider_gate` for real `deepseek` connectivity only.

## Step 19: Retrieval Formatting And Ranking Helper Split

- Scope: start decomposing `src/retrieval.ts` by extracting pure citation, formatting, ranking, and result-limit helpers into a dedicated module, without changing MCP or web-search service behavior.
- Implementation:
  - Added `src/retrieval-format.ts` for MCP/web citations, MCP/web result formatting, resource/result ranking, and limit clamping.
  - Re-exported the existing public formatting and citation helpers from `src/retrieval.ts` so tool-call sites and tests keep the same import contract.
  - Kept live request construction, engine normalization, and config loading inside `src/retrieval.ts` for this first low-risk slice.
- Code Complete review result:
  - Correctness: citations, formatted output strings, ranking order, and result limits still use the same logic because only helper locations changed.
  - Maintainability: `retrieval.ts` now holds the service and engine-flow logic while pure presentation/scoring helpers live in an isolated module that is easier to extend or test independently.
  - Verification: validated with retrieval, tool, and CLI startup coverage because those paths exercise both fixture ranking and the Tavily setup hint behavior.
- Verification:
  - `bun run typecheck`: pass.
  - `bun test test/unit/retrieval.test.ts test/unit/tool.test.ts test/unit/cli.test.ts`: 79 pass, 0 fail.
  - `bun run gate`: all local checks pass; remaining failure is `provider_gate` for real `deepseek` connectivity only.

## Step 20: Retrieval Live Engine Helper Split

- Scope: continue decomposing `src/retrieval.ts` by extracting live-engine normalization, auth/header shaping, request building, timeout wiring, and result parsing helpers into a dedicated module, without changing Tavily-only runtime behavior.
- Implementation:
  - Added `src/retrieval-live.ts` for engine normalization, API key lookup, header shaping, request assembly, response parsing, and timeout cleanup.
  - Rewired `WebSearchService.searchLive()` to delegate to those helpers while preserving the same TLS injection, fetch behavior, and error messages.
  - Fixed an intermediate regression where the unsupported-engine path lost the Tavily setup hint because `normalizeEngine()` was called without the shared hint string.
- Code Complete review result:
  - Correctness: live request construction and parsing still happen in the same order and produce the same Tavily-only behavior because the helper extraction kept the same defaults and error text.
  - Maintainability: `retrieval.ts` now concentrates on service flow and config loading, while live-engine mechanics live in an isolated module that is easier to reason about and test independently.
  - Verification: validated with retrieval, tool, and CLI startup coverage because those paths exercise unsupported-engine errors, Tavily setup hints, live-search config checks, and tool-surface formatting.
- Verification:
  - `bun run typecheck`: pass.
  - `bun test test/unit/retrieval.test.ts test/unit/tool.test.ts test/unit/cli.test.ts`: 79 pass, 0 fail.
  - `bun run gate`: all local checks pass; remaining failure is `provider_gate` for real `deepseek` connectivity only.

## Step 21: Retrieval Config Helper Split

- Scope: finish the low-risk `retrieval` decomposition by extracting engine selection and implicit Tavily default resolution helpers into a dedicated config module, without changing startup hints or runtime engine resolution.
- Implementation:
  - Added `src/retrieval-config.ts` for `selectEngine()` and `withImplicitDefaults()`.
  - Rewired `src/retrieval.ts` to pass `WebSearchEngine.parse` through the helper so implicit Tavily engine injection keeps the same schema validation behavior.
  - Fixed two intermediate regressions during the extraction:
    - the parser callback was initially omitted, which broke the implicit Tavily default path;
    - the helper return type initially dropped `results`, so it was widened to preserve the full config shape.
- Code Complete review result:
  - Correctness: default-engine selection, implicit Tavily injection, and configured-engine lookup still behave the same because the helper keeps the same validation and selection rules.
  - Maintainability: `retrieval.ts` now focuses on service flow and file IO, while config resolution, live request mechanics, and formatting are each isolated in their own modules.
  - Verification: reran retrieval, tool, and CLI startup coverage after fixing both regressions, since those paths exercise implicit Tavily setup, engine lookup, and user-facing setup hints.
- Verification:
  - `bun run typecheck`: pass.
  - `bun test test/unit/retrieval.test.ts test/unit/tool.test.ts test/unit/cli.test.ts`: 79 pass, 0 fail.
  - `bun run gate`: all local checks pass; remaining failure is `provider_gate` for real `deepseek` connectivity only.

## Step 22: Context Compose And Compaction Snapshot Split

- Scope: continue shrinking `src/context/manager.ts` by extracting message-composition and compaction-snapshot assembly helpers into a focused module, without changing budgeting or context-selection behavior.
- Implementation:
  - Added `src/context/manager-compose.ts` for provider-message assembly and compaction snapshot construction.
  - Rewired `ContextManager.compose()` and `ContextManager.compactionSnapshot()` to delegate to those helpers while preserving the same prompt ordering, summary wrapping, and protected-tool-result redaction.
  - Kept budget math, cache accounting, ledger selection, and mutation logic inside `ContextManager` so this slice stayed on the pure data-transformation boundary.
- Code Complete review result:
  - Correctness: compose ordering, summary inclusion, skill/instruction prompt assembly, and compaction snapshot redaction still use the same logic because the extracted helpers are pure reorganizations of the previous implementation.
  - Maintainability: `ContextManager` now focuses more on strategy, mutation, and budgeting, while message-assembly responsibilities live in a dedicated helper file with direct context-test coverage.
  - Verification: reran context, runner, and tool coverage because these paths exercise compose ordering, compaction snapshots, and provider-facing prompt composition.
- Verification:
  - `bun run typecheck`: pass.
  - `bun test test/unit/context.test.ts test/unit/runner.test.ts test/unit/tool.test.ts`: 69 pass, 0 fail.
  - `bun run gate`: all local checks pass; remaining failure is `provider_gate` for real `deepseek` connectivity only.

## Step 23: Context Stats And Ledger Calculation Split

- Scope: continue decomposing `src/context/manager.ts` by extracting cache stats, budget stats, compaction-basis, and ledger-selection calculations into a focused helper module, without changing context mutation behavior.
- Implementation:
  - Added `src/context/manager-stats.ts` for cache/budget stats, compaction basis, ledger token budget, selected ledger rendering, and ledger stats calculation.
  - Rewired `ContextManager.selectedLedgerText()`, `cacheStats()`, `budgetStats()`, `compactionBasis()`, `ledgerStats()`, and `ledgerTokenBudget()` to delegate to those pure helpers.
  - Kept message mutation, compaction application, and strategy state transitions inside `ContextManager`, so this slice stayed on the read-only calculation boundary.
- Code Complete review result:
  - Correctness: cache metrics, budget reporting, and ledger selection still use the same formulas and selection rules because the extracted helpers preserve the previous logic exactly.
  - Maintainability: `ContextManager` is now more focused on owned state transitions, while stats and ledger math live in a dedicated helper that can be reasoned about independently.
  - Verification: reran context, runner, and tool coverage because those paths exercise ledger rendering, cache stats, and provider-facing budgeting behavior.
- Verification:
  - `bun run typecheck`: pass.
  - `bun test test/unit/context.test.ts test/unit/runner.test.ts test/unit/tool.test.ts`: 69 pass, 0 fail.
  - `bun run gate`: all local checks pass; remaining failure is `provider_gate` for real `deepseek` connectivity only.

## Step 24: Context Compaction Application Split

- Scope: keep shrinking `src/context/manager.ts` by extracting the repeated compaction-application logic behind `compact()` and `compactSnapshot()` into a focused helper module, without changing compaction eligibility or conflict recording semantics.
- Implementation:
  - Added `src/context/manager-compaction.ts` for full compaction result creation and snapshot-based compaction result creation.
  - Rewired `ContextManager.compact()` and `ContextManager.compactSnapshot()` to delegate to those helpers while preserving summary truncation, preserved-message selection, and ledger conflict generation.
  - Fixed an intermediate type regression by normalizing the optional ledger before passing it to `summaryLedgerConflicts()`.
- Code Complete review result:
  - Correctness: compaction still keeps the same preserved suffix and summary-conflict behavior because the extracted helpers are direct reorganizations of the previous logic.
  - Maintainability: `ContextManager` now centers more on mutation and strategy orchestration, while compaction result construction is isolated in its own helper file.
  - Verification: reran context, runner, and tool coverage because those paths exercise both direct compaction and snapshot-based background compaction behavior.
- Verification:
  - `bun run typecheck`: pass.
  - `bun test test/unit/context.test.ts test/unit/runner.test.ts test/unit/tool.test.ts`: 69 pass, 0 fail.
  - `bun run gate`: all local checks pass; remaining failure is `provider_gate` for real `deepseek` connectivity only.

## Step 25: Runner Terminal Outcome Helper Split

- Scope: start another low-risk `runner` slice by extracting terminal outcome helpers for run completion signaling and cancellation-result assembly, without changing main-loop decision order.
- Implementation:
  - Added `src/agent/runner-outcomes.ts` for `run_done` event emission and cancelled run result assembly.
  - Rewired `AgentRunner.cancelledResult()` and `AgentRunner.emitRunDone()` to delegate to the helper module while preserving the same context append, state transition, and provider-metrics event behavior.
  - Kept provider failure, tool loop, and completion decisions inline in `runner.ts`, so this slice only moved end-of-run packaging responsibilities.
- Code Complete review result:
  - Correctness: cancellation still emits the same failure text, appends the same assistant message, and transitions through the same `cancelled` state because the helper is a direct extraction of the previous logic.
  - Maintainability: terminal outcome shaping now has an isolated home instead of living inline beside the main run loop.
  - Verification: reran runner, context, and tool coverage because these paths exercise cancellation, `run_done`, and immediate post-tool streaming transitions.
- Verification:
  - `bun run typecheck`: pass.
  - `bun test test/unit/runner.test.ts test/unit/context.test.ts test/unit/tool.test.ts`: 69 pass, 0 fail.
  - `bun run gate`: all local checks pass; remaining failure is `provider_gate` for real `deepseek` connectivity only.

## Step 26: Runner Turn Preparation Helper Split

- Scope: continue the low-risk `runner` decomposition by extracting per-step provider-turn preparation logic, without changing tool-loop order or summary-readiness policy.
- Implementation:
  - Added `src/agent/runner-turn-prep.ts` for composing `planRequest()` output, summary-readiness gating, active-hypothesis system messages, and the resulting provider message/tool set for each step.
  - Rewired the main run loop to call the helper instead of assembling `providerMessages` and `availableTools` inline.
  - Kept turn execution, tool running, and terminal branching inside `runner.ts`, so this slice stayed on the preflight preparation boundary.
- Code Complete review result:
  - Correctness: summary-readiness checkpoints, active-hypothesis message injection, and tool disabling on late exploration steps still happen under the same conditions because the helper is a direct extraction of the previous inline logic.
  - Maintainability: the run loop now reads more clearly as `prepare -> stream -> handle outcome -> run tools`, instead of mixing prompt assembly with execution flow.
  - Verification: reran runner, context, and tool coverage because these paths exercise step preparation, plan-mode messaging, and immediate post-tool transitions.
- Verification:
  - `bun run typecheck`: pass.
  - `bun test test/unit/runner.test.ts test/unit/context.test.ts test/unit/tool.test.ts`: 69 pass, 0 fail.
  - `bun run gate`: all local checks pass; remaining failure is `provider_gate` for real `deepseek` connectivity only.

## Step 27: Session Tail Policy Split

- Scope: address the remaining explicit Phase 4 session-policy gap by extracting persisted session tail selection rules out of `src/session.ts`, without changing session file shape or restore behavior.
- Implementation:
  - Added `src/session-tail.ts` for persisted-tail selection, recent session suffix selection, and greedy fallback suffix logic.
  - Rewired `SessionStore.save()` and `SessionStore.context()` to delegate to `persistedSessionMessages()` from the new module.
  - Kept `SessionStore` responsible only for filesystem persistence, normalization, and restore orchestration.
- Code Complete review result:
  - Correctness: persisted session save/restore still keeps the latest answered turn, preserves unanswered latest user turns, and avoids orphan leading tool results because the extracted helpers preserve the previous tail-selection logic exactly.
  - Maintainability: session-tail policy is now explicit and independently testable, instead of being buried inside the persistence class.
  - Verification: reran session, context, and CLI coverage because those paths exercise persisted-tail save/restore behavior, startup restore, and cancellation/session persistence interactions.
- Verification:
  - `bun run typecheck`: pass.
  - `bun test test/unit/session.test.ts test/unit/context.test.ts test/unit/cli.test.ts`: 89 pass, 0 fail.
  - `bun run gate`: all local checks pass; remaining failure is `provider_gate` for real `deepseek` connectivity only.

## Step 28: Context Strategy Helper Split

- Scope: continue filling the explicit Phase 4 boundary map by extracting `ContextManager` strategy defaults, initialization, and clamping logic into a dedicated strategy helper, without changing budget semantics.
- Implementation:
  - Added `src/context/strategy.ts` for min token floor calculation, initial max-token selection, response reserve defaults, safety multiplier defaults, initial strategy state creation, and strategy-state clamping.
  - Rewired `ContextManager` construction and `applyStrategy()` to delegate to those helpers while preserving the same clamped values and default budgets.
  - Kept runtime state mutation and budgeting orchestration in `ContextManager`, so this slice stayed on the pure policy/helper boundary.
- Code Complete review result:
  - Correctness: default token budgets, response reserve sizing, safety multiplier clamping, and `configureStrategy()` behavior still follow the same formulas because the helper extraction preserves the previous values exactly.
  - Maintainability: strategy policy is now explicit instead of being embedded in the manager constructor, which aligns more directly with the roadmap’s `context/strategy` separation goal.
  - Verification: reran context, session, and runner coverage because these paths exercise initial context defaults, strategy reconfiguration, and persisted-session restore under the current budgets.
- Verification:
  - `bun run typecheck`: pass.
  - `bun test test/unit/context.test.ts test/unit/session.test.ts test/unit/runner.test.ts`: 50 pass, 0 fail.
  - `bun run gate`: all local checks pass; remaining failure is `provider_gate` for real `deepseek` connectivity only.

## Step 29: Runner Failure Policy Boundary Extraction

- Scope: materialize the roadmap’s explicit `failure-policy` boundary by moving runner failure-text shaping into its own module, without changing terminal behavior or tool-loop order.
- Implementation:
  - Added `src/agent/failure-policy.ts` for `runFailureText()`.
  - Rewired `runner.ts` to import failure text shaping from the new module instead of keeping it inside the generic helper bundle.
  - Left terminal outcome assembly in `runner-outcomes.ts` and the main branching logic in `runner.ts`, so this slice stayed narrowly structural.
- Code Complete review result:
  - Correctness: provider-error and max-step failure text still append the same guidance because the helper is a direct move of the previous implementation.
  - Maintainability: failure semantics now have an explicit home that matches the roadmap, instead of living inside a mixed helper file.
  - Verification: reran runner, context, and tool coverage because these paths exercise provider failure text, cancellation-adjacent terminal paths, and max-step handling.
- Verification:
  - `bun run typecheck`: pass.
  - `bun test test/unit/runner.test.ts test/unit/context.test.ts test/unit/tool.test.ts`: 69 pass, 0 fail.
  - `bun run gate`: all local checks pass; remaining failure is `provider_gate` for real `deepseek` connectivity only.

## Step 30: Runner Events Boundary Extraction

- Scope: materialize the roadmap’s explicit `runner-events` boundary by moving small but reusable runner event emitters into a dedicated module, without changing event order.
- Implementation:
  - Added `src/agent/runner-events.ts` for `run_done` emission with provider-metrics bridging and plan-exit text emission.
  - Rewired `runner.ts` and `runner-outcomes.ts` to use the extracted event helpers.
  - Fixed an intermediate import regression where `runner.ts` still imported `emitRunDoneEvent` from the old module after the move.
- Code Complete review result:
  - Correctness: `run_done`, provider-metrics final emission, and plan-exit text deltas still fire in the same order because the extracted helpers preserve the previous call sites exactly.
  - Maintainability: the named event-boundary from the roadmap now exists explicitly instead of being spread across `runner.ts` and outcome helpers.
  - Verification: reran runner, context, and tool coverage because these paths exercise immediate post-tool event emission, cancellation completion, and plan-exit text behavior.
- Verification:
  - `bun run typecheck`: pass.
  - `bun test test/unit/runner.test.ts test/unit/context.test.ts test/unit/tool.test.ts`: 69 pass, 0 fail.
  - `bun run gate`: all local checks pass; remaining failure is `provider_gate` for real `deepseek` connectivity only.

## Step 31: TUI Render Loop Split

- Scope: keep thinning the remaining thick TUI façade by extracting panel redraw/erase and timeline-text write-loop plumbing into a dedicated helper module, without changing TTY rendering behavior.
- Implementation:
  - Added `src/ui/tui-render-loop.ts` for status-panel erase/draw, panel-aware text writes, timeline writes, and welcome/success/failure summary card rendering.
  - Rewired `src/ui/tui.ts` to delegate its redraw plumbing to the new helper while preserving `TuiState` ownership and event semantics.
  - Kept `event(...)`, prompt entrypoints, and high-level TUI orchestration inside `TuiRenderer`, so this slice stayed on the rendering-plumbing boundary.
- Code Complete review result:
  - Correctness: timeline writes, panel redraw suppression, spinner-driven updates, and summary-card rendering still happen at the same call sites because the helper extraction preserved the same control flow.
  - Maintainability: `tui.ts` now focuses more on event handling and user-facing prompts instead of mixing that with low-level redraw mechanics.
  - Verification: reran TUI, timeline, and CLI coverage because those paths exercise permission prompts, plan approval prompts, panel redraws, session rendering, and non-TTY compatibility.
- Verification:
  - `bun run typecheck`: pass.
  - `bun test test/unit/tui.test.ts test/unit/timeline.test.ts test/unit/cli.test.ts`: 57 pass, 0 fail.
  - `bun run gate`: all local checks pass; remaining failure is `provider_gate` for real `deepseek` connectivity only.

## Step 32: Agent Runner Directory Consolidation

- Scope: improve the `src/agent` file structure by grouping the already-extracted runner collaborators under a dedicated `src/agent/runner/` directory, without changing the exported `src/agent` surface or runner behavior.
- Implementation:
  - Moved `runner.ts` into `src/agent/runner/index.ts` so `src/agent/index.ts` can keep exporting `./runner` as the same public entrypoint.
  - Moved runner-only collaborators into the same directory: `provider-turn`, `repo-map-refresh`, `runner-events`, `runner-helpers`, `runner-outcomes`, `runner-support`, `runner-turn-prep`, `summary-subagent`, `tool-execution`, `validated-provider-turn`, `failure-policy`, and `hypothesis-state`.
  - Rewired relative imports so shared agent primitives stay at `src/agent/*`, while runner-internal modules resolve locally from `src/agent/runner/*`.
- Code Complete review result:
  - Correctness: this is a directory-boundary change only; the `AgentRunner` API, `src/agent` barrel export, and runner/tool/context behavior are preserved because module contents and call sites stayed the same.
  - Maintainability: `src/agent` now separates shared agent primitives from the runner subsystem, making the module tree match the architecture that had already emerged in code.
  - Verification: reran typecheck, runner/context/tool coverage, and the unified gate because this slice changes many import paths and the `src/agent` export surface.
- Verification:
  - `bun run typecheck`: pass.
  - `bun test test/unit/runner.test.ts test/unit/context.test.ts test/unit/tool.test.ts`: 69 pass, 0 fail.
  - `bun run gate`: all local checks pass; remaining failure is `provider_gate` for real `deepseek` connectivity only.

## Step 33: TUI Directory Consolidation

- Scope: improve the `src/ui` file structure by grouping the already-extracted TUI collaborators under a dedicated `src/ui/tui/` directory, without changing the exported `src/ui/tui` entrypoint or runtime behavior.
- Implementation:
  - Moved `src/ui/tui.ts` into `src/ui/tui/index.ts` so existing imports of `../ui/tui` continue resolving through the directory entrypoint.
  - Moved TUI-only collaborators into the same directory: `tui-ansi`, `tui-cards`, `tui-render-loop`, `tui-state`, `tui-status-panel`, and `tui-types`.
  - Rewired relative imports so TUI internals reference shared `timeline`, `i18n`, `session`, and `permission` modules through stable parent paths.
  - Updated TUI unit tests to import from the new `src/ui/tui/*` locations.
- Code Complete review result:
  - Correctness: this is a directory-boundary change only; the `TuiRenderer` API and `src/ui/tui` import path stay compatible because the module contents and public entrypoint are preserved.
  - Maintainability: `src/ui` now separates the TUI subsystem from the shared `timeline` renderer, making the directory match the architecture that had already been split at the file level.
  - Verification: reran typecheck, TUI/timeline/CLI coverage, and the unified gate because this slice changes import paths across the renderer, CLI session helpers, and TUI tests.
- Verification:
  - `bun run typecheck`: pass.
  - `bun test test/unit/tui.test.ts test/unit/timeline.test.ts test/unit/cli.test.ts`: 58 pass, 0 fail.
  - `bun run gate`: all local checks pass; remaining failure is `provider_gate` for real `deepseek` connectivity only.

## Step 34: Retrieval Directory Consolidation

- Scope: improve the `src` file structure by grouping the already-extracted retrieval collaborators under a dedicated `src/retrieval/` directory, without changing the exported `src/retrieval` entrypoint or web-search behavior.
- Implementation:
  - Moved `src/retrieval.ts` into `src/retrieval/index.ts` so existing imports of `../retrieval` continue resolving through the directory entrypoint.
  - Moved retrieval-only collaborators into the same directory: `retrieval-config`, `retrieval-format`, and `retrieval-live`.
  - Rewired relative imports so the retrieval internals reference shared `easycode-path` and `tls-config` through stable parent paths.
- Code Complete review result:
  - Correctness: this is a directory-boundary change only; `WebSearchService`, `McpSourceService`, and the `hasConfiguredWebSearch()` entrypoint remain compatible because the module contents and public import path are preserved.
  - Maintainability: `src` now treats retrieval as a self-contained subsystem instead of a split set of root-level helper files.
  - Verification: reran typecheck plus retrieval, tool, context, session, runner, and CLI coverage because this slice changes import paths used by startup checks and tool-backed web-search flows.
- Verification:
  - `bun run typecheck`: pass.
  - `bun test test/unit/retrieval.test.ts test/unit/session.test.ts test/unit/context.test.ts test/unit/runner.test.ts test/unit/tool.test.ts test/unit/cli.test.ts`: 129 pass, 0 fail.
  - `bun run gate`: all local checks pass; remaining failure is `provider_gate` for real `deepseek` connectivity only.

## Step 35: Instrumentation Directory Consolidation

- Scope: improve the `src` file structure by grouping the already-extracted instrumentation collaborators under a dedicated `src/instrumentation/` directory, without changing the exported `src/instrumentation` entrypoint or logging behavior.
- Implementation:
  - Moved `src/instrumentation.ts` into `src/instrumentation/index.ts` so existing imports of `../instrumentation` continue resolving through the directory entrypoint.
  - Moved instrumentation-only collaborators into the same directory: `instrumentation-context` and `instrumentation-provider`.
  - Rewired relative imports so instrumentation internals reference shared `agent`, `context`, `logger`, `message`, `provider`, `skill`, and `tool` modules through stable parent paths.
- Code Complete review result:
  - Correctness: this is a directory-boundary change only; `createRunAspect()` and the logging decorators keep the same behavior because the module contents and public import path are preserved.
  - Maintainability: instrumentation is now clearly scoped as a subsystem instead of root-level helpers orbiting a single façade file.
  - Verification: reran typecheck plus retrieval, tool, context, session, runner, and CLI coverage because instrumentation is used across runner, provider, and tool execution paths.
- Verification:
  - `bun run typecheck`: pass.
  - `bun test test/unit/retrieval.test.ts test/unit/session.test.ts test/unit/context.test.ts test/unit/runner.test.ts test/unit/tool.test.ts test/unit/cli.test.ts`: 129 pass, 0 fail.
  - `bun run gate`: all local checks pass; remaining failure is `provider_gate` for real `deepseek` connectivity only.

## Step 36: Session Directory Consolidation

- Scope: improve the `src` file structure by grouping the already-extracted session collaborators under a dedicated `src/session/` directory, without changing the exported `src/session` entrypoint, session file shape, or restore behavior.
- Implementation:
  - Moved `src/session.ts` into `src/session/index.ts` so existing imports of `../session` continue resolving through the directory entrypoint.
  - Moved `session-tail` into the same directory so persistence and persisted-tail policy live together as one subsystem.
  - Rewired relative imports so the session internals reference shared `context`, `easycode-path`, `message`, and `settings` modules through stable parent paths.
- Code Complete review result:
  - Correctness: this is a directory-boundary change only; `SessionStore`, `SessionTokenUsage`, persisted-tail pruning, and restore behavior remain compatible because the module contents and public import path are preserved.
  - Maintainability: session persistence and session-tail policy now live in one explicit module boundary instead of being split across unrelated root-level files.
  - Verification: reran typecheck plus retrieval, tool, context, session, runner, and CLI coverage because this slice changes imports used by startup, session restore, and TUI session rendering.
- Verification:
  - `bun run typecheck`: pass.
  - `bun test test/unit/retrieval.test.ts test/unit/session.test.ts test/unit/context.test.ts test/unit/runner.test.ts test/unit/tool.test.ts test/unit/cli.test.ts`: 129 pass, 0 fail.
  - `bun run gate`: all local checks pass; remaining failure is `provider_gate` for real `deepseek` connectivity only.

## Step 37: Roadmap Completion Audit

- Scope: close the readability and architecture roadmap by auditing the current tree against the roadmap’s named phases and success criteria, without changing runtime behavior.
- Implementation:
  - Audited the current module boundaries against the roadmap and confirmed the intended subsystems now exist as explicit directories or focused helper boundaries: `src/agent/runner/`, `src/ui/tui/`, `src/retrieval/`, `src/instrumentation/`, `src/session/`, `src/context/*`, and `src/tool/builtins/*`.
  - Updated `specs/014-readability-refactor-roadmap.md` with a completion status and a current-state evidence section, so the roadmap now records why it is considered complete instead of relying only on scattered progress-log slices.
  - Kept the earlier phase descriptions as historical baseline notes while making the completion decision rest on the current tree and current verification evidence.
- Code Complete review result:
  - Correctness: no runtime code changed; this step only records the current completion state after checking the actual source tree, export surfaces, and verification outputs.
  - Maintainability: the roadmap now has an explicit closeout section, so future work can distinguish between the original hotspot baseline and the post-refactor module layout.
  - Verification: reran typecheck plus the unified gate on the committed runtime tree, and rechecked the main subsystem boundaries directly in source before marking the roadmap complete.
- Verification:
  - `bun run typecheck`: pass.
  - `bun run gate`: all local checks pass; remaining failure is `provider_gate` for real `deepseek` connectivity only.

## Step 38: Instruction Resolver Stable Multi-file Loading

- Scope: strengthen the minimal instruction resolver so project/global durable instruction loading matches the acceptance contract more closely, without changing prompt ordering relative to dynamic conversation history.
- Implementation:
  - Updated `src/instruction.ts` to resolve all existing project and global instruction files in stable order instead of stopping after the first project hit and the first global hit.
  - Preserved the current ordering contract: project instruction files still load before global ones, and both still appear before dynamic history in composed provider context.
  - Expanded unit and integration coverage so the resolver now proves multiple project/global instruction files are surfaced together and still precede the user prompt in provider input.
- Code Complete review result:
  - Correctness: durable instruction loading now matches the plural acceptance language for project/global instruction files while preserving the same prompt boundary and source tagging format.
  - Maintainability: the instruction service now behaves more like a true minimal resolver instead of a first-hit shortcut, which reduces hidden configuration loss when repos carry both `easycode.md` and `AGENTS.md`.
  - Verification: reran instruction-focused unit/integration coverage plus the unified gate because this change affects composed provider context for every run.
- Verification:
  - `bun run typecheck`: pass.
  - `bun test test/unit/instruction.test.ts test/integration/agent.test.ts`: pass.
  - `bun run gate`: all local checks pass; remaining failure is `provider_gate` for real `deepseek` connectivity only.

## Step 39: Code Index Multiline Comment And String Masking

- Scope: reduce false-positive code-navigation references by teaching the code index to ignore multiline comments and multiline string bodies, without changing definition/call graph contracts.
- Implementation:
  - Added a shared stateful masking helper in `src/tool/code-navigator/parsing.ts` that preserves line shape while stripping `/* ... */`, multiline template strings, and Python triple-quoted strings from semantic scanning.
  - Rewired `src/tool/code-navigator/code-index.ts` to use the masked lines for `calls` and `references` extraction instead of a line-local string/comment stripper.
  - Reused the same masked lines in generic local-binding scope extraction so non-TypeScript languages also stop learning bogus bindings from multiline comment/string bodies.
  - Added regression coverage for TypeScript block comments + multiline template literals and for Python triple-quoted strings.
- Code Complete review result:
  - Correctness: symbol lookup now avoids counting comment/docstring/template-literal noise as semantic references, which makes the code index a clearer improvement over raw text search in same-name collision cases.
  - Maintainability: masking now lives in one shared helper instead of duplicated per-line heuristics, so future parser tweaks do not need to be repeated in both reference extraction and generic scope extraction.
  - Verification: reran code-navigation-focused unit tests plus the unified gate because this changes the shared code-index path used by `repo_map`, `find_definition`, `find_references`, and `call_graph`.
- Verification:
  - `bun run typecheck`: pass.
  - `bun test test/unit/code-navigator.test.ts`: pass.
  - `bun run gate`: all local checks pass; remaining failure is `provider_gate` for real `deepseek` connectivity only.

## Step 40: Default Import Alias Resolution In Code Index

- Scope: fix a cross-file code-navigation misresolution where default imports could bind to the wrong exported symbol in the target file, without changing `repo_map` or search tool contracts.
- Implementation:
  - Added explicit `exportStyle` metadata to indexed symbols so the code index distinguishes `export default` from ordinary named exports.
  - Updated import resolution so `import foo from "./leaf"` resolves only to the target file's default export instead of falling back to the first exported symbol.
  - Bumped the code-index generator version so cached indexes rebuild with the new symbol metadata.
  - Added a regression test proving `call_graph` follows a default-import alias to the actual default export, not to an unrelated named export in the same file.
- Code Complete review result:
  - Correctness: cross-file default-import navigation now preserves semantic identity for callers/callees, which closes a real gap between AST-backed navigation and naive text matching.
  - Maintainability: export intent is now explicit in the index schema instead of being inferred from a lossy boolean at import-resolution time.
  - Verification: reran code-navigation-focused unit tests plus the unified gate because this changes cached index structure and cross-file symbol resolution.
- Verification:
  - `bun run typecheck`: pass.
  - `bun test test/unit/code-navigator.test.ts`: pass.
  - `bun run gate`: all local checks pass; remaining failure is `provider_gate` for real `deepseek` connectivity only.

## Step 41: Namespace Import Member Resolution In Code Index

- Scope: fix a code-navigation gap where namespace-import member calls such as `leafApi.leaf()` could lose their semantic target under same-name collisions, without changing tool output shapes.
- Implementation:
  - Added optional `receiverName` metadata on indexed edges so call extraction can preserve the property receiver for member calls.
  - Updated code-index import resolution to use the receiver alias when matching import bindings, which lets `import * as leafApi from "./leaf"` resolve `leafApi.leaf()` to the imported file instead of falling back to ambiguous global name matching.
  - Bumped the code-index generator version so cached indexes rebuild with the new edge metadata.
  - Added a regression test proving `call_graph` resolves namespace-import member calls to the intended imported file even when another file exports the same symbol name.
- Code Complete review result:
  - Correctness: namespace-import call edges now keep their semantic target under same-name collisions, which closes another gap between the code index and plain text search.
  - Maintainability: receiver-aware resolution is localized to code-index edge metadata and import resolution, instead of relying on brittle preview-text heuristics later.
  - Verification: reran code-navigation-focused unit tests plus the unified gate because this changes cached edge structure and cross-file call resolution.
- Verification:
  - `bun run typecheck`: pass.
  - `bun test test/unit/code-navigator.test.ts`: pass.
  - `bun run gate`: all local checks pass; remaining failure is `provider_gate` for real `deepseek` connectivity only.

## Step 42: Re-export Barrel Resolution In Code Index

- Scope: fix a code-navigation gap where named imports through a local re-export barrel could lose their semantic target under same-name collisions, without changing tool output shapes.
- Implementation:
  - Added optional `exportBindings` metadata on indexed files so the code index records local `export { ... }` aliases and `export { ... } from "./impl"` re-export bindings.
  - Updated import resolution to follow named exports through local barrel files before falling back to ambiguous project-wide name matching.
  - Bumped the code-index generator version so cached indexes rebuild with the new export-binding metadata.
  - Added a regression test proving `call_graph` resolves `import { leaf } from "./index"` through `index.ts -> impl.ts` even when another file exports the same symbol name.
- Code Complete review result:
  - Correctness: named re-export barrels now preserve semantic identity for cross-file callers, which closes another common real-world gap between the code index and raw text search.
  - Maintainability: re-export intent is now explicit in cached file metadata instead of being inferred indirectly from export edges and global name uniqueness.
  - Verification: reran code-navigation-focused unit tests plus the unified gate because this changes cached file metadata and import resolution behavior.
- Verification:
  - `bun run typecheck`: pass.
  - `bun test test/unit/code-navigator.test.ts`: pass.
  - `bun run gate`: all local checks pass; remaining failure is `provider_gate` for real `deepseek` connectivity only.

## Step 43: Star Re-export Barrel Resolution In Code Index

- Scope: fix a code-navigation gap where named imports through `export * from "./impl"` barrel files could lose their semantic target under same-name collisions, without changing tool output shapes.
- Implementation:
  - Added optional `exportAllSources` metadata on indexed files so the code index records star re-export sources explicitly.
  - Updated exported-symbol resolution to recurse through `export * from ...` sources before falling back to ambiguous project-wide name matching.
  - Bumped the code-index generator version so cached indexes rebuild with the new star re-export metadata.
  - Added a regression test proving `call_graph` resolves `import { leaf } from "./index"` through `index.ts -> export * from "./impl"` even when another file exports the same symbol name.
- Code Complete review result:
  - Correctness: star re-export barrels now preserve semantic identity for cross-file callers, which closes another common barrel-file gap between the code index and raw text search.
  - Maintainability: star re-export intent is now explicit in cached file metadata instead of being inferred only from coarse export edges.
  - Verification: reran code-navigation-focused unit tests plus the unified gate because this changes cached file metadata and named import resolution behavior.
- Verification:
  - `bun run typecheck`: pass.
  - `bun test test/unit/code-navigator.test.ts`: pass.
  - `bun run gate`: all local checks pass; remaining failure is `provider_gate` for real `deepseek` connectivity only.

## Step 44: Non-blocking Hypothesis Drift Recovery

- Scope: stop hypothesis-drift protection from aborting an in-progress run when the provider still returns a drifting diagnosis after the built-in retry, while keeping the drift ledger and correction prompt behavior intact.
- Implementation:
  - Updated `src/agent/runner/validated-provider-turn.ts` so the validator still retries once and records each violation, but now falls back to the last provider turn instead of emitting a synthetic failure event that terminates the run.
  - Removed the now-unused failure-text dependency from the validated-provider-turn wiring in `src/agent/runner/index.ts`.
  - Added an integration regression in `test/integration/agent.test.ts` proving repeated unresolved drift no longer surfaces `Hypothesis drift blocked...` to the user or fails the run.
- Code Complete review result:
  - Correctness: drift protection still nudges the model back to the active diagnosis first, but no longer interrupts user-visible execution on a stubborn second attempt.
  - Maintainability: the recovery path is now a simple fallback to an already captured provider turn instead of a synthetic provider-error branch with separate replay semantics.
  - Verification: targeted the exact runner integration path first because this change is about failure semantics, then revalidated through typecheck, cache benchmark, and the default gate.
- Verification:
  - `bun test test/integration/agent.test.ts`: pass.
  - `bun run typecheck`: pass.
  - `bun run cache:bench -- --provider simulated --suite real --quiet`: pass; the default cache benchmark remained at `effective_input=34644`, so no benchmark-visible cost regression was introduced by this runner-only change.
  - `bun run gate`: local checks pass; remaining failure is the known external `provider_gate` for real `deepseek` connectivity only.

## Step 45: Global Code-Nav Cache And Session Lifecycle Controls

- Scope: move repo-map/code-index derived artifacts to the global EasyCode project cache at runtime, keep tests isolated, and add interactive session switch/delete controls with delete-time archival into project memory.
- Implementation:
  - Added explicit global-project cache helpers in `src/easycode-path.ts` and rewired `src/tool/code-navigator/{constants,cli,code-index}.ts` so runtime code-navigation caches use `~/.easycode/projects/<hash>/cache/`, while test runs keep using project-local `.easycode/cache/`.
  - Extended slash/session handling so `/session switch <id>` reloads another session's persisted settings/context and `/session delete <id>` removes the session JSON, logger transcripts, and saved plan directory.
  - Added session-delete archival in `src/session/index.ts` using `ProjectMemoryStore`, so deleted sessions leave a short durable project-memory summary instead of disappearing without trace.
- Code Complete review result:
  - Correctness: code-navigation cache placement is now explicit and no longer depends on whether a repo has a local `.easycode/` folder, while interactive session deletion cleans all known session-scoped artifacts.
  - Maintainability: session lifecycle responsibilities now live beside session persistence instead of being split across ad hoc CLI-only cleanup paths.
  - Verification: targeted slash/session/code-navigation coverage first because the new behavior crosses startup state, runtime session state, and derived cache metadata.

## Step 46: Stronger Skill-Reuse Prompt Contract

- Scope: make the agent more likely to reuse loaded skill guidance and referenced scripts/tools instead of inventing fresh workflows, without adding irrelevant prompt weight to summary mode.
- Implementation:
  - Removed the generic skill reminders from the global `operatingCore` in `src/prompt/agent.ts`.
  - Added explicit skill-reuse rules to `planModeProtocol` and `buildModeProtocol`: load selected or first-use skills before task-specific action, inspect referenced scripts/tools/templates/paths first, and only bypass them with an explicit reason.
  - Added prompt-level regression coverage in `test/unit/prompt.test.ts` to assert the new rules exist in build/plan prompts and stay absent from summary prompts.
- Code Complete review result:
  - Correctness: the stronger rules now target the modes where task execution and planning happen, instead of leaking into summary-only prompts.
  - Maintainability: the prompt contract is more executable because it says when to load a skill, what artifacts to inspect first, and when bypass is allowed.
  - Verification: reran prompt-focused tests, cache benchmark, and the unified gate because this change affects prompt shape and prompt-cache cost.

## Step 47: Skill Artifact Discovery In Runtime

- Scope: carry the stronger skill-reuse contract into runtime behavior so loaded skills expose their referenced local scripts/templates/paths directly, instead of only returning raw markdown.
- Implementation:
  - Extended `src/skill.ts` so `SkillService.load()` extracts local artifact references from markdown links and inline code spans, resolves them against the owning `SKILL.md`, and classifies them as file, directory, or missing.
  - Updated `src/tool/builtins/retrieval-tools.ts` so the `skill` tool now returns a `<skill_artifacts>` block ahead of the raw skill content and includes structured artifact metadata in the tool result.
  - Added unit/integration coverage in `test/unit/skill.test.ts`, `test/unit/tool.test.ts`, and `test/integration/agent.test.ts` to lock artifact extraction, tool formatting, and the provider-visible skill loading flow.
- Code Complete review result:
  - Correctness: selected or first-use skills now surface the concrete local artifacts the prompt tells the model to inspect first, reducing the gap between prompt guidance and executable runtime behavior.
  - Maintainability: artifact extraction stays inside `SkillService`, so skill-aware runtime paths share one resolver instead of each caller reparsing markdown ad hoc.
  - Verification: reran targeted skill/tool/agent coverage, `bun run typecheck`, and the unified gate because this changes provider-visible tool output and loaded skill structure.

## Step 48: Auto-Inspect Skill Artifacts After Skill Load

- Scope: turn exposed skill artifacts into immediate runtime evidence by automatically inspecting a small first batch of existing local artifacts right after a successful `skill` tool load, instead of relying on the next provider turn to remember that work.
- Implementation:
  - Updated `src/agent/runner/index.ts` so successful `skill` tool results schedule up to three follow-up inspections, mapping file artifacts to `read` and directory artifacts to `list`.
  - Resolved those follow-up tool inputs against the project root using the artifact `resolvedPath`, so skill-local references like `scripts/demo.sh` are inspected via project-relative paths such as `.easycode/skills/demo/scripts/demo.sh`.
  - Added integration coverage in `test/integration/agent.test.ts` to assert the next provider turn already sees the auto-inspected artifact content, while existing runner UI event coverage continues to prove ordinary skill loads keep their event ordering when no artifacts are present.
- Code Complete review result:
  - Correctness: first-use skill loading now produces real inspection evidence in context, not just a reminder block, so the runtime better enforces the intended “inspect referenced artifacts first” workflow.
  - Maintainability: the follow-up inspection stays inside `AgentRunner`, where tool sequencing and context updates already live, instead of spreading special-case logic across providers or prompt templates.
  - Verification: reran focused runner/agent coverage, `bun run typecheck`, and the unified gate because this changes run-loop tool sequencing and provider-visible context.

## Step 49: Artifact Order And Inspection Priority Refinement

- Scope: make skill-artifact inspection follow the skill document's actual mention order while still prioritizing concrete existing files over directory noise, without changing prompt composition or cache-sensitive prefixes.
- Implementation:
  - Updated `src/skill.ts` so markdown-link and inline-code artifact references are merged by source offset, preserving the document's mention order instead of listing all markdown links before all inline-code paths.
  - Updated `src/agent/runner/index.ts` so auto-inspection normalizes all inspectable artifacts first, then prioritizes existing files before directories while preserving within-kind order, and still ignores missing paths.
  - Added coverage in `test/unit/skill.test.ts` for mixed markdown/code mention order and in `test/integration/agent.test.ts` for file-before-directory auto-inspection ordering.
- Code Complete review result:
  - Correctness: a skill that says “run this script first, then browse that directory” now yields the same effective inspection order in runtime evidence instead of being reordered by parser shape or directory-first noise.
  - Maintainability: ordering logic is now explicit in the artifact extractor and runner inspection queue rather than being an accidental side effect of how two regex scans were concatenated.
  - Verification: reran focused skill/runner/agent coverage, `bun run typecheck`, `bun run cache:bench -- --provider simulated --suite real --quiet`, and the unified gate because this slice changes runtime sequencing but must not regress prompt prefix caching.

## Step 50: High-Signal Auto-Inspection Filter

- Scope: keep auto-inspection focused on the first useful runtime evidence by skipping low-signal file types such as images, archives, and lockfiles while retaining scripts, docs, config-like text files, and relevant directories, without touching prompt composition.
- Implementation:
  - Updated `src/agent/runner/index.ts` with explicit allowlists for high-signal text/script/config file extensions and well-known filenames, plus ignore lists for lockfiles and noisy build/cache directories.
  - Reused that filter inside the existing file-before-directory prioritization path so auto-inspection still preserves the current runtime ordering rules after low-signal artifacts are removed.
  - Added integration coverage in `test/integration/agent.test.ts` to assert that `image.png`, `archive.zip`, and `pnpm-lock.yaml` are skipped while `scripts/demo.sh` and `templates/` still feed the next provider turn.
- Code Complete review result:
  - Correctness: first-use skill loading now surfaces more relevant evidence instead of spending its limited auto-inspection budget on assets or packaging noise that rarely help task execution.
  - Maintainability: the high-signal filter is a small explicit policy table in the runner, so future additions are local and do not require changing prompt text or artifact extraction.
  - Verification: reran focused skill/runner/agent coverage, `bun run typecheck`, `bun run cache:bench -- --provider simulated --suite real --quiet`, and the unified gate because this slice changes runtime inspection selection but must not regress prompt prefix caching.

## Step 51: Memory Eval Coverage For Recall And Promotion

- Scope: add default-gate eval coverage for the new project-memory runtime paths so continuation recall and durable lesson promotion are exercised end to end, not only through unit tests.
- Implementation:
  - Extended `src/provider/fake.ts` with deterministic fake-provider branches for a continuation-style memory-recall prompt and a `memory_promote` workflow prompt.
  - Added `evals/tasks/EC-010.json` and `evals/tasks/EC-011.json`, plus the dedicated `evals/fixtures/memory-recall/` fixture with scoped archived memory.
  - Added runner integration coverage in `test/integration/agent.test.ts` to assert `memory_promote` writes a structured `successful_workflow` record through the normal tool execution path.
- Code Complete review result:
  - Correctness: the default fake eval suite now proves that project-memory recall reaches provider-visible context and that durable lesson promotion writes the expected structured memory artifact.
  - Maintainability: memory evals reuse the existing lightweight fake-provider harness instead of introducing a separate bespoke test runner.
  - Verification: reran focused memory/eval/agent coverage, `bun run typecheck`, and the unified gate because this slice changes both provider-visible fake behavior and the default eval corpus.

## Step 52: Task Checkpoint Runtime Recall And Roadmap Closure

- Scope: close the remaining project-memory roadmap gaps by proving `task_state` checkpoints enter provider-visible runtime context at session startup and session switch, then synchronize the roadmap and acceptance contract to the implemented state.
- Implementation:
  - Extended `src/provider/fake.ts` with a deterministic `active task checkpoint eval` branch that succeeds only when `<active_task_checkpoints>` and the checkpoint text are present in provider input.
  - Added CLI coverage in `test/unit/cli.test.ts` to assert active task checkpoints are injected into provider context both at interactive startup and after `/session switch`.
  - Updated `specs/acceptance.md` and `specs/015-memory-module-roadmap.md` so task checkpoint commands, startup/switch runtime injection, and retrieval-refinement behavior are part of the formal contract rather than undocumented partial behavior.
- Code Complete review result:
  - Correctness: active unfinished work is now proven to reach the model at the two session lifecycle boundaries called out by the roadmap, not only rendered as CLI text.
  - Maintainability: roadmap status now matches the implemented runtime surface, reducing drift between spec and the current project-memory behavior.
  - Verification: reran focused CLI/memory coverage plus the unified gate because this slice changes provider-visible fake behavior and closes the remaining roadmap evidence gap.

## Step 53: Replaceable Bash Guardrails And Structured Audit Fields

- Scope: stop the model from taking low-value `bash` paths when an internal inspection tool already covers the job, while making session logs directly auditable from `.jsonl` without scraping replay-heavy transcript text.
- Implementation:
  - Updated `src/tool/bash.ts` to classify bash commands into stable audit classes, attach `command` / `normalizedCommand` / `commandClass` / `replaceableBy` metadata to bash tool results, and stop treating replaceable inspection shapes as readonly auto-approval candidates.
  - Updated `src/tool/registry.ts` to fail fast on replaceable bash inspection commands with a structured `bash_replaced_by_internal_tool` result that points the model at the matching internal tool.
  - Updated `src/permission.ts` so readonly auto-approval now distinguishes the actual `bash` fallback tool from internal bash-permission tools: only non-replaceable fallback scopes (`pwd`, `ls`, `find`, `wc`, safe readonly `curl`) auto-approve, while internal `git_*` tools stay frictionless.
  - Updated `src/instrumentation/instrumentation-context.ts` so `provider -> tool_call_message` and `tool_result -> context` log entries now carry bash audit fields, making session-log analysis possible from structured `.jsonl` events instead of transcript-only scraping.
  - Synchronized `specs/acceptance.md` and `specs/005-boundary-conditions.md` with the new guardrail contract and added focused regression coverage in `test/unit/tool.test.ts`, `test/unit/permission.test.ts`, and `test/integration/agent.test.ts`.
- Code Complete review result:
  - Correctness: replaceable bash now fails before permission/execution, so the runtime finally enforces the existing prompt contract instead of only hoping the model follows it.
  - Maintainability: one shared bash-classification path now feeds result metadata, runtime blocking, and logger audit fields, which reduces policy drift across prompt, permission, and observability layers.
  - Verification: reran focused tool/permission/logger integration coverage and TypeScript checks for this slice because the behavior change is localized to bash policy and audit surfaces.

## Step 54: Plan LowRisk Visibility And Subagent Review Discipline

- Scope: close the ordinary plan approval observability gap while strengthening subagent execution quality for broad review workflows.
- Implementation:
  - Made `ExecutionPlan.lowRisk` a normalized runtime boolean that is visible in rendered plan markdown and preserved in structured JSON, including fallback parser and replan prompts.
  - Kept `[A]` default approval semantics intact, but added structured `plan.approval` log events that distinguish `user_default`, `user_explicit`, and `low_risk_auto` approvals.
  - Added a reviewer anti-pattern gate: broad review/repair/optimization outputs that can be decomposed into bounded scopes must delegate at least one reviewer task before final synthesis.
  - Tightened subagent coordinator outputs to concise conclusions with `evidenceRefs`, while keeping detailed tool traces in subagent side logs.
  - Added per-invocation and per-run subagent usage logs with role, status, turns, token, cache, and budget fields, and changed foreground subagent budgeting to reserve only available turns and release unused budget.
- Code Complete review result:
  - Correctness: plan approval and low-risk execution are now auditable from logs and rendered plans, and broad review work cannot silently bypass reviewer delegation.
  - Maintainability: role-level subagent metrics provide the data needed to tune budgets, cache behavior, and routing without scraping transcripts.
  - Verification: added focused unit/integration coverage for lowRisk rendering, approval source logging, reviewer gating, subagent summaries, and role usage logs.

## Step 55: Remove Cross-Session Task Checkpoints

- Scope: align runtime task semantics with session-local execution by removing manual `/task` checkpoints, stopping plan state from promoting cross-session `task_state` records, and ensuring active plans do not resume after exit or session switch.
- Implementation:
  - Removed `/task` parsing, CLI help text, and session-helper handling, plus the startup/session-switch injection path for `<active_task_checkpoints>`.
  - Stopped plan activation from writing `task_state` memory checkpoints, but kept cleanup of legacy plan-tagged `task_state` records when clearing an active plan.
  - Stripped plan ledger subjects on session restore so unfinished work does not automatically resume in a later session, matching the existing transient-goal behavior.
  - Narrowed memory tooling and auto-recall guidance to durable preferences, repo facts, failure patterns, successful workflows, and session archives; legacy `task_state` records remain readable only for backward compatibility.
- Code Complete review result:
  - Correctness: exiting or switching sessions now drops transient task execution state instead of reviving stale work from memory or saved session ledgers.
  - Maintainability: task semantics are simpler because plan execution now has one live-session state path instead of split session-memory and project-memory checkpoints.
  - Verification: added focused slash/session coverage updates and reran targeted CLI/session/tool tests, plus TypeScript and the unified gate.

## Step 56: Goal Review Fail-Closed And Active-Plan Checkpoint Suppression

- Scope: fix two workflow gaps found in the `review` session by making goal review completion fail closed when the review still reports blockers, and by stopping the generic exploration checkpoint from interrupting active structured-plan execution near the end of long review runs.
- Implementation:
  - Updated `src/tool/builtins/retrieval-tools.ts` so `goal_complete` now inspects the review-phase completion summary plus the latest assistant review text and rejects completion when they still report blocking defects, critical issues, or “not committable” style outcomes.
  - Updated `src/agent/runner/runner-turn-prep.ts` and `src/agent/runner/index.ts` so the exploration-summary checkpoint is suppressed whenever an active structured plan step is already driving execution, preserving the step-by-step controller contract through final review-plan slices.
  - Added focused regression coverage in `test/unit/tool.test.ts` and `test/unit/runner.test.ts` for review-phase blocker rejection and active-plan checkpoint suppression, then reran the related logger/session/TUI/runner suites plus TypeScript checks.
- Code Complete review result:
  - Correctness: goal review can no longer silently report blockers and still transition to `completed`, and long-running structured review plans no longer receive a stray “ask the user whether to continue exploring” prompt mid-step.
  - Maintainability: the exploration checkpoint logic now keys off explicit structured-plan state instead of only global step count, which better matches the controller architecture.
  - Verification: reran `bun test test/unit/tool.test.ts test/unit/runner.test.ts test/unit/logger.test.ts test/unit/session.test.ts test/unit/tui.test.ts` and `bun run typecheck`.

## Step 57: Planning Delegation Deadlock And Hypothesis Drift Narrowing

- Scope: fix two runtime false positives exposed by the `trading` session: planning-mode bounded inspection getting trapped by the coordinator delegation gate, and action-routing sentences being misclassified as hypothesis drift.
- Implementation:
  - Updated `src/agent/runner/index.ts` so the coordinator delegation gate is skipped while `requiresProposedPlan` is active, leaving plan-phase bounded inspection governed by the existing planning hard gate instead of conflicting with the prompt rule that forbids `delegate_subagent` during the initial planning gate.
  - Narrowed `src/agent/hypothesis.ts` so hypothesis extraction now keys off diagnosis-style statements and explicit `the fix/solution is ...` phrasing, instead of treating generic `should use` / `need to use` execution-routing sentences as competing hypotheses.
  - Added focused regression coverage in `test/unit/runner.test.ts` and `test/unit/hypothesis.test.ts` for planning-mode bounded inspection and for action-sentence non-detection while preserving real diagnostic-drift detection.
- Code Complete review result:
  - Correctness: planning runs can now do bounded coordinator reads before submitting a plan, and routing/tool-choice chatter no longer self-triggers hypothesis-drift retries.
  - Maintainability: plan-phase and execution-phase gates now have clearer responsibilities, while hypothesis extraction is closer to the actual “lock diagnosis, not tool routing” policy.
  - Verification: reran focused runner/hypothesis coverage for the affected runtime paths.

## Step 58: Restore Default CLI Force-Planning

- Scope: fix the remaining `trading` workflow bug where ordinary CLI prompts still entered `build` directly, so the coordinator delegation gate could loop on bounded retrieval before any plan was proposed.
- Implementation:
  - Updated `src/cli.ts` so both single-run and interactive sessions create the runner with `forcePlanning: true`, leaving the runner’s own `planIdRecord` checks to keep active approved-plan execution in `build` while making fresh user prompts honor the prompt contract that requires an initial proposal plan.
  - Added `test/integration/cli.test.ts` coverage proving a normal interactive fake-provider prompt now logs `provider.input` with `mode: "plan"` and surfaces a `<proposed_plan>` before any execution.
- Code Complete review result:
  - Correctness: ordinary prompts now reach the planning hard gate first, so they cannot bypass planning and fall straight into execution-only delegation loops.
  - Maintainability: CLI entry behavior now matches the runtime prompt contract instead of having a goal-only exception path that was easy to forget when debugging sessions from logs.
  - Verification: reran focused CLI integration plus the runner/hypothesis/typecheck checks covering the affected plan/delegation paths.

## Step 59: Restore Build-First Default And Soft Fallbacks

- Scope: reverse the default force-planning behavior so normal prompts stay in `build`, keep `/goal` as the only auto-planning flow, restore public `/plan`, and reduce repeated hard-failure loops when planning or validation gates keep rejecting a run.
- Implementation:
  - Updated `src/cli.ts`, `src/slash.ts`, `src/cli/session-helpers.ts`, and `src/i18n.ts` so ordinary single-run and interactive prompts create the runner with `forcePlanning: false`, `/goal` still queues planning automatically, `/plan <request>` is publicly exposed again, and welcome/help copy now advertises both slash commands.
  - Updated `src/prompt/agent.ts` plus `src/agent/runner/runner-support.ts` so `build` and `plan` prompts diverge again: `build` executes directly and must not emit `plan_exit` unless an explicit planning turn is active, while `plan` retains the proposal-plan contract and plan-mode permission profile.
  - Updated `src/agent/runner/index.ts` and `src/agent/runner/validated-provider-turn.ts` so repeated validation failures stop after two attempts, non-plan runs degrade to a result-bearing fallback message instead of hard failure, repeated plan-gate failures synthesize a minimal draft `<proposed_plan>` for approval, and delegation-only validation gates no longer block ordinary build turns that have no active plan step.
  - Updated `specs/acceptance.md`, `test/unit/slash.test.ts`, `test/unit/prompt.test.ts`, and `test/unit/runner.test.ts` to lock the restored `/plan` surface, build-first prompt contract, and soft-fallback behavior.
- Code Complete review result:
  - Correctness: normal prompts no longer pay the plan-mode gate cost by default, `/goal` still preserves controlled auto-planning, and repeated validator rejection now converges to an inspectable result instead of looping into failure.
  - Maintainability: mode boundaries are explicit again, which makes the runner easier to reason about because planning-only tools and permissions are no longer silently active in build runs.
  - Verification:
  - `bun test test/unit/slash.test.ts test/unit/prompt.test.ts test/unit/cli.test.ts test/unit/runner.test.ts`
  - `bun run typecheck`

## Step 60: Deterministic Cross-Platform Desktop Release Verification

- Scope: turn the desktop roadmap's cross-platform packaging requirement into an executable release gate instead of relying on broad artifact upload globs.
- Implementation:
  - Added `scripts/verify-desktop-release.mjs` and `bun run desktop:verify-release` to validate expected versioned installers plus the packaged platform sidecar for every existing package host, including the macOS arm64, Linux x64, and Windows x64 CI targets.
  - Declared explicit electron-builder targets for every CI platform, cleaned stale sidecar binaries and release output before packaging, and made `desktop:package` run release verification before returning success.
  - Tightened `.github/workflows/desktop-release.yml` so each matrix job supplies its expected target and uploads only verified lowercase `easycode-*` artifacts with missing-output failure enabled.
  - Added fixture-based verifier coverage and package-script assertions, then synchronized the desktop sidecar readiness checklist with the enforced contract.
- Code Complete review result:
  - Correctness: stale installers and sidecar binaries cannot satisfy, bloat, or contaminate a new release, and a matrix build fails before upload when an expected installer or the single platform sidecar is absent.
  - Maintainability: one small platform table owns artifact names, unpacked resource paths, and sidecar names while the existing capability verifier remains focused on runtime behavior.
  - Verification: focused tests, a real local macOS arm64 package, the release verifier, desktop capability verification, and the unified quality gate.
