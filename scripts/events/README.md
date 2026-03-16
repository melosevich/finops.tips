# Events updater (ETL)

This folder contains a strict events extractor for **finops.tips**.

## Goals
- Crawl approved sources
- For each candidate event, extract **date** + **location** (venue/city/country or Online+timezone)
- Apply strict schema validation with reason-coded rejects (missing title/date/location, invalid URL/date, non-Europe scope, online without timezone)
- Deterministic de-duplication (source event id first, then fuzzy source+title+date+location key)
- Idempotent writes (unchanged markdown files are not rewritten)
- Write one event post per event under `src/content/posts/`

## Run
```bash
npm run events:update
```

The updater prints run metadata:
- candidate count
- valid count
- rejected count + reason breakdown
- duplicate count
- created/updated/unchanged write counts

## Tests
```bash
npm run events:test
```

Fixtures are in `scripts/events/fixtures/`.

## Optional (recommended): JS-rendered pages
Some sources are JS-rendered and require a headless browser to extract event details.

If you see a Playwright message like “Please run `npx playwright install`”, run:
```bash
npx playwright install chromium
```

Then re-run `npm run events:update`.

## Sources
Configured in `scripts/events/sources.json`.
