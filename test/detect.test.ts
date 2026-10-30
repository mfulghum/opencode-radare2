import assert from "node:assert/strict"
import { mkdtempSync, writeFileSync, chmodSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { candidatePaths, detectR2mcp } from "../src/detect"

const dir = mkdtempSync(join(tmpdir(), "r2mcp-detect-"))
const fake = join(dir, "r2mcp")
writeFileSync(fake, "#!/bin/sh\n")
chmodSync(fake, 0o755)

// PATH discovery
const viaPath = detectR2mcp(undefined, { PATH: dir, HOME: dir })
assert.equal(viaPath, fake, "should find r2mcp on PATH")

// Explicit override wins when it exists
assert.equal(detectR2mcp(fake, { PATH: "", HOME: dir }), fake, "override should resolve")

// Override that does not exist returns undefined (no silent fallback)
assert.equal(detectR2mcp(join(dir, "nope"), { PATH: dir, HOME: dir }), undefined)

// Nothing available returns undefined (isolated: no PATH, no prefixes, no fake in HOME)
assert.equal(detectR2mcp(undefined, { PATH: "", HOME: dir }, []), undefined)

// R2MCP_BIN environment override
assert.equal(detectR2mcp(undefined, { PATH: "", HOME: dir, R2MCP_BIN: fake }, []), fake)
assert.equal(detectR2mcp(undefined, { PATH: "", HOME: dir, R2MCP_BIN: join(dir, "gone") }, []), undefined)

// Candidate order: PATH entries precede fixed prefixes, ~/.local/bin last
const cands = candidatePaths("r2mcp", { PATH: "/opt/bin", HOME: "/home/u" }, ["/usr/local/bin", "/usr/bin"])
assert.equal(cands[0], "/opt/bin/r2mcp")
assert.ok(cands.includes("/usr/local/bin/r2mcp"))
assert.equal(cands[cands.length - 1], "/home/u/.local/bin/r2mcp")

console.log("all detect() tests passed")
