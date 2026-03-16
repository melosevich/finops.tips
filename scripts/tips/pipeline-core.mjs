import crypto from "node:crypto";

export const SECTIONS = ["operations", "services", "metrics"];

const IMPERATIVE_HINTS = [
  "audit",
  "tag",
  "rightsize",
  "set",
  "enable",
  "review",
  "track",
  "measure",
  "alert",
  "remove",
  "consolidate",
  "negotiate",
  "schedule",
  "commit",
  "adopt",
];

const CLOUD_KEYWORDS = [
  "aws",
  "azure",
  "gcp",
  "ec2",
  "s3",
  "rds",
  "lambda",
  "kubernetes",
  "finops",
  "focus",
  "cur",
  "reservation",
  "savings plan",
  "unit cost",
  "tag",
  "showback",
  "chargeback",
  "cloudfront",
  "dynamodb",
  "eks",
];

const SECTION_TEMPLATES = {
  operations: {
    prompt: "Generate one concrete cloud operations cost tip with an immediate runbook action.",
    buildTitle: (source) => `Understand ${source.focus} patterns to reduce request costs`,
    buildSummary: (source) =>
      `Use ${source.focus} request telemetry and per-call cost baselines to remove high-volume waste before month-end close.`,
    buildBody: (source) =>
      [
        "## What It Is",
        `${source.focus} is an API-level spend driver. It can be modeled as \`total_cost = requests * unit_request_price + related_transfer + downstream_compute\` and broken down by workload, endpoint, and environment.`,
        "",
        "## Why It Matters",
        "Small per-request prices hide large aggregate spend at scale. A single noisy integration can multiply request, transfer, and retry costs, then cascade into Lambda/DB invocations.",
        "",
        "## How to Act",
        "1. Query 14 days of CUR and API logs, grouped by operation, caller, and status code; compute p50/p95 requests per minute.",
        "2. Build a cost-per-1k-requests baseline for each workload and flag callers with >20% week-over-week drift not explained by traffic.",
        "3. For top offenders, enforce one control: response caching, retry budget (max attempts), or request batching, then verify 48-hour impact.",
        "",
        "## Example",
        `If ${source.focus} from one service rises from 42M to 56M calls/week (+33%) while business KPIs stay flat, cap retries to 2, add a 300s cache TTL for idempotent reads, and target a 15-25% request-cost reduction in the next billing window. Source: [${source.title}](${source.url}).`,
      ].join("\n"),
  },
  services: {
    prompt: "Generate one service-level optimization tip with a direct procurement or architecture action.",
    buildTitle: (source) => `Optimize ${source.focus} usage before it scales your bill`,
    buildSummary: (source) =>
      `Turn ${source.focus} usage shape into a concrete architecture plus commitment strategy with expected savings.`,
    buildBody: (source) =>
      [
        "## What It Is",
        `${source.focus} spend is governed by three levers: utilization profile, pricing model (on-demand vs commitment), and architecture efficiency (duration, memory/compute, and data movement).`,
        "",
        "## Why It Matters",
        "If you tune only one lever, savings plateau quickly. Durable FinOps gains come from combining engineering changes with the right commercial commitment.",
        "",
        "## How to Act",
        "1. Rank the top SKUs/usage types for this service and quantify each as % of monthly service spend.",
        "2. Segment workload into steady baseline vs burst usage; map baseline to RI/Savings Plan coverage target and leave burst on on-demand.",
        "3. Execute one engineering optimization with measured ROI (for example, reduce runtime or over-provisioning) and track realized savings against forecast.",
        "",
        "## Example",
        `If ${source.focus} is 30% above plan and 70% of usage is stable, target 60-70% commitment coverage for the stable slice and reduce peak-unit consumption by 10-15% via architecture tuning; validate savings in CUR within 7 days. Source: [${source.title}](${source.url}).`,
      ].join("\n"),
  },
  metrics: {
    prompt: "Generate one KPI-oriented FinOps tip with a measurable threshold and owner handoff.",
    buildTitle: (source) => `Track ${source.focus} to catch cloud waste early`,
    buildSummary: (source) =>
      `Instrument ${source.focus} with owner-level thresholds, confidence bands, and an explicit remediation SLA.`,
    buildBody: (source) =>
      [
        "## What It Is",
        `${source.focus} is a leading FinOps KPI that should be tracked by workload and environment, not only at global account level, to expose where inefficiency actually originates.`,
        "",
        "## Why It Matters",
        "Without statistically meaningful guardrails, teams either overreact to noise or detect cost drift too late. Thresholds plus ownership reduce both false positives and delayed remediation.",
        "",
        "## How to Act",
        "1. Define target, warning, and critical bands (for example using a 4-week rolling baseline plus variance tolerance).",
        "2. Slice the metric by owner dimension (team, product, environment) and attach one accountable engineer per slice.",
        "3. Trigger an incident-style remediation when critical threshold breaches persist >7 days, with expected savings and due date.",
        "",
        "## Example",
        `If ${source.focus} rises from 8% to 13% for two consecutive weeks in one product line, open a remediation ticket with a 14-day SLA, require a quantified rollback/optimization plan, and track whether waste returns below 9% by next review. Source: [${source.title}](${source.url}).`,
      ].join("\n"),
  },
};

