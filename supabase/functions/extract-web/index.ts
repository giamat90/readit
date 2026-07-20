// extract-web: fetch a URL, extract the readable article, chunk it, and
// save it as a document owned by the calling user. RLS applies naturally
// because the Supabase client below is built with the caller's own JWT —
// never the service role key.
//
// This is the template TASK-006 (PDF) and TASK-007 (photo) copy: fetch/read
// input -> normalize -> chunk -> insert documents + document_chunks -> reply.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Readability } from "https://esm.sh/@mozilla/readability@0.5.0";
import { parseHTML } from "https://esm.sh/linkedom@0.16.11/worker";
import { chunkText } from "./chunking.ts";

const FETCH_TIMEOUT_MS = 10_000;
const USER_AGENT =
  "Mozilla/5.0 (compatible; ReadItBot/1.0; +https://readit.app)";

type ErrorCode = "invalid_url" | "fetch_failed" | "no_content" | "unauthorized";

function errorResponse(code: ErrorCode, status: number) {
  return new Response(JSON.stringify({ error: code }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return errorResponse("invalid_url", 405);

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

  let url: string;
  try {
    const body = await req.json();
    url = new URL(body.url).toString();
    if (!url.startsWith("http")) throw new Error("not http(s)");
  } catch {
    return errorResponse("invalid_url", 400);
  }

  let html: string;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`status ${res.status}`);
    html = await res.text();
  } catch {
    return errorResponse("fetch_failed", 502);
  }

  let title = url;
  let articleText = "";
  let language: string | null = null;
  try {
    const { document } = parseHTML(html);
    language = document.documentElement.getAttribute("lang");
    const reader = new Readability(document);
    const article = reader.parse();
    if (article?.textContent) {
      title = article.title || title;
      articleText = article.textContent;
    }
  } catch {
    // fall through to no_content below
  }

  const chunks = chunkText(articleText);
  if (chunks.length === 0) return errorResponse("no_content", 422);

  const charCount = chunks.reduce((n, c) => n + c.length, 0);
  const { data: doc, error: docError } = await supabase
    .from("documents")
    .insert({
      user_id: user.id,
      title: title.slice(0, 200),
      source_type: "web",
      source_ref: url,
      language,
      char_count: charCount,
      chunk_count: chunks.length,
      status: "ready",
    })
    .select("id")
    .single();

  if (docError || !doc) {
    return errorResponse("fetch_failed", 500);
  }

  const rows = chunks.map((content, seq) => ({
    document_id: doc.id,
    seq,
    content,
  }));
  const { error: chunksError } = await supabase
    .from("document_chunks")
    .insert(rows);

  if (chunksError) {
    await supabase.from("documents").delete().eq("id", doc.id);
    return errorResponse("fetch_failed", 500);
  }

  return new Response(JSON.stringify({ documentId: doc.id }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
