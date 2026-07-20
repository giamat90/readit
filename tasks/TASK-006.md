# TASK-006: PDF import — storage upload + extract-pdf edge function

## Status: APPROVED

## Overview
Third import path: pick a PDF from the device, upload it to Supabase Storage, extract its text server-side, chunk it, save as a `documents` row (`source_type='pdf'`), then delete the uploaded file (we only need the text, not the original). Reuses the same fetch/extract → normalize → chunk → insert → reply pattern `extract-web` established in TASK-005 — this task adapts it to a storage-triggered input instead of a URL fetch.

## User story
As a user, I want to pick a PDF from my device and listen to it so that I don't have to read long documents on screen.

## Acceptance criteria
- [ ] New "Import PDF" entry point alongside paste/web (third row on the import picker)
- [ ] Tapping it opens the native document picker filtered to `application/pdf`
- [ ] Selected file uploads to a private Storage bucket (`pdf-uploads`) under the user's own folder (`{user_id}/{uuid}.pdf`), with a progress indicator
- [ ] After upload, client calls `extract-pdf` with the storage path; loading state continues while text is extracted server-side
- [ ] On success: player opens with the extracted, chunked text; document already saved (`status='ready'`)
- [ ] The uploaded PDF is deleted from Storage once extraction succeeds (we don't keep original files — text only, per CLAUDE.md's document model)
- [ ] On extraction failure the uploaded file is still cleaned up (no orphaned storage objects) and a translated error shows: password-protected PDF, scanned/image-only PDF (no extractable text), corrupt file, generic failure — each distinct
- [ ] `documents.source_type='pdf'`, `source_ref` stores the original filename (not a storage path, since the file no longer exists after extraction)
- [ ] RLS + Storage policies verified: user B cannot read/list user A's uploaded files or resulting documents
- [ ] `npx tsc --noEmit` passes; works on device over Wi-Fi and mobile data; large PDF (50+ pages) doesn't time out

## Technical plan

### Files to create
| File | Purpose |
|------|---------|
| `supabase/migrations/003_pdf_storage.sql` | Creates private bucket `pdf-uploads` (`select storage.create_bucket(...)` or dashboard-equivalent SQL) + Storage RLS policies: users can insert/select/delete only under their own `{user_id}/` prefix |
| `supabase/functions/extract-pdf/index.ts` | Deno edge function: JWT check (same pattern as extract-web) → download the file from Storage using the caller-scoped client → extract text via `unpdf` → chunk (reuse `extract-pdf/chunking.ts`, a copy of the same algorithm) → insert `documents`+`document_chunks` → delete the storage object (success or failure) → reply `{ documentId }` or typed error |
| `supabase/functions/extract-pdf/chunking.ts` | Copy of `extract-web/chunking.ts` (same contract; duplication accepted per TASK-005 notes — small file, no shared-package infra yet) |
| `app/import/pdf.tsx` | Document-picker screen: pick button → upload with progress bar → calls `extract-pdf` → loading → player. Mirrors `web.tsx`'s error-banner pattern |

### Files to modify
| File | Change |
|------|--------|
| `app/import/paste.tsx` | Add third entry row "Import PDF" next to the existing "Import from a link" |
| `lib/documents.ts` | Add `uploadPdf(uri: string, filename: string): Promise<string \| null>` (returns storage path) using `supabase.storage.from('pdf-uploads').upload(...)`, and `callExtractPdf(storagePath: string, filename: string)` — direct `fetch()` with Bearer + apikey, same as `callExtractWeb` |
| `package.json` | Add `expo-document-picker` via `npx expo install` (new native module → device test needs a rebuild) |

### Database changes
_Migration number: 003_
Storage bucket + policies only, no new tables (reuses `documents`/`document_chunks` from 002).

### Edge functions
**New: `extract-pdf`.**
⚡ Manual Deploy Step: run `npx supabase functions deploy extract-pdf` (already linked/logged in from TASK-005 — Giacomo confirmed direct deploys from the assistant's session are fine going forward, so the Developer instance may run this itself and report the result rather than handing it back).

### i18n keys
`import.fromPdf`, `import.selectPdf`, `import.uploading`, `import.extracting`, `import.errorPasswordProtected`, `import.errorNoTextFound`, `import.errorCorruptFile` — en + it.

## Implementation steps
1. `npx expo install expo-document-picker`
2. Write migration 003 (bucket + Storage RLS); apply it (assistant can run via the same direct-Postgres path used for migration 002, or the Supabase CLI/dashboard — whichever is cleaner at the time)
3. Copy chunking.ts into `extract-pdf/`; write `extract-pdf/index.ts` using `unpdf`'s `extractText`
4. Deploy `extract-pdf`
5. Build `app/import/pdf.tsx`; add `uploadPdf`/`callExtractPdf` to `lib/documents.ts`; wire entry point
6. i18n keys; `npx tsc --noEmit`
7. Native rebuild (`expo run:android`) — new native module; verify on device with a real multi-page PDF; commit on `feat/task-006-pdf-import`

## Testing checklist
- [ ] Works on free tier (no gating yet)
- [ ] Works on Pro tier (n/a)
- [ ] Works offline / poor network: upload shows a clear translated error, no hang; no partial/orphaned storage file left behind
- [ ] i18n: tested in en + it
- [ ] No hardcoded pixel values
- [ ] No layout regressions on Moto G 5G
- [ ] Password-protected PDF gives the specific error, not a generic one
- [ ] Scanned/image-only PDF (no text layer) gives the "no text found" error — do not silently produce an empty document
- [ ] Storage bucket is empty after both successful and failed extractions (no leaked files)

## Dependencies
TASK-004 (documents/library, TESTED), TASK-005 (extraction pattern + deploy precedent, TESTED).

## Notes
- Storage bucket must be **private** (not public) — PDFs may contain sensitive personal content; access only via the caller-scoped client, never a public URL.
- `unpdf` is chosen per CLAUDE.md's tech stack; if it can't be bundled cleanly in the edge runtime (watch for the same kind of native-dependency bundling issue TASK-005 hit with `linkedom`/canvas), the fallback is `pdf-parse`'s pure-JS build — flag it in the commit message if a substitution is needed.
- Scanned PDFs (image-only, no text layer) are explicitly out of scope for OCR here — that's what TASK-007's Claude vision pipeline is for. `extract-pdf` should fail cleanly with `errorNoTextFound` rather than attempting OCR.
- Keep the upload progress UI honest — `expo-document-picker` + `supabase.storage.upload` progress events, not a fake spinner.
- We intentionally do not keep the original PDF file — CLAUDE.md's model is text-only; storing user PDFs indefinitely would add storage cost and privacy surface for no product benefit in v1.0.