const FALLBACK_SOURCE_BY_SECTION = {
  operations: {
    title: "FinOps Foundation operations playbook",
    url: "https://www.finops.org/framework/capabilities/workload-optimization/",
  },
  services: {
    title: "FinOps Foundation pricing and rate optimization",
    url: "https://www.finops.org/framework/capabilities/rate-optimization/",
  },
  metrics: {
    title: "FinOps Foundation KPI guidance",
    url: "https://www.finops.org/framework/capabilities/measuring-unit-cost/",
  },
};

function normalizeSpace(input) {
  return String(input || "").replace(/\s+/g, " ").trim();
}

function normalizeText(input) {
  return normalizeSpace(input)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, "")
    .trim();
}

function slugify(input) {
  return normalizeText(input).replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

function cleanSourceTitle(input) {
  const normalized = normalizeSpace(input)
    .replace(/^(runbook focus|service optimization|metric to watch|operation|service|metric)\s*:\s*/i, "")
    .replace(/\(([^)]+)\)/g, " $1")
    .replace(/\s+/g, " ")
    .trim();
  return normalized || "cloud cost signal";
}

function sha1(input) {
  return crypto.createHash("sha1").update(input).digest("hex");
}

function tokenize(input) {
  const text = normalizeText(input);
  if (!text) return [];
  return text.split(" ").filter(Boolean);
}

