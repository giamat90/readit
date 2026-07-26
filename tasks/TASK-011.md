# TASK-011: Locale key validation script

## Status: APPROVED

## Overview
CLAUDE.md has long warned that "duplicate JSON keys silently break translations — always validate locale files," but no such validation exists in the repo. `JSON.parse` silently keeps only the last of any duplicate key, so a copy-paste mistake in a locale file fails silently at runtime (missing/wrong string) instead of at build time. This task adds a script that catches duplicate keys and missing/extra keys across all `locales/*.json` files, run via `npm run validate-locales`. It must land before TASK-012 (adding 4 new locale files) so those additions are guarded from day one.

## User story
As the developer, I want a script that fails loudly when a locale file has a duplicate or mismatched key, so translation bugs are caught before they reach a device.

## Acceptance criteria
- [ ] `npm run validate-locales` exits non-zero and prints the offending file + key when a locale file has a duplicate key at any nesting level (note: plain `JSON.parse` cannot detect this — it silently keeps the last occurrence — so the script must inspect raw file text or use a duplicate-key-aware parse)
- [ ] `npm run validate-locales` exits non-zero and lists every key present in `locales/en.json` but missing from another locale file, and vice versa (treat `en.json` as the reference key set)
- [ ] `npm run validate-locales` exits 0 with a short success message when all locale files are in sync and duplicate-free
- [ ] Script requires no new runtime dependency if avoidable — prefer a small hand-rolled duplicate-key scan over pulling in a parser library; only add a devDependency if a hand-rolled scan is materially harder to get right
- [ ] `npx tsc --noEmit` still passes (script must not break typecheck if written in TS, or must be excluded from the TS project if it's a plain `.js` Node script run via `node`)

## Technical plan

### Files to create
| File | Purpose |
|------|---------|
| `scripts/validate-locales.js` | Node script: reads every file in `locales/*.json`, checks for duplicate keys (raw-text scan, not just `JSON.parse`) and key-set parity against `en.json`; prints violations; exits 1 on any violation, 0 otherwise |

### Files to modify
| File | Change |
|------|--------|
| `package.json` | Add `"validate-locales": "node scripts/validate-locales.js"` to `scripts` |

### Database changes
None.

### Edge functions
None.

### i18n keys
None.

## Implementation steps
1. Write `scripts/validate-locales.js`:
   - Duplicate-key detection: read each `locales/*.json` file as raw text and parse it with a duplicate-key-aware approach (e.g. `JSON.parse` with a `reviver`-based approach won't see duplicates either — instead walk the raw text tracking nesting and flag any `"key":` appearing twice within the same object scope, or use a minimal recursive-descent scan). Keep it simple and correct over clever.
   - Key-set parity: flatten each locale file's JSON into dotted-path keys (e.g. `settings.english`), compare every locale's flattened key set against `en.json`'s, report both directions (missing-from-locale and extra-in-locale).
   - Aggregate all violations across all files before exiting, so a single run reports everything at once (don't fail fast on the first file).
2. Add the `validate-locales` npm script to `package.json`.
3. Manually verify: temporarily duplicate a key in a scratch copy of `it.json` and confirm the script catches it; temporarily delete a key and confirm the parity check catches it; revert the scratch changes.
4. `npx tsc --noEmit` — confirm no regressions.
5. Commit on `feat/task-011-validate-locales`.

## Testing checklist
- [ ] Works on free tier (n/a — dev tooling only)
- [ ] Works on Pro tier (n/a)
- [ ] Works offline / poor network (n/a — local script, no network)
- [ ] i18n: validated against current en + it locale files, both pass clean before this task is marked done
- [ ] No hardcoded pixel values (n/a — no UI)
- [ ] No layout regressions (n/a — no UI)

## Dependencies
None.

## Notes
- This script is intentionally scoped to locale-file hygiene only — it does not check that translation values are *correct* (that's a human/translator concern), only that the key structure is internally consistent.
- Giacomo has not indicated whether this should also run as a pre-commit hook — no hook infrastructure exists in this repo today. Leave it as an on-demand npm script for now; ask before adding hook infra as a follow-up.
- TASK-012 depends on this landing first, so its new locale files are checked as they're written rather than after the fact.
