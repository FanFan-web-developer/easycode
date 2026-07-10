import { constants as fsConstants } from "node:fs"
import { access, readFile, readdir, stat } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

export const desktopReleaseTargets = {
  "darwin-arm64": {
    artifactNames(version) {
      return [
        `easycode-${version}-mac-arm64.dmg`,
        `easycode-${version}-mac-arm64.zip`,
      ]
    },
    resourcesDirectory: ["mac-arm64", "easycode.app", "Contents", "Resources"],
    sidecarName: "easycode-darwin-arm64",
  },
  "darwin-x64": {
    artifactNames(version) {
      return [
        `easycode-${version}-mac-x64.dmg`,
        `easycode-${version}-mac-x64.zip`,
      ]
    },
    resourcesDirectory: ["mac", "easycode.app", "Contents", "Resources"],
    sidecarName: "easycode-darwin-x64",
  },
  "linux-arm64": {
    artifactNames(version) {
      return [
        `easycode-${version}-linux-arm64.AppImage`,
        `easycode-${version}-linux-arm64.deb`,
      ]
    },
    resourcesDirectory: ["linux-arm64-unpacked", "resources"],
    sidecarName: "easycode-linux-arm64",
  },
  "linux-x64": {
    artifactNames(version) {
      return [
        `easycode-${version}-linux-x64.AppImage`,
        `easycode-${version}-linux-x64.deb`,
      ]
    },
    resourcesDirectory: ["linux-unpacked", "resources"],
    sidecarName: "easycode-linux-x64",
  },
  "win-x64": {
    artifactNames(version) {
      return [
        `easycode-${version}-win-x64.exe`,
        `easycode-${version}-win-x64.zip`,
      ]
    },
    resourcesDirectory: ["win-unpacked", "resources"],
    sidecarName: "easycode-win-x64.exe",
  },
}

export function normalizeDesktopReleaseVersion(value) {
  const version = String(value ?? "").replace(/^desktop-v/, "").replace(/^v/, "")
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error(`invalid desktop release version: ${value ?? ""}`)
  }
  return version
}

export function currentDesktopReleaseTarget(platform = process.platform, arch = process.arch) {
  const target = platform === "darwin"
    ? `darwin-${arch}`
    : platform === "win32"
      ? `win-${arch}`
      : platform === "linux"
        ? `linux-${arch}`
        : ""
  if (!(target in desktopReleaseTargets)) {
    throw new Error(`unsupported desktop release target: ${platform}-${arch}`)
  }
  return target
}

function releaseTarget(value) {
  if (!(value in desktopReleaseTargets)) {
    throw new Error(`unsupported desktop release target: ${value}`)
  }
  return desktopReleaseTargets[value]
}

async function requireNonEmptyFile(file, label) {
  let details
  try {
    details = await stat(file)
  } catch {
    throw new Error(`missing ${label}: ${file}`)
  }
  if (!details.isFile() || details.size === 0) {
    throw new Error(`${label} must be a non-empty file: ${file}`)
  }
  return details
}

export async function verifyDesktopRelease({
  packageJsonPath = path.join(repoRoot, "apps", "desktop", "package.json"),
  platform = process.env.EASYCODE_DESKTOP_RELEASE_TARGET || currentDesktopReleaseTarget(),
  releaseDir = path.join(repoRoot, "apps", "desktop", "release"),
  version: requestedVersion,
} = {}) {
  const manifest = JSON.parse(await readFile(packageJsonPath, "utf8"))
  const packageVersion = normalizeDesktopReleaseVersion(manifest.version)
  const version = requestedVersion
    ? normalizeDesktopReleaseVersion(requestedVersion)
    : packageVersion
  if (packageVersion !== version) {
    throw new Error(`desktop package version ${packageVersion} does not match expected release ${version}`)
  }

  const target = releaseTarget(platform)
  const artifactNames = target.artifactNames(version)
  const releaseEntries = new Set(await readdir(releaseDir))
  for (const artifactName of artifactNames) {
    if (!releaseEntries.has(artifactName)) {
      throw new Error(`missing ${platform} release artifact: ${path.join(releaseDir, artifactName)}`)
    }
    await requireNonEmptyFile(path.join(releaseDir, artifactName), "release artifact")
  }

  const sidecarPath = path.join(releaseDir, ...target.resourcesDirectory, "sidecar", target.sidecarName)
  const sidecar = await requireNonEmptyFile(sidecarPath, "packaged sidecar")
  const bundledSidecars = (await readdir(path.dirname(sidecarPath)))
    .filter((name) => name === "easycode" || name.startsWith("easycode-"))
  if (bundledSidecars.length !== 1 || bundledSidecars[0] !== target.sidecarName) {
    throw new Error(`unexpected packaged sidecars for ${platform}: ${bundledSidecars.join(", ") || "none"}`)
  }
  if (platform !== "win-x64" && process.platform !== "win32" && (sidecar.mode & 0o111) === 0) {
    throw new Error(`packaged sidecar is not executable: ${sidecarPath}`)
  }
  await access(sidecarPath, platform === "win-x64" || process.platform === "win32" ? fsConstants.F_OK : fsConstants.X_OK)

  return { artifactNames, platform, sidecarPath, version }
}

export function parseDesktopReleaseVerifyArgs(args) {
  const options = {}
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    const [name, inlineValue] = arg.split("=", 2)
    const value = inlineValue ?? args[++index]
    if (!value) throw new Error(`missing value for ${name}`)
    if (name === "--version") options.version = value
    else if (name === "--platform") options.platform = value
    else if (name === "--release-dir") options.releaseDir = path.resolve(value)
    else if (name === "--package-json") options.packageJsonPath = path.resolve(value)
    else throw new Error(`unknown argument: ${name}`)
  }
  return options
}

async function main() {
  const result = await verifyDesktopRelease(parseDesktopReleaseVerifyArgs(process.argv.slice(2)))
  console.log(`Verified desktop release ${result.version} for ${result.platform}`)
  for (const artifactName of result.artifactNames) console.log(`- artifact: ${artifactName}`)
  console.log(`- sidecar: ${result.sidecarPath}`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`error: ${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
  })
}
