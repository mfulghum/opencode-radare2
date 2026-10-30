import { Plugin } from "@opencode/plugin"
import { detectR2mcp } from "./detect.ts"
import { executeR2 } from "./commands.ts"

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
      // r2mcp not installed; silently skip registration.
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

    const directory = ctx.location.directory
    await ctx.command.transform((editor) => {
      editor.add({
        name: "r2",
        description: "Analyze a binary with radare2: /r2 <path> [focus notes]",
        execute: async (input) => {
          await executeR2(input, ctx.session, directory)
        },
      })
    })
  },
})
