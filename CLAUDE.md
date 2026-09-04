# ReadIt

Text-to-speech reader app for Android. Give it a text — a PDF, a web page, a photo, or pasted text — and it reads it aloud. The main goal: let the user **listen** to any text resource instead of reading it.

**Fully standalone / on-device.** No accounts, no backend, no cloud. Everything — documents, chunks, playback positions, preferences — lives on the device. The *only* network request anywhere is the web importer fetching the URL the user pastes. Extraction runs on-device: a hidden WebView (`lib/extraction/`) hosts Mozilla Readability (web) and pdf.js (PDF); photo OCR uses Google ML Kit's bundled on-device model.

Solo founder project — Giacomo is PO and tester. Development is done via two Claude Code instances working in tandem.

## Two-instance workflow

This project uses a Tech Lead + Developer pattern (same as GreenThumb / GermanBuddy):

- **Tech Lead (Instance 1)**: plan mode. Analyzes the codebase, writes detailed task specs into `tasks/TASK-xxx.md`. NEVER writes production code directly.
- **Developer (Instance 2)**: execution mode. Reads task specs from `tasks/`, implements exactly as specified, commits on feature branches.
- **Giacomo**: Chooses features, approves task specs, tests on device, merges PRs.

The `tasks/` folder is the handoff point. Tech Lead writes, Developer reads. Both instances must check `tasks/` for context. Task status: DRAFT → APPROVED → IN_PROGRESS → DONE → TESTED.

## Stack

- Expo React Native SDK 55 + TypeScript + Expo Router
- **On-device storage**: `expo-sqlite` (documents/chunks/positions, schema in `lib/db.ts`) + zustand `persist` → AsyncStorage (preferences)
- **On-device extraction**: hidden `react-native-webview` running bundled `@mozilla/readability` + `pdfjs-dist` (`lib/extraction/`, generated `assets/extraction/engine.html`); `@react-native-ml-kit/text-recognition` for photo OCR
- NativeWind (Tailwind for RN)
- Zustand (state management)
- Lucide icons
- expo-speech (on-device TTS)
- expo-document-picker (PDF), expo-image-picker (photo)
- Local Gradle build via the `.bat` scripts / GitHub Actions

No backend. No auth. No payments. No `@supabase/*`, no RevenueCat.

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

### Extraction pipeline (`lib/extraction/` — all on-device)

The client does all parsing. `lib/documents.ts` orchestrates every path identically: **extract raw text + title → `chunkText` (`lib/chunking.ts`) → `detectLanguage` (`lib/language.ts`) → `saveDocument` into SQLite → return document id.**

