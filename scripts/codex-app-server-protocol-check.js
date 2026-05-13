#!/usr/bin/env node
/* eslint-disable security/detect-non-literal-fs-filename */
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { setTimeout, clearTimeout } from "node:timers";
import { fileURLToPath } from "node:url";

const REQUIRED_METHODS = ["initialize", "thread/start", "turn/start", "thread/read"];
const REQUIRED_FILES = {
  ClientRequest: "ClientRequest.ts",
  InitializeCapabilities: "InitializeCapabilities.ts",
  ThreadStartParams: "ThreadStartParams.ts",
  TurnStartParams: "TurnStartParams.ts",
  ThreadReadParams: "ThreadReadParams.ts"
};

function getArg(args, flag) {
  const idx = args.lastIndexOf(flag);
  if (idx === -1 || idx + 1 >= args.length) return null;
  return args[idx + 1];
}

function fileExists(filePath) {
  try {
    return fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function readFile(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function findBindingFile(rootDir, filename) {
  const candidates = [path.join(rootDir, "v2", filename), path.join(rootDir, filename)];
  return candidates.find(fileExists) || path.join(rootDir, filename);
}

function ensureBindingRoot(rootDir) {
  if (!fileExists(findBindingFile(rootDir, REQUIRED_FILES.ClientRequest))) {
    throw new Error(`Could not find generated app-server TypeScript bindings in ${rootDir}`);
  }
}

function hasMethod(clientRequestSource, method) {
  return clientRequestSource.includes(`"method": "${method}"`);
}

function hasOptionalStringField(source, fieldName) {
  const compact = source.replace(/\s+/g, "");
  return compact.includes(`${fieldName}?:string|null`);
}

function hasBooleanField(source, fieldName) {
  const compact = source.replace(/\s+/g, "");
  return compact.includes(`${fieldName}:boolean`);
}

export function validateCodexAppServerProtocolShape(rootDir) {
  ensureBindingRoot(rootDir);
  const files = Object.fromEntries(
    Object.entries(REQUIRED_FILES).map(([key, filename]) => {
      const filePath = findBindingFile(rootDir, filename);
      if (!fileExists(filePath)) {
        return [key, { filePath, ok: false, reason: "missing" }];
      }
      return [key, { filePath, ok: true, source: readFile(filePath) }];
    })
  );

  const failures = [];
  for (const [key, file] of Object.entries(files)) {
    if (!file.ok) failures.push(`${key}: missing ${file.filePath}`);
  }

  const methods = Object.fromEntries(
    REQUIRED_METHODS.map((method) => {
      const ok = files.ClientRequest.ok && hasMethod(files.ClientRequest.source, method);
      if (!ok) failures.push(`ClientRequest: missing method ${method}`);
      return [method, ok];
    })
  );

  const fields = {
    "InitializeCapabilities.experimentalApi":
      files.InitializeCapabilities.ok && files.InitializeCapabilities.source.includes("experimentalApi: boolean"),
    "ThreadStartParams.model": files.ThreadStartParams.ok && hasOptionalStringField(files.ThreadStartParams.source, "model"),
    "TurnStartParams.threadId": files.TurnStartParams.ok && files.TurnStartParams.source.includes("threadId: string"),
    "TurnStartParams.input": files.TurnStartParams.ok && files.TurnStartParams.source.includes("input: Array<"),
    "TurnStartParams.model": files.TurnStartParams.ok && hasOptionalStringField(files.TurnStartParams.source, "model"),
    "ThreadReadParams.threadId": files.ThreadReadParams.ok && files.ThreadReadParams.source.includes("threadId: string"),
    "ThreadReadParams.includeTurns": files.ThreadReadParams.ok && hasBooleanField(files.ThreadReadParams.source, "includeTurns")
  };

  for (const [field, ok] of Object.entries(fields)) {
    if (!ok) failures.push(`missing field ${field}`);
  }

  return {
    status: failures.length === 0 ? "verified" : "failed",
    surface: "codex-app-server-protocol",
    bindingDir: rootDir,
    filePaths: Object.fromEntries(Object.entries(files).map(([key, file]) => [key, file.filePath])),
    methods,
    fields,
    failures
  };
}

function runCommand(command, args, { timeoutMs }) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env: { ...process.env, NO_COLOR: "1" },
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`${command} ${args.join(" ")} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("exit", (code, signal) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`${command} exited with code ${code ?? "null"} and signal ${signal ?? "null"}: ${stderr}`));
      }
    });
  });
}

export async function runCodexAppServerProtocolCheck({
  codexBin = "codex",
  bindingsDir = null,
  timeoutMs = 30000
} = {}) {
  const generatedDir = bindingsDir || fs.mkdtempSync(path.join(os.tmpdir(), "switchboard-codex-app-server-ts-"));
  const generated = !bindingsDir;
  const evidence = {};
  if (generated) {
    evidence.generateTs = await runCommand(codexBin, ["app-server", "generate-ts", "--out", generatedDir], { timeoutMs });
  }
  return {
    generated,
    ...validateCodexAppServerProtocolShape(generatedDir),
    evidence: {
      command: generated ? `${codexBin} app-server generate-ts --out ${generatedDir}` : null,
      generatedDir,
      stderrTail: evidence.generateTs?.stderr?.slice(-1600) || ""
    }
  };
}

async function main() {
  const args = process.argv.slice(2);
  const codexBin = getArg(args, "--codex-bin") || "codex";
  const bindingsDir = getArg(args, "--bindings-dir");
  const timeoutMs = Number(getArg(args, "--timeout-ms") || 30000);
  const result = await runCodexAppServerProtocolCheck({ codexBin, bindingsDir, timeoutMs });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exitCode = result.status === "verified" ? 0 : 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`codex-app-server-protocol-check failed: ${error.message}\n`);
    process.exitCode = 1;
  });
}
