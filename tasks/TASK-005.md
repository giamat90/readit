# TASK-005: Web import — extract-web edge function + URL screen

## Status: IN_PROGRESS — code complete on `feat/task-005-web-import`; blocked on ⚡ manual edge function deploy

## Overview
Second import path: paste a URL, the server fetches the page, extracts the article text with Mozilla Readability, chunks it, saves it as a `documents` row (`source_type='web'`), and the client opens the player once it's ready. This is the first task with a real Supabase Edge Function and the first server-side extraction pipeline — the pattern (fetch → normalize → chunk → insert → return id) is reused unchanged by TASK-006 (PDF) and TASK-007 (photo).

## User story
As a user, I want to paste a link to an article and listen to it so that I don't have to read long web pages.

## Acceptance criteria
- [ ] New "Import from web" entry point next to paste (FAB menu or a second row on the paste screen — Developer's call, keep it one tap away)
- [ ] URL screen: text input (keyboard type `url`), paste-from-clipboard convenience button, "Extract" button disabled until input looks like a URL
- [ ] Tapping Extract shows a loading state, calls `extract-web`, and on success opens the player with the extracted, chunked article
- [ ] The document is already saved (`status='ready'`) by the time the player opens — no separate client-side save step, unlike the paste path
- [ ] Clear, translated error states: invalid URL, fetch failure (site down/blocks bots), no readable article content found — each distinct, no raw error text or stack traces shown to the user
- [ ] Extracted document's `source_type='web'`, `source_ref=<url>`, `language` set from Readability's detected/declared language when available
- [ ] Document appears in the Library like any other, with working resume
- [ ] RLS still enforced — the edge function inserts using the caller's JWT, not a service-role bypass
- [ ] `npx tsc --noEmit` passes; works on device over both Wi-Fi and mobile data

## Technical plan

### Files to create
| File | Purpose |
|------|---------|
| `supabase/functions/extract-web/index.ts` | Deno edge function. Verifies the caller's JWT (via `Authorization` header → `supabase.auth.getUser()`), fetches the URL server-side, runs `@mozilla/readability` + `linkedom` (or `deno-dom`) to get title + article text, normalizes whitespace, chunks with the same rules as `lib/chunking.ts` (port the algorithm — see Notes), inserts `documents` + `document_chunks` using a client built with the caller's JWT (so RLS applies), returns `{ documentId }` or a typed error |
| `supabase/functions/extract-web/chunking.ts` | Deno-side port of `lib/chunking.ts` — same output contract, since Deno can't import the RN app's TS directly |
| `app/import/web.tsx` | URL input screen: clipboard-paste button, validation, loading state, error banner, calls the function via `fetch` |

### Files to modify
| File | Change |
|------|--------|
| `app/import/paste.tsx` (or a new `app/import/index.tsx` picker) | Add a way to reach `/import/web` — simplest: two buttons/rows under the FAB, "Paste text" and "From a link" |
| `lib/documents.ts` | Add `callExtractWeb(url: string): Promise<{ documentId: string } \| { error: string }>` — direct `fetch()` with `Authorization: Bearer <session token>` + `apikey: <anon key>` headers (CLAUDE.md rule 2 — never `supabase.functions.invoke()`) |

### Database changes
None — reuses `documents`/`document_chunks` from migration 002.

### Edge functions
**New: `extract-web`.**
⚡ Manual Deploy Step required — Developer does NOT run the deploy. Report exactly:
```bash
npx supabase login
npx supabase link --project-ref yhifdsfjbiitxxzulnhp
npx supabase functions deploy extract-web
```
No new secrets needed (function only needs the caller's own JWT + the project's own service context, both provided automatically by the Supabase runtime).

### i18n keys
`import.fromWeb`, `import.urlPlaceholder`, `import.extract`, `import.pasteFromClipboard`, `import.errorInvalidUrl`, `import.errorFetchFailed`, `import.errorNoContent` — en + it.

## Implementation steps
1. Port `lib/chunking.ts` to `supabase/functions/extract-web/chunking.ts` (Deno-compatible: no RN imports, same algorithm)
2. Write `extract-web/index.ts`: JWT check → fetch with a real User-Agent + timeout → Readability extraction → chunk → insert → respond
3. **⚡ Giacomo deploys** `extract-web` per the commands above; confirm no errors, share the deploy log if anything looks off
4. Build `app/import/web.tsx` + entry point + `lib/documents.ts` helper
5. i18n keys en + it; `npx tsc --noEmit`
6. Test against a few real articles (news site, blog, Wikipedia) on device; commit on `feat/task-005-web-import`

## Testing checklist
- [ ] Works on free tier (no gating yet — quotas arrive in TASK-009)
- [ ] Works on Pro tier (n/a)
- [ ] Works offline / poor network: clear, translated error, no hang; airplane mode shows the fetch-failed message promptly (not a 30s timeout)
- [ ] i18n: tested in en + it
- [ ] No hardcoded pixel values
- [ ] No layout regressions on Moto G 5G
- [ ] Site with a paywall / bot-block returns the no-content error, not a crash
- [ ] A genuinely long article (5000+ words) chunks and plays without issue

## Dependencies
TASK-004 (TESTED) — needs `documents`/`document_chunks` and the library list.

## Notes
- Direct `fetch()` from the client to the function with `Authorization: Bearer` + `apikey` headers — never `supabase.functions.invoke()` (CLAUDE.md rule 2, caused JWT 401s on GreenThumb).
- The edge function must build its Supabase client with the incoming JWT (not the service role key) so RLS naturally scopes the insert to the calling user — no manual `user_id` trust needed.
- Set a fetch timeout (~10s) inside the function; Android clients should not wait indefinitely on a hung site.
- Readability needs a DOM; use `linkedom` (lighter, known to work in Deno edge runtimes) over full `deno-dom` unless it proves insufficient.
- This task's extraction + chunking pattern is the template TASK-006/007 copy — keep `index.ts` readable, since it's about to be duplicated twice.
- Do not attempt paywalled/JS-rendered sites — out of scope; the error path from "no readable content" covers this gracefully.
