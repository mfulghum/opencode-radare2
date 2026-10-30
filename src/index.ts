import { Plugin } from "@opencode/plugin"
import { detectR2mcp } from "./detect.ts"

const SERVER_NAME = "r2mcp"

export default Plugin.define({
  id: "opencode-radare2",
  async setup(ctx) {
    // Allow an explicit binary path via plugin options:
    //   { "package": "opencode-radare2", "options": { "binary": "/path/to/r2mcp" } }
    const override =
      typeof ctx.options.binary === "string" && ctx.options.binary ? ctx.options.binary : undefined

    const binary = detectR2mcp(override)
    if (!binary) {
      console.warn(
        "[opencode-radare2] r2mcp binary not found; install radare2-mcp or set options.binary. " +
          "MCP server not registered.",
      )
      return
    }

    console.log(`[opencode-radare2] registering MCP server "${SERVER_NAME}" -> ${binary}`)

    await ctx.mcp.transform((editor) => {
      const existing = editor.get(SERVER_NAME)
      if (existing) {
        // Keep user configuration authoritative, but make sure it is enabled.
        editor.update(SERVER_NAME, (server) => {
          server.disabled = false
        })
        return
      }
      editor.set(SERVER_NAME, {
        type: "local",
        command: [binary],
      })
    })
  },
})
