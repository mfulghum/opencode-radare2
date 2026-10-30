import { existsSync } from "node:fs"
import { isAbsolute, resolve } from "node:path"

export interface R2Session {
  prompt(input: Record<string, unknown>): Promise<unknown>
  synthetic(input: { sessionID: string; text: string }): Promise<unknown>
}

export interface R2CommandInput {
  sessionID: string
  prompt: { text: string; [key: string]: unknown }
  delivery: "steer" | "queue"
}

/**
 * Build the guided-analysis prompt sent into the session for /r2 <target> [focus].
 * `target` must already be resolved and known to exist.
 */
export function buildR2Prompt(target: string, focus: string): string {
  const focusLine = focus ? `\nFocus areas from the user: ${focus}\n` : ""
  return (
    `Analyze the binary \`${target}\` using the r2mcp MCP tools and produce a concise reverse-engineering report.` +
    focusLine +
    "\n" +
    "Workflow:\n" +
    `1. open_file with file_path "${target}" (call this before any other r2mcp tool).\n` +
    "2. analyze with level 2.\n" +
    "3. Gather overview data: show_info, list_entrypoints, list_functions, list_imports, list_strings.\n" +
    "4. Use xrefs_to and lookup_address to identify the most interesting functions.\n" +
    "5. Decompile entry0 and main (if present) with decompile_function.\n" +
    "6. close_file when done.\n\n" +
    "Report: file format/arch/bits, entry points, notable imports (network, crypto, file I/O, process), " +
    "interesting strings, key functions with decompilation highlights, and anything suspicious " +
    "(packers, anti-debug, obfuscation). Keep it structured and to the point."
  )
}

const USAGE = "Usage: /r2 <path-to-binary> [focus notes]"

/**
 * Executor for the /r2 command. Submits a guided analysis prompt into the
 * current session. Relative targets resolve against the plugin location.
 */
export async function executeR2(
  input: R2CommandInput,
  session: R2Session,
  directory: string,
): Promise<void> {
  let raw = input.prompt.text.trim()
  // Be defensive: some clients submit the raw input including the command token.
  if (raw === "/r2" || raw.startsWith("/r2 ")) raw = raw.slice(3).trim()
  if (!raw) {
    await session.synthetic({ sessionID: input.sessionID, text: USAGE })
    return
  }

  const [targetRaw, ...focusParts] = raw.split(/\s+/)
  const target = isAbsolute(targetRaw) ? targetRaw : resolve(directory, targetRaw)

  if (!existsSync(target)) {
    await session.synthetic({
      sessionID: input.sessionID,
      text: `\`${targetRaw}\` does not exist.\n${USAGE}`,
    })
    return
  }

  await session.prompt({
    ...input.prompt,
    sessionID: input.sessionID,
    text: buildR2Prompt(target, focusParts.join(" ")),
    delivery: input.delivery,
  })
}
