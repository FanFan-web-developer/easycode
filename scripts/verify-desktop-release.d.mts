export type DesktopReleasePlatform = "darwin-arm64" | "darwin-x64" | "linux-arm64" | "linux-x64" | "win-x64"

export interface DesktopReleaseTarget {
  artifactNames(version: string): string[]
  resourcesDirectory: string[]
  sidecarName: string
}

export const desktopReleaseTargets: Record<DesktopReleasePlatform, DesktopReleaseTarget>

export interface DesktopReleaseVerifyOptions {
  packageJsonPath?: string
  platform?: DesktopReleasePlatform
  releaseDir?: string
  version?: string
}

export interface DesktopReleaseVerifyResult {
  artifactNames: string[]
  platform: DesktopReleasePlatform
  sidecarPath: string
  version: string
}

export function normalizeDesktopReleaseVersion(value: unknown): string
export function currentDesktopReleaseTarget(platform?: NodeJS.Platform, arch?: string): DesktopReleasePlatform
export function parseDesktopReleaseVerifyArgs(args: string[]): DesktopReleaseVerifyOptions
export function verifyDesktopRelease(options?: DesktopReleaseVerifyOptions): Promise<DesktopReleaseVerifyResult>
