# ReadIt

Text-to-speech reader app for Android. Give it a text — a PDF, a web page, a photo, or pasted text — and it reads it aloud. The main goal: let the user **listen** to any text resource instead of reading it.

Solo founder project — Giacomo is PO and tester. Development is done via two Claude Code instances working in tandem.

## Two-instance workflow

This project uses a Tech Lead + Developer pattern (same as GreenThumb / GermanBuddy):

- **Tech Lead (Instance 1)**: plan mode. Analyzes the codebase, writes detailed task specs into `tasks/TASK-xxx.md`. NEVER writes production code directly.
- **Developer (Instance 2)**: execution mode. Reads task specs from `tasks/`, implements exactly as specified, commits on feature branches.
- **Giacomo**: Chooses features, approves task specs, tests on device, merges PRs.

The `tasks/` folder is the handoff point. Tech Lead writes, Developer reads. Both instances must check `tasks/` for context. Task status: DRAFT → APPROVED → IN_PROGRESS → DONE → TESTED.

## Stack

- Expo React Native SDK 55 + TypeScript + Expo Router
- Supabase (auth, database, edge functions, storage)
- NativeWind (Tailwind for RN)
- Zustand (state management)
- Lucide icons
- expo-speech (on-device TTS, v1.0) / expo-av (neural audio playback, v1.1)
- expo-document-picker (PDF), expo-image-picker (photo)
- Anthropic Claude via Supabase Edge Functions (photo OCR, text cleanup)
- RevenueCat (Pro subscription)
- EAS Build (Expo Application Services)

Android package / iOS bundle ID: `com.giamat90.readit`

## Product architecture

### The core loop
**import → extract → listen → resume**

1. **Import** — user provides a resource:
   - *Pasted text*: paste directly into the app (simplest path, always works)
   - *Web page*: paste/share a URL
   - *PDF*: pick a file from device
   - *Photo*: camera or gallery shot of printed text
2. **Extract** — text is extracted server-side and stored as an ordered list of chunks
3. **Listen** — TTS player reads chunks aloud with play/pause, skip ±paragraph, speed control (0.5×–2×), voice/language selection
4. **Resume** — playback position is persisted per document; the library shows progress

### Extraction pipeline (Supabase Edge Functions)

All extraction is server-side — the client stays thin and never parses PDFs/HTML itself.

| Edge function | Input | Method |
|---------------|-------|--------|
| `extract-web` | URL | fetch + Mozilla Readability (Deno) → clean article text |
| `extract-pdf` | Supabase Storage path of uploaded PDF | `unpdf` text extraction |
| `extract-photo` | image (base64) | Claude vision OCR — returns clean reading-order text |

Each function: extracts → normalizes (strip boilerplate, fix hyphenation) → splits into ~1000-char chunks on paragraph/sentence boundaries → inserts `documents` row + `document_chunks` rows → returns document id. Client polls/receives `status: ready`.

Pasted text skips edge functions entirely: chunked client-side, inserted directly.

### TTS strategy

- **v1.0 (Free + Pro)**: `expo-speech` — on-device, offline, zero cost. Player drives chunk-by-chunk: speak chunk N, on `onDone` advance to N+1. Known limitation: playback pauses when app is backgrounded on some devices — documented, not fought in v1.0.
- **v1.1 (Pro)**: neural voices via a `tts-neural` edge function (cloud TTS provider TBD), audio cached in Supabase Storage, played with `expo-av` → true background/lock-screen playback with media controls. This is the Pro headline feature.

### Zustand stores

- `store/user.ts` — auth session, `isPro`, preferences (voice, rate, theme)
- `store/library.ts` — documents list, import status, pagination
- `store/player.ts` — current document, chunk index, playing state, rate; drives expo-speech

### Screens (Expo Router)

```
app/
├── (tabs)/
│   ├── index.tsx        # Library — document list w/ progress, FAB import menu
│   └── settings.tsx     # Voice, rate default, language, account, Pro
├── import/
│   ├── paste.tsx        # Paste text
│   ├── web.tsx          # URL input (+ Android share-intent target)
│   ├── pdf.tsx          # Document picker flow
│   └── photo.tsx        # Camera/gallery flow
├── player/[id].tsx      # Player: text view w/ highlighted current chunk + controls
└── auth/                # Sign in / sign up (Supabase auth)
```

## Database schema (Supabase Postgres)

Migrations tracked numerically starting at 001. Always increment, never reuse numbers. RLS on every table: users only see their own rows.

```sql
-- 001
CREATE TABLE profiles (
    id              UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
    is_pro          BOOLEAN DEFAULT false,
    preferred_voice TEXT,
    preferred_rate  FLOAT DEFAULT 1.0,
    app_language    TEXT DEFAULT 'en',
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE documents (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID REFERENCES auth.users ON DELETE CASCADE,
    title        TEXT NOT NULL,
    source_type  TEXT NOT NULL CHECK (source_type IN ('paste','web','pdf','photo')),
    source_ref   TEXT,              -- URL or storage path; null for paste
    language     TEXT,              -- BCP-47, detected at extraction
    char_count   INT DEFAULT 0,
    chunk_count  INT DEFAULT 0,
    status       TEXT NOT NULL DEFAULT 'processing'
                 CHECK (status IN ('processing','ready','error')),
    error_msg    TEXT,
    created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE document_chunks (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id  UUID REFERENCES documents ON DELETE CASCADE,
    seq          INT NOT NULL,
    content      TEXT NOT NULL,
    UNIQUE(document_id, seq)
);

CREATE TABLE playback_positions (
    document_id  UUID REFERENCES documents ON DELETE CASCADE,
    user_id      UUID REFERENCES auth.users ON DELETE CASCADE,
    chunk_seq    INT DEFAULT 0,
    updated_at   TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (document_id, user_id)
);
```

