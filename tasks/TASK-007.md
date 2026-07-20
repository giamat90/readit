# TASK-007: Photo import — extract-photo edge function (Claude vision OCR)

## Status: DRAFT

## Overview
Fourth and final v1.0 import path: take a photo (or pick one from the gallery) of printed text and have Claude's vision model read it via OCR, returning clean reading-order text. This is the one extraction pipeline that doesn't parse a structured format — it's genuinely reading an image — so accuracy depends on lighting/angle/print quality more than the others. Same overall shape as TASK-005/006 (upload → extract → chunk → save → reply), but the "extraction" step is a Claude API call instead of Readability/unpdf.

## User story
As a user, I want to photograph a page (a book, a document, a sign) and listen to it so that I can capture text from the physical world, not just digital sources.

## Acceptance criteria
- [ ] New "Take a photo" entry point alongside paste/web/PDF, offering camera capture or gallery pick
- [ ] Camera permission requested with a clear rationale string; graceful handling if denied (translated message, no crash)
- [ ] Selected/captured image uploads to a private Storage bucket (`photo-uploads`, `{user_id}/{uuid}.jpg`) — same pattern as `pdf-uploads`
- [ ] Client calls `extract-photo` with the storage path; loading state shows "Reading photo…" while Claude processes it
- [ ] On success: player opens with extracted, chunked text; document saved (`status='ready'`, `source_type='photo'`)
- [ ] Uploaded image is deleted from Storage after extraction (success or failure) — text-only model, same as PDF
- [ ] Distinct translated errors: no text detected in image, image unreadable/corrupt, generic failure — no raw API errors shown
- [ ] Multi-photo capture is OUT of scope for this task (single image only); large single images are downscaled client-side before upload to control latency/cost
- [ ] RLS + Storage policies verified: user B cannot access user A's uploads
- [ ] `npx tsc --noEmit` passes; works on device

## Technical plan

### Files to create
| File | Purpose |
|------|---------|
| `supabase/migrations/004_photo_storage.sql` | Private `photo-uploads` bucket + per-user RLS policies (copy of migration 003's pattern) |
| `supabase/functions/extract-photo/index.ts` | JWT check (same pattern as extract-web/pdf) → download image from Storage → base64-encode → call Claude API (vision) with an OCR-focused prompt requesting clean reading-order text only → chunk → insert `documents`+`document_chunks` → delete uploaded image → reply |
| `supabase/functions/extract-photo/chunking.ts` | Copy of the chunking algorithm (same as extract-web/extract-pdf) |
| `app/import/photo.tsx` | Camera/gallery picker screen (action sheet: "Take photo" / "Choose from gallery"), preview thumbnail, upload progress, calls `extract-photo`, same error-banner pattern as web/pdf screens |

### Files to modify
| File | Change |
|------|--------|
| `app/import/paste.tsx` | Add fourth entry row "Take a photo" |
| `lib/documents.ts` | Add `uploadPhoto(uri, filename)` (mirrors `uploadPdf`, reusing the expo-file-system + base64 read established in TASK-006 — content:// URIs apply here too) and `callExtractPhoto(storagePath, filename)` |
| `app.json` | Add camera permission plugin config for `expo-image-picker` (rationale string) |
| `package.json` | Add `expo-image-picker` via `npx expo install` (new native module → device rebuild) |

### Database changes
_Migration number: 004_
Storage bucket + RLS only (mirrors 003), no new tables.

### Edge functions
**New: `extract-photo`.**
Requires a new secret: `ANTHROPIC_API_KEY`.
⚡ Manual step: set the secret before first deploy —
```bash
npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
npx supabase functions deploy extract-photo
```
(Assistant can run the deploy command itself per the TASK-005/006 precedent, but the API key value must come from Giacomo — it should never be typed into chat; set it directly via the CLI command above or the dashboard's Edge Functions → Secrets page.)

### i18n keys
`import.fromPhoto`, `import.takePhoto`, `import.chooseFromGallery`, `import.readingPhoto`, `import.errorNoTextDetected`, `import.errorImageUnreadable`, `import.cameraPermissionDenied` — en + it.

## Implementation steps
1. `npx expo install expo-image-picker`; add camera permission block to `app.json` (mirror GreenThumb's `expo-camera` plugin pattern)
2. Write migration 004; apply it
3. **⚡ Giacomo provides the Anthropic API key** — set as a Supabase secret (command above)
4. Write `extract-photo/index.ts`: build the vision request with an explicit "transcribe only, no commentary, preserve reading order, output plain text" system prompt; keep the model call server-side only
5. Deploy `extract-photo`
6. Build `app/import/photo.tsx`, `lib/documents.ts` additions, entry point
7. i18n keys; `npx tsc --noEmit`
8. Native rebuild; test with a real photographed page (book/printed document) on device; commit on `feat/task-007-photo-import`

## Testing checklist
- [ ] Works on free tier (no gating yet)
- [ ] Works on Pro tier (n/a)
- [ ] Works offline / poor network: clear translated error, no hang
- [ ] i18n: tested in en + it
- [ ] No hardcoded pixel values
- [ ] No layout regressions on Moto G 5G
- [ ] Camera permission denial handled gracefully (Settings deep-link optional, not required)
- [ ] A blurry/blank photo gives the "no text detected" error, not a garbage document
- [ ] Storage bucket empty after both successful and failed extractions

## Dependencies
TASK-004 (documents/library), TASK-006 (upload-via-file-system pattern + Storage RLS precedent) — both TESTED.

## Notes
- This is the only extraction pipeline that costs money per call (Claude API) — CLAUDE.md rule 6 (never log document content) applies doubly here since the "content" is a photo of the user's private material; log only metadata (document_id, char_count), never the image or transcribed text.
- Downscale/compress the image client-side (`expo-image-manipulator`, resize to ~1600px long edge, JPEG quality ~0.8) before upload — keeps latency and API cost sane without materially hurting OCR accuracy.
- The Claude prompt must explicitly forbid commentary/summarization — we want a faithful transcription, not an AI-generated description of the page.
- Import quotas (this is the natural task to gate first once TASK-009 lands, since it's the only one with a direct per-use cost) — do not build gating logic now, just note it; TASK-009 owns that.
- If Claude's response includes low-confidence/garbled sections, don't attempt automatic correction — pass through what it returns; users can always retake the photo.
