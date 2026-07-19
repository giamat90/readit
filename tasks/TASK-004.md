# TASK-004: Documents in the database — library list + resume

## Status: DRAFT

## Overview
Persist documents to Supabase and make the Library real. Migration 002 creates `documents`, `document_chunks`, and `playback_positions` (per CLAUDE.md schema, with RLS). Pasting a text saves it (fire-and-forget, so offline listening still works), the Library lists saved documents with progress, tapping one resumes from the last-heard paragraph, and long-press deletes. After this task the app survives restarts: import once, listen over days.

## User story
As a user, I want my imported texts saved with my listening position so that I can come back and continue where I left off.

## Acceptance criteria
- [ ] Pasting + Listen saves the document (title, chunks, language, `source_type='paste'`, `status='ready'`) and playback starts immediately — saving must NOT block playback
- [ ] Offline paste still plays; the document simply isn't persisted (no error dialog, at most a subtle inline notice)
- [ ] Library lists saved documents: title, created date, chunk progress (e.g. "3/12 · 25%"), newest first; pull-to-refresh; refreshes on tab focus
- [ ] Tapping a document fetches its chunks and opens the player at the saved position
- [ ] Playback position is upserted on every chunk advance and on leaving the player; relaunching the app and reopening the document resumes at that chunk
- [ ] Long-press on a library row → translated confirm dialog → deletes document (chunks + position cascade)
- [ ] RLS verified: user B cannot read user A's documents/chunks/positions
- [ ] `npx tsc --noEmit` passes; works on device; JS-only (no native rebuild needed)

## Technical plan

### Files to create
| File | Purpose |
|------|---------|
| `supabase/migrations/002_documents.sql` | `documents`, `document_chunks`, `playback_positions` per CLAUDE.md schema + RLS: documents/positions own-row policies on `user_id`; chunks policies via `EXISTS` join to owning document. Index `document_chunks(document_id, seq)` |
| `lib/documents.ts` | Data service (all fetch logic outside components — CLAUDE.md rule 5): `saveDocument(...)` (insert document + batch-insert chunks, returns id), `listDocuments()` (with embedded `playback_positions(chunk_seq)`), `getChunks(id)`, `upsertPosition(documentId, chunkSeq)`, `deleteDocument(id)` |

### Files to modify
| File | Change |
|------|--------|
| `app/import/paste.tsx` | After chunking: start playback immediately, then `saveDocument` fire-and-forget; on success update player store `documentId` |
| `app/(tabs)/index.tsx` | Real list: FlatList over `useLibraryStore`, row = title + date + progress, tap → open, long-press → delete confirm; `useFocusEffect` refresh + pull-to-refresh; keep empty state + FAB |
| `store/library.ts` | `fetchDocuments()` action calling `lib/documents.ts`; `removeDocument(id)` optimistic delete |
| `app/player/index.tsx` | On chunk change + unmount: `upsertPosition` when `documentId` set (fire-and-forget) |
| `types/index.ts` | Add `DocumentWithPosition` (Document + `playback_positions: { chunk_seq: number }[]`) |

### Database changes
_Migration number: 002_
Tables exactly as CLAUDE.md §Database schema. RLS enabled on all three:
- `documents`: select/insert/update/delete where `auth.uid() = user_id` (insert with check)
- `playback_positions`: same on `user_id`
- `document_chunks`: select/insert/delete where `EXISTS (SELECT 1 FROM documents d WHERE d.id = document_id AND d.user_id = auth.uid())`
⚡ Manual step: Giacomo runs migration 002 in the SQL editor before device testing.

### Edge functions
None.

### i18n keys
`library.progress` ("{{current}} of {{total}}"), `library.deleteTitle`, `library.deleteConfirm`, `library.savedOffline` (subtle not-persisted notice), `library.sourcePaste` — en + it.

## Implementation steps
1. Write migration 002 → ⚡ Giacomo runs it in SQL editor
2. Implement `lib/documents.ts`; extend `types/index.ts` and `store/library.ts`
3. Wire paste flow (play first, save in background), library list, resume, delete
4. `npx tsc --noEmit`; reload on device (JS-only — no gradle rebuild)
5. Verify acceptance criteria incl. app-restart resume; commit on `feat/task-004-library`

## Testing checklist
- [ ] Works on free tier (no gating yet)
- [ ] Works on Pro tier (n/a)
- [ ] Works offline / poor network: paste+listen fully works offline; library shows cached store contents; no crashes, no blocking spinners
- [ ] i18n: tested in en + it
- [ ] No hardcoded pixel values
- [ ] No layout regressions on Moto G 5G
- [ ] Resume across app kill: listen to chunk 5, kill app, reopen doc → starts at chunk 5
- [ ] Delete removes row from list immediately (optimistic) and from DB

## Dependencies
TASK-002 (auth — provides `user_id`), TASK-003 (player) — both TESTED.

## Notes
- Chunks batch insert: one `insert(rows[])` call; documents rarely exceed a few hundred chunks. Set `chunk_count`/`char_count` on the document row at save time.
- Position writes are tiny and per-chunk (~1 per minute of listening) — no debounce needed beyond that.
- `saveDocument` failures (offline) must be swallowed after a `console.warn` — never log document content (CLAUDE.md rule 6), only metadata.
- Library progress = `chunk_seq + 1` over `chunk_count`; a missing position row means unstarted (0%).
- Do NOT build folders/tags/search — out of v1.0 scope.
