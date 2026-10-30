import assert from "node:assert/strict"
import plugin from "../src/index"

const registered: Array<[string, unknown]> = []
let transformCb: ((editor: any) => void) | undefined

const ctx = {
  options: {} as Record<string, unknown>,
  mcp: {
    async transform(cb: (editor: any) => void) {
      transformCb = cb
      return { dispose: async () => {} }
    },
    async reload() {},
    async list() { return [] },
  },
}

const cleanup = await (plugin.setup as any)(ctx)

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

// binary missing -> no registration
registered.length = 0
transformCb = undefined
const ctx2 = { ...ctx, options: { binary: "/nonexistent/r2mcp" } }
await (plugin.setup as any)(ctx2)
assert.ok(!transformCb, "no transform when binary missing")

console.log("all plugin setup tests passed")
