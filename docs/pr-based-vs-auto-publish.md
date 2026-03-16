# PR-based workflow vs auto-publish

## Context
The daily automation pipeline (events refresh + tip generation) can either:
- open a pull request for human review, or
- auto-commit directly to `main`.

## PR-based workflow (current default)
Benefits:
- Quality control before publication (editorial and factual review).
- Safer rollback path (decline/close PR instead of reverting production).
- Better auditability via commit/PR discussion history.

Tradeoffs:
- Added publication latency (wait for reviewer merge).
- Requires human availability for timely merges.

## Auto-publish workflow (future option)
Benefits:
- Lowest latency from generation to production.
- No manual merge dependency on routine days.

Tradeoffs:
- Higher risk of publishing low-quality or duplicate content.
- Recovery happens after the fact (revert/fix-forward), not before publish.

## Recommendation
Use PR-based publishing during hardening while validation, dedupe, and SLO monitoring mature.
Revisit auto-publish only after sustained evidence of low reject rates, low duplicates, and stable run reliability.
