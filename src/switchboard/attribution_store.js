/**
 * Attribution Store (Milestone 4)
 *
 * Handles persistence of routing decision attribution records for
 * outcome tracking and policy evaluation.
 */

import fs from "node:fs";
import path from "node:path";
import { DEFAULT_SWITCHBOARD_STATE_DIR } from "./paths.js";

export const DEFAULT_ATTRIBUTIONS_PATH = path.join(DEFAULT_SWITCHBOARD_STATE_DIR, "attributions");

function readNdjson(filePath) {
  if (!fs.existsSync(filePath)) return [];
  return fs
    .readFileSync(filePath, "utf8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map(JSON.parse);
}

/**
 * Save an attribution record for a routing decision.
 * @param {object} params
 * @param {string} params.storePath - path to attributions directory
 * @param {string} params.sessionId - session ID
 * @param {object} params.attribution - attribution record with decisionId, confidence, etc.
 * @returns {object} - saved record
 */
export function saveAttribution({
  storePath = DEFAULT_ATTRIBUTIONS_PATH,
  sessionId,
  attribution
}) {
  if (!sessionId) {
    throw new Error("sessionId is required for attribution storage");
  }
  if (!attribution?.decisionId) {
    throw new Error("attribution.decisionId is required");
  }

  const sessionFilePath = path.join(storePath, `${sessionId}.ndjson`);
  const record = {
    ...attribution,
    savedAt: new Date().toISOString()
  };

  fs.mkdirSync(path.dirname(sessionFilePath), { recursive: true });
  fs.appendFileSync(sessionFilePath, `${JSON.stringify(record)}\n`, "utf8");

  return record;
}

/**
 * Load all attribution records for a session.
 * @param {object} params
 * @param {string} params.storePath - path to attributions directory
 * @param {string} params.sessionId - session ID
 * @returns {array} - array of attribution records
 */
export function loadSessionAttributions({
  storePath = DEFAULT_ATTRIBUTIONS_PATH,
  sessionId
}) {
  if (!sessionId) {
    throw new Error("sessionId is required");
  }

  const sessionFilePath = path.join(storePath, `${sessionId}.ndjson`);
  return readNdjson(sessionFilePath);
}

/**
 * Load attribution record by decision ID.
 * @param {object} params
 * @param {string} params.storePath - path to attributions directory
 * @param {string} params.sessionId - session ID
 * @param {string} params.decisionId - decision ID
 * @returns {object|null} - attribution record or null if not found
 */
export function loadAttributionByDecisionId({
  storePath = DEFAULT_ATTRIBUTIONS_PATH,
  sessionId,
  decisionId
}) {
  if (!sessionId || !decisionId) {
    throw new Error("sessionId and decisionId are required");
  }

  const records = loadSessionAttributions({ storePath, sessionId });
  return records.find((r) => r.decisionId === decisionId) || null;
}

/**
 * Update an attribution record with outcome feedback.
 * @param {object} params
 * @param {string} params.storePath - path to attributions directory
 * @param {string} params.sessionId - session ID
 * @param {string} params.decisionId - decision ID
 * @param {object} params.outcome - outcome object with errorSignal, successSignal, etc.
 * @returns {object} - updated record
 */
export function updateAttributionOutcome({
  storePath = DEFAULT_ATTRIBUTIONS_PATH,
  sessionId,
  decisionId,
  outcome
}) {
  if (!sessionId || !decisionId || !outcome) {
    throw new Error("sessionId, decisionId, and outcome are required");
  }

  const records = loadSessionAttributions({ storePath, sessionId });
  const index = records.findIndex((r) => r.decisionId === decisionId);

  if (index === -1) {
    throw new Error(`Attribution not found for decisionId ${decisionId}`);
  }

  records[index] = {
    ...records[index],
    outcome,
    updatedAt: new Date().toISOString()
  };

  const sessionFilePath = path.join(storePath, `${sessionId}.ndjson`);
  const ndjson = records.map((r) => JSON.stringify(r)).join("\n") + "\n";
  fs.writeFileSync(sessionFilePath, ndjson, "utf8");

  return records[index];
}

/**
 * Query attributions by outcome signal.
 * Useful for filtering decisions that failed vs succeeded.
 * @param {object} params
 * @param {string} params.storePath - path to attributions directory
 * @param {string} params.sessionId - session ID
 * @param {string} params.errorSignal - error signal to filter by (e.g., "tool_failure")
 * @returns {array} - matching attribution records
 */
export function queryAttributionsByErrorSignal({
  storePath = DEFAULT_ATTRIBUTIONS_PATH,
  sessionId,
  errorSignal
}) {
  if (!sessionId) {
    throw new Error("sessionId is required");
  }

  const records = loadSessionAttributions({ storePath, sessionId });
  if (!errorSignal) {
    return records;
  }

  return records.filter((r) => r.outcome?.errorSignal === errorSignal);
}

/**
 * Get decision statistics for a session.
 * @param {object} params
 * @param {string} params.storePath - path to attributions directory
 * @param {string} params.sessionId - session ID
 * @returns {object} - statistics
 */
export function getSessionAttributionStats({
  storePath = DEFAULT_ATTRIBUTIONS_PATH,
  sessionId
}) {
  if (!sessionId) {
    throw new Error("sessionId is required");
  }

  const records = loadSessionAttributions({ storePath, sessionId });

  const successCount = records.filter((r) => !r.outcome?.errorSignal).length;
  const failureCount = records.length - successCount;
  const avgConfidence = records.length > 0
    ? records.reduce((sum, r) => sum + (r.decisionConfidence || 0), 0) / records.length
    : 0;

  const failuresBySignal = {};
  records.forEach((r) => {
    const signal = r.outcome?.errorSignal || "success";
    failuresBySignal[signal] = (failuresBySignal[signal] || 0) + 1;
  });

  return {
    totalDecisions: records.length,
    successCount,
    failureCount,
    successRate: records.length > 0 ? successCount / records.length : 0,
    avgConfidence,
    failuresBySignal
  };
}
