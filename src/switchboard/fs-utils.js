import fs from "node:fs";
import path from "node:path";

export function ensureFile(storePath) {
  fs.mkdirSync(path.dirname(storePath), { recursive: true });
  if (!fs.existsSync(storePath)) fs.writeFileSync(storePath, "{}\n", "utf8");
}

export function readStore(storePath) {
  ensureFile(storePath);
  return JSON.parse(fs.readFileSync(storePath, "utf8"));
}

export function writeStore(storePath, data) {
  ensureFile(storePath);
  fs.writeFileSync(storePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}
