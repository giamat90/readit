# TASK-012: Add Spanish, German, French, Portuguese UI languages

## Status: DONE

## Overview
ReadIt currently ships 2 UI languages (English, Italian). This task extends UI-language support to 6 total by adding Spanish (`es`), German (`de`), French (`fr`), and Portuguese (`pt`) — full translations of every existing key, wired into `i18next` and the language picker. This is UI-chrome language only (button labels, screen titles, error copy) — it has no relation to a document's detected spoken language or TTS voice selection, which are handled entirely separately (see Notes).

## User story
As a user whose device or preferred language is Spanish, German, French, or Portuguese, I want the app's own interface to display in that language, so ReadIt feels native rather than defaulting to English.

## Acceptance criteria
- [ ] `locales/es.json`, `locales/de.json`, `locales/fr.json`, `locales/pt.json` exist, each containing every key currently present in `locales/en.json`, fully translated (no leftover English placeholder strings, no missing keys)
- [ ] `npm run validate-locales` (TASK-011) passes clean across all 6 locale files
- [ ] `lib/i18n.ts`'s `SUPPORTED` array and `resources` map include all 4 new codes
- [ ] `app/settings/language.tsx`'s `LANGUAGES` array includes all 4 new entries, each pointing at a new `settings.<lang>` key (`settings.spanish`, `settings.german`, `settings.french`, `settings.portuguese`)
- [ ] The 4 new `settings.<lang>` keys exist in **all six** locale files (including `en.json` and `it.json`) so the picker's own row labels are correctly translated regardless of which language is currently active
- [ ] Selecting any of the 4 new languages in Settings immediately re-renders the whole app in that language (existing `i18n.changeLanguage()` behavior — no new logic needed here, just confirm it still works with the larger `SUPPORTED` set) and persists to `profiles.app_language`
- [ ] Device-locale auto-detection (`lib/i18n.ts`'s `deviceLanguage()`) correctly picks up `es`/`de`/`fr`/`pt` as a device locale on first launch, same as it already does for `it`
- [ ] `npx tsc --noEmit` passes; manual device check switching through all 6 languages shows correct strings everywhere (no raw key names, no English leaking into a non-English selection)

## Technical plan

### Files to create
| File | Purpose |
|------|---------|
| `locales/es.json` | Spanish translation of every key in `locales/en.json` |
| `locales/de.json` | German translation of every key in `locales/en.json` |
| `locales/fr.json` | French translation of every key in `locales/en.json` |
| `locales/pt.json` | Portuguese translation of every key in `locales/en.json` |

### Files to modify
| File | Change |
|------|--------|
| `lib/i18n.ts` | Add `"es"`, `"de"`, `"fr"`, `"pt"` to `SUPPORTED`; import and register the 4 new JSON files in `resources` |
| `app/settings/language.tsx` | Add 4 entries to `LANGUAGES`: `{ code: "es", labelKey: "settings.spanish" }`, etc. |
| `locales/en.json` | Add `settings.spanish`, `settings.german`, `settings.french`, `settings.portuguese` keys |
| `locales/it.json` | Add same 4 keys, translated to Italian |
| `locales/es.json`, `locales/de.json`, `locales/fr.json`, `locales/pt.json` | Include the same 4 keys as part of their initial content (each language's own name for itself and the other three) |

### Database changes
None — `profiles.app_language` is already free-text (migration 001).

### Edge functions
None.

### i18n keys
New: `settings.spanish`, `settings.german`, `settings.french`, `settings.portuguese` — required in all six locale files. All other keys are 1:1 translations of the existing `locales/en.json` key set (see that file for the full inventory: `common.*`, `tabs.*`, `library.*`, `settings.*`, `import.*`, `player.*`, `auth.*`).

## Implementation steps
1. Confirm TASK-011's `validate-locales` script exists and passes on the current `en.json`/`it.json` pair.
2. Add the `settings.spanish`/`settings.german`/`settings.french`/`settings.portuguese` keys to `en.json` and `it.json` first.
3. Write `locales/es.json`, `locales/de.json`, `locales/fr.json`, `locales/pt.json` — full translations, including the 4 new self-referential language-name keys.
4. Update `lib/i18n.ts` (`SUPPORTED` + `resources`).
5. Update `app/settings/language.tsx` (`LANGUAGES` array).
6. Run `npm run validate-locales` — fix any reported gaps.
7. `npx tsc --noEmit`.
8. On device: cycle through all 6 languages via Settings → App language, confirm every screen (Library, Import flows, Player, Auth, Settings itself) renders correctly with no missing-key fallback text.
9. Commit on `feat/task-012-add-languages`.

## Testing checklist
- [ ] Works on free tier
- [ ] Works on Pro tier (n/a — no Pro-gated strings affected)
- [ ] Works offline / poor network (n/a — locale files are bundled, not fetched)
- [ ] i18n: tested in all 6 languages (en, it, es, de, fr, pt), including live-switching between them without app restart
- [ ] No hardcoded pixel values
- [ ] No layout regressions on Giacomo's test device — note German strings in particular tend to run longer than English; check button/label wrapping
- [ ] `validate-locales` passes clean as part of this task's completion, not just at the end

## Dependencies
TASK-011 (locale validation script) must land first, so these new locale files are checked as they're added rather than after the fact.

## Notes
- **Do not conflate `app_language` with document/TTS language.** `app_language` is UI chrome only. A document's spoken language is detected independently at extraction (`documents.language`, BCP-47) and governs TTS voice selection in `hooks/useSpeechPlayer.ts` — this task does not touch that path at all, and adding these 4 UI languages does not imply or require adding TTS voice support for them (that already works for any language with an installed on-device `expo-speech` voice, independent of UI language). See TASK-008's Notes for the original statement of this distinction.
- Translation quality: since there's no in-house translator, write natural, correctly-accented translations rather than literal machine-translation artifacts — this is user-facing app chrome, not throwaway text. Flag any string you're unsure about in the PR description for Giacomo to spot-check.
- `app.json` currently has no Expo-level locale config (no `supportedLocales`, no localization plugin entry) — out of scope here; this task is purely `react-i18next` resource-level, consistent with how `it` was added.