| Extractor | Input | Method |
|-----------|-------|--------|
| paste | text | chunked directly, no extractor |
| `extraction/web.ts` | URL | RN `fetch(url)` (the one network call) → hidden WebView runs Mozilla Readability on the HTML → `{title,text,language}`; falls back to a regex tag-strip if the engine fails |
| `extraction/pdf.ts` | picked `file://` PDF | hidden WebView runs pdf.js `getTextContent()` over every page (reads the file via `fetch('file://')` so bytes don't cross the RN bridge) |
| `extraction/photo.ts` | image `uri` | `@react-native-ml-kit/text-recognition` on-device OCR |

`lib/extraction/engine.tsx` mounts one hidden `<ExtractionEngine/>` WebView in `app/_layout.tsx`; `runInEngine(op, payload)` is the request/reply bridge. The WebView page is `assets/extraction/engine.html`, **generated** by `npm run build:engine` (`scripts/build-extraction-engine.js`) which inlines Readability + pdf.js + the pdf worker — regenerate and commit it after bumping `@mozilla/readability` or `pdfjs-dist` (both devDependencies).

### TTS strategy

`expo-speech` — on-device, offline, zero cost. Player drives chunk-by-chunk: speak chunk N, on `onDone` advance to N+1 (`hooks/useSpeechPlayer.ts`). Known limitation: playback pauses when the app is backgrounded on some devices — documented, not fought.

### Zustand stores

- `store/preferences.ts` — voice, rate, app language; **persisted** via `persist` → AsyncStorage, rehydrated in `app/_layout.tsx` before first render. `lib/preferences.ts` is a thin snake-case adapter kept so the settings screens didn't change.
- `store/library.ts` — documents list; `fetchDocuments()` reads SQLite via `listDocuments()`, re-run on every tab focus
- `store/player.ts` — current document, chunk index, playing state, rate; drives expo-speech

### Screens (Expo Router)

```
app/
├── (tabs)/
│   ├── index.tsx        # Library — document list w/ progress, FAB import menu
│   └── settings.tsx     # Voice, rate default, app language
├── import/
│   ├── paste.tsx        # Paste text (also links to web/pdf/photo)
│   ├── web.tsx          # URL input
│   ├── pdf.tsx          # Document picker flow
│   └── photo.tsx        # Camera/gallery + on-device OCR
├── player/index.tsx     # Player: text view w/ highlighted current chunk + controls
└── settings/            # voice.tsx, rate.tsx, language.tsx
```

No auth screens — the app opens straight to the library.

## Database schema (on-device SQLite — `lib/db.ts`)

One local database, `readit.db`, opened behind a cached promise. Schema versioned with `PRAGMA user_version` + an append-only `MIGRATIONS` array (never edit/reorder existing entries — add a new one). On a hard migration failure the DB is dropped and recreated (acceptable pre-launch). No `user_id`, no RLS — single implicit local user.

```sql
CREATE TABLE documents (
    id           TEXT PRIMARY KEY,                 -- Crypto.randomUUID()
    title        TEXT NOT NULL,
    source_type  TEXT NOT NULL CHECK (source_type IN ('paste','web','pdf','photo')),
    source_ref   TEXT,                             -- URL or filename; null for paste
    language     TEXT,                             -- BCP-47
    char_count   INTEGER NOT NULL DEFAULT 0,
    chunk_count  INTEGER NOT NULL DEFAULT 0,
    status       TEXT NOT NULL DEFAULT 'ready' CHECK (status IN ('processing','ready','error')),
    error_msg    TEXT,
    created_at   TEXT NOT NULL                     -- ISO 8601
);

CREATE TABLE document_chunks (
    document_id  TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    seq          INTEGER NOT NULL,
    content      TEXT NOT NULL,
    PRIMARY KEY (document_id, seq)
);

CREATE TABLE playback_positions (
    document_id  TEXT PRIMARY KEY REFERENCES documents(id) ON DELETE CASCADE,
    chunk_seq    INTEGER NOT NULL DEFAULT 0,
    updated_at   TEXT NOT NULL
);
```

## Pricing

Free. No payments, no subscription, no import quotas. Everything is unlimited.

## Critical rules — NEVER violate (carried over from GreenThumb, hard-won)

1. **NEVER use hardcoded pixel values for layout spacing** — always use `onLayout` dynamic measurement
2. **i18n**: duplicate JSON keys silently break translations — always run `npm run validate-locales`
3. **SQLite migrations** (`lib/db.ts`): the `MIGRATIONS` array is append-only. Add a new entry, never edit or reorder existing ones
4. **Data-access functions**: define outside component scope (all in `lib/documents.ts`) to avoid infinite re-render loops
5. **Never log document content** — only metadata (source_type, char_count, chunk_count, error codes). Users may import private texts
6. **expo-speech chunk advance**: drive from `onDone` callback, never `setTimeout` estimates
7. **The extraction WebView only ever loads the local `engine.html`** — never point it at remote content. It runs with `allowUniversalAccessFromFileURLs` so it can read the picked PDF; that is safe only because it never navigates
8. **Only one network call may exist in the app**: `fetch(url)` in `lib/extraction/web.ts`. Do not add others
9. **After every merge to `master` and every app version bump**: review whether `readit-support/` needs updating — see "Support site" below. Do this before cutting a release build

## Support site (privacy policy / terms of service)

Legal/support pages live in `readit-support/` — a separate git repo nested inside this working tree (its own `.git`, own remote), pushed to `giamat90/readit-support` on GitHub and served via GitHub Pages at `https://giamat90.github.io/readit-support/`. Contains `privacy-policy.html`, `terms-of-service.html`, `contact.html`, `delete-account.html`, styled with ReadIt's own palette (`constants/index.ts` colors, not GreenThumb's).

