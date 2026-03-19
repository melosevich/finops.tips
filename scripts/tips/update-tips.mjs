#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  SECTIONS,
  generateSectionTips,
  makeTipFileName,
  stableContentHash,
  toMarkdown,
} from "./pipeline-core.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.join(__dirname, "..", "..");
const POSTS_DIR = path.join(REPO_ROOT, "src", "content", "posts");
const SUMMARY_PATH = path.join(__dirname, ".last-run-summary.json");
const MS_PER_DAY = 24 * 3600 * 1000;

function normalizeSpace(input) {
  return String(input || "").replace(/\s+/g, " ").trim();
}

function parseFrontmatter(raw) {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return null;
  const [, frontmatterRaw, body] = match;

  const data = {};
  const lines = frontmatterRaw.split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (/^\s*#/.test(line) || /^\s*$/.test(line)) {
      i += 1;
      continue;
    }

    if (/^image:\s*$/.test(line)) {
      i += 1;
      const image = {};
      while (i < lines.length && /^\s{2}\w+:/.test(lines[i])) {
        const nested = lines[i].trim();
        const [key, ...valueParts] = nested.split(":");
        image[key] = normalizeSpace(valueParts.join(":")).replace(/^"|"$/g, "");
        i += 1;
      }
      data.image = image;
      continue;
    }

    if (/^tags:\s*$/.test(line)) {
      i += 1;
      const tags = [];
      while (i < lines.length && /^\s*-\s+/.test(lines[i])) {
        tags.push(lines[i].replace(/^\s*-\s+/, "").trim().replace(/^"|"$/g, ""));
        i += 1;
      }
      data.tags = tags;
      continue;
    }

    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (kv) {
      data[kv[1]] = normalizeSpace(kv[2]).replace(/^"|"$/g, "");
    }
    i += 1;
  }

  return { data, body: body.trim() };
}

function parsePost(fileName) {
  const fullPath = path.join(POSTS_DIR, fileName);
  const raw = fs.readFileSync(fullPath, "utf-8");
  const parsed = parseFrontmatter(raw);
  if (!parsed) return null;

  const slug = fileName.replace(/\.md$/, "");
  const pubDate = new Date(parsed.data.pubDate);
  if (Number.isNaN(pubDate.getTime())) return null;

  return {
    slug,
    title: normalizeSpace(parsed.data.title),
    description: normalizeSpace(parsed.data.description),
    pubDate,
    tags: Array.isArray(parsed.data.tags) ? parsed.data.tags : [],
    body: parsed.body,
    url: `https://finops.tips/archive/posts/${slug}`,
    generated: Array.isArray(parsed.data.tags) && parsed.data.tags.includes("daily-tip"),
  };
}

function listPosts() {
  return fs
    .readdirSync(POSTS_DIR)
    .filter((name) => name.endsWith(".md"))
    .map(parsePost)
    .filter(Boolean);
}

function removeLegacyEventDailyTips() {
  const files = fs
    .readdirSync(POSTS_DIR)
    .filter((name) => name.endsWith(".md"))
    .filter((name) => name.includes("-events-daily-tip-"));

  for (const file of files) {
    fs.unlinkSync(path.join(POSTS_DIR, file));
  }

  return files;
}

function removeLegacyStaticSectionTips() {
  const files = fs
    .readdirSync(POSTS_DIR)
    .filter((name) => name.endsWith(".md"))
    .filter((name) => /^(10[1-9]|20[1-9]|30[1-9])-[a-z0-9-]+\.md$/i.test(name));

  for (const file of files) {
    fs.unlinkSync(path.join(POSTS_DIR, file));
  }

  return files;
}

function withinDays(date, now, days) {
  const delta = now.getTime() - date.getTime();
  return delta >= 0 && delta <= days * MS_PER_DAY;
}

