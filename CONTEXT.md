# ReadIt — Project Context

## What it is
Android app: give it a text resource — pasted text, web page URL, PDF, or a photo of printed text — and it reads it aloud (TTS). Library with resume, speed control, voice selection. Freemium via RevenueCat.

## Tech Stack
- **Framework**: Expo (React Native) SDK 55 + TypeScript + Expo Router
- **Backend**: Supabase (auth, Postgres, edge functions, storage)
- **Extraction**: edge functions — Readability (web), unpdf (PDF), Claude vision OCR (photo, pending deploy)
- **TTS**: expo-speech on-device (v1.0); neural voices via edge function + expo-av (v1.1, Pro)
- **Payments**: RevenueCat (react-native-purchases) — not yet integrated (TASK-009)
- **Styling**: NativeWind (Tailwind for RN)
- **State**: Zustand (`store/user.ts`, `store/library.ts`, `store/player.ts`)
- **Build**: local Gradle via the `.bat` scripts (see below); EAS not yet configured (no `eas.json`, no project id)

## Repository
- **GitHub**: https://github.com/giamat90/readit (public)
- `main` — everything TESTED below, fully pushed, working tree clean as of this session's end
- `feat/task-007-photo-import` — pushed, paused (see TASK-007 status)

## Supabase
- Project ref: `yhifdsfjbiitxxzulnhp` (Central EU) — URL + anon key live in gitignored `.env` (template: `.env.example`); DB password also in `.env` as `SUPABASE_DB_PASSWORD` (used for direct-Postgres migration runs, e.g. via the `pg` npm package from the scratchpad — see any TASK-00X commit around a migration for the pattern)
- Migrations applied: 001 (profiles + RLS + auto-create trigger), 002 (documents/document_chunks/playback_positions + RLS), 003 (pdf-uploads private storage bucket + RLS), 004 (photo-uploads private storage bucket + RLS)
- Edge functions deployed: `extract-web`, `extract-pdf`. **`extract-photo` is written but NOT deployed** — blocked on `ANTHROPIC_API_KEY` (see TASK-007)
- Supabase CLI is logged in and linked to this project on Giacomo's machine — deploys can be run directly from a session without round-tripping through Giacomo, once he's done the one-time `supabase login` himself in his own terminal

## Package / Bundle IDs
- Android package: `com.giamat90.readit`
- iOS bundle ID: `com.giamat90.readit` (iOS out of scope for v1.0)

## App icon
- `assets/images/app-icon.png` / `adaptive-icon.png` — navy book mark, no wordmark (a v1 with the "ReadIt" wordmark was replaced after the mark was found to sit too close to the adaptive-icon safe-zone edge). Adaptive icon background `#283A5F`.
- **Icon/native-config changes require `npx expo prebuild --platform android --clean` before the next build** — the native `android/` project is generated once and does not re-read `app.json` afterward. Both release scripts (`deploy_local_release_android.bat`, `build_bundle_android_release.bat`) do this automatically now; the debug script does not.
- Android's launcher also caches icons aggressively — an overlay reinstall (`adb install -r`, or `expo run:android`'s own install step) often shows the old icon even with a correct APK. A full `adb uninstall` + fresh `adb install` reliably clears it. `deploy_local_release_android.bat` does this automatically.

## Current state (end of session, 2026-07-20)
Nine tasks merged and device-TESTED on `main` (see checklist). App icon added. Local build/deploy `.bat` scripts (mirroring GreenThumb) added and hardened. GitHub repo created and pushed. Working tree clean, nothing uncommitted.

No dev server is guaranteed running at session start — Metro was started/stopped many times this session and should be assumed **not running**; start fresh with `npx expo start` (or one of the deploy scripts) rather than assuming a live instance.

## Status checklist
- [x] CLAUDE.md, CONTEXT.md, tasks/TEMPLATE.md written
- [x] TASK-001 — project scaffold — TESTED, merged
- [x] TASK-002 — Supabase auth (email/password), profiles — TESTED, merged
- [x] TASK-003 — paste → chunk → listen (expo-speech, en/it voice detection) — TESTED, merged
- [x] TASK-004 — documents persisted, library list, resume — TESTED, merged
- [x] TASK-005 — web import (`extract-web` edge function, deployed) — TESTED, merged
- [x] TASK-006 — PDF import (`extract-pdf` edge function, deployed) — TESTED, merged
- [x] TASK-008 — settings: voice/rate/language preferences — TESTED, merged
- [ ] TASK-007 — photo import (`extract-photo` edge function) — **PAUSED**, code complete on `feat/task-007-photo-import`, migration 004 applied, function NOT deployed. Needs: (1) `ANTHROPIC_API_KEY` as a Supabase secret, (2) native rebuild (`expo-image-picker`/`expo-image-manipulator` are new native modules), (3) device test. Giacomo's call on when to resume.
- [ ] TASK-009 — RevenueCat + Pro gating + import quotas — not yet specced this session; natural next task
- [ ] TASK-010 — polish, error states, EAS build, Play Store prep — not started

## What "continue" should mean next session
Two independent threads, pick either (or ask Giacomo which he wants):
1. **Resume TASK-007**: get the Anthropic key into a Supabase secret, deploy `extract-photo`, native-rebuild, device-test, merge. Closes out all four v1.0 import paths.
2. **Spec + implement TASK-009**: RevenueCat integration, Pro gating, import quotas. Needs Giacomo's pricing confirmation first (see Open Questions) and a RevenueCat account/API keys — expect another credentials handoff similar to the Supabase ones.

Either is a reasonable default; TASK-009 is the literal next line in the roadmap, but TASK-007 is closer to done (just blocked on one secret) and finishes a fully self-contained feature.

## Decisions made (and why)
- **Server-side extraction** for web/PDF/photo: keeps the RN client free of heavy parsing deps; matches the GreenThumb edge-function pattern; Claude vision doubles as a high-quality OCR.
- **expo-speech first, neural later**: zero-cost TTS ships v1.0 fast; neural voices + background playback become the Pro upsell in v1.1.
- **Paste-text as first playable milestone** (TASK-003): proves the whole player loop without any backend extraction dependency.
- **App language ≠ document language**: Settings' "App language" only changes UI chrome; what voice reads a given document is resolved independently per-document (paste: client-side stopword heuristic; web: HTML `lang` + same heuristic fallback; PDF: same heuristic server-side). This distinction caused one real bug (TASK-008 session) where fresh PDF/web imports ignored their own detected language because the importer screens never read the server-computed `language` back — fixed via `getDocumentMeta()`.

## Open questions for Giacomo
1. Confirm pricing tiers (proposal: Free = paste/web unlimited + 3 PDF/photo per month; Pro €2.99/mo, €24.99/yr).
2. Which neural TTS provider for v1.1 (Google Cloud TTS / Azure / ElevenLabs)? Affects cost per minute.
3. Launch languages: en + it confirmed?
4. When to resume TASK-007 (photo import) — needs the Anthropic API key.
