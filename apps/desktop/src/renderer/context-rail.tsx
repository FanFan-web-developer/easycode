import { useEffect, useState } from "react"
import type { DesktopSkillInfo, DesktopWorkspaceStatus } from "../shared/protocol.js"
import type { SelectOption } from "./app-types.js"
import { providerReadinessDetail, providerReadinessLabel } from "./provider-readiness.js"
import { languageSelectOptions, normalizeSelectOptions } from "./select-options.js"
import type { DesktopProviderReadiness, DesktopSettings } from "../shared/protocol.js"

export type ContextRailCopy = {
  activeCount: (count: number) => string
  changes: string
  changedFiles: (count: number) => string
  clean: string
  clearSkills: string
  environment: string
  gitBranch: string
  language: string
  maxSteps: string
  maxTokens: string
  modified: string
  noPathResolved: string
  noSkillsFound: string
  notSelected: string
  off: string
  on: string
  provider: string
  providerStatus: string
  refreshGitChanges: string
  run: string
  showAllSkills: (count: number) => string
  showLess: string
  skills: string
  thinking: string
  viewFileDiff: (filePath: string) => string
  workingTree: string
  workspace: string
  languageName: (code: string) => string
}

export function ContextRail({
  copy,
  onChangeLanguage,
  onChangeContextLimit,
  onChangeMaxSteps,
  onChangeProvider,
  onChangeThinking,
  onClearSkills,
  onRefreshWorkspaceStatus,
  onToggleSkill,
  onViewFileDiff,
  open,
  providerOptions,
  providerReadiness,
  running,
  selectedSkills,
  settings,
  skills,
  status,
  statusRefreshing,
  workspaceName,
}: {
  copy: ContextRailCopy
  onChangeContextLimit: (value: number | undefined) => void
  onChangeLanguage: (language: string) => void
  onChangeMaxSteps: (maxSteps: number | undefined) => void
  onChangeProvider: (provider: string) => void
  onChangeThinking: (thinking: boolean) => void
  onClearSkills: () => void
  onRefreshWorkspaceStatus: () => void
  onToggleSkill: (skill: DesktopSkillInfo) => void
  onViewFileDiff: (filePath: string) => void
  open: boolean
  providerOptions: string[]
  providerReadiness?: DesktopProviderReadiness
  running: boolean
  selectedSkills: string[]
  settings?: DesktopSettings
  skills: DesktopSkillInfo[]
  status?: DesktopWorkspaceStatus
  statusRefreshing: boolean
  workspaceName: string
}) {
  return <aside className={`context-rail ${open ? "open" : "collapsed"}`}>
    {open && <>
      <Panel title={copy.environment}>
        <InfoRow label={copy.workspace} value={workspaceName} detail={settings?.workspaceRoot || copy.notSelected} status="ok" />
        <SelectRow label={copy.provider} value={settings?.provider ?? "deepseek"} options={providerOptions} onChange={onChangeProvider} />
        <InfoRow label={copy.providerStatus} value={providerReadinessLabel(providerReadiness)} detail={providerReadinessDetail(providerReadiness)} status={providerReadiness?.status === "ready" ? "ok" : "warn"} />
        <ToggleRow copy={copy} label={copy.thinking} value={settings?.thinking ?? true} onChange={onChangeThinking} />
        <SelectRow label={copy.language} value={settings?.language ?? "en"} options={languageSelectOptions(copy)} onChange={onChangeLanguage} />
      </Panel>
      <GitChangesPanel copy={copy} onRefresh={onRefreshWorkspaceStatus} onViewFileDiff={onViewFileDiff} refreshing={statusRefreshing} status={status} />
      <Panel title={copy.run}>
        <NumberRow label={copy.maxTokens} value={settings?.maxTokens} fallback={32000} onCommit={onChangeContextLimit} />
        <NumberRow label={copy.maxSteps} value={settings?.maxSteps} fallback={66} onCommit={onChangeMaxSteps} />
      </Panel>
      <SkillsPanel copy={copy} skills={skills} selected={selectedSkills} running={running} onClear={onClearSkills} onToggle={onToggleSkill} />
    </>}
  </aside>
}

function Panel({ action, children, title }: { action?: React.ReactNode; children: React.ReactNode; title: string }) {
  return <section className="rail-panel"><div className="panel-title"><h2>{title}</h2>{action}</div>{children}</section>
}

