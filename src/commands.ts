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

export interface R2CommandSpec {
  /** Full command name, e.g. "r2:load". */
  name: string
  description: string
  /** Usage hint shown when required input is missing. */
  usage: string
  /** When true, the first token must resolve to an existing file. */
  needsFile: boolean
  /** Build the prompt injected into the session. target is absolute when needsFile. */
  build: (target: string | undefined, focus: string) => string
}

function reportPrompt(target: string, focus: string): string {
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

export const R2_COMMANDS: readonly R2CommandSpec[] = [
  {
    name: "r2:load",
    description: "Open a binary in r2mcp and show a quick overview: /r2:load <path>",
    usage: "Usage: /r2:load <path-to-binary>",
    needsFile: true,
    build: (target, focus) =>
      `Open the binary \`${target}\` with the r2mcp MCP tools. Call open_file with file_path "${target}" ` +
      "before any other r2mcp tool, then give a brief overview using show_info and list_entrypoints. " +
      "Do not run full analysis yet — wait for /r2:analyze." +
      (focus ? `\nUser notes: ${focus}` : ""),
  },
  {
    name: "r2:analyze",
    description: "Run radare2 analysis on the loaded file: /r2:analyze [level] [focus notes]",
    usage: "Usage: /r2:analyze [level 0-2] [focus notes]",
    needsFile: false,
    build: (_target, focus) => {
      let level = 2
      let notes = focus
      const first = focus.split(/\s+/)[0]
      if (/^[0-2]$/.test(first)) {
        level = Number(first)
        notes = focus.slice(first.length).trim()
      }
      return (
        `Run analysis on the file currently open in r2mcp (open_file was already called). ` +
        `Use the analyze tool with level ${level}, then summarize: number of functions found, ` +
        "entry points, and the most interesting imports and strings. " +
        "Leave the file open for follow-up commands." +
        (notes ? `\nFocus areas from the user: ${notes}` : "")
      )
    },
  },
  {
    name: "r2:report",
    description: "Full guided RE workflow on a binary: /r2:report <path> [focus notes]",
    usage: "Usage: /r2:report <path-to-binary> [focus notes]",
    needsFile: true,
    build: (target, focus) => reportPrompt(target as string, focus),
  },
  {
    name: "r2:close",
    description: "Close the currently open file in r2mcp",
    usage: "Usage: /r2:close",
    needsFile: false,
    build: () =>
      "Close the currently open file using the r2mcp close_file tool and confirm it was closed.",
  },
]

/**
 * Executor for a /r2:* subcommand. Submits the built prompt into the current
 * session; reports usage errors as synthetic messages. Relative file targets
 * resolve against the plugin location directory.
 */
export async function executeR2Command(
  spec: R2CommandSpec,
  input: R2CommandInput,
  session: R2Session,
  directory: string,
): Promise<void> {
  let raw = input.prompt.text.trim()
  // Be defensive: some clients submit the raw input including the command token.
  const token = `/${spec.name}`
  if (raw === token || raw.startsWith(`${token} `)) raw = raw.slice(token.length).trim()

  let target: string | undefined
  let focusTokens = raw.split(/\s+/).filter(Boolean)

  if (spec.needsFile) {
    const targetRaw = focusTokens[0]
    if (!targetRaw) {
      await session.synthetic({ sessionID: input.sessionID, text: spec.usage })
      return
    }
    focusTokens = focusTokens.slice(1)
    target = isAbsolute(targetRaw) ? targetRaw : resolve(directory, targetRaw)
    if (!existsSync(target)) {
      await session.synthetic({
        sessionID: input.sessionID,
        text: `\`${targetRaw}\` does not exist.\n${spec.usage}`,
      })
      return
    }
  }

  await session.prompt({
    ...input.prompt,
    sessionID: input.sessionID,
    text: spec.build(target, focusTokens.join(" ")),
    delivery: input.delivery,
  })
}
