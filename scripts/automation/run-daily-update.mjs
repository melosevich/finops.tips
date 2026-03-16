#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "../..");
const EVENTS_SUMMARY_PATH = path.join(REPO_ROOT, "scripts/events/.last-run-summary.json");
const TIPS_SUMMARY_PATH = path.join(REPO_ROOT, "scripts/tips/.last-run-summary.json");
const OUTPUT_SUMMARY_PATH = path.join(__dirname, ".last-run-summary.json");
const OUTPUT_MARKDOWN_PATH = path.join(__dirname, ".last-run-summary.md");

function ensureNumber(v) {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: REPO_ROOT,
      stdio: "inherit",
      shell: false,
      env: process.env,
      ...options,
    });

    child.on("close", (code) => {
      resolve({ code: code ?? 1 });
    });

    child.on("error", () => {
      resolve({ code: 1 });
    });
  });
}

async function runWithRetry({ label, command, args, attempts, backoffMs }) {
  let lastCode = 1;

  for (let i = 1; i <= attempts; i += 1) {
    console.log(`\\n== ${label}: attempt ${i}/${attempts} ==`);
    const result = await runCommand(command, args);
    lastCode = result.code;

    if (result.code === 0) {
      return { ok: true, attemptsUsed: i, exitCode: 0 };
    }

    if (i < attempts) {
      const waitMs = backoffMs * i;
      console.log(`${label} failed with exit code ${result.code}; retrying in ${waitMs}ms.`);
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }

  return { ok: false, attemptsUsed: attempts, exitCode: lastCode };
}

function toMdNumberLine(label, value) {
  return `- ${label}: ${ensureNumber(value)}`;
}

function writeOutputs(summary) {
  fs.writeFileSync(OUTPUT_SUMMARY_PATH, `${JSON.stringify(summary, null, 2)}\\n`, "utf-8");

  const md = [
    "## Daily Content Automation Summary",
    "",
    `- generated_at: ${summary.generatedAt}`,
    `- run_date_copenhagen: ${summary.runDateCopenhagen}`,
    `- overall_success: ${summary.overallSuccess}`,
    `- retry_policy: attempts=${summary.retryPolicy.attempts}, backoff_ms=${summary.retryPolicy.backoffMs}`,
    "",
    "### Events",
    `- success: ${summary.events.success}`,
    `- attempts_used: ${summary.events.attemptsUsed}`,
    toMdNumberLine("candidate_count", summary.events.metrics.candidateCount),
    toMdNumberLine("valid_count", summary.events.metrics.validCount),
    toMdNumberLine("rejected_count", summary.events.metrics.rejectedCount),
    toMdNumberLine("duplicate_count", summary.events.metrics.duplicateCount),
    toMdNumberLine("writes_created", summary.events.metrics.writesCreated),
    toMdNumberLine("writes_updated", summary.events.metrics.writesUpdated),
    toMdNumberLine("writes_unchanged", summary.events.metrics.writesUnchanged),
    "",
    "### Tips",
    `- success: ${summary.tips.success}`,
    `- attempts_used: ${summary.tips.attemptsUsed}`,
    toMdNumberLine("generated_count", summary.tips.metrics.generatedCount),
    toMdNumberLine("rejected_count", summary.tips.metrics.rejectedCount),
    toMdNumberLine("duplicate_count", summary.tips.metrics.duplicateCount),
    toMdNumberLine("writes_created", summary.tips.metrics.writesCreated),
    toMdNumberLine("writes_updated", summary.tips.metrics.writesUpdated),
    toMdNumberLine("writes_unchanged", summary.tips.metrics.writesUnchanged),
    "",
  ].join("\\n");

  fs.writeFileSync(OUTPUT_MARKDOWN_PATH, `${md}\\n`, "utf-8");
}

function copenhagenDateStamp(now = new Date()) {
  const dateString = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Copenhagen",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return dateString;
}

async function main() {
  const attempts = Number.parseInt(process.env.DAILY_UPDATE_RETRY_ATTEMPTS || "2", 10);
  const backoffMs = Number.parseInt(process.env.DAILY_UPDATE_RETRY_BACKOFF_MS || "10000", 10);

  const eventsRun = await runWithRetry({
    label: "events:update",
    command: "npm",
    args: ["run", "events:update"],
    attempts,
    backoffMs,
  });

  const tipsRun = await runWithRetry({
    label: "tips:update",
    command: "npm",
    args: ["run", "tips:update"],
    attempts,
    backoffMs,
  });

  const eventsSummary = readJsonIfExists(EVENTS_SUMMARY_PATH) || {};
  const tipsSummary = readJsonIfExists(TIPS_SUMMARY_PATH) || {};

  const output = {
    generatedAt: new Date().toISOString(),
    runDateCopenhagen: copenhagenDateStamp(),
    retryPolicy: {
      attempts,
      backoffMs,
    },
    overallSuccess: Boolean(eventsRun.ok && tipsRun.ok),
    events: {
      success: eventsRun.ok,
      attemptsUsed: eventsRun.attemptsUsed,
      exitCode: eventsRun.exitCode,
      metrics: {
        candidateCount: ensureNumber(eventsSummary.candidateCount),
        validCount: ensureNumber(eventsSummary.validCount),
        rejectedCount: ensureNumber(eventsSummary.rejectedCount),
        duplicateCount: ensureNumber(eventsSummary.duplicateCount),
        writesCreated: ensureNumber(eventsSummary.writes?.created),
        writesUpdated: ensureNumber(eventsSummary.writes?.updated),
        writesUnchanged: ensureNumber(eventsSummary.writes?.unchanged),
      },
    },
    tips: {
      success: tipsRun.ok,
      attemptsUsed: tipsRun.attemptsUsed,
      exitCode: tipsRun.exitCode,
      metrics: {
        generatedCount: ensureNumber(tipsSummary.generatedCount),
        rejectedCount: ensureNumber(tipsSummary.rejectedCount),
        duplicateCount: ensureNumber(tipsSummary.duplicateCount),
        writesCreated: ensureNumber(tipsSummary.writes?.created),
        writesUpdated: ensureNumber(tipsSummary.writes?.updated),
        writesUnchanged: ensureNumber(tipsSummary.writes?.unchanged),
      },
    },
  };

  writeOutputs(output);

  console.log("\\nDaily update orchestration summary:");
  console.log(`- overall_success=${output.overallSuccess}`);
  console.log(`- run_date_copenhagen=${output.runDateCopenhagen}`);
  console.log(`- events_attempts_used=${output.events.attemptsUsed}`);
  console.log(`- tips_attempts_used=${output.tips.attemptsUsed}`);
  console.log(`- summary_json=${path.relative(REPO_ROOT, OUTPUT_SUMMARY_PATH)}`);
  console.log(`- summary_markdown=${path.relative(REPO_ROOT, OUTPUT_MARKDOWN_PATH)}`);

  if (!output.overallSuccess) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
