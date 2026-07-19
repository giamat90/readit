# TASK-003: Core loop MVP — paste text → chunk → listen

## Status: APPROVED

## Overview
The first version of ReadIt that talks. Activate the Library FAB, add a paste-text import screen, a chunking utility, and a TTS player screen driven by expo-speech: play/pause, skip ±paragraph, speed control, and current-chunk highlighting. No persistence yet — the pasted document lives in the player store; TASK-004 adds the database and library. This task proves the entire listening experience end-to-end.

## User story
As a user, I want to paste any text and have the app read it aloud with playback controls so that I can listen instead of reading.

## Acceptance criteria
- [ ] Library FAB is enabled; tapping it navigates to the paste screen
- [ ] Paste screen: optional title field, large multiline text input, "Listen" button disabled while text is empty
- [ ] Tapping "Listen" chunks the text and opens the player, which starts reading aloud automatically
- [ ] Play/pause works; pausing mid-chunk resumes from the start of that chunk (expo-speech cannot resume mid-utterance — accepted limitation)
- [ ] Skip back/forward moves one chunk and keeps speaking if currently playing
- [ ] Speed control cycles 0.75× / 1× / 1.25× / 1.5× / 2×; change applies from the current chunk (restart chunk at new rate)
- [ ] The text view shows all chunks; the chunk being spoken is visually highlighted and auto-scrolled into view
- [ ] Reaching the last chunk ends playback cleanly (button returns to "play" state)
- [ ] Leaving the player screen stops speech (no zombie audio)
- [ ] Screen stays awake while playing (expo-keep-awake)
- [ ] `npx tsc --noEmit` passes; works on device

## Technical plan

### Files to create
| File | Purpose |
|------|---------|
| `lib/chunking.ts` | `chunkText(text: string): string[]` — normalize whitespace, split on paragraph boundaries, merge/split to ~CONFIG.CHUNK_SIZE chars breaking on sentence ends (`.`, `!`, `?`, `…`); never returns empty chunks |
| `hooks/useSpeechPlayer.ts` | The playback engine. Wraps expo-speech; reads/writes `usePlayerStore`. API: `play()`, `pause()`, `toggle()`, `next()`, `prev()`, `setRate(r)`. Chunk advancement ONLY via `Speech.speak`'s `onDone` callback (CLAUDE.md rule 7). Guards against stale `onDone` firing after manual skip (track an utterance id) |
| `app/import/_layout.tsx` | Stack for import screens with header + back |
| `app/import/paste.tsx` | Title input + multiline text area + Listen button → `chunkText`, load into player store, `router.push("/player")` |
| `app/player/index.tsx` | Player screen: title, scrollable chunk list (current chunk highlighted `bg-primary/10` + auto-scroll via ref), transport bar: prev / play-pause / next / rate button. `useKeepAwake()` while playing. `useEffect` cleanup calls `Speech.stop()` |

### Files to modify
| File | Change |
|------|--------|
| `app/(tabs)/index.tsx` | Enable FAB: full opacity, `onPress={() => router.push("/import/paste")}` |
| `app/_layout.tsx` | Register `import` and `player` as root-level Stack screens (headerShown false for player) |
| `store/player.ts` | Add `title: string`, `chunks: string[]`, `loadDocument(title, chunks)`, `reset()`. Keep existing rate clamp |
| `package.json` | Add `expo-speech`, `expo-keep-awake` (both via `npx expo install`) |

### Database changes
None (TASK-004).

### Edge functions
None.

### i18n keys
`import.pasteTitle`, `import.titlePlaceholder`, `import.textPlaceholder`, `import.listen`, `player.speed`, `player.done` — en + it.

## Implementation steps
1. `npx expo install expo-speech expo-keep-awake` (native modules → device test needs `npx expo run:android` rebuild)
2. Implement and manually verify `lib/chunking.ts` (throwaway node script with a long Italian + English sample; check no chunk exceeds ~1200 chars, none empty, sentences not cut mid-word)
3. Implement `store/player.ts` extensions, then `hooks/useSpeechPlayer.ts`
4. Build paste screen + player screen; wire FAB
5. i18n keys en + it; `npx tsc --noEmit`
6. Rebuild on device, verify acceptance criteria, commit on `feat/task-003-core-loop`

## Testing checklist
- [ ] Works on free tier (no gating in this task)
- [ ] Works on Pro tier (n/a)
- [ ] Works offline — expo-speech is on-device; paste → listen must work in airplane mode
- [ ] i18n: tested in en + it
- [ ] No hardcoded pixel values
- [ ] No layout regressions on Moto G 5G
- [ ] Long text (10k+ chars) chunks and plays without jank
- [ ] Italian text is spoken with an Italian voice when device language is Italian (expo-speech `language` option — pass device locale for now; proper per-document language detection comes with extraction tasks)

## Dependencies
TASK-001, TASK-002 (both TESTED).

## Notes
- expo-speech pauses when the app is backgrounded on many Android devices — accepted v1.0 limitation, do not fight it (neural voices + expo-av solve it in v1.1).
- `Speech.speak` has a per-utterance length cap on Android (~4000 chars) — our ~1000-char chunks stay well clear.
- Rate: expo-speech `rate` maps roughly 1:1 on Android; clamp via existing `setRate`.
- Do NOT persist anything in this task; player state resets on app restart. TASK-004 owns persistence and resume.
