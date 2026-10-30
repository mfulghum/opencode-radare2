import { existsSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"

export const DEFAULT_BINARY_NAME = "r2mcp"

export const DEFAULT_PREFIXES = ["/usr/local/bin", "/usr/bin"]

/**
 * Candidate locations checked for the r2mcp binary, in priority order:
 * PATH entries first, then well-known install prefixes, then ~/.local/bin.
 */
export function candidatePaths(
  name: string,
  env: NodeJS.ProcessEnv = process.env,
  prefixes: readonly string[] = DEFAULT_PREFIXES,
): string[] {
  const paths: string[] = []
  for (const dir of (env.PATH ?? "").split(":")) {
    if (dir) paths.push(join(dir, name))
  }
  for (const dir of prefixes) {
    paths.push(join(dir, name))
  }
  const home = env.HOME || homedir()
  paths.push(join(home, ".local/bin", name))
  return paths
}

/**
 * Resolve the r2mcp executable. Priority: explicit override argument,
 * R2MCP_BIN environment variable, then PATH and common install prefixes.
 * Returns undefined when the binary cannot be found.
 */
export function detectR2mcp(
  override?: string,
  env: NodeJS.ProcessEnv = process.env,
  prefixes: readonly string[] = DEFAULT_PREFIXES,
): string | undefined {
  const explicit = override || env.R2MCP_BIN
  if (explicit) {
    return existsSync(explicit) ? explicit : undefined
  }
  for (const candidate of candidatePaths(DEFAULT_BINARY_NAME, env, prefixes)) {
    if (existsSync(candidate)) return candidate
  }
  return undefined
}
