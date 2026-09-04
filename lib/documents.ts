import * as Crypto from "expo-crypto";
import { getDb } from "@/lib/db";
import { chunkText } from "@/lib/chunking";
import { detectLanguage } from "@/lib/language";
import { extractWeb } from "@/lib/extraction/web";
import { extractPdf } from "@/lib/extraction/pdf";
import { extractPhoto } from "@/lib/extraction/photo";
import { ExtractionError } from "@/lib/extraction/types";
import type { DocumentWithPosition, SourceType } from "@/types";

// All document data access lives here, outside component scope (CLAUDE.md
// rule 5). Everything is on-device SQLite now — no network, no auth. Errors
// are swallowed with metadata-only warnings — never log document content
// (rule 6).

export async function saveDocument(params: {
  title: string;
  chunks: string[];
  sourceType: SourceType;
  language: string | null;
  sourceRef?: string | null;
}): Promise<string | null> {
  if (params.chunks.length === 0) return null;
  const db = await getDb();
  const id = Crypto.randomUUID();
  const charCount = params.chunks.reduce((n, c) => n + c.length, 0);

  try {
    await db.withTransactionAsync(async () => {
      await db.runAsync(
        `INSERT INTO documents
           (id, title, source_type, source_ref, language, char_count, chunk_count, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'ready', ?)`,
        id,
        params.title,
        params.sourceType,
        params.sourceRef ?? null,
        params.language,
        charCount,
        params.chunks.length,
        new Date().toISOString()
      );
      const stmt = await db.prepareAsync(
        "INSERT INTO document_chunks (document_id, seq, content) VALUES (?, ?, ?)"
      );
      try {
        for (let seq = 0; seq < params.chunks.length; seq++) {
          await stmt.executeAsync(id, seq, params.chunks[seq]);
        }
      } finally {
        await stmt.finalizeAsync();
      }
    });
    return id;
  } catch (err) {
    console.warn("saveDocument failed", (err as Error)?.name);
    return null;
  }
}

type DocRow = {
  id: string;
  title: string;
  source_type: SourceType;
  source_ref: string | null;
  language: string | null;
  char_count: number;
  chunk_count: number;
  status: DocumentWithPosition["status"];
  error_msg: string | null;
  created_at: string;
  position_seq: number | null;
};

/** null kept in the signature for callers; only ever returns an array now. */
export async function listDocuments(): Promise<DocumentWithPosition[] | null> {
  try {
    const db = await getDb();
    const rows = await db.getAllAsync<DocRow>(
      `SELECT d.*, p.chunk_seq AS position_seq
         FROM documents d
         LEFT JOIN playback_positions p ON p.document_id = d.id
        ORDER BY d.created_at DESC`
    );
    return rows.map(({ position_seq, ...doc }) => ({
      ...doc,
      playback_positions:
        position_seq == null ? [] : [{ chunk_seq: position_seq }],
    }));
  } catch (err) {
    console.warn("listDocuments failed", (err as Error)?.name);
    return [];
  }
}

export async function getDocumentMeta(
  documentId: string
): Promise<{ title: string; language: string | null } | null> {
  try {
    const db = await getDb();
    const row = await db.getFirstAsync<{ title: string; language: string | null }>(
      "SELECT title, language FROM documents WHERE id = ?",
      documentId
    );
    return row ?? null;
  } catch (err) {
    console.warn("getDocumentMeta failed", (err as Error)?.name);
    return null;
  }
}

export async function getChunks(documentId: string): Promise<string[]> {
  try {
    const db = await getDb();
    const rows = await db.getAllAsync<{ content: string }>(
      "SELECT content FROM document_chunks WHERE document_id = ? ORDER BY seq ASC",
      documentId
    );
    return rows.map((r) => r.content);
  } catch (err) {
    console.warn("getChunks failed", (err as Error)?.name);
    return [];
  }
}

export async function upsertPosition(
  documentId: string,
  chunkSeq: number
): Promise<void> {
  try {
    const db = await getDb();
    await db.runAsync(
      `INSERT INTO playback_positions (document_id, chunk_seq, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(document_id)
       DO UPDATE SET chunk_seq = excluded.chunk_seq, updated_at = excluded.updated_at`,
      documentId,
      chunkSeq,
      new Date().toISOString()
    );
  } catch (err) {
    console.warn("upsertPosition failed", (err as Error)?.name);
  }
}

export async function deleteDocument(documentId: string): Promise<boolean> {
  try {
    const db = await getDb();
    await db.runAsync("DELETE FROM documents WHERE id = ?", documentId);
    return true;
  } catch (err) {
    console.warn("deleteDocument failed", (err as Error)?.name);
    return false;
  }
}

// --- Import orchestration: extract on-device -> chunk -> persist ------------

async function persistExtraction(
  sourceType: SourceType,
  extracted: { title: string; text: string; language: string | null },
  sourceRef: string | null
): Promise<string | null> {
  const chunks = chunkText(extracted.text);
  if (chunks.length === 0) return null;
  const language = detectLanguage(extracted.text) ?? extracted.language;
  return saveDocument({
    title: extracted.title,
    chunks,
    sourceType,
    language,
    sourceRef,
  });
}

type ExtractWebErrorCode =
  | "invalid_url"
  | "fetch_failed"
  | "no_content"
  | "network_error";

export type ExtractWebResult =
  | { documentId: string }
  | { error: ExtractWebErrorCode };

export async function callExtractWeb(url: string): Promise<ExtractWebResult> {
  try {
    const extracted = await extractWeb(url);
    const documentId = await persistExtraction("web", extracted, url);
    if (!documentId) return { error: "no_content" };
    return { documentId };
  } catch (err) {
    if (err instanceof ExtractionError) {
      return { error: err.code as ExtractWebErrorCode };
    }
    console.warn("callExtractWeb failed", (err as Error)?.name);
    return { error: "fetch_failed" };
  }
}

type ExtractPdfErrorCode =
  | "password_protected"
  | "no_text_found"
  | "corrupt_file"
  | "network_error";

export type ExtractPdfResult =
  | { documentId: string }
  | { error: ExtractPdfErrorCode };

export async function callExtractPdf(
  fileUri: string,
  filename: string
): Promise<ExtractPdfResult> {
  try {
    const extracted = await extractPdf(fileUri, filename);
    const documentId = await persistExtraction("pdf", extracted, filename);
    if (!documentId) return { error: "no_text_found" };
    return { documentId };
  } catch (err) {
    if (err instanceof ExtractionError) {
      return { error: err.code as ExtractPdfErrorCode };
    }
    console.warn("callExtractPdf failed", (err as Error)?.name);
    return { error: "corrupt_file" };
  }
}

type ExtractPhotoErrorCode = "no_text_detected" | "ocr_failed";

export type ExtractPhotoResult =
  | { documentId: string }
  | { error: ExtractPhotoErrorCode };

export async function callExtractPhoto(
  imageUri: string,
  filename: string
): Promise<ExtractPhotoResult> {
  try {
    const extracted = await extractPhoto(imageUri, filename);
    const documentId = await persistExtraction("photo", extracted, null);
    if (!documentId) return { error: "no_text_detected" };
    return { documentId };
  } catch (err) {
    if (err instanceof ExtractionError) {
      return { error: err.code as ExtractPhotoErrorCode };
    }
    console.warn("callExtractPhoto failed", (err as Error)?.name);
    return { error: "ocr_failed" };
  }
}
