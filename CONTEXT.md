# ReadIt — Project Context

## What it is
Android app: give it a text resource — pasted text, web page URL, PDF, or a photo of printed text — and it reads it aloud (TTS). Library with resume, speed control, voice selection. Freemium via RevenueCat.

## Tech Stack
- **Framework**: Expo (React Native) SDK 55 + TypeScript + Expo Router
- **Backend**: Supabase (auth, Postgres, edge functions, storage)
- **Extraction**: edge functions — Readability (web), unpdf (PDF), Claude vision OCR (photo)
- **TTS**: expo-speech on-device (v1.0); neural voices via edge function + expo-av (v1.1, Pro)
- **Payments**: RevenueCat (react-native-purchases)
- **Styling**: NativeWind (Tailwind for RN)
- **State**: Zustand (`store/user.ts`, `store/library.ts`, `store/player.ts`)
- **Build**: EAS Build

## Package / Bundle IDs
- Android package: `com.giamat90.readit`
- iOS bundle ID: `com.giamat90.readit` (iOS out of scope for v1.0)

## Current state
Scaffold TESTED on device (Moto G 5G, serial ZY22BHCRLF) and merged to `main`: tab shell, i18n en/it, store skeletons. Next: TASK-002 (Supabase + auth).

## Status checklist
- [x] CLAUDE.md, CONTEXT.md, tasks/TEMPLATE.md written
- [x] TASK-001 specced and APPROVED (project scaffold)
- [x] TASK-001 implemented, device-TESTED, merged to `main`
- [ ] TASK-002 specced (DRAFT) — awaiting Giacomo's approval
- [ ] Supabase project created (Giacomo: create at supabase.com, note project ref)
- [ ] Auth flow (TASK-002)
- [ ] Core loop: paste → listen (TASK-003)
- [ ] Library + resume (TASK-004)
- [ ] Web / PDF / photo import (TASK-005..007)
- [ ] Settings + i18n (TASK-008)
- [ ] RevenueCat + Pro gating (TASK-009) — pricing proposal in CLAUDE.md needs Giacomo's confirmation
- [ ] EAS build + Play Store prep (TASK-010)

## Decisions made (and why)
- **Server-side extraction** for web/PDF/photo: keeps the RN client free of heavy parsing deps; matches the GreenThumb edge-function pattern; Claude vision doubles as a high-quality OCR.
- **expo-speech first, neural later**: zero-cost TTS ships v1.0 fast; neural voices + background playback become the Pro upsell in v1.1.
- **Paste-text as first playable milestone** (TASK-003): proves the whole player loop without any backend extraction dependency.

## Open questions for Giacomo
1. Confirm pricing tiers (proposal: Free = paste/web unlimited + 3 PDF/photo per month; Pro €2.99/mo, €24.99/yr).
2. Which neural TTS provider for v1.1 (Google Cloud TTS / Azure / ElevenLabs)? Affects cost per minute.
3. Launch languages: en + it confirmed?
