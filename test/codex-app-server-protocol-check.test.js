import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { validateCodexAppServerProtocolShape } from "../scripts/codex-app-server-protocol-check.js";

function writeFixture(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "codex-app-server-protocol-check-test-"));
  const dir = path.join(root, "v2");
  fs.mkdirSync(dir);
  for (const [filename, source] of Object.entries(files)) {
    fs.writeFileSync(path.join(dir, filename), source, "utf8");
  }
  return root;
}

function validFixture() {
  return writeFixture({
    "ClientRequest.ts": `
      export type ClientRequest =
        { "method": "initialize", id: string, params: unknown } |
        { "method": "thread/start", id: string, params: ThreadStartParams } |
        { "method": "turn/start", id: string, params: TurnStartParams } |
        { "method": "thread/read", id: string, params: ThreadReadParams };
    `,
    "InitializeCapabilities.ts": "export type InitializeCapabilities = { experimentalApi: boolean };",
    "ThreadStartParams.ts": "export type ThreadStartParams = { model?: string | null };",
    "TurnStartParams.ts": `
      export type TurnStartParams = {
        threadId: string,
        input: Array<UserInput>,
        model?: string | null
      };
    `,
    "ThreadReadParams.ts": "export type ThreadReadParams = { threadId: string, includeTurns: boolean };"
  });
}

test("protocol check verifies the minimum app-server surface Switchboard depends on", () => {
  const result = validateCodexAppServerProtocolShape(validFixture());

  assert.equal(result.status, "verified");
  assert.deepEqual(result.failures, []);
  assert.equal(result.methods.initialize, true);
  assert.equal(result.methods["thread/start"], true);
  assert.equal(result.methods["turn/start"], true);
  assert.equal(result.methods["thread/read"], true);
  assert.equal(result.fields["InitializeCapabilities.experimentalApi"], true);
  assert.equal(result.fields["ThreadStartParams.model"], true);
  assert.equal(result.fields["TurnStartParams.threadId"], true);
  assert.equal(result.fields["TurnStartParams.input"], true);
  assert.equal(result.fields["TurnStartParams.model"], true);
  assert.equal(result.fields["ThreadReadParams.threadId"], true);
  assert.equal(result.fields["ThreadReadParams.includeTurns"], true);
});

test("protocol check fails clearly when a required model override field disappears", () => {
  const root = validFixture();
  fs.writeFileSync(
    path.join(root, "v2", "TurnStartParams.ts"),
    "export type TurnStartParams = { threadId: string, input: Array<UserInput> };",
    "utf8"
  );

  const result = validateCodexAppServerProtocolShape(root);

  assert.equal(result.status, "failed");
  assert.match(result.failures.join("\n"), /TurnStartParams\.model/);
});
