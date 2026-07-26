# TASK-013: Add Japanese, Chinese (Simplified), Russian, Dutch UI languages

## Status: DONE

## Overview
ReadIt currently ships 6 UI languages (English, Italian, Spanish, German, French, Portuguese). This task extends UI-language support to 10 total by adding Japanese (`ja`), Chinese Simplified (`zh`), Russian (`ru`), and Dutch (`nl`) — full translations of every existing key, wired into `i18next` and the language picker. These four were chosen specifically because they're left-to-right scripts with wide Android TTS voice availability — **no RTL layout work is in scope here**. As with the previous batch, this is UI-chrome language only and has no relation to a document's detected spoken language or TTS voice selection.

## User story
As a user whose device or preferred language is Japanese, Chinese, Russian, or Dutch, I want the app's own interface to display in that language, so ReadIt feels native rather than defaulting to English.

## Acceptance criteria
- [ ] `locales/ja.json`, `locales/zh.json`, `locales/ru.json`, `locales/nl.json` exist, each containing every key currently present in `locales/en.json`, fully translated (no leftover English placeholder strings, no missing keys)
- [ ] `npm run validate-locales` passes clean across all 10 locale files
- [ ] `lib/i18n.ts`'s `SUPPORTED` array and `resources` map include all 4 new codes
- [ ] `app/settings/language.tsx`'s exported `LANGUAGES` array includes all 4 new entries, each pointing at a new `settings.<lang>` key (`settings.japanese`, `settings.chinese`, `settings.russian`, `settings.dutch`)
- [ ] The 4 new `settings.<lang>` keys exist in **all ten** locale files, using each language's own native name identically everywhere (e.g. `"japanese": "日本語"` in every file, not translated per-active-language) — same convention already used for `settings.spanish`/`settings.german`/`settings.french`/`settings.portuguese`
- [ ] `app/(tabs)/settings.tsx` needs **no code change** — it already derives its language-row hint text generically from the shared `LANGUAGES` list (fixed in TASK-012); confirm this still holds instead of re-introducing a hardcoded ternary
- [ ] Selecting any of the 4 new languages in Settings immediately re-renders the whole app in that language and persists to `profiles.app_language`
- [ ] Device-locale auto-detection (`lib/i18n.ts`'s `deviceLanguage()`) correctly picks up `ja`/`zh`/`ru`/`nl` as a device locale on first launch
- [ ] `npx tsc --noEmit` passes; manual device check switching through all 10 languages shows correct strings everywhere — in particular check Japanese/Chinese (CJK) and Russian (Cyrillic) glyphs render correctly and not as tofu/missing-glyph boxes (a font-fallback issue, not a translation bug, if it occurs)

## Technical plan

### Files to create
| File | Purpose |
|------|---------|
| `locales/ja.json` | Japanese translation of every key in `locales/en.json` |
| `locales/zh.json` | Chinese (Simplified) translation of every key in `locales/en.json` |
| `locales/ru.json` | Russian translation of every key in `locales/en.json` |
| `locales/nl.json` | Dutch translation of every key in `locales/en.json` |

### Files to modify
| File | Change |
|------|--------|
| `lib/i18n.ts` | Add `"ja"`, `"zh"`, `"ru"`, `"nl"` to `SUPPORTED`; import and register the 4 new JSON files in `resources` |
| `app/settings/language.tsx` | Add 4 entries to the exported `LANGUAGES`: `{ code: "ja", labelKey: "settings.japanese" }`, etc. |
| `locales/en.json`, `locales/it.json`, `locales/es.json`, `locales/de.json`, `locales/fr.json`, `locales/pt.json` | Add `settings.japanese`, `settings.chinese`, `settings.russian`, `settings.dutch` keys (native-form values, identical across all files) |
| `locales/ja.json`, `locales/zh.json`, `locales/ru.json`, `locales/nl.json` | Include the same 4 new keys as part of their initial content, plus the existing `settings.english`/`italian`/`spanish`/`german`/`french`/`portuguese` keys (native-form values, same as every other locale file) |

### Database changes
None — `profiles.app_language` is already free-text.

### Edge functions
None.

### i18n keys
New: `settings.japanese`, `settings.chinese`, `settings.russian`, `settings.dutch` — required in all ten locale files, native-form values. All other keys are 1:1 translations of the existing `locales/en.json` key set.

## Implementation steps
1. Confirm `npm run validate-locales` (TASK-011) passes on the current 6 locale files.
2. Add the 4 new `settings.<lang>` keys to all 6 existing locale files.
3. Write `locales/ja.json`, `locales/zh.json`, `locales/ru.json`, `locales/nl.json` — full translations, including all 10 language-name keys.
4. Update `lib/i18n.ts` (`SUPPORTED` + `resources`).
5. Update `app/settings/language.tsx` (`LANGUAGES` array). Do not touch `app/(tabs)/settings.tsx` — verify its hint text still resolves correctly via the shared list.
6. Run `npm run validate-locales` — fix any reported gaps.
7. `npx tsc --noEmit`.
8. On device: cycle through all 10 languages via Settings → App language, confirm every screen renders correctly, with particular attention to CJK/Cyrillic glyph rendering and any text-wrapping differences (CJK strings are often visually shorter per-character but layout should already be dynamic per CLAUDE.md rule 1 — flag if any screen assumes a fixed width).
9. Commit on `feat/task-013-add-cjk-cyrillic-languages`.

## Testing checklist
- [ ] Works on free tier
- [ ] Works on Pro tier (n/a — no Pro-gated strings affected)
- [ ] Works offline / poor network (n/a — locale files are bundled, not fetched)
- [ ] i18n: tested in all 10 languages, including live-switching between them without app restart
- [ ] No hardcoded pixel values
- [ ] No layout regressions on Giacomo's test device — check CJK/Cyrillic glyph rendering specifically (font-fallback gap vs. translation bug)
- [ ] `validate-locales` passes clean as part of this task's completion

## Dependencies
TASK-011 (locale validation script) and TASK-012 (established the LANGUAGES-list pattern this task follows) — both DONE.

## Notes
- **Do not conflate `app_language` with document/TTS language** — same distinction as TASK-008/TASK-012. This task doesn't touch `hooks/useSpeechPlayer.ts` or `lib/language.ts` at all.
- **RTL is explicitly out of scope.** These 4 languages were chosen because they're LTR. Arabic, Hebrew, and other RTL languages require `I18nManager.forceRTL`/layout-direction handling across the app and should be scoped as a separate, larger task — do not attempt to generalize this task's changes toward RTL support.
- Chinese: use Simplified Chinese (`zh`) for this task; Traditional Chinese (`zh-Hant`) is a separate future addition if ever needed, not part of this task.
- Translation quality: write natural, correctly-rendered translations rather than literal machine-translation artifacts — this is user-facing app chrome. Flag any string you're unsure about in the PR description for Giacomo to spot-check.
