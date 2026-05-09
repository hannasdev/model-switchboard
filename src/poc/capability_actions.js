import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

function defaultRunCommand(command, cwd) {
  try {
    const stdout = execSync(command, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
      encoding: "utf8"
    });
    return { ok: true, command, stdout: stdout.trim(), stderr: "", exitCode: 0 };
  } catch (error) {
    return {
      ok: false,
      command,
      stdout: String(error?.stdout || "").trim(),
      stderr: String(error?.stderr || "").trim(),
      exitCode: Number.isInteger(error?.status) ? error.status : 1
    };
  }
}

export function runCapabilityAction({ toolAction, repoRoot, runCommand = defaultRunCommand }) {
  if (toolAction === "run_tests") {
    const cmdResult = runCommand("npm test", repoRoot);
    return {
      action: "run_tests",
      status: cmdResult.ok ? "ok" : "failed",
      command: cmdResult.command,
      exitCode: cmdResult.exitCode,
      stdoutPreview: (cmdResult.stdout || "").slice(0, 400),
      stderrPreview: (cmdResult.stderr || "").slice(0, 400)
    };
  }

  if (toolAction === "safe_file_edit") {
    const file = path.join(repoRoot, "src", "poc", "logs", "capability-probe.txt");
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const line = `[${new Date().toISOString()}] gateway safe_file_edit\n`;
    fs.appendFileSync(file, line, "utf8");
    return {
      action: "safe_file_edit",
      status: "ok",
      file: "src/poc/logs/capability-probe.txt",
      bytesAppended: Buffer.byteLength(line, "utf8")
    };
  }

  const targetPath = path.join(repoRoot, "package.json");
  const body = fs.readFileSync(targetPath, "utf8");
  return {
    action: "read_file",
    status: "ok",
    file: "package.json",
    bytes: Buffer.byteLength(body, "utf8"),
    preview: body.split(/\r?\n/).slice(0, 8).join("\n")
  };
}
