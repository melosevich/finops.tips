# Events updater (ETL)

This folder contains a strict events extractor for **finops.tips**.

## Goals
- Crawl approved sources
- For each candidate event, extract **date** + **location** (venue/city/country or Online+timezone)
- If date or location is missing → **discard**
- Write one event post per event under `src/content/posts/`

## Run
```bash
npm run events:update
```

## Optional (recommended): JS-rendered pages
Some sources are JS-rendered and require a headless browser to extract event details.

If you see a Playwright message like “Please run `npx playwright install`”, run:
```bash
npx playwright install chromium
```

Then re-run `npm run events:update`.

## Sources
Configured in `scripts/events/sources.json`.