function GitChangesPanel({ copy, onRefresh, onViewFileDiff, refreshing, status }: { copy: ContextRailCopy; onRefresh: () => void; onViewFileDiff: (filePath: string) => void; refreshing: boolean; status?: DesktopWorkspaceStatus }) {
  const files = status?.files ?? []
  const refreshAction = <button className="panel-refresh-button" type="button" onClick={onRefresh} disabled={refreshing} aria-label={copy.refreshGitChanges} title={copy.refreshGitChanges}><span className={refreshing ? "spinning" : ""} aria-hidden="true">↻</span></button>
  return <Panel action={refreshAction} title={copy.changes}>
    <InfoRow label={copy.gitBranch} value={status?.branch ?? "unknown"} detail={aheadBehind(status)} />
    <InfoRow label={copy.workingTree} value={status?.clean ? copy.clean : copy.modified} status={status?.clean ? "ok" : "warn"} />
    <div className="git-change-summary">
      <span>{status?.clean ? copy.clean : copy.changedFiles(status?.changedFiles ?? 0)}</span>
      {!status?.clean && <><strong>+{status?.added ?? 0}</strong><em>-{status?.deleted ?? 0}</em></>}
    </div>
    {status?.error && <div className="empty-list compact">{status.error}</div>}
    {!status?.error && files.length === 0 && <div className="empty-list compact">{status?.clean ? copy.clean : copy.noPathResolved}</div>}
    {files.length > 0 && <div className="git-change-list">
      {files.map((file) => <button className="git-change-row" key={`${file.status}-${file.path}`} onClick={() => onViewFileDiff(file.path)} title={copy.viewFileDiff(file.path)} type="button">
        <span>{file.status}</span>
        <strong title={file.path}>{file.path}</strong>
        <small><b>+{file.added}</b><i>-{file.deleted}</i></small>
      </button>)}
    </div>}
  </Panel>
}

function SkillsPanel({ copy, onClear, onToggle, running, selected, skills }: { copy: ContextRailCopy; onClear: () => void; onToggle: (skill: DesktopSkillInfo) => void; running: boolean; selected: string[]; skills: DesktopSkillInfo[] }) {
  const [expanded, setExpanded] = useState(false)
  const selectedSet = new Set(selected)
  const visible = expanded ? skills : skills.slice(0, 8)
  return <Panel title={copy.skills}>
    <div className="panel-inline-actions"><span>{copy.activeCount(selected.length)}</span><button onClick={onClear} disabled={running || selected.length === 0}>{copy.clearSkills}</button></div>
    {skills.length === 0 && <div className="empty-list compact">{copy.noSkillsFound}</div>}
    {visible.length > 0 && <div className="skill-list">
      {visible.map((skill) => {
        const active = selectedSet.has(skill.id) || selectedSet.has(skill.name)
        return <button key={skill.id} className={`skill-row ${active ? "active" : ""}`} onClick={() => onToggle(skill)} disabled={running}>
          <span>{active ? copy.on : copy.off}</span>
          <strong>{skill.name}</strong>
          <small>{skill.description}</small>
        </button>
      })}
    </div>}
    {skills.length > 8 && <button className="more-row" onClick={() => setExpanded((value) => !value)}>{expanded ? copy.showLess : copy.showAllSkills(skills.length)}</button>}
  </Panel>
}

function InfoRow({ detail, label, status, value }: { detail?: string; label: string; status?: "ok" | "warn"; value: string }) {
  return <div className="info-row"><div><span>{label}</span>{detail && <small>{detail}</small>}</div><strong className={status}>{value}</strong></div>
}

function SelectRow({ label, onChange, options, value }: { label: string; onChange: (value: string) => void; options: Array<string | SelectOption>; value: string }) {
  const normalized = normalizeSelectOptions(options, value)
  const selected = normalized.find((option) => option.value === value) ?? normalized[0] ?? { value, label: value }
  return <div className="editable-row"><span>{label}</span><div className="panel-dropdown">
    <button className="panel-dropdown-trigger" type="button">
      <strong>{selected.label}</strong>
      <i aria-hidden="true" />
    </button>
    <div className="panel-dropdown-menu">
      {normalized.map((option) => <button className={option.value === value ? "selected" : ""} key={option.value} onClick={() => onChange(option.value)} type="button">
        <span>{option.label}</span>
        {option.value === value && <em>✓</em>}
      </button>)}
    </div>
  </div></div>
}

function ToggleRow({ copy, label, onChange, value }: { copy: ContextRailCopy; label: string; onChange: (value: boolean) => void; value: boolean }) {
  return <div className="editable-row"><span>{label}</span><button className={`toggle-button ${value ? "on" : ""}`} onClick={() => onChange(!value)}>{value ? copy.on : copy.off}</button></div>
}

function NumberRow({ fallback, label, onCommit, value }: { fallback: number; label: string; onCommit: (value: number | undefined) => void; value?: number }) {
  const [draft, setDraft] = useState(String(value ?? fallback))
  useEffect(() => setDraft(String(value ?? fallback)), [fallback, value])
  return <label className="editable-row"><span>{label}</span><input value={draft} inputMode="numeric" onChange={(event) => setDraft(event.target.value)} onBlur={() => {
    const next = Number(draft)
    onCommit(Number.isFinite(next) && next > 0 ? Math.round(next) : undefined)
  }} /></label>
}

function aheadBehind(status: DesktopWorkspaceStatus | undefined) {
  if (!status) return undefined
  const parts = []
  if (status.ahead) parts.push(`ahead ${status.ahead}`)
  if (status.behind) parts.push(`behind ${status.behind}`)
  return parts.join(", ") || undefined
}
