import assert from "node:assert/strict"
import { mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { buildR2Prompt, executeR2 } from "../src/commands"

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

// buildR2Prompt includes target, workflow steps, and focus
const p = buildR2Prompt("/bin/ls", "look at crypto routines")
assert.ok(p.includes('"/bin/ls"'), "prompt embeds target path")
assert.ok(p.includes("open_file"), "prompt mentions open_file first")
assert.ok(p.includes("close_file"), "prompt closes the file")
assert.ok(p.includes("crypto routines"), "prompt carries focus")
assert.ok(!buildR2Prompt("/bin/ls", "").includes("Focus areas"), "no focus line when empty")

// /r2 with absolute path -> session.prompt with rewritten text, delivery preserved
calls.length = 0
await executeR2(
  { sessionID: "ses1", prompt: { text: `/r2 ${binary} check imports`, files: [] }, delivery: "queue" },
  session,
  dir,
)
assert.equal(calls.length, 1)
assert.equal(calls[0].kind, "prompt")
let sent = calls[0].args as Record<string, unknown>
assert.equal(sent.sessionID, "ses1")
assert.equal(sent.delivery, "queue")
assert.equal((sent.files as unknown[]).length, 0, "original files preserved")
assert.ok(String(sent.text).includes(binary), "prompt targets the binary")
assert.ok(String(sent.text).includes("check imports"), "focus notes forwarded")

// Relative path resolved against location directory
calls.length = 0
await executeR2({ sessionID: "ses2", prompt: { text: "sample" }, delivery: "steer" }, session, dir)
sent = calls[0].args as Record<string, unknown>
assert.ok(String(sent.text).includes(binary), "relative path resolved")

// Empty target -> usage synthetic, no prompt
calls.length = 0
await executeR2({ sessionID: "ses3", prompt: { text: "   " }, delivery: "steer" }, session, dir)
assert.equal(calls.length, 1)
assert.equal(calls[0].kind, "synthetic")
assert.ok(String((calls[0].args as { text: string }).text).includes("Usage: /r2"))

// Missing file -> error synthetic, no prompt
calls.length = 0
await executeR2({ sessionID: "ses4", prompt: { text: "/no/such/file" }, delivery: "steer" }, session, dir)
assert.equal(calls.length, 1)
assert.equal(calls[0].kind, "synthetic")
assert.ok(String((calls[0].args as { text: string }).text).includes("/no/such/file"))

console.log("all command tests passed")
