# Tips generation pipeline

Deterministic daily tip generation for four landing-page sections:
- operations
- services
- metrics
- events

## Guarantees
- one generated candidate per section per run (fallback templates when source data is sparse)
- novelty protection using near-duplicate detection against recent generated history
- quality gates with reason codes:
  - `SPECIFICITY`
  - `ACTIONABILITY`
  - `SOURCEABLE_CLAIMS`
- run summary emitted to `scripts/tips/.last-run-summary.json`

## Run
```bash
npm run tips:update
```

The updater prints:
- expected/generated section counts
- generated/rejected/duplicate counts
- write counts (created/updated/unchanged)

## Tests
```bash
npm run tips:test
```

Fixtures are in `scripts/tips/fixtures/`.