function buildRecentSourceMap(generatedHistory) {
  const recent = new Map();
  for (const section of SECTIONS) recent.set(section, new Set());

  for (const item of generatedHistory) {
    const section = SECTIONS.find((candidate) => item.tags.includes(candidate));
    if (!section) continue;
    const sourceMatch = item.body.match(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/);
    if (!sourceMatch) continue;
    const sourceSlug = sourceMatch[2].split("/").filter(Boolean).pop();
    if (sourceSlug) recent.get(section).add(sourceSlug);
  }

  return recent;
}

function writeIfChanged(filePath, content) {
  if (fs.existsSync(filePath)) {
    const existing = fs.readFileSync(filePath, "utf-8");
    if (stableContentHash(existing) === stableContentHash(content)) {
      return "unchanged";
    }
    fs.writeFileSync(filePath, content, "utf-8");
    return "updated";
  }
  fs.writeFileSync(filePath, content, "utf-8");
  return "created";
}

function summarizeReasonCounts(items, reasonKey = "reason") {
  const counts = {};
  for (const item of items) {
    const key = item[reasonKey] || "UNKNOWN";
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

function removeSupersededGeneratedTips(validTips) {
  const keepFileNames = new Set(validTips.map((tip) => makeTipFileName(tip)));
  const keepKeys = new Set(validTips.map((tip) => `${tip.pubDate}:${tip.section}`));

  const candidates = fs
    .readdirSync(POSTS_DIR)
    .filter((name) => name.endsWith(".md"))
    .filter((name) => /^\d{4}-\d{2}-\d{2}-(operations|services|metrics)-daily-tip-/.test(name));

  const removed = [];
  for (const fileName of candidates) {
    if (keepFileNames.has(fileName)) continue;
    const match = fileName.match(/^(\d{4}-\d{2}-\d{2})-(operations|services|metrics)-daily-tip-/);
    if (!match) continue;
    const key = `${match[1]}:${match[2]}`;
    if (!keepKeys.has(key)) continue;
    fs.unlinkSync(path.join(POSTS_DIR, fileName));
    removed.push(fileName);
  }

  return removed;
}

function parseArgs(argv) {
  const parsed = {
    days: 1,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--days" && argv[i + 1]) {
      parsed.days = Number.parseInt(argv[i + 1], 10);
      i += 1;
      continue;
    }
    if (arg.startsWith("--days=")) {
      parsed.days = Number.parseInt(arg.split("=")[1], 10);
      continue;
    }
  }

  if (!Number.isInteger(parsed.days) || parsed.days < 1 || parsed.days > 365) {
    throw new Error(`Invalid --days value: ${parsed.days}. Expected integer between 1 and 365.`);
  }

  return parsed;
}

function toIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date, delta) {
  return new Date(date.getTime() + delta * MS_PER_DAY);
}

