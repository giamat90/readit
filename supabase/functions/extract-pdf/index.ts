// extract-pdf: download an uploaded PDF from the private pdf-uploads bucket,
// extract its text, chunk it, save as a document, then delete the uploaded
// file (text-only model — see CLAUDE.md). Same pattern as extract-web:
// caller-scoped Supabase client so RLS applies naturally.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { extractText, getDocumentProxy } from "https://esm.sh/unpdf@0.11.0";
import { chunkText } from "./chunking.ts";

type ErrorCode =
  | "invalid_request"
  | "unauthorized"
  | "download_failed"
  | "password_protected"
  | "no_text_found"
  | "corrupt_file";

function errorResponse(code: ErrorCode, status: number) {
  return new Response(JSON.stringify({ error: code }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return errorResponse("invalid_request", 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return errorResponse("unauthorized", 401);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return errorResponse("unauthorized", 401);

  let storagePath: string;
  let filename: string;
  try {
    const body = await req.json();
    storagePath = String(body.storagePath);
    filename = String(body.filename ?? "Untitled.pdf");
    if (!storagePath.startsWith(`${user.id}/`)) throw new Error("path mismatch");
  } catch {
    return errorResponse("invalid_request", 400);
  }

  // Always clean up the uploaded file, success or failure.
  const cleanup = () => supabase.storage.from("pdf-uploads").remove([storagePath]);

  const { data: fileBlob, error: downloadError } = await supabase.storage
    .from("pdf-uploads")
    .download(storagePath);
  if (downloadError || !fileBlob) {
    await cleanup();
    return errorResponse("download_failed", 502);
  }

  let text = "";
  try {
    const buffer = new Uint8Array(await fileBlob.arrayBuffer());
    const pdf = await getDocumentProxy(buffer);
    const result = await extractText(pdf, { mergePages: true });
    text = Array.isArray(result.text) ? result.text.join("\n") : result.text;
  } catch (err) {
    await cleanup();
    const message = (err as Error)?.message?.toLowerCase() ?? "";
    if (message.includes("password") || message.includes("encrypted")) {
      return errorResponse("password_protected", 422);
    }
    return errorResponse("corrupt_file", 422);
  }

  const chunks = chunkText(text);
  if (chunks.length === 0) {
    await cleanup();
    return errorResponse("no_text_found", 422);
  }

  const charCount = chunks.reduce((n, c) => n + c.length, 0);
  const { data: doc, error: docError } = await supabase
    .from("documents")
    .insert({
      user_id: user.id,
      title: filename.replace(/\.pdf$/i, "").slice(0, 200),
      source_type: "pdf",
      source_ref: filename,
      char_count: charCount,
      chunk_count: chunks.length,
      status: "ready",
    })
    .select("id")
    .single();

  if (docError || !doc) {
    await cleanup();
    return errorResponse("corrupt_file", 500);
  }

  const rows = chunks.map((content, seq) => ({
    document_id: doc.id,
    seq,
    content,
  }));
  const { error: chunksError } = await supabase
    .from("document_chunks")
    .insert(rows);

  await cleanup();

  if (chunksError) {
    await supabase.from("documents").delete().eq("id", doc.id);
    return errorResponse("corrupt_file", 500);
  }

  return new Response(JSON.stringify({ documentId: doc.id }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
