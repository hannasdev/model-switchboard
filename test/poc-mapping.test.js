import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateMappings } from "../src/poc/model_mappings.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function readJson(relPath) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, relPath), "utf8"));
}

test("openai mapping definitions are complete for all targets", () => {
  const targets = readJson("../src/router/data/targets.openai.json").targets;
  const check = validateMappings({ vendor: "openai-codex", targets });
  assert.equal(check.ok, true);
  assert.equal(check.errors.length, 0);
});

test("anthropic mapping definitions are complete for all targets", () => {
  const targets = readJson("../src/router/data/targets.anthropic.json").targets;
  const check = validateMappings({ vendor: "anthropic-claude", targets });
  assert.equal(check.ok, true);
  assert.equal(check.errors.length, 0);
});

test("gemini mapping definitions are complete for all targets", () => {
  const targets = readJson("../src/router/data/targets.gemini.json").targets;
  const check = validateMappings({ vendor: "google-gemini", targets });
  assert.equal(check.ok, true);
  assert.equal(check.errors.length, 0);
});
