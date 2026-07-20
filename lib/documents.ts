import { supabase } from "@/lib/supabase";
import type { DocumentWithPosition, SourceType } from "@/types";

// All document data access lives here, outside component scope (CLAUDE.md
// rule 5). Errors are swallowed with metadata-only warnings — never log
// document content (rule 6).

async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

export async function saveDocument(params: {
  title: string;
  chunks: string[];
  sourceType: SourceType;
  language: string | null;
}): Promise<string | null> {
  const userId = await currentUserId();
  if (!userId) return null;

  const charCount = params.chunks.reduce((n, c) => n + c.length, 0);
  const { data: doc, error } = await supabase
    .from("documents")
    .insert({
      user_id: userId,
      title: params.title,
      source_type: params.sourceType,
      language: params.language,
      char_count: charCount,
      chunk_count: params.chunks.length,
      status: "ready",
    })
    .select("id")
    .single();
  if (error || !doc) {
    console.warn("saveDocument: document insert failed", error?.code);
    return null;
  }

  const rows = params.chunks.map((content, seq) => ({
    document_id: doc.id as string,
    seq,
    content,
  }));
  const { error: chunksError } = await supabase
    .from("document_chunks")
    .insert(rows);
  if (chunksError) {
    console.warn("saveDocument: chunk insert failed", chunksError.code);
    await supabase.from("documents").delete().eq("id", doc.id); // no torso docs
    return null;
  }
  return doc.id as string;
}

/** null = fetch failed (e.g. offline) — caller should keep cached list */
export async function listDocuments(): Promise<DocumentWithPosition[] | null> {
  const { data, error } = await supabase
    .from("documents")
    .select("*, playback_positions(chunk_seq)")
    .order("created_at", { ascending: false });
  if (error) {
    console.warn("listDocuments failed", error.code);
    return null;
  }
  return (data ?? []) as DocumentWithPosition[];
}

export async function getChunks(documentId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("document_chunks")
    .select("seq, content")
    .eq("document_id", documentId)
    .order("seq", { ascending: true });
  if (error) {
    console.warn("getChunks failed", error.code);
    return [];
  }
  return (data ?? []).map((row) => row.content as string);
}

export async function upsertPosition(
  documentId: string,
  chunkSeq: number
): Promise<void> {
  const userId = await currentUserId();
  if (!userId) return;
  const { error } = await supabase.from("playback_positions").upsert({
    document_id: documentId,
    user_id: userId,
    chunk_seq: chunkSeq,
    updated_at: new Date().toISOString(),
  });
  if (error) console.warn("upsertPosition failed", error.code);
}

export async function uploadPdf(
  uri: string,
  filename: string
): Promise<string | null> {
  const userId = await currentUserId();
  if (!userId) return null;

  try {
    const response = await fetch(uri);
    const arrayBuffer = await response.arrayBuffer();
    const path = `${userId}/${Date.now()}-${filename}`;
    const { error } = await supabase.storage
      .from("pdf-uploads")
      .upload(path, arrayBuffer, { contentType: "application/pdf" });
    if (error) {
      console.warn("uploadPdf failed", error.message);
      return null;
    }
    return path;
  } catch (err) {
    console.warn("uploadPdf: read/upload error", (err as Error)?.name);
    return null;
  }
}

type ExtractPdfErrorCode =
  | "invalid_request"
  | "unauthorized"
  | "download_failed"
  | "password_protected"
  | "no_text_found"
  | "corrupt_file";

export type ExtractPdfResult =
  | { documentId: string }
  | { error: ExtractPdfErrorCode | "network_error" };

export async function callExtractPdf(
  storagePath: string,
  filename: string
): Promise<ExtractPdfResult> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  const baseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  if (!token || !anonKey || !baseUrl) return { error: "unauthorized" };

  try {
    const res = await fetch(`${baseUrl}/functions/v1/extract-pdf`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        apikey: anonKey,
      },
      body: JSON.stringify({ storagePath, filename }),
    });
    const json = await res.json();
    if (!res.ok) return { error: json.error ?? "corrupt_file" };
    return { documentId: json.documentId as string };
  } catch (err) {
    console.warn("callExtractPdf: network error", (err as Error)?.name);
    return { error: "network_error" };
  }
}

type ExtractWebErrorCode =
  | "invalid_url"
  | "fetch_failed"
  | "no_content"
  | "unauthorized";

export type ExtractWebResult =
  | { documentId: string }
  | { error: ExtractWebErrorCode | "network_error" };

// Direct fetch() with Bearer token + apikey — never supabase.functions.invoke()
// (CLAUDE.md rule 2: invoke() causes JWT 401s).
export async function callExtractWeb(url: string): Promise<ExtractWebResult> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  const baseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  if (!token || !anonKey || !baseUrl) return { error: "unauthorized" };

  try {
    const res = await fetch(`${baseUrl}/functions/v1/extract-web`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        apikey: anonKey,
      },
      body: JSON.stringify({ url }),
    });
    const json = await res.json();
    if (!res.ok) return { error: json.error ?? "fetch_failed" };
    return { documentId: json.documentId as string };
  } catch (err) {
    console.warn("callExtractWeb: network error", (err as Error)?.name);
    return { error: "network_error" };
  }
}

export async function deleteDocument(documentId: string): Promise<boolean> {
  const { error } = await supabase
    .from("documents")
    .delete()
    .eq("id", documentId);
  if (error) {
    console.warn("deleteDocument failed", error.code);
    return false;
  }
  return true;
}