This is the URL registered in Google Play Console's Data Safety section — **it must accurately reflect what the shipped app actually does**. The app now collects and shares **nothing** — everything is on-device — so the Data Safety declaration should read "No data collected / No data shared". The one nuance to keep the pages honest about: the web importer makes a direct request from the device to whatever URL the user supplies (no proxy, no logging).

**Checklist to run after every merge to `master` and every version bump**, before cutting a release build:
- Did this merge add a network call, an analytics/crash SDK, or a backend of any kind? (If so, the "no data collected" claim is now false — stop and fix the pages.)
- Did it add/remove a runtime permission (`app.json` `android.permissions`, or a config plugin like `expo-image-picker`)?
- Did it add/remove an import path?
- Did it change what a local uninstall / "clear storage" erases?

If any answer is yes, update the relevant page(s) in `readit-support/`, bump their "Last updated" date, commit, and push (GitHub Pages redeploys automatically on push to `main`).

## Commands

```bash
npx expo start                                   # dev server
npx expo run:android                             # run on Giacomo's Moto G 5G (serial ZY22BHCRLF; auto-picked when it's the only device)
npm run build:engine                             # regenerate assets/extraction/engine.html (after bumping readability/pdfjs-dist)
npm run typecheck
npm run validate-locales
```

### Local build scripts (mirrors GreenThumb)

```
deploy_local_debug_android.bat      # npx expo run:android — debug build to connected device (fast, no prebuild)
deploy_local_release_android.bat    # prebuild --clean -> gradlew assembleRelease -> uninstall + fresh install
build_bundle_android_release.bat    # prebuild --clean -> gradlew bundleRelease -> Bundles/app-release-vX.Y.Z-N.aab (Play Store artifact)
build_get_version.ps1               # helper: reads version/versionCode from app.json — used by build_bundle_android_release.bat
```

Only the debug script skips `expo prebuild`. The native `android/` project is generated once and does **not** re-read `app.json` on later runs — icon, permissions, and plugin config changes are silently ignored until prebuild reruns. Both release scripts run `npx expo prebuild --platform android --clean` first so they always reflect current `app.json`. `deploy_local_release_android.bat` also does a full `adb uninstall` + fresh `adb install` — Android's launcher caches icons aggressively and often ignores an overlay reinstall (`adb install -r`) even when the new icon is genuinely in the APK.

`build_bundle_android_release.bat` reads version info straight from `app.json`, so bump `version`/`android.versionCode` there before cutting a release bundle.

## Release CI (GitHub Actions)

Two workflows in `.github/workflows/` mirror the local build scripts above, running on a fresh checkout instead of Giacomo's machine:

- **`release-apk.yml`** — manual trigger only (`workflow_dispatch`, or `gh workflow run "Release APK (testers)"`). Builds a release-signed `.apk` and uploads it as a workflow artifact, for handing to testers.
- **`release-aab.yml`** — triggers on pushing a `v*.*.*` tag (also has `workflow_dispatch` for manual reruns). Builds the `.aab`, uploads it as a workflow artifact, then publishes to the Play Console **`internal`** track (deliberately not `production` — promote manually when ready).

Both do: checkout → Node 22 → `npm ci` → JDK 17 → Android SDK → decode the release keystore → write signing values to `~/.gradle/gradle.properties` → `npx expo prebuild --platform android --clean` → `gradlew {assembleRelease,bundleRelease}` → rename artifact into `Bundles/app-release-v<version>-<code>.{apk,aab}`. (No `.env` step — the app has no build-time secrets. `prebuild --clean` autolinks the native modules: expo-sqlite, react-native-webview, expo-image-picker, ml-kit.)

