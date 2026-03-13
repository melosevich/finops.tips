#!/usr/bin/env node

/*
Events ETL for finops.tips

Goal:
- Crawl approved sources, follow each candidate event link, and extract:
  - title, description, startDate, location (venue/city/country OR Online + timezone), url
- Hard discard if missing date OR missing location.
- Write one markdown post per event under src/content/posts/.

Notes:
- Many event listing pages are JS-driven. This script implements a robust baseline:
  - Extract candidate links from list pages
  - Visit each candidate and parse JSON-LD Event blocks first
  - Fall back to og:title/description and simple regexes

This is intentionally strict: when in doubt, discard.
*/

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";

import * as cheerio from "cheerio";

let chromium;
try {
  // Optional: enables JS-rendered pages extraction
  ({ chromium } = await import("playwright"));
} catch {
  chromium = null;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REPO_ROOT = path.resolve(__dirname, "../..");
const SOURCES_PATH = path.join(REPO_ROOT, "scripts/events/sources.json");
const POSTS_DIR = path.join(REPO_ROOT, "src/content/posts");

const EURO_COUNTRIES = new Set([
  // EU
  "Austria","Belgium","Bulgaria","Croatia","Cyprus","Czech Republic","Denmark","Estonia","Finland","France",
  "Germany","Greece","Hungary","Ireland","Italy","Latvia","Lithuania","Luxembourg","Malta","Netherlands",
  "Poland","Portugal","Romania","Slovakia","Slovenia","Spain","Sweden",
  // plus
  "United Kingdom","UK","England","Scotland","Wales","Northern Ireland",
  "Switzerland","Norway",
]);

function slugify(input) {
  return input
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function sha1(input) {
  return crypto.createHash("sha1").update(input).digest("hex").slice(0, 10);
}

async function fetchText(url) {
  const res = await fetch(url, {
    redirect: "follow",
    headers: {
      "user-agent": "finops.tips-events-bot/1.0 (+https://finops.tips)",
      accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return await res.text();
}

async function fetchRenderedHtml(url) {
  if (!chromium) return null;
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch {
    // Playwright installed but browsers not downloaded (npx playwright install)
    return null;
  }
  const page = await browser.newPage();
  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
    const html = await page.content();
    return html;
  } catch {
    return null;
  } finally {
    await page.close();
    await browser.close();
  }
}

function extractJsonLdEvents(html) {
  const $ = cheerio.load(html);
  const scripts = $("script[type='application/ld+json']").toArray();
  const events = [];
  for (const s of scripts) {
    const raw = $(s).text().trim();
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      const nodes = Array.isArray(parsed) ? parsed : [parsed];
      for (const node of nodes) {
        // handle graph
        if (node && node["@graph"]) {
          for (const g of node["@graph"]) nodes.push(g);
          continue;
        }
        const type = node?.["@type"];
        if (!type) continue;
        const types = Array.isArray(type) ? type : [type];
        if (types.includes("Event")) events.push(node);
      }
    } catch {
      // ignore invalid json
    }
  }
  return events;
}

function parseLocation(loc) {
  // Returns { venue, city, country, online, timezone, raw }
  if (!loc) return null;

  // JSON-LD can be string or object
  if (typeof loc === "string") {
    const raw = loc.trim();
    if (!raw) return null;
    if (/online/i.test(raw)) return { online: true, raw };
    // best-effort split
    const parts = raw.split(",").map((x) => x.trim()).filter(Boolean);
    const country = parts.at(-1);
    const city = parts.length >= 2 ? parts.at(-2) : undefined;
    const venue = parts.length >= 3 ? parts.slice(0, -2).join(", ") : undefined;
    return { venue, city, country, online: false, raw };
  }

  const name = loc?.name;
  const addr = loc?.address;
  const raw = JSON.stringify(loc);

  // Online can appear as VirtualLocation in schema.org; handle loosely.
  if (loc?.["@type"] === "VirtualLocation" || /VirtualLocation/i.test(raw)) {
    return { online: true, raw };
  }

  let venue = typeof name === "string" ? name : undefined;
  let city;
  let country;

  if (typeof addr === "string") {
    const parts = addr.split(",").map((x) => x.trim()).filter(Boolean);
    country = parts.at(-1);
    city = parts.length >= 2 ? parts.at(-2) : undefined;
    if (!venue && parts.length >= 3) venue = parts.slice(0, -2).join(", ");
  } else if (addr && typeof addr === "object") {
    city = addr.addressLocality || addr.addressRegion;
    country = addr.addressCountry;
    // venue may be in streetAddress
    if (!venue && addr.streetAddress) venue = addr.streetAddress;
  }

  return { venue, city, country, online: false, raw };
}

function isEuropeLocation(loc) {
  if (!loc) return false;
  if (loc.online) return true; // further check should rely on timezone presence
  const c = (loc.country || "").trim();
  if (!c) return false;
  if (EURO_COUNTRIES.has(c)) return true;
  // tolerate ISO codes
  const iso = c.toUpperCase();
  if (["DE","DK","SE","NO","CH","UK","GB","FR","ES","NL","BE","PL","IT","IE","PT","FI","AT"].includes(iso)) return true;
  return false;
}

function extractOg($) {
  const og = (p) => $("meta[property='" + p + "']").attr("content") || "";
  return {
    title: og("og:title") || $("title").text().trim(),
    description: og("og:description") || $("meta[name='description']").attr("content") || "",
    image: og("og:image"),
  };
}

function extractFallbackDateAndLocation(html) {
  // Strict but simple fallback parsing from rendered HTML text.
  const text = cheerio.load(html).text().replace(/\s+/g, " ").trim();

  // Date patterns like: March 12, 2026 / Mar 12, 2026 / 2026-03-12
  const datePatterns = [
    /\b(20\d{2})-(\d{2})-(\d{2})\b/,
    /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\s+(\d{1,2}),\s*(20\d{2})\b/i,
  ];

  let date = null;
  for (const re of datePatterns) {
    const m = text.match(re);
    if (!m) continue;
    if (re.source.startsWith('\\b(20')) {
      date = new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00Z`);
    } else {
      date = new Date(`${m[0]}`);
    }
    if (!Number.isNaN(date.getTime())) break;
    date = null;
  }

  // Location patterns like "Berlin, Germany" or "Copenhagen, Denmark" or "Online"
  let location = null;
  const online = /\bonline\b/i.test(text);
  if (online) {
    const tzMatch = html.match(/\b(CET|CEST|BST|EET|WET|UTC\+\d{1,2})\b/);
    const timezone = tzMatch ? tzMatch[1] : undefined;
    location = { online: true, timezone, raw: "Online" };
  } else {
    const locMatch = text.match(/\b([A-Z][a-zA-Z\- ]{2,}),\s*(Austria|Belgium|Bulgaria|Croatia|Cyprus|Czech Republic|Denmark|Estonia|Finland|France|Germany|Greece|Hungary|Ireland|Italy|Latvia|Lithuania|Luxembourg|Malta|Netherlands|Poland|Portugal|Romania|Slovakia|Slovenia|Spain|Sweden|United Kingdom|Switzerland|Norway)\b/);
    if (locMatch) {
      location = { online: false, city: locMatch[1].trim(), country: locMatch[2].trim(), raw: locMatch[0] };
    }
  }

  return { date, location };
}

function normalizeEvent({ source, url, jsonld, html }) {
  const $ = cheerio.load(html);
  const og = extractOg($);

  const title = (jsonld?.name || og.title || "").trim();
  const description = (jsonld?.description || og.description || "").replace(/\s+/g, " ").trim();

  let startDate = jsonld?.startDate ? new Date(jsonld.startDate) : null;
  let loc = parseLocation(jsonld?.location);

  // timezone: prefer page text
  let timezone;
  const tzMatch = html.match(/\b(CET|CEST|BST|EET|WET|UTC\+\d{1,2})\b/);
  if (tzMatch) timezone = tzMatch[1];

  // Fallback extraction if missing critical fields
  if ((!startDate || Number.isNaN(startDate.getTime())) || !loc) {
    const fb = extractFallbackDateAndLocation(html);
    if (!startDate && fb.date) startDate = fb.date;
    if (!loc && fb.location) loc = fb.location;
    if (!timezone && fb.location?.timezone) timezone = fb.location.timezone;
  }

  const europeOk = loc && isEuropeLocation(loc) && (!loc.online || Boolean(timezone));

  if (!title) return null;
  if (!startDate || Number.isNaN(startDate.getTime())) return null;
  if (!loc) return null;
  if (!europeOk) return null;

  return {
    sourceId: source.id,
    sourceName: source.name,
    hostTag: source.hostTag,
    hostLogo: source.logo,
    url,
    title,
    description: description || `${source.name} event`,
    startDate,
    location: {
      online: Boolean(loc.online),
      venue: loc.venue,
      city: loc.city,
      country: loc.country,
      timezone,
    },
  };
}

function eventToMarkdown(ev) {
  const y = ev.startDate.getFullYear();
  const m = String(ev.startDate.getMonth() + 1).padStart(2, "0");
  const d = String(ev.startDate.getDate()).padStart(2, "0");

  const locParts = [];
  if (ev.location.online) {
    locParts.push(`Online${ev.location.timezone ? ` (${ev.location.timezone})` : ""}`);
  } else {
    if (ev.location.city) locParts.push(ev.location.city);
    if (ev.location.country) locParts.push(ev.location.country);
  }

  const safeTitle = ev.title.replace(/"/g, "'");
  const safeDesc = ev.description.replace(/"/g, "'");

  const tags = ["events", ev.hostTag];

  return `---\n` +
    `pubDate: ${y}-${m}-${d}\n` +
    `team: "gonzalo-melosevich"\n` +
    `title: "${safeTitle}"\n` +
    `description: "${safeDesc}"\n` +
    `image:\n` +
    `  url: "${ev.hostLogo}"\n` +
    `  alt: "${ev.sourceName}"\n` +
    `tags:\n` +
    tags.map((t) => `  - ${t}\n`).join("") +
    `---\n\n` +
    `**When:** ${y}-${m}-${d}\n\n` +
    `**Where:** ${locParts.join(", ") || ""}${ev.location.venue ? ` — ${ev.location.venue}` : ""}\n\n` +
    `**Source:** ${ev.sourceName}\n\n` +
    `**Link:** ${ev.url}\n`;
}

function pickFilename(ev) {
  const y = ev.startDate.getFullYear();
  const m = String(ev.startDate.getMonth() + 1).padStart(2, "0");
  const d = String(ev.startDate.getDate()).padStart(2, "0");
  const slug = slugify(ev.title) || `${ev.sourceId}-${sha1(ev.url)}`;
  return `${y}-${m}-${d}-events-${slug}.md`;
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function listExistingEventPosts() {
  if (!fs.existsSync(POSTS_DIR)) return [];
  return fs.readdirSync(POSTS_DIR).filter((f) => f.includes("-events-"));
}

function extractCandidateLinks(listHtml, listUrl) {
  const $ = cheerio.load(listHtml);
  const anchors = $("a[href]").toArray();
  const urls = new Set();
  for (const a of anchors) {
    const href = $(a).attr("href");
    if (!href) continue;
    if (href.startsWith("mailto:")) continue;
    const abs = new URL(href, listUrl).toString();
    // basic filter: keep links that look like event detail pages
    if (/\b(events?|summits?)\b/i.test(abs)) urls.add(abs);
  }
  // also try JSON-LD ItemList of URLs
  const jsonld = extractJsonLdEvents(listHtml);
  for (const ev of jsonld) {
    if (ev?.url) urls.add(new URL(ev.url, listUrl).toString());
  }
  return [...urls];
}

async function crawlSource(source) {
  console.log(`\n== Source: ${source.name} ==`);

  // Try plain fetch first, then fallback to rendered HTML.
  let listHtml = await fetchText(source.listUrl);
  let candidates = extractCandidateLinks(listHtml, source.listUrl);

  if (candidates.length < 5 && chromium) {
    const rendered = await fetchRenderedHtml(source.listUrl);
    if (rendered) {
      listHtml = rendered;
      candidates = extractCandidateLinks(listHtml, source.listUrl);
    }
  }

  // Deduplicate candidates
  candidates = [...new Set(candidates)];

  console.log(`Candidates: ${candidates.length}`);

  const extracted = [];

  for (const url of candidates) {
    try {
      // Get rendered HTML if available (helps JS-driven pages)
      const html = (await fetchRenderedHtml(url)) ?? (await fetchText(url));
      const jsonldEvents = extractJsonLdEvents(html);
      const jsonld = jsonldEvents[0];
      const ev = normalizeEvent({ source, url, jsonld, html });
      if (!ev) continue;
      extracted.push(ev);
    } catch {
      // skip
    }
  }

  // de-dupe by URL
  const byUrl = new Map();
  for (const ev of extracted) byUrl.set(ev.url, ev);
  const out = [...byUrl.values()];
  console.log(`Extracted valid events: ${out.length}`);
  return out;
}

async function main() {
  const sources = JSON.parse(fs.readFileSync(SOURCES_PATH, "utf-8"));
  ensureDir(POSTS_DIR);

  const all = [];
  for (const source of sources) {
    try {
      const events = await crawlSource(source);
      all.push(...events);
    } catch (e) {
      console.error(`Source failed: ${source.id}: ${e.message}`);
    }
  }

  // write posts
  const written = [];
  for (const ev of all) {
    const filename = pickFilename(ev);
    const fp = path.join(POSTS_DIR, filename);
    fs.writeFileSync(fp, eventToMarkdown(ev), "utf-8");
    written.push(filename);
  }

  console.log(`\nWrote/updated ${written.length} event posts.`);
  if (!written.length) {
    console.log("No events extracted. This can happen if sources don’t expose JSON-LD or links are JS-driven.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
