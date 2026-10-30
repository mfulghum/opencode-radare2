import assert from "node:assert/strict"
import { mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { R2_COMMANDS, executeR2Command } from "../src/commands"

const dir = mkdtempSync(join(tmpdir(), "r2-cmd-"))
const binary = join(dir, "sample")
writeFileSync(binary, "ELF")

const calls: Array<{ kind: string; args: unknown }> = []
const session = {
  async prompt(input: Record<string, unknown>) {
    calls.push({ kind: "prompt", args: input })
  },
  async synthetic(input: { sessionID: string; text: string }) {
    calls.push({ kind: "synthetic", args: input })
  },
}

const spec = (name: string) => {
  const found = R2_COMMANDS.find((c) => c.name === name)
  assert.ok(found, `command ${name} exists`)
  return found
}

// namespace shape
assert.deepEqual(
  R2_COMMANDS.map((c) => c.name),
  ["r2:load", "r2:analyze", "r2:report", "r2:close"],
)
for (const c of R2_COMMANDS) {
  assert.ok(c.name.startsWith("r2:"), "namespaced")
  assert.ok(c.description.includes(`/${c.name}`) || c.name === "r2:close", "description documents usage")
}

// r2:load with absolute path -> prompt with open_file, no full analysis
calls.length = 0
await executeR2Command(
  spec("r2:load"),
  { sessionID: "ses1", prompt: { text: `/r2:load ${binary}`, files: [] }, delivery: "queue" },
  session,
  dir,
)
assert.equal(calls.length, 1)
assert.equal(calls[0].kind, "prompt")
let sent = calls[0].args as Record<string, unknown>
assert.equal(sent.sessionID, "ses1")
assert.equal(sent.delivery, "queue")
assert.equal((sent.files as unknown[]).length, 0, "original files preserved")
assert.ok(String(sent.text).includes(`file_path "${binary}"`), "load prompt embeds absolute path")
assert.ok(String(sent.text).includes("open_file"), "load prompt uses open_file")
assert.ok(!String(sent.text).includes("close_file"), "load keeps file open")

// r2:load relative path resolved against location directory
calls.length = 0
await executeR2Command(
  spec("r2:load"),
  { sessionID: "ses2", prompt: { text: "sample" }, delivery: "steer" },
  session,
  dir,
)
sent = calls[0].args as Record<string, unknown>
assert.ok(String(sent.text).includes(binary), "relative path resolved")

// r2:load missing file -> error synthetic, no prompt
calls.length = 0
await executeR2Command(
  spec("r2:load"),
  { sessionID: "ses3", prompt: { text: "/no/such/file" }, delivery: "steer" },
  session,
  dir,
)
assert.equal(calls[0].kind, "synthetic")
assert.ok(String((calls[0].args as { text: string }).text).includes("/no/such/file"))

// r2:load empty -> usage synthetic
calls.length = 0
await executeR2Command(spec("r2:load"), { sessionID: "ses4", prompt: { text: "  " }, delivery: "steer" }, session, dir)
assert.equal(calls[0].kind, "synthetic")
assert.ok(String((calls[0].args as { text: string }).text).includes("Usage: /r2:load"))

// r2:analyze parses leading level, defaults to 2, leaves file open
calls.length = 0
await executeR2Command(
  spec("r2:analyze"),
  { sessionID: "ses5", prompt: { text: "/r2:analyze 1 crypto routines" }, delivery: "steer" },
  session,
  dir,
)
sent = calls[0].args as Record<string, unknown>
assert.ok(String(sent.text).includes("level 1"), "explicit level")
assert.ok(String(sent.text).includes("crypto routines"), "focus forwarded")
assert.ok(!String(sent.text).includes("1 crypto routines"), "level token stripped from focus")

calls.length = 0
await executeR2Command(spec("r2:analyze"), { sessionID: "ses6", prompt: { text: "" }, delivery: "steer" }, session, dir)
sent = calls[0].args as Record<string, unknown>
assert.ok(String(sent.text).includes("level 2"), "default level 2")
assert.ok(String(sent.text).includes("Leave the file open"), "analyze keeps file open")

// r2:report runs the full workflow (opens and closes)
calls.length = 0
await executeR2Command(
  spec("r2:report"),
  { sessionID: "ses7", prompt: { text: `${binary} packers?` }, delivery: "steer" },
  session,
  dir,
)
sent = calls[0].args as Record<string, unknown>
const report = String(sent.text)
assert.ok(report.includes("open_file") && report.includes("close_file"), "full workflow")
assert.ok(report.includes("packers?"), "focus forwarded")

// r2:close -> simple close prompt
calls.length = 0
await executeR2Command(spec("r2:close"), { sessionID: "ses8", prompt: { text: "" }, delivery: "steer" }, session, dir)
sent = calls[0].args as Record<string, unknown>
assert.ok(String(sent.text).includes("close_file"))

console.log("all command tests passed")