**Why a config plugin is required**: `android/app/build.gradle` is regenerated from scratch by `expo prebuild --clean` and isn't tracked in git, so a real release signing config can't be hand-edited into it — it would vanish on the next prebuild. `plugins/withReleaseSigning.js` re-injects a `signingConfigs.release` block (reading `RELEASE_STORE_FILE`/`RELEASE_STORE_PASSWORD`/`RELEASE_KEY_ALIAS`/`RELEASE_KEY_PASSWORD` via `project.hasProperty(...)`) on every prebuild, and switches the release `buildType` to use it when those properties are present — falling back to the debug keystore otherwise, so local dev builds are unaffected. It throws a clear error if its anchors don't match the generated file, so a future Expo SDK upgrade that changes the template fails loudly instead of silently shipping a debug-signed release.

**GitHub repo secrets required** (`gh secret list` to check): `RELEASE_KEYSTORE_BASE64`, `RELEASE_KEYSTORE_PASSWORD`, `RELEASE_KEY_ALIAS`, `RELEASE_KEY_PASSWORD`, `PLAY_SERVICE_ACCOUNT_JSON` (only needed for the `.aab` workflow's publish step — needs a Google Cloud service account with Release Manager access on `com.giamat90.readit` in Play Console's API access page). The old `EXPO_PUBLIC_SUPABASE_*` secrets are unused and can be deleted.

**Keystore backup**: the release keystore (`readit-release.jks`) and its password live at `C:\Users\giaco\Documents\ReadIt-release-keystore\` on Giacomo's machine — back this up to durable secure storage (password manager / cloud). It is never committed (`.gitignore` covers `*.jks`/`*.keystore`) and losing it permanently blocks future Play Store updates. If a `GoogleCloud/` or `keystore_secure/` folder appears at the repo root during future credential handling, `.gitignore` already covers both by name — but double-check before ever running a broad `git add`, since one already slipped in unignored once (a GCP service-account key downloaded with a `<project-id>-<hash>.json` name that didn't match the `*service-account*.json` pattern).

**`npm ci` vs `npm install`**: CI uses `npm ci`, which fails hard if `package-lock.json` is out of sync with `package.json` — `npm install` tolerates drift that `npm ci` won't. Run `npm install` locally after any dependency change and commit the resulting lock file, not just `package.json`.

## v1.0 scope

### IN
- Four import paths: paste, web URL, PDF, photo (on-device OCR) — all offline except the web fetch
- On-device TTS player: play/pause, skip paragraph, speed 0.5×–2×, voice picker
- Current-chunk highlighting in the text view while speaking
- Library with per-document progress + resume, all in on-device SQLite
- i18n: 14 locales bundled (en + it fully translated; photo strings await translation in the rest)
- Android only

### OUT (later)
- Neural voices + true background playback — needs a cloud TTS provider, conflicts with the standalone goal; revisit only if that changes
- Android share-sheet target ("Share → ReadIt")
- Audio file export
- EPUB support, iOS, web version, folders/tags, sleep timer

## History

The app was originally built (TASK-001…009) on Supabase — auth, Postgres, storage, and Deno edge functions for extraction — plus a planned RevenueCat tier. The `feat/standalone-offline` refactor removed all of it: SQLite replaces Postgres, a hidden WebView + ML Kit replace the edge functions, preferences moved to AsyncStorage, and auth + Pro were deleted. Older `tasks/TASK-00X.md` specs describe the pre-refactor architecture and are historical.

## Task spec format

All task specs go in `tasks/TASK-xxx.md` — see `tasks/TEMPLATE.md`. Tech Lead writes the spec, Developer implements it.

## Coding conventions

- TypeScript strict; shared types in `types/index.ts`
- Conventional commits (`feat:`, `fix:`, `chore:`, `refactor:`) referencing the task
- Never commit `.env`, API keys, or service account files
- All user-facing strings through i18n from day one — no hardcoded copy
