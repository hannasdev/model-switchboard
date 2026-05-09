import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { routePrompt } from "./router.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROUTE_LOG_PATH = path.join(__dirname, "logs", "route-decisions.ndjson");

function readJson(relPath) {
  const p = path.join(__dirname, relPath);
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function getArg(flag) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1 || idx + 1 >= process.argv.length) return null;
  return process.argv[idx + 1];
}

function loadTargets(vendorKey) {
  if (vendorKey === "anthropic") return readJson("./data/targets.anthropic.json").targets;
  return readJson("./data/targets.openai.json").targets;
}

function printResult(result) {
  console.log(JSON.stringify(result, null, 2));
}

function appendRouteLog(entry) {
  fs.mkdirSync(path.dirname(ROUTE_LOG_PATH), { recursive: true });
  fs.appendFileSync(ROUTE_LOG_PATH, `${JSON.stringify(entry)}\n`, "utf8");
}

function runRoute() {
  const input = getArg("--input") || "Compare tradeoffs and propose a plan.";
  const vendor = getArg("--vendor") || "openai";
  const executionSupported = getArg("--execute") === "true";
  const targets = loadTargets(vendor);
  const result = routePrompt({
    input,
    targets,
    session: { mode: "plan", cost_posture: "balanced", currentTargetId: targets[1]?.id || null },
    executionSupported
  });
  appendRouteLog({
    ts: new Date().toISOString(),
    source: "route",
    vendor,
    input,
    session: { mode: "plan", cost_posture: "balanced", currentTargetId: targets[1]?.id || null },
    result
  });
  printResult(result);
}

function runFixtures() {
  const fixtures = readJson("./data/fixtures.json");
  const openaiTargets = loadTargets("openai");
  let passed = 0;
  let failed = 0;

  for (const fx of fixtures) {
    const targets =
      fx.targetOverride === "quick_only"
        ? openaiTargets.filter((t) => t.label === "quick")
        : openaiTargets;
    const result = routePrompt({
      input: fx.input,
      session: fx.session,
      targets,
      executionSupported: false
    });
    appendRouteLog({
      ts: new Date().toISOString(),
      source: "fixture",
      fixture: fx.name,
      vendor: "openai",
      input: fx.input,
      session: fx.session,
      result
    });

    const modeOk = result.mode === fx.expected.mode;
    const statusOk = fx.expected.status ? result.status === fx.expected.status : true;
    const labelOk = fx.expected.label
      ? result.selectedTarget && result.selectedTarget.label === fx.expected.label
      : true;
    const shouldSwitchOk =
      typeof fx.expected.shouldSwitch === "boolean"
        ? result.shouldSwitch === fx.expected.shouldSwitch
        : true;

    if (modeOk && statusOk && labelOk && shouldSwitchOk) {
      passed += 1;
      console.log(`PASS ${fx.name}`);
    } else {
      failed += 1;
      console.log(`FAIL ${fx.name}`);
      console.log(
        JSON.stringify(
          {
            expected: fx.expected,
            actual: {
              status: result.status,
              mode: result.mode,
              label: result.selectedTarget ? result.selectedTarget.label : null,
              shouldSwitch: result.shouldSwitch
            }
          },
          null,
          2
        )
      );
    }
  }

  console.log(JSON.stringify({ passed, failed, total: fixtures.length }, null, 2));
  if (failed > 0) process.exitCode = 1;
}

function runVendorMatrix() {
  printResult(readJson("./vendor_matrix.json"));
}

const cmd = process.argv[2];
if (cmd === "route") runRoute();
else if (cmd === "fixtures") runFixtures();
else if (cmd === "vendor-matrix") runVendorMatrix();
else {
  console.log("Usage:");
  console.log("  node src/poc/cli.js route --vendor openai --input \"Implement the plan.\"");
  console.log("  node src/poc/cli.js fixtures");
  console.log("  node src/poc/cli.js vendor-matrix");
  process.exitCode = 1;
}
