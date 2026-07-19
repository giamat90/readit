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
