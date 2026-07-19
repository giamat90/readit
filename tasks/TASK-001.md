# TASK-001: Project scaffold — Expo app shell

## Status: DONE

## Overview
Bootstrap the ReadIt Expo application: Expo SDK 55 + TypeScript + Expo Router + NativeWind + Zustand + Lucide icons, with the tab shell, theme constants, and placeholder screens. No backend, no TTS yet — this task delivers a running app on device with navigation in place, so every later task lands in a working shell.

## User story
As the developer, I want a correctly configured project skeleton so that all subsequent features are built on the agreed stack without rework.

## Acceptance criteria
- [ ] `npx expo start` runs; app installs and launches on Giacomo's Moto G 5G via `npx expo run:android` (serial ZY22BHCRLF — GreenThumb's docs say ...G, which is wrong for this device)
- [ ] Two tabs render: **Library** (empty state: "Import something to start listening" + disabled FAB) and **Settings** (placeholder list)
- [ ] NativeWind classes style all placeholder UI; dark mode follows system
- [ ] TypeScript strict mode passes with `npx tsc --noEmit`
- [ ] Android package is `com.giamat90.readit`
- [ ] Zustand stores exist as typed skeletons (no logic): `store/user.ts`, `store/library.ts`, `store/player.ts`
- [ ] i18n wired (i18n-js or expo-localization pattern) with `locales/en.json` + `locales/it.json`; all placeholder copy goes through it

## Technical plan

### Files to create
| File | Purpose |
|------|---------|
| `app.json` | Expo config — name "ReadIt", package `com.giamat90.readit`, scheme `readit` |
| `app/_layout.tsx` | Root layout: fonts, theme provider, i18n init |
| `app/(tabs)/_layout.tsx` | Tab navigator (Lucide `Library` + `Settings` icons) |
| `app/(tabs)/index.tsx` | Library screen placeholder + empty state |
| `app/(tabs)/settings.tsx` | Settings screen placeholder |
| `store/user.ts` | Typed Zustand store skeleton (session, isPro, preferences) |
| `store/library.ts` | Typed Zustand store skeleton (documents, status) |
| `store/player.ts` | Typed Zustand store skeleton (docId, chunkIndex, isPlaying, rate) |
| `types/index.ts` | `Document`, `DocumentChunk`, `PlaybackPosition`, `SourceType` types mirroring CLAUDE.md schema |
| `constants/index.ts` | COLORS, CONFIG (chunk size 1000, rate bounds 0.5–2.0) |
| `lib/i18n.ts` | i18n setup, device-locale detection, en fallback |
| `locales/en.json`, `locales/it.json` | Launch languages |
| `global.css`, `tailwind.config.js`, `metro.config.js`, `babel.config.js` | NativeWind wiring |
| `tsconfig.json` | strict: true, path alias `@/*` |

### Files to modify
None — greenfield.

### Database changes
None (TASK-002).

### Edge functions
None.

### i18n keys
`library.title`, `library.empty`, `settings.title`, `tabs.library`, `tabs.settings` — en + it.

## Implementation steps
1. `npx create-expo-app@latest . --template` (SDK 55, TypeScript, Expo Router template) in the repo root; `git init` and initial commit
2. Install and configure NativeWind per official Expo SDK 55 guide (babel preset, metro CSS, `global.css`)
3. Install `zustand`, `lucide-react-native`, `react-native-svg`, `i18n-js`, `expo-localization`
4. Set `app.json` identifiers and scheme; enable `userInterfaceStyle: "automatic"`
5. Build tab layout + two placeholder screens, all copy via i18n
6. Add store skeletons, types, constants
7. Verify `npx tsc --noEmit` clean, run on device, commit `feat: project scaffold (TASK-001)` on branch `feat/task-001-scaffold`

## Testing checklist
- [ ] Works on free tier (n/a — no gating yet)
- [ ] Works on Pro tier (n/a)
- [ ] Works offline (app is fully local at this stage)
- [ ] i18n: tested in en + it (switch device language)
- [ ] No hardcoded pixel values
- [ ] No layout regressions on Giacomo's test device

## Dependencies
None — first task.

## Notes
- Do NOT install supabase-js, RevenueCat, or expo-speech yet — each arrives with its own task to keep diffs reviewable.
- Keep the FAB visually present but disabled; TASK-003 activates the paste-import path behind it.
- If SDK 55 + NativeWind versions conflict, pin the versions GreenThumb uses (check its `package.json`) — that combination is known-good.
