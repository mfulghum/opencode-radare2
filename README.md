# opencode-radare2

OpenCode plugin that auto-configures the [radare2 MCP server (r2mcp)](https://github.com/radareorg/radare2-mcp) — install the plugin, get a fully wired reverse-engineering toolchain with zero manual MCP setup.

## What it does

On load, the plugin:

1. Detects the `r2mcp` binary (PATH, then `/usr/local/bin`, `/usr/bin`, `~/.local/bin`).
2. Registers it as a local MCP server named `r2mcp` via `ctx.mcp.transform`, exposing all radare2 tools (analysis, decompilation, xrefs, …).
3. If an `r2mcp` server is already configured (e.g. in your global config), it leaves the configuration alone and just ensures it is enabled.
4. Registers the `/r2:*` command namespace for guided binary analysis.

## Commands

| Command | Description |
| ------- | ----------- |
| `/r2:load <path>` | Open a binary and show a quick overview (format, arch, entrypoint, hardening). No analysis yet. |
| `/r2:analyze [level] [focus notes]` | Run analysis (default level 2) on the loaded file and summarize functions, entrypoints, imports, strings. |
| `/r2:report <path> [focus notes]` | Full guided RE workflow: open → analyze → triage → decompile entry points → structured report → close. |
| `/r2:close` | Close the currently open file. |

Relative paths resolve against the session directory; trailing free text is
passed to the model as focus guidance (e.g. `/r2:analyze 1 look at the crypto
routines`). Usage and file-not-found errors are reported in-session without
consuming a model turn.

If `r2mcp` is not installed, the plugin registers nothing — no MCP server and no commands.

## Install

Add the plugin to your `opencode.json(c)` (global or project):

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": ["opencode-radare2"] // or a local path: "/path/to/opencode-radare2"
}
```

Then run `/reload` in the TUI (or start a new session). The plugin registers `r2mcp` as a local MCP server automatically; you do not need a `mcp` config entry.

## Options

```jsonc
{
  "plugins": [
    {
      "package": "opencode-radare2",
      "options": { "binary": "/opt/r2/bin/r2mcp" }
    }
  ]
}
```

| Option   | Description                                          |
| -------- | ---------------------------------------------------- |
| `binary` | Explicit path to the `r2mcp` executable              |

The `R2MCP_BIN` environment variable is honored as an override as well.

## Requirements

- OpenCode V2
- [radare2](https://github.com/radareorg/radare2) and [r2mcp](https://github.com/radareorg/radare2-mcp) installed

## License

MIT

## Development

```sh
npm install
npm test
```

Note: the plugin entry point must live at the package root (`index.ts`), which
re-exports the implementation from `src/`. OpenCode v2.1.4 does not load local
directory plugins whose `package.json` `exports` map points into a
subdirectory (e.g. `./src/index.ts` as shown in the official plugin guide) —
it silently skips them. Keep the root shim.
