import assert from "node:assert/strict"
import plugin from "../src/index"

const registered: Array<[string, unknown]> = []
let transformCb: ((editor: any) => void) | undefined
let commandCb: ((editor: any) => void) | undefined
const commands: any[] = []

const ctx = {
  options: {} as Record<string, unknown>,
  location: { directory: "/tmp" },
  mcp: {
    async transform(cb: (editor: any) => void) {
      transformCb = cb
      return { dispose: async () => {} }
    },
    async reload() {},
    async list() { return [] },
  },
  command: {
    async transform(cb: (editor: any) => void) {
      commandCb = cb
      return { dispose: async () => {} }
    },
    async reload() {},
    async list() { return [] },
  },
  session: {},
}

await (plugin.setup as any)(ctx)

assert.ok(transformCb, "setup should register an mcp transform")
const editor = {
  get: (name: string) => undefined,
  set: (name: string, config: unknown) => registered.push([name, config]),
  update: (name: string, fn: (s: any) => void) => registered.push([name + ":update", null]),
}
transformCb!(editor)

assert.equal(registered.length, 1, "should set exactly one server")
assert.equal(registered[0][0], "r2mcp")
const cfg = registered[0][1] as { type: string; command: string[] }
assert.equal(cfg.type, "local")
assert.ok(cfg.command[0].endsWith("r2mcp"), "command should point at r2mcp binary")

// /r2 command registered with description and executor
assert.ok(commandCb, "setup should register a command transform")
commandCb!({ add: (def: any) => commands.push(def) })
assert.equal(commands.length, 1, "one command registered")
assert.equal(commands[0].name, "r2")
assert.ok(String(commands[0].description).includes("/r2"), "description documents usage")
assert.equal(typeof commands[0].execute, "function")

// binary missing -> no mcp transform, no commands
registered.length = 0
transformCb = undefined
commandCb = undefined
commands.length = 0
const ctx2 = { ...ctx, options: { binary: "/nonexistent/r2mcp" } }
await (plugin.setup as any)(ctx2)
assert.ok(!transformCb, "no transform when binary missing")
assert.ok(!commandCb, "no command transform when binary missing")

console.log("all plugin setup tests passed")