## Pricing (proposal — Giacomo to confirm before paywall task)

- **Free**: unlimited pasted text + web pages, 3 PDF/photo imports per month, on-device voices
- **Pro**: €2.99/month or €24.99/year, 7-day free trial — unlimited PDF/photo imports, neural voices + background playback (v1.1), audio export (v1.2)
- Pro gating via `useProGate` hook + `ProUpgradeModal` component (same pattern as GreenThumb)

## Critical rules — NEVER violate (carried over from GreenThumb, hard-won)

1. **NEVER use hardcoded pixel values for layout spacing** — always use `onLayout` dynamic measurement
2. **Edge function auth**: use direct `fetch()` with Bearer token + anon key pattern, NOT `supabase.functions.invoke()` (causes JWT 401 errors)
3. **i18n**: duplicate JSON keys silently break translations — always validate locale files
4. **Migrations**: tracked numerically. Always increment, never reuse numbers
5. **Extraction fetch functions**: define outside component scope to avoid infinite re-render loops
6. **Never log document content** — only metadata (document_id, source_type, char_count). Users may import private texts
7. **expo-speech chunk advance**: drive from `onDone` callback, never `setTimeout` estimates

## Supabase Edge Functions — Deploy Protocol

The Developer instance must **NOT** run deploy commands itself. It must stop and instruct Giacomo to run them manually, labeled as **"⚡ Manual Deploy Step"** in its completion report:

```bash
npx supabase login                       # first time only
npx supabase link --project-ref <ref>    # first time only
npx supabase functions deploy <function-name>
npx supabase secrets list                # verify secrets if needed
```

Wait for Giacomo to confirm before considering the task complete.

## Commands

```bash
npx expo start                                   # dev server
npx expo run:android                             # run on Giacomo's Moto G 5G (serial ZY22BHCRLF; auto-picked when it's the only device)
eas build --profile preview --platform android   # preview APK (cloud, once eas.json exists)
eas build --profile production --platform android
```

### Local build scripts (mirrors GreenThumb)

```
deploy_local_debug_android.bat      # npx expo run:android — debug build to connected device
deploy_local_release_android.bat    # npx expo run:android --variant release — release build to connected device
build_bundle_android_release.bat    # gradlew bundleRelease -> Bundles/app-release-vX.Y.Z-N.aab (Play Store artifact)
build_get_version.ps1               # helper: reads version/versionCode from app.json — used by build_bundle_android_release.bat
```

`build_bundle_android_release.bat` requires a generated `android/` project (`npx expo run:android` / `npx expo prebuild` at least once) and reads version info straight from `app.json`, so bump `version`/`android.versionCode` there before cutting a release bundle.

## v1.0 scope

### IN
- Supabase auth (email + Google)
- All four import paths: paste, web URL, PDF, photo (Claude OCR)
- On-device TTS player: play/pause, skip paragraph, speed 0.5×–2×, voice picker
- Current-chunk highlighting in the text view while speaking
- Library with per-document progress + resume
- Free/Pro gating with RevenueCat
- i18n: en + it at launch
- Android only

### OUT (v1.1+)
- Neural voices + true background playback (v1.1, Pro headline)
- Android share-sheet target ("Share → ReadIt") (v1.1)
- Audio file export (v1.2)
- EPUB support, iOS, web version, folders/tags, sleep timer

## Task roadmap (v1.0)

| Task | Scope |
|------|-------|
| TASK-001 | Project scaffold: Expo SDK 55 + TS + Expo Router + NativeWind + Zustand + Lucide, tab shell, theme |
| TASK-002 | Supabase project + auth flow + `profiles` (migration 001) |
| TASK-003 | Core loop MVP: paste text → chunking → expo-speech player with controls + highlighting |
| TASK-004 | `documents`/`document_chunks`/`playback_positions` tables, library screen, resume |
| TASK-005 | Web import: `extract-web` edge function + URL screen |
| TASK-006 | PDF import: storage upload + `extract-pdf` edge function |
| TASK-007 | Photo import: `extract-photo` edge function (Claude vision OCR) |
| TASK-008 | Settings: voice picker, default rate, app language, i18n en/it |
| TASK-009 | RevenueCat + Pro gating + import quotas |
| TASK-010 | Polish, error states, EAS preview build, Play Store prep |

## Task spec format

All task specs go in `tasks/TASK-xxx.md` — see `tasks/TEMPLATE.md`. Tech Lead writes the spec, Developer implements it.

## Coding conventions

- TypeScript strict; shared types in `types/index.ts`
- Conventional commits (`feat:`, `fix:`, `chore:`, `refactor:`) referencing the task
- Never commit `.env`, API keys, or service account files
- All user-facing strings through i18n from day one — no hardcoded copy
