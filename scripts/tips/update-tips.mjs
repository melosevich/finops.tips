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

function withinDays(date, now, days) {
  const delta = now.getTime() - date.getTime();
  return delta >= 0 && delta <= days * 24 * 3600 * 1000;
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

function main() {
  const now = new Date();
  const allPosts = listPosts();
  const generatedHistory = allPosts.filter((post) => post.generated && withinDays(post.pubDate, now, 60));

  const sourceUniverse = allPosts.filter((post) => {
    const section = SECTIONS.find((candidate) => post.tags.includes(candidate));
    if (!section) return false;
    if (!post.title || !post.description) return false;
    return true;
  });

  const recentSourceSlugsBySection = buildRecentSourceMap(generatedHistory);

  const { valid, rejected, duplicates } = generateSectionTips({
    now,
    sources: sourceUniverse,
    history: generatedHistory.map((post) => ({
      section: SECTIONS.find((candidate) => post.tags.includes(candidate)),
      title: post.title,
      description: post.description,
      body: post.body,
      slug: post.slug,
    })),
    recentSourceSlugsBySection,
  });

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
    sectionsExpected: SECTIONS.length,
    sectionsGenerated: valid.length,
    generatedCount: valid.length,
    rejectedCount: rejected.length,
    duplicateCount: duplicates.length,
    rejectedReasons: summarizeReasonCounts(rejected),
    duplicateReasons: summarizeReasonCounts(duplicates),
    writes,
    files: writtenFiles,
  };

  fs.writeFileSync(SUMMARY_PATH, `${JSON.stringify(summary, null, 2)}\n`, "utf-8");

  console.log("Tip generation summary:");
  console.log(`- sections_expected=${summary.sectionsExpected}`);
  console.log(`- sections_generated=${summary.sectionsGenerated}`);
  console.log(`- generated_count=${summary.generatedCount}`);
  console.log(`- rejected_count=${summary.rejectedCount}`);
  console.log(`- duplicate_count=${summary.duplicateCount}`);
  console.log(`- writes_created=${summary.writes.created}`);
  console.log(`- writes_updated=${summary.writes.updated}`);
  console.log(`- writes_unchanged=${summary.writes.unchanged}`);

  if (summary.sectionsGenerated !== summary.sectionsExpected) {
    console.error("Tip generation failed to produce one valid tip per section.");
    process.exitCode = 1;
  }
}

main();
