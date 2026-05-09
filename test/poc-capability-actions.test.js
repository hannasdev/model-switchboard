import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runCapabilityAction } from "../src/poc/capability_actions.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.join(__dirname, "..");

test("capability action read_file reads package metadata", () => {
  const result = runCapabilityAction({ toolAction: "read_file", repoRoot });
  assert.equal(result.status, "ok");
  assert.equal(result.action, "read_file");
  assert.equal(result.file, "package.json");
});

test("capability action safe_file_edit appends probe line", () => {
  const result = runCapabilityAction({ toolAction: "safe_file_edit", repoRoot });
  assert.equal(result.status, "ok");
  assert.equal(result.action, "safe_file_edit");

  const probePath = path.join(repoRoot, "src", "poc", "logs", "capability-probe.txt");
  const text = fs.readFileSync(probePath, "utf8");
  assert.match(text, /gateway safe_file_edit/);
});

test("capability action run_tests executes through command runner", () => {
  const result = runCapabilityAction({
    toolAction: "run_tests",
    repoRoot,
    runCommand: (command) => ({ ok: true, command, stdout: "ok", stderr: "", exitCode: 0 })
  });
  assert.equal(result.status, "ok");
  assert.equal(result.action, "run_tests");
  assert.equal(result.command, "npm test");
});