function jaccard(aTokens, bTokens) {
  const a = new Set(aTokens);
  const b = new Set(bTokens);
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection += 1;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function containsImperativeLanguage(text) {
  const normalized = normalizeText(text);
  return IMPERATIVE_HINTS.some((hint) => normalized.includes(hint));
}

function cloudKeywordCount(text) {
  const normalized = normalizeText(text);
  return CLOUD_KEYWORDS.filter((keyword) => normalized.includes(normalizeText(keyword))).length;
}

function hasNumericSpecificity(text) {
  return /\b\d+(?:[.,]\d+)?(?:%|x|k|m|gb|tb|ms|days?|hours?)?\b/i.test(text);
}

function buildTemplateTip(section, source, isoDate) {
  const template = SECTION_TEMPLATES[section];
  const base = source ?? FALLBACK_SOURCE_BY_SECTION[section];
  const safeSource = {
    ...base,
    focus: cleanSourceTitle(base.title),
  };
  const body = template.buildBody(safeSource);
  return {
    section,
    templatePrompt: template.prompt,
    title: template.buildTitle(safeSource),
    description: template.buildSummary(safeSource),
    body,
    sourceTitle: safeSource.title,
    sourceUrl: safeSource.url,
    pubDate: isoDate,
    tags: [section, "daily-tip", "generated"],
    fallbackUsed: !source,
    sourceSlug: source?.slug ?? null,
  };
}

export function scoreSourceCandidate(candidate, section, now) {
  const date = candidate?.pubDate ? new Date(candidate.pubDate) : null;
  const nowDate = new Date(now);
  const ageDays = date ? Math.max(0, Math.floor((nowDate.getTime() - date.getTime()) / (24 * 3600 * 1000))) : 365;

  let score = 0;
  if (candidate.tags?.includes(section)) score += 20;
  if (section === "events" && date && date >= nowDate) score += 40;
  score += Math.max(0, 30 - ageDays);
  score += Math.min(20, tokenize(candidate.body || "").length / 20);
  return score;
}

export function pickSourceForSection({ section, sources, now, recentSourceSlugs = new Set() }) {
  const scoped = sources.filter((source) => source.tags?.includes(section));
  const candidates = scoped
    .filter((source) => !recentSourceSlugs.has(source.slug))
    .sort((a, b) => scoreSourceCandidate(b, section, now) - scoreSourceCandidate(a, section, now));
  if (candidates.length) return candidates[0];

  const allRanked = scoped.sort((a, b) => scoreSourceCandidate(b, section, now) - scoreSourceCandidate(a, section, now));
  return allRanked[0] ?? null;
}

export function qualityGate(tip) {
  const content = `${tip.title}\n${tip.description}\n${tip.body}`;
  const specificity = hasNumericSpecificity(content) || cloudKeywordCount(content) >= 2;
  const actionability = /\n1\.\s+/.test(tip.body) || containsImperativeLanguage(content);
  const sourceableClaims = Boolean(tip.sourceUrl) && /\[.+\]\(https?:\/\//.test(tip.body);

  const failures = [];
  if (!specificity) failures.push("SPECIFICITY");
  if (!actionability) failures.push("ACTIONABILITY");
  if (!sourceableClaims) failures.push("SOURCEABLE_CLAIMS");

  return {
    valid: failures.length === 0,
    failures,
  };
}

function similaritySignature(tip) {
  return `${tip.section}\n${tip.title}\n${tip.description}\n${tip.body}`;
}

export function detectNearDuplicate(tip, history, threshold = 0.72) {
  const currentTokens = tokenize(similaritySignature(tip));
  for (const previous of history) {
    if (previous.section !== tip.section) continue;
    const previousTokens = tokenize(similaritySignature(previous));
    const score = jaccard(currentTokens, previousTokens);
    if (score >= threshold) {
      return {
        duplicate: true,
        score,
        previousId: previous.slug ?? previous.title,
      };
    }
  }
  return {
    duplicate: false,
    score: 0,
    previousId: null,
  };
}

export function makeTipFileName(tip) {
  const date = tip.pubDate;
  const slug = slugify(tip.title).slice(0, 64) || `${tip.section}-tip`;
  return `${date}-${tip.section}-daily-tip-${slug}.md`;
}

export function toMarkdown(tip) {
  return [
    "---",
    `pubDate: ${tip.pubDate}`,
    'team: "gonzalo-melosevich"',
    `title: "${tip.title.replace(/"/g, "\\\"")}"`,
    `description: "${tip.description.replace(/"/g, "\\\"")}"`,
    "image:",
    `  url: "${tip.section === "events" ? "/src/images/events/official/finopsfoundation.png" : "/src/images/blog/1.jpg"}"`,
    `  alt: "${tip.section} daily tip"`,
    "tags:",
    `  - ${tip.section}`,
    "  - daily-tip",
    "  - generated",
    "---",
    "",
    tip.body,
    "",
  ].join("\n");
}

export function stableContentHash(markdown) {
  return sha1(markdown);
}

export function generateSectionTips({
  now,
  sources,
  history = [],
  recentSourceSlugsBySection = new Map(),
  duplicateThreshold = 0.72,
}) {
  const isoDate = new Date(now).toISOString().slice(0, 10);
  const valid = [];
  const rejected = [];
  const duplicates = [];

  for (const section of SECTIONS) {
    const recentSourceSlugs = recentSourceSlugsBySection.get(section) || new Set();
    const selected = pickSourceForSection({ section, sources, now, recentSourceSlugs });
    const firstPass = buildTemplateTip(section, selected, isoDate);
    const firstQuality = qualityGate(firstPass);

    let candidate = firstPass;
    let quality = firstQuality;

    if (!quality.valid) {
      candidate = buildTemplateTip(section, null, isoDate);
      quality = qualityGate(candidate);
    }

    if (!quality.valid) {
      rejected.push({
        section,
        reason: "QUALITY_GATE_FAILED",
        failures: quality.failures,
      });
      continue;
    }

    const duplicate = detectNearDuplicate(candidate, history, duplicateThreshold);
    if (duplicate.duplicate) {
      duplicates.push({
        section,
        reason: "NEAR_DUPLICATE",
        score: Number(duplicate.score.toFixed(3)),
        previousId: duplicate.previousId,
      });
      continue;
    }

    valid.push(candidate);
  }

  return { valid, rejected, duplicates };
}
