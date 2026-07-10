import { afterEach, describe, expect, test } from "bun:test"
import { chmod, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import {
  desktopReleaseTargets,
  normalizeDesktopReleaseVersion,
  parseDesktopReleaseVerifyArgs,
  verifyDesktopRelease,
} from "../../scripts/verify-desktop-release.mjs"

const temporaryRoots: string[] = []

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { force: true, recursive: true })))
})

async function createReleaseLayout(platform: keyof typeof desktopReleaseTargets, version = "1.2.3") {
  const root = await mkdtemp(path.join(os.tmpdir(), "easycode-desktop-release-"))
  temporaryRoots.push(root)
  const releaseDir = path.join(root, "release")
  const packageJsonPath = path.join(root, "package.json")
  const target = desktopReleaseTargets[platform]
  const sidecarPath = path.join(releaseDir, ...target.resourcesDirectory, "sidecar", target.sidecarName)
  await mkdir(path.dirname(sidecarPath), { recursive: true })
  await writeFile(packageJsonPath, JSON.stringify({ version }))
  for (const artifactName of target.artifactNames(version)) {
    await writeFile(path.join(releaseDir, artifactName), "artifact")
  }
  await writeFile(sidecarPath, "sidecar")
  if (platform !== "win-x64") await chmod(sidecarPath, 0o755)
  return { packageJsonPath, releaseDir, sidecarPath }
}

describe("desktop release verification", () => {
  test("verifies required artifacts and packaged sidecars for every supported package host", async () => {
    for (const platform of Object.keys(desktopReleaseTargets) as Array<keyof typeof desktopReleaseTargets>) {
      const layout = await createReleaseLayout(platform)
      await expect(verifyDesktopRelease({ ...layout, platform })).resolves.toMatchObject({
        artifactNames: desktopReleaseTargets[platform].artifactNames("1.2.3"),
        platform,
        version: "1.2.3",
      })
    }
  })

  test("does not accept stale artifacts from another version", async () => {
    const layout = await createReleaseLayout("darwin-arm64", "1.2.2")
    await writeFile(layout.packageJsonPath, JSON.stringify({ version: "1.2.3" }))

    await expect(verifyDesktopRelease({ ...layout, platform: "darwin-arm64" })).rejects.toThrow(
      "missing darwin-arm64 release artifact",
    )
  })

  test("requires the platform sidecar inside the unpacked application", async () => {
    const layout = await createReleaseLayout("linux-x64")
    await rm(layout.sidecarPath)

    await expect(verifyDesktopRelease({ ...layout, platform: "linux-x64" })).rejects.toThrow("missing packaged sidecar")
  })

  test("rejects stale sidecar binaries copied from an earlier build", async () => {
    const layout = await createReleaseLayout("darwin-arm64")
    await writeFile(path.join(path.dirname(layout.sidecarPath), "easycode"), "stale sidecar")

    await expect(verifyDesktopRelease({ ...layout, platform: "darwin-arm64" })).rejects.toThrow(
      "unexpected packaged sidecars for darwin-arm64",
    )
  })

  test("normalizes release tags and parses explicit CI options", () => {
    expect(normalizeDesktopReleaseVersion("desktop-v1.2.3")).toBe("1.2.3")
    expect(normalizeDesktopReleaseVersion("v1.2.3")).toBe("1.2.3")
    expect(() => normalizeDesktopReleaseVersion("1.2")).toThrow("invalid desktop release version")
    expect(parseDesktopReleaseVerifyArgs([
      "--version=desktop-v1.2.3",
      "--platform",
      "linux-x64",
      "--release-dir",
      "./release",
    ])).toMatchObject({
      platform: "linux-x64",
      version: "desktop-v1.2.3",
      releaseDir: path.resolve("./release"),
    })
  })
})