function main() {
  const { days } = parseArgs(process.argv.slice(2));
  const now = new Date();
  const startOfToday = startOfDay(now);
  const earliestDate = addDays(startOfToday, -(days - 1));
  const removedLegacyEventTips = removeLegacyEventDailyTips();
  const allPosts = listPosts();
  const existingGeneratedHistory = allPosts
    .filter((post) => post.generated)
    .map((post) => ({
      section: SECTIONS.find((candidate) => post.tags.includes(candidate)),
      title: post.title,
      description: post.description,
      body: post.body,
      slug: post.slug,
      pubDate: toIsoDate(post.pubDate),
    }))
    .filter((post) => post.section);

  const sourceUniverse = allPosts.filter((post) => {
    const section = SECTIONS.find((candidate) => post.tags.includes(candidate));
    return Boolean(section && post.title && post.description && !post.generated);
  });

  const valid = [];
  const rejected = [];
  const duplicates = [];
  const generatedInRun = [];

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const runDay = addDays(startOfToday, -offset);
    const runDayIso = toIsoDate(runDay);

    const historyForRun = [...existingGeneratedHistory, ...generatedInRun].filter((item) => {
      if (!item.pubDate) return false;
      return item.pubDate < runDayIso && withinDays(new Date(item.pubDate), runDay, 60);
    });

    const recentSourceSlugsBySection = buildRecentSourceMap(
      historyForRun.map((item) => ({
        ...item,
        tags: [item.section],
      })),
    );

    const scopedSources = sourceUniverse.filter((post) => {
      const postIso = toIsoDate(post.pubDate);
      return postIso <= runDayIso;
    });

    const runResult = generateSectionTips({
      now: runDay,
      sources: scopedSources,
      history: historyForRun,
      recentSourceSlugsBySection,
      // Always materialize one tip per section/day; language variation handles repetition.
      duplicateThreshold: 1.01,
    });

    for (const tip of runResult.valid) {
      valid.push(tip);
      generatedInRun.push({
        section: tip.section,
        title: tip.title,
        description: tip.description,
        body: tip.body,
        slug: makeTipFileName(tip).replace(/\.md$/, ""),
        pubDate: tip.pubDate,
      });
    }

    rejected.push(...runResult.rejected);
    duplicates.push(...runResult.duplicates);
  }

  const removedSupersededTips = removeSupersededGeneratedTips(valid);
  const removedLegacyStaticTips = removeLegacyStaticSectionTips();

  const writes = {
    created: 0,
    updated: 0,
    unchanged: 0,
  };

  const writtenFiles = [];
  for (const tip of valid) {
    const fileName = makeTipFileName(tip);
    const target = path.join(POSTS_DIR, fileName);
    const markdown = toMarkdown(tip);
    const state = writeIfChanged(target, markdown);
    writes[state] += 1;
    writtenFiles.push({ fileName, state, section: tip.section });
  }

  const summary = {
    generatedAt: now.toISOString(),
    backfillDays: days,
    dateFrom: toIsoDate(earliestDate),
    dateTo: toIsoDate(startOfToday),
    sectionsExpected: SECTIONS.length * days,
    sectionsGenerated: valid.length,
    generatedCount: valid.length,
    rejectedCount: rejected.length,
    duplicateCount: duplicates.length,
    removedLegacyEventTips: removedLegacyEventTips.length,
    removedLegacyStaticTips: removedLegacyStaticTips.length,
    removedSupersededTips: removedSupersededTips.length,
    rejectedReasons: summarizeReasonCounts(rejected),
    duplicateReasons: summarizeReasonCounts(duplicates),
    writes,
    files: writtenFiles,
  };

  fs.writeFileSync(SUMMARY_PATH, `${JSON.stringify(summary, null, 2)}\n`, "utf-8");

  console.log("Tip generation summary:");
  console.log(`- backfill_days=${summary.backfillDays}`);
  console.log(`- date_from=${summary.dateFrom}`);
  console.log(`- date_to=${summary.dateTo}`);
  console.log(`- sections_expected=${summary.sectionsExpected}`);
  console.log(`- sections_generated=${summary.sectionsGenerated}`);
  console.log(`- generated_count=${summary.generatedCount}`);
  console.log(`- rejected_count=${summary.rejectedCount}`);
  console.log(`- duplicate_count=${summary.duplicateCount}`);
  console.log(`- removed_legacy_event_daily_tips=${summary.removedLegacyEventTips}`);
  console.log(`- removed_legacy_static_tips=${summary.removedLegacyStaticTips}`);
  console.log(`- removed_superseded_tips=${summary.removedSupersededTips}`);
  console.log(`- writes_created=${summary.writes.created}`);
  console.log(`- writes_updated=${summary.writes.updated}`);
  console.log(`- writes_unchanged=${summary.writes.unchanged}`);

  if (summary.sectionsGenerated !== summary.sectionsExpected) {
    console.error("Tip generation failed to produce one valid tip per section.");
    process.exitCode = 1;
  }
}

main();
