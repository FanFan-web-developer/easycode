import path from "node:path"
import { easycodeDir, homeRelativePath } from "../../easycode-path"

export const repoMapGeneratorVersion = "1"
export const codeIndexGeneratorVersion = "10"
export const defaultMaxResults = 50
export const maxMaxResults = 200
export const defaultReadLineLimit = 200
export const ignoredDirs = new Set([".git", "node_modules", ".easycode", "dist", "build", "coverage"])
export const codeExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".py", ".go", ".rs", ".java", ".kt", ".kts", ".swift", ".c", ".h", ".cpp", ".cc", ".hpp", ".cs", ".php", ".rb"])

export function repoMapCacheFile(root: string) {
  return path.join(easycodeDir(root), "cache", "repo-map.json")
}

export function codeIndexCacheFile(root: string) {
  return path.join(easycodeDir(root), "cache", "code-index", "index.json")
}

export function repoMapCachePath(root: string) {
  return displayCachePath(root, repoMapCacheFile(root))
}

export function codeIndexCachePath(root: string) {
  return displayCachePath(root, codeIndexCacheFile(root))
}

function displayCachePath(root: string, cacheFile: string) {
  const resolvedRoot = path.resolve(root)
  if (cacheFile === resolvedRoot || cacheFile.startsWith(`${resolvedRoot}${path.sep}`)) {
    return path.relative(resolvedRoot, cacheFile).replaceAll(path.sep, "/")
  }
  return homeRelativePath(cacheFile)
}
