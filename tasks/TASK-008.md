# TASK-008: Settings — voice picker, default speed, app language

## Status: DRAFT

## Overview
Replace the three "Coming soon" placeholder rows in Settings with working preferences: a TTS voice picker (per language, sourced from the device's installed voices), a default playback speed, and an app display-language switch (en/it). Preferences persist to the `profiles` row (already in the schema since migration 001: `preferred_voice`, `preferred_rate`, `app_language`) and apply as defaults the next time a document is opened. This task makes ReadIt's copy and voice actually configurable instead of hardcoded to device locale.

## User story
As a user, I want to choose my preferred voice and reading speed once, so I don't have to adjust them every time I open a document.

## Acceptance criteria
- [ ] Tapping "Voice" opens a picker listing voices available on-device via `expo-speech`'s `getAvailableVoicesAsync()`, grouped/filterable by language; selecting one saves to `profiles.preferred_voice` and shows it as the row's current value
- [ ] Tapping "Reading speed" opens the same rate options as the player's cycle (0.75×–2×) as a picker (not a slider — consistency with the player's discrete steps); selection saves to `profiles.preferred_rate`
- [ ] Tapping "App language" offers English / Italiano; selecting one calls `i18n.changeLanguage()` immediately (whole app re-renders in the new language without restart) and saves to `profiles.app_language`
- [ ] On app launch (after auth), saved preferences load into `useUserStore` and `i18n` is set from `profiles.app_language` if present (overriding device-locale detection)
- [ ] Player screen uses `preferredVoice`/`preferredRate` as the starting rate/voice for a document that has no per-document override yet (a pasted doc's auto-detected language still wins for voice *language*, but the specific voice name and starting speed come from preferences)
- [ ] All three rows show their current value as the trailing hint text (replacing "Coming soon")
- [ ] Offline: preference changes still apply locally/instantly; Supabase sync is fire-and-forget (same pattern as `upsertPosition`) and silently retried on next successful call, not blocking the UI
- [ ] `npx tsc --noEmit` passes; works on device; no native rebuild needed (no new native modules)

## Technical plan

### Files to create
| File | Purpose |
|------|---------|
| `app/settings/voice.tsx` | Voice picker screen: list from `Speech.getAvailableVoicesAsync()`, filtered to the current `app_language`'s locale family plus an "all languages" toggle; radio-style selection |
| `app/settings/rate.tsx` | Simple list of the 5 rate steps (reuse `RATE_STEPS` from `hooks/useSpeechPlayer.ts`), radio-style selection |
| `app/settings/language.tsx` | Two-row list: English / Italiano |
| `app/settings/_layout.tsx` | Stack for the three sub-screens, headers with back button |
| `lib/preferences.ts` | `updatePreferences(partial: Partial<Pick<Profile,'preferred_voice'|'preferred_rate'|'app_language'>>)` — upserts into `profiles`, fire-and-forget pattern like `upsertPosition` |

### Files to modify
| File | Change |
|------|--------|
| `app/(tabs)/settings.tsx` | Rows navigate to the three sub-screens instead of showing "Coming soon"; hint text shows current value from `useUserStore` |
| `app/_layout.tsx` | After `fetchProfile`, if `profile.app_language` differs from current `i18n.language`, call `i18n.changeLanguage(profile.app_language)` |
| `store/user.ts` | Already has `preferredVoice`/`preferredRate` (TASK-002); add nothing new — just confirm `setProfile` keeps them in sync (it already does) |
| `store/player.ts` / `hooks/useSpeechPlayer.ts` | When loading a document with no explicit `language` override already resolved to a specific voice, seed `rate` from `useUserStore.preferredRate` and pass `voice: useUserStore.preferredVoice` to `Speech.speak` when its language matches the document's detected language |
| `app/import/paste.tsx`, `paste`/`web`/`pdf`/`photo` flows | No change needed — they already call `loadDocument`; rate/voice seeding happens inside the player/hook, not per-importer |

### Database changes
None — `profiles.preferred_voice`, `preferred_rate`, `app_language` already exist (migration 001).

### Edge functions
None.

### i18n keys
`settings.voiceDefault` ("Device default"), `settings.selectVoice`, `settings.selectRate`, `settings.selectLanguage`, `settings.english`, `settings.italian` — en + it.

## Implementation steps
1. Write `lib/preferences.ts`
2. Build the three sub-screens + `_layout.tsx`
3. Wire Settings rows to navigate + show current values
4. Wire app-language sync in `app/_layout.tsx` on profile load
5. Wire rate/voice seeding into `useSpeechPlayer`
6. i18n keys; `npx tsc --noEmit`
7. Reload on device (JS-only), verify acceptance criteria incl. immediate language switch with no restart; commit on `feat/task-008-settings`

## Testing checklist
- [ ] Works on free tier (no gating yet)
- [ ] Works on Pro tier (n/a)
- [ ] Works offline / poor network: preference changes apply instantly regardless of connectivity
- [ ] i18n: tested in en + it, including the live-switch itself (English → Italiano → English without app restart)
- [ ] No hardcoded pixel values
- [ ] No layout regressions on Moto G 5G
- [ ] Selecting a voice whose language doesn't match a document being played doesn't silently break playback (document's detected language still governs which voice family applies)
- [ ] Preferences survive app restart (loaded from `profiles` on next launch)

## Dependencies
TASK-002 (profiles/auth), TASK-003 (player + RATE_STEPS) — both TESTED.

## Notes
- `getAvailableVoicesAsync()` result varies a lot by device/Android version/installed TTS engines — handle an empty or very long list gracefully (search/filter, not just a raw dump).
- Changing `app_language` must not be confused with a document's spoken `language` — they're independent: app_language is UI chrome (English/Italian labels), the per-document `language` field (TASK-003/005/006/007) governs what the voice speaks. Keep these clearly separated in the code and comments to avoid future confusion.
- This is a good moment to also surface a "Device default" option for voice (i.e. `preferred_voice = null`, falls back to the existing detect-or-locale logic) — don't force a specific voice selection.
- No native rebuild required — good candidate to ship fast between the heavier extraction tasks.
