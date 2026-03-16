import crypto from "node:crypto";

export const VALIDATION_REASONS = {
  MISSING_SOURCE_ID: "MISSING_SOURCE_ID",
  UNKNOWN_SOURCE_ID: "UNKNOWN_SOURCE_ID",
  MISSING_URL: "MISSING_URL",
  INVALID_URL: "INVALID_URL",
  MISSING_TITLE: "MISSING_TITLE",
  MISSING_START_DATE: "MISSING_START_DATE",
  INVALID_START_DATE: "INVALID_START_DATE",
  MISSING_LOCATION: "MISSING_LOCATION",
  ONLINE_MISSING_TIMEZONE: "ONLINE_MISSING_TIMEZONE",
  NON_EUROPE_LOCATION: "NON_EUROPE_LOCATION",
};

const EURO_COUNTRIES = new Set([
  "Austria", "Belgium", "Bulgaria", "Croatia", "Cyprus", "Czech Republic", "Denmark", "Estonia", "Finland", "France",
  "Germany", "Greece", "Hungary", "Ireland", "Italy", "Latvia", "Lithuania", "Luxembourg", "Malta", "Netherlands",
  "Poland", "Portugal", "Romania", "Slovakia", "Slovenia", "Spain", "Sweden", "United Kingdom", "UK", "England",
  "Scotland", "Wales", "Northern Ireland", "Switzerland", "Norway",
]);

const EURO_ISO_CODES = new Set([
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU",
  "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE", "GB", "UK", "CH", "NO",
]);

function sha1(input) {
  return crypto.createHash("sha1").update(input).digest("hex");
}

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

function normalizeDate(input) {
  if (!input) return null;
  if (input instanceof Date) return Number.isNaN(input.getTime()) ? null : input;
  const date = new Date(input);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isEuropeLocation(location) {
  if (!location) return false;
  if (location.online) return true;
  const country = normalizeSpace(location.country);
  if (!country) return false;
  if (EURO_COUNTRIES.has(country)) return true;
  if (EURO_ISO_CODES.has(country.toUpperCase())) return true;
  return false;
}

function canonicalLocation(location) {
  if (!location) return null;
  return {
    online: Boolean(location.online),
    venue: normalizeSpace(location.venue) || undefined,
    city: normalizeSpace(location.city) || undefined,
    country: normalizeSpace(location.country) || undefined,
    timezone: normalizeSpace(location.timezone).toUpperCase() || undefined,
  };
}

function isValidUrl(url) {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

export function toCanonicalEvent(event) {
  const startDate = normalizeDate(event?.startDate);
  return {
    sourceId: normalizeSpace(event?.sourceId),
    sourceName: normalizeSpace(event?.sourceName),
    sourceEventId: normalizeSpace(event?.sourceEventId) || undefined,
    hostTag: normalizeSpace(event?.hostTag),
    hostLogo: normalizeSpace(event?.hostLogo),
    url: normalizeSpace(event?.url),
    title: normalizeSpace(event?.title),
    description: normalizeSpace(event?.description),
    startDate,
    location: canonicalLocation(event?.location),
  };
}

export function validateEvent(event, options = {}) {
  const e = toCanonicalEvent(event);
  const allowedSourceIds = options.allowedSourceIds ? new Set(options.allowedSourceIds) : null;

  if (!e.sourceId) return { valid: false, reason: VALIDATION_REASONS.MISSING_SOURCE_ID, event: e };
  if (allowedSourceIds && !allowedSourceIds.has(e.sourceId)) {
    return { valid: false, reason: VALIDATION_REASONS.UNKNOWN_SOURCE_ID, event: e };
  }
  if (!e.url) return { valid: false, reason: VALIDATION_REASONS.MISSING_URL, event: e };
  if (!isValidUrl(e.url)) return { valid: false, reason: VALIDATION_REASONS.INVALID_URL, event: e };
  if (!e.title) return { valid: false, reason: VALIDATION_REASONS.MISSING_TITLE, event: e };
  if (!event?.startDate) return { valid: false, reason: VALIDATION_REASONS.MISSING_START_DATE, event: e };
  if (!e.startDate) return { valid: false, reason: VALIDATION_REASONS.INVALID_START_DATE, event: e };
  if (!e.location) return { valid: false, reason: VALIDATION_REASONS.MISSING_LOCATION, event: e };
  if (e.location.online && !e.location.timezone) {
    return { valid: false, reason: VALIDATION_REASONS.ONLINE_MISSING_TIMEZONE, event: e };
  }
  if (!isEuropeLocation(e.location)) {
    return { valid: false, reason: VALIDATION_REASONS.NON_EUROPE_LOCATION, event: e };
  }

  return { valid: true, event: e };
}

export function validateEvents(events, options = {}) {
  const valid = [];
  const rejected = [];
  for (const event of events) {
    const result = validateEvent(event, options);
    if (result.valid) {
      valid.push(result.event);
    } else {
      rejected.push({ reason: result.reason, event: result.event });
    }
  }
  return { valid, rejected };
}

function toDateKey(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
    .toISOString()
    .slice(0, 10);
}

function fuzzyLocationKey(location) {
  if (!location) return "";
  if (location.online) return `online|${normalizeText(location.timezone || "")}`;
  return [location.venue, location.city, location.country].map((v) => normalizeText(v || "")).join("|");
}

function dedupeKey(event) {
  if (event.sourceEventId) {
    return `source:${event.sourceId}:${normalizeText(event.sourceEventId)}`;
  }
  const title = normalizeText(event.title);
  const date = toDateKey(event.startDate);
  const location = fuzzyLocationKey(event.location);
  return `fuzzy:${event.sourceId}:${title}:${date}:${location}`;
}

export function dedupeEvents(events) {
  const sorted = [...events].sort((a, b) => {
    const ka = `${a.sourceId}|${a.url}|${a.title}|${a.startDate.toISOString()}`;
    const kb = `${b.sourceId}|${b.url}|${b.title}|${b.startDate.toISOString()}`;
    return ka.localeCompare(kb);
  });

  const seen = new Map();
  const deduped = [];
  const duplicates = [];

  for (const event of sorted) {
    const key = dedupeKey(event);
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, event);
      deduped.push(event);
      continue;
    }

    duplicates.push({
      reason: "DUPLICATE_EVENT",
      key,
      droppedUrl: event.url,
      keptUrl: existing.url,
      droppedSourceId: event.sourceId,
      keptSourceId: existing.sourceId,
    });
  }

  return { events: deduped, duplicates };
}

export function stableContentHash(markdown) {
  return sha1(markdown);
}
