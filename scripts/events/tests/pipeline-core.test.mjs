import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { dedupeEvents, validateEvent } from "../pipeline-core.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FIXTURES_DIR = path.join(__dirname, "..", "fixtures");

function loadJson(file) {
  return JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, file), "utf-8"));
}

test("validation fixtures", () => {
  const fixtures = loadJson("validation-cases.json");
  const allowedSourceIds = [
    "finops-foundation",
    "finopsdk",
    "microsoft-events",
    "aws-summits",
    "gcp-events",
  ];

  for (const fixture of fixtures) {
    const result = validateEvent(fixture.input, { allowedSourceIds });
    assert.equal(result.valid, fixture.valid, fixture.name);
    if (!fixture.valid) {
      assert.equal(result.reason, fixture.reason, fixture.name);
    }
  }
});

test("dedupe fixtures", () => {
  const fixture = loadJson("dedupe-cases.json");
  const events = fixture.events.map((event) => ({
    ...event,
    startDate: new Date(event.startDate),
  }));

  const { events: deduped, duplicates } = dedupeEvents(events);

  assert.equal(deduped.length, fixture.expect.dedupedCount);
  assert.equal(duplicates.length, fixture.expect.duplicateCount);
});
