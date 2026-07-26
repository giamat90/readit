# TASK-014: Add Korean, Polish, Turkish, Ukrainian UI languages

## Status: DONE

## Overview
ReadIt currently ships 10 UI languages (English, Italian, Spanish, German, French, Portuguese, Japanese, Chinese Simplified, Russian, Dutch). This task extends UI-language support to 14 total by adding Korean (`ko`), Polish (`pl`), Turkish (`tr`), and Ukrainian (`uk`) — full translations of every existing key, wired into `i18next` and the language picker. All four are left-to-right — **no RTL layout work is in scope**. Polish and Turkish are Latin-script (same risk category as `es`/`de`/`fr`/`pt`/`nl` — diacritics only, e.g. Polish `ą ę ł ń ś ź ż`, Turkish `ç ğ ı ş ö ü`). Ukrainian is Cyrillic, reusing the script-rendering path already validated by TASK-013's Russian addition. Korean (Hangul) is the one genuinely new script family in this batch and is the main thing to verify on-device. As with every prior batch, this is UI-chrome language only and has no relation to a document's detected spoken language or TTS voice selection.

## User story
As a user whose device or preferred language is Korean, Polish, Turkish, or Ukrainian, I want the app's own interface to display in that language, so ReadIt feels native rather than defaulting to English.

## Acceptance criteria
- [ ] `locales/ko.json`, `locales/pl.json`, `locales/tr.json`, `locales/uk.json` exist, each containing every key currently present in `locales/en.json`, fully translated (no leftover English placeholder strings, no missing keys)
- [ ] `npm run validate-locales` passes clean across all 14 locale files
- [ ] `lib/i18n.ts`'s `SUPPORTED` array and `resources` map include all 4 new codes
- [ ] `app/settings/language.tsx`'s exported `LANGUAGES` array includes all 4 new entries, each pointing at a new `settings.<lang>` key (`settings.korean`, `settings.polish`, `settings.turkish`, `settings.ukrainian`)
- [ ] The 4 new `settings.<lang>` keys exist in **all fourteen** locale files, using each language's own native name identically everywhere (e.g. `"korean": "한국어"` in every file, not translated per-active-language) — same convention as every prior batch
- [ ] `app/(tabs)/settings.tsx` needs **no code change** — it already derives its language-row hint text generically from the shared `LANGUAGES` list (TASK-012); confirm this still holds
- [ ] Selecting any of the 4 new languages in Settings immediately re-renders the whole app in that language and persists to `profiles.app_language`
- [ ] Device-locale auto-detection (`lib/i18n.ts`'s `deviceLanguage()`) correctly picks up `ko`/`pl`/`tr`/`uk` as a device locale on first launch
- [ ] `npx tsc --noEmit` passes; manual device check switching through all 14 languages shows correct strings everywhere — in particular check Korean (Hangul) glyph rendering, since it's a new script family for this app (Polish/Turkish are Latin like existing languages; Ukrainian is Cyrillic, already proven by Russian)

## Technical plan

### Files to create
| File | Purpose |
|------|---------|
| `locales/ko.json` | Korean translation of every key in `locales/en.json` |
| `locales/pl.json` | Polish translation of every key in `locales/en.json` |
| `locales/tr.json` | Turkish translation of every key in `locales/en.json` |
| `locales/uk.json` | Ukrainian translation of every key in `locales/en.json` |

### Files to modify
| File | Change |
|------|--------|
| `lib/i18n.ts` | Add `"ko"`, `"pl"`, `"tr"`, `"uk"` to `SUPPORTED`; import and register the 4 new JSON files in `resources` |
| `app/settings/language.tsx` | Add 4 entries to the exported `LANGUAGES`: `{ code: "ko", labelKey: "settings.korean" }`, etc. |
| `locales/en.json`, `locales/it.json`, `locales/es.json`, `locales/de.json`, `locales/fr.json`, `locales/pt.json`, `locales/ja.json`, `locales/zh.json`, `locales/ru.json`, `locales/nl.json` | Add `settings.korean`, `settings.polish`, `settings.turkish`, `settings.ukrainian` keys (native-form values, identical across all files) |
| `locales/ko.json`, `locales/pl.json`, `locales/tr.json`, `locales/uk.json` | Include the same 4 new keys plus all 10 existing `settings.<lang>` keys (native-form values, same as every other locale file) as part of their initial content |

### Database changes
None — `profiles.app_language` is already free-text.

### Edge functions
None.

### i18n keys
New: `settings.korean`, `settings.polish`, `settings.turkish`, `settings.ukrainian` — required in all 14 locale files, native-form values (`한국어`, `Polski`, `Türkçe`, `Українська`). All other keys are 1:1 translations of the existing `locales/en.json` key set.

## Implementation steps
1. Confirm `npm run validate-locales` passes on the current 10 locale files.
2. Add the 4 new `settings.<lang>` keys to all 10 existing locale files.
3. Write `locales/ko.json`, `locales/pl.json`, `locales/tr.json`, `locales/uk.json` — full translations, including all 14 language-name keys.
4. Update `lib/i18n.ts` (`SUPPORTED` + `resources`).
5. Update `app/settings/language.tsx` (`LANGUAGES` array). Do not touch `app/(tabs)/settings.tsx` — verify its hint text still resolves correctly via the shared list.
6. Run `npm run validate-locales` — fix any reported gaps.
7. `npx tsc --noEmit`.
8. On device: cycle through all 14 languages via Settings → App language, confirm every screen renders correctly. Pay particular attention to Korean (Hangul) — the one new script family in this batch — and check Polish/Turkish diacritics (ą, ę, ł, ń, ś, ź, ż / ç, ğ, ı, ş, ö, ü) don't get mangled or dropped in any text component.
9. Commit on `feat/task-014-add-ko-pl-tr-uk-languages`.

## Testing checklist
- [ ] Works on free tier
- [ ] Works on Pro tier (n/a — no Pro-gated strings affected)
- [ ] Works offline / poor network (n/a — locale files are bundled, not fetched)
- [ ] i18n: tested in all 14 languages, including live-switching between them without app restart
- [ ] No hardcoded pixel values
- [ ] No layout regressions on Giacomo's test device — check Korean glyph rendering specifically (new script family, font-fallback risk) and Polish/Turkish diacritic rendering
- [ ] `validate-locales` passes clean as part of this task's completion

## Dependencies
TASK-011 (locale validation script), TASK-012 (established the shared `LANGUAGES`-list pattern), TASK-013 (validated the Cyrillic rendering path Ukrainian reuses) — all DONE.

## Notes
- **Do not conflate `app_language` with document/TTS language** — same distinction as every prior i18n task. This task doesn't touch `hooks/useSpeechPlayer.ts` or `lib/language.ts` at all.
- **RTL remains explicitly out of scope.** Arabic, Hebrew, and other RTL languages require `I18nManager.forceRTL`/layout-direction handling across the app and should stay a separate, larger future task.
- Ukrainian and Russian are distinct languages, not variants — do not copy `ru.json` verbatim; translate independently (they share a script, not a vocabulary).
- Translation quality: write natural, correctly-rendered translations rather than literal machine-translation artifacts — this is user-facing app chrome. Flag any string you're unsure about in the PR description for Giacomo to spot-check.
