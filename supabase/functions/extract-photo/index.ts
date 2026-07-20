// extract-photo: download an uploaded image, transcribe it with Claude
// vision OCR, chunk the text, save as a document, then delete the image.
// Same shape as extract-web/extract-pdf: caller-scoped Supabase client so
// RLS applies naturally; text-only storage model.
//
// Never log document content OR the image itself — only metadata
// (document_id, char_count). This is user-photographed material.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { chunkText } from "./chunking.ts";

const OCR_SYSTEM_PROMPT = `You transcribe text from photographs of printed or handwritten pages.
Output ONLY the transcribed text, in natural reading order, exactly as it appears.
Do not add commentary, descriptions, summaries, or markdown formatting.
Preserve paragraph breaks. If the image contains no legible text, output exactly: NO_TEXT_DETECTED`;

type ErrorCode =
  | "invalid_request"
  | "unauthorized"
  | "download_failed"
  | "no_text_detected"
  | "image_unreadable";

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
    filename = String(body.filename ?? "Photo");
    if (!storagePath.startsWith(`${user.id}/`)) throw new Error("path mismatch");
  } catch {
    return errorResponse("invalid_request", 400);
  }

  const cleanup = () => supabase.storage.from("photo-uploads").remove([storagePath]);

  const { data: fileBlob, error: downloadError } = await supabase.storage
    .from("photo-uploads")
    .download(storagePath);
  if (downloadError || !fileBlob) {
    await cleanup();
    return errorResponse("download_failed", 502);
  }

  let base64Image: string;
  try {
    const buffer = new Uint8Array(await fileBlob.arrayBuffer());
    base64Image = btoa(String.fromCharCode(...buffer));
  } catch {
    await cleanup();
    return errorResponse("image_unreadable", 422);
  }

  let text = "";
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": Deno.env.get("ANTHROPIC_API_KEY")!,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 4096,
        system: OCR_SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: fileBlob.type || "image/jpeg",
                  data: base64Image,
                },
              },
              { type: "text", text: "Transcribe this image." },
            ],
          },
        ],
      }),
    });
    if (!res.ok) throw new Error(`Claude API status ${res.status}`);
    const json = await res.json();
    text = json.content?.[0]?.text ?? "";
  } catch (err) {
    await cleanup();
    console.warn("extract-photo: Claude call failed", (err as Error)?.message);
    return errorResponse("image_unreadable", 502);
  }

  if (!text.trim() || text.trim() === "NO_TEXT_DETECTED") {
    await cleanup();
    return errorResponse("no_text_detected", 422);
  }

  const chunks = chunkText(text);
  if (chunks.length === 0) {
    await cleanup();
    return errorResponse("no_text_detected", 422);
  }

  const charCount = chunks.reduce((n, c) => n + c.length, 0);
  const { data: doc, error: docError } = await supabase
    .from("documents")
    .insert({
      user_id: user.id,
      title: filename.slice(0, 200),
      source_type: "photo",
      char_count: charCount,
      chunk_count: chunks.length,
      status: "ready",
    })
    .select("id")
    .single();

  if (docError || !doc) {
    await cleanup();
    return errorResponse("image_unreadable", 500);
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
    return errorResponse("image_unreadable", 500);
  }

  return new Response(JSON.stringify({ documentId: doc.id }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
