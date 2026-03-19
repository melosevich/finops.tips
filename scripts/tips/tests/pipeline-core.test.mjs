import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  SECTIONS,
  detectNearDuplicate,
  generateSectionTips,
  makeTipFileName,
  qualityGate,
} from "../pipeline-core.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FIXTURES_DIR = path.join(__dirname, "..", "fixtures");

function loadJson(file) {
  return JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, file), "utf-8"));
}

test("generates one valid tip per section", () => {
  const fixture = loadJson("generation-cases.json");

  const { valid, rejected, duplicates } = generateSectionTips({
    now: new Date(fixture.now),
    sources: fixture.sources,
    history: [],
  });

  assert.equal(valid.length, SECTIONS.length);
  assert.equal(rejected.length, 0);
  assert.equal(duplicates.length, 0);

  for (const tip of valid) {
    const gate = qualityGate(tip);
    assert.equal(gate.valid, true, tip.section);
    assert.match(makeTipFileName(tip), /^\d{4}-\d{2}-\d{2}-[a-z]+-daily-tip-/);
  }
});

test("blocks near-duplicate tips", () => {
  const current = {
    section: "metrics",
    title: "Metric to watch: Unit Cost",
    description: "Track unit cost and alert when it increases.",
    body: "1. Track spend per transaction. 2. Alert when cost rises 15%.",
  };

  const history = [
    {
      section: "metrics",
      slug: "2026-03-14-metrics-daily-tip-unit-cost",
      title: "Metric to watch: Unit Cost",
      description: "Track unit cost and alert when it increases.",
      body: "1. Track spend per transaction. 2. Alert when cost rises 15%.",
    },
  ];

  const result = detectNearDuplicate(current, history, 0.7);
  assert.equal(result.duplicate, true);
  assert.ok(result.score >= 0.7);
});

test("does not duplicate directive verbs in generated title focus", () => {
  const { valid } = generateSectionTips({
    now: new Date("2026-03-19T00:00:00Z"),
    sources: [
      {
        title: "Understand GetObject S3 request path",
        url: "https://example.com/getobject",
        slug: "getobject-source",
        pubDate: "2026-03-10",
        tags: ["operations"],
        body: "GetObject request analysis",
      },
      {
        title: "Optimize EC2 commitments",
        url: "https://example.com/ec2",
        slug: "ec2-source",
        pubDate: "2026-03-10",
        tags: ["services"],
        body: "EC2 commitments",
      },
      {
        title: "Track unit cost by product",
        url: "https://example.com/unit-cost",
        slug: "unit-cost-source",
        pubDate: "2026-03-10",
        tags: ["metrics"],
        body: "Unit cost trend",
      },
    ],
    history: [],
  });
  const operationsTip = valid.find((tip) => tip.section === "operations");
  assert.ok(operationsTip);

  const firstTwoWords = operationsTip.title
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.toLowerCase());
  assert.equal(firstTwoWords.length, 2);
  assert.notEqual(firstTwoWords[0], firstTwoWords[1]);
});

test("fallback-generated titles use concrete focus terms", () => {
  const { valid } = generateSectionTips({
    now: new Date("2026-03-19T00:00:00Z"),
    sources: [],
    history: [],
  });

  assert.equal(valid.length, SECTIONS.length);
  for (const tip of valid) {
    assert.ok(!/finops foundation/i.test(tip.title), tip.title);
    assert.ok(!/finops foundation/i.test(tip.description), tip.description);
  }
});

test("section bodies vary strategy across days", () => {
  const baseSources = [
    {
      title: "API retry volume",
      url: "https://example.com/ops",
      slug: "ops-source",
      pubDate: "2026-03-10",
      tags: ["operations"],
      body: "operations source",
    },
    {
      title: "Savings plan utilization",
      url: "https://example.com/services",
      slug: "services-source",
      pubDate: "2026-03-10",
      tags: ["services"],
      body: "services source",
    },
    {
      title: "Waste-rate trend",
      url: "https://example.com/metrics",
      slug: "metrics-source",
      pubDate: "2026-03-10",
      tags: ["metrics"],
      body: "metrics source",
    },
  ];

  const signatures = new Set();
  for (const date of ["2026-03-16", "2026-03-17", "2026-03-18", "2026-03-19"]) {
    const { valid } = generateSectionTips({
      now: new Date(`${date}T00:00:00Z`),
      sources: baseSources,
      history: [],
    });
    const operationsTip = valid.find((tip) => tip.section === "operations");
    assert.ok(operationsTip);
    const howToBlock = operationsTip.body.match(/## How to Act\n([\s\S]*?)\n\n## Example/);
    assert.ok(howToBlock);
    signatures.add(howToBlock[1].trim());
  }

  assert.ok(signatures.size > 1);
});
