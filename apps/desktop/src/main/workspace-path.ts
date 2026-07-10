import path from "node:path"
import { existsSync, type Dirent } from "node:fs"
import { readdir, stat } from "node:fs/promises"

export function workspacePathInfo(workspaceRoot: string, filePath: string) {
  const resolvedRoot = path.resolve(workspaceRoot)
  const resolvedPath = path.resolve(filePath)
  const relativePath = path.relative(resolvedRoot, resolvedPath)
  const insideWorkspace = Boolean(relativePath) && !relativePath.startsWith("..") && !path.isAbsolute(relativePath)
  return {
    insideWorkspace,
    ...(insideWorkspace ? { relativePath } : {}),
  }
}

export function resolveWorkspaceRelativePath(workspaceRoot: string, requestedPath: string) {
  const cleanPath = requestedPath.trim().replace(/^["']|["']$/g, "")
  if (!cleanPath || path.isAbsolute(cleanPath) || cleanPath.includes("\0") || cleanPath.split(/[\\/]/).some((part) => part === "..")) {
    throw new Error("File must be a relative path inside the workspace.")
  }
  const root = path.resolve(workspaceRoot)
  const absolutePath = path.resolve(root, cleanPath)
  const relativePath = path.relative(root, absolutePath)
  if (!relativePath || relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error("File must be a relative path inside the workspace.")
  }
  return { root, absolutePath, relativePath: relativePath.split(path.sep).join("/") }
}

export async function resolveWorkspaceFilePath(workspaceRoot: string, requestedPath: string) {
  const cleanPath = requestedPath.trim().replace(/^["']|["']$/g, "")
  if (!cleanPath || path.isAbsolute(cleanPath) || cleanPath.includes("\0") || cleanPath.split(/[\\/]/).some((part) => part === "..")) {
    throw new Error("File must be a relative path inside the workspace.")
  }

  const resolvedWorkspace = path.resolve(workspaceRoot)
  const roots = uniqueRoots([resolvedWorkspace, nearestGitRoot(resolvedWorkspace)])
  for (const root of roots) {
    const candidate = path.resolve(root, cleanPath)
    if (workspacePathInfo(root, candidate).insideWorkspace && await isFile(candidate)) return candidate
  }

  const suffixMatch = await findWorkspaceFileBySuffix(roots, cleanPath)
  if (suffixMatch) return suffixMatch
  throw new Error(`Workspace file not found: ${cleanPath}`)
}

function nearestGitRoot(start: string) {
  let current = path.resolve(start)
  while (true) {
    if (existsSync(path.join(current, ".git"))) return current
    const parent = path.dirname(current)
    if (parent === current) return undefined
    current = parent
  }
}

function uniqueRoots(roots: Array<string | undefined>) {
  const seen = new Set<string>()
  const result: string[] = []
  for (const root of roots) {
    if (!root) continue
    const resolved = path.resolve(root)
    if (seen.has(resolved)) continue
    seen.add(resolved)
    result.push(resolved)
  }
  return result
}

async function isFile(filePath: string) {
  try {
    return (await stat(filePath)).isFile()
  } catch {
    return false
  }
}

async function findWorkspaceFileBySuffix(roots: string[], requestedPath: string) {
  const normalizedRequest = normalizePathForMatch(requestedPath)
  const hasDirectory = normalizedRequest.includes("/")
  const matches: string[] = []

  for (const root of roots) {
    await collectMatchingFiles(root, root, normalizedRequest, hasDirectory, matches)
  }

  return matches.sort((left, right) => left.length - right.length || left.localeCompare(right))[0]
}

async function collectMatchingFiles(root: string, directory: string, requestedPath: string, hasDirectory: boolean, matches: string[], depth = 0) {
  if (depth > 8 || matches.length > 50) return
  let entries: Dirent[]
  try {
    entries = await readdir(directory, { withFileTypes: true })
  } catch {
    return
  }

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (ignoredSearchDirectory(entry.name)) continue
      await collectMatchingFiles(root, path.join(directory, entry.name), requestedPath, hasDirectory, matches, depth + 1)
      continue
    }
    if (!entry.isFile()) continue
    const absolutePath = path.join(directory, entry.name)
    const relativePath = normalizePathForMatch(path.relative(root, absolutePath))
    if (hasDirectory ? relativePath.endsWith(requestedPath) : entry.name === requestedPath) matches.push(absolutePath)
  }
}

function ignoredSearchDirectory(name: string) {
  return name === ".git" || name === "node_modules" || name === "dist" || name === "build" || name === ".turbo" || name === ".next"
}

function normalizePathForMatch(filePath: string) {
  return filePath.split(path.sep).join("/")
}
