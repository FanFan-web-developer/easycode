import { describe, expect, test } from "bun:test"
import path from "node:path"

describe("desktop package scripts", () => {
  test("declares the desktop app name for Electron dev and packaged builds", async () => {
    const manifest = await Bun.file(path.join(import.meta.dir, "../../apps/desktop/package.json")).json() as {
      productName?: string
      build?: {
        artifactName?: string
        executableName?: string
        linux?: { executableName?: string, packageName?: string, target?: string[] }
        mac?: { extendInfo?: Record<string, string>, hardenedRuntime?: boolean, identity?: string, target?: string[] }
        productName?: string
        win?: { executableName?: string, target?: string[] }
      }
    }

    expect(manifest.productName).toBe("easycode")
    expect(manifest.build?.productName).toBe("easycode")
    expect(manifest.build?.executableName).toBe("easycode")
    expect(manifest.build?.artifactName).toBe("easycode-${version}-${os}-${arch}.${ext}")
    expect(manifest.build?.artifactName).not.toContain("${name}")
    expect(manifest.build?.win?.executableName).toBe("easycode")
    expect(manifest.build?.win?.target).toEqual(["nsis", "zip"])
    expect(manifest.build?.linux?.executableName).toBe("easycode")
    expect(manifest.build?.linux?.target).toEqual(["AppImage", "deb"])
    expect(manifest.build?.linux).not.toHaveProperty("packageName")
    expect(manifest.build?.mac?.identity).toBe("-")
    expect(manifest.build?.mac?.hardenedRuntime).toBe(false)
    expect(manifest.build?.mac?.target).toEqual(["dmg", "zip"])
    expect(manifest.build?.mac?.extendInfo?.CFBundleDisplayName).toBe("easycode")
    expect(manifest.build?.mac?.extendInfo?.CFBundleName).toBe("easycode")
  })

  test("cleans stale artifacts and verifies the packaged release before returning", async () => {
    const source = await Bun.file(path.join(import.meta.dir, "../../scripts/package-desktop.sh")).text()

    expect(source).toContain("cleaning previous sidecar binaries")
    expect(source).toContain("name.startsWith('easycode-')")
    expect(source).toContain('rmSync(process.argv[1], { recursive: true, force: true })')
    expect(source).toContain('"$DESKTOP_DIR/release"')
    expect(source).toContain("bun run desktop:verify-release")
    expect(source.indexOf("cleaning previous desktop artifacts")).toBeLessThan(source.indexOf("packaging desktop client"))
    expect(source.indexOf("packaging desktop client")).toBeLessThan(source.indexOf("verifying desktop release artifacts"))
  })

  test("electron script builds preload dependencies before launching Electron", async () => {
    const manifest = await Bun.file(path.join(import.meta.dir, "../../apps/desktop/package.json")).json() as {
      scripts?: Record<string, string>
    }

    expect(manifest.scripts?.electron).toBe("bun run build && node scripts/run-electron.mjs")
    expect(manifest.scripts?.dev).toContain("node scripts/run-electron.mjs")
    expect(manifest.scripts?.build).toContain("node scripts/bundle-preload.mjs")
  })

  test("uses native macOS icon generation before falling back to manual icns output", async () => {
    const source = await Bun.file(path.join(import.meta.dir, "../../apps/desktop/scripts/make-mac-icon.mjs")).text()

    expect(source).toContain('spawnSync("iconutil"')
    expect(source).toContain('"EasyCode.iconset"')
    expect(source).toContain('["icon_512x512@2x.png", 1024]')
    expect(source).toContain('fileHeader.write("icns"')
  })
})
