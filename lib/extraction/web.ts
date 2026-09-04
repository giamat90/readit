import { runInEngine } from "@/lib/extraction/engine";
import { ExtractionError, type ExtractedText } from "@/lib/extraction/types";

const FETCH_TIMEOUT_MS = 12_000;
const USER_AGENT =
  "Mozilla/5.0 (compatible; ReadItBot/1.0; +https://giamat90.github.io/readit-support/)";
const MIN_CONTENT_CHARS = 200;
const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function bytesToBase64(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : 0;
    out += B64[b0 >> 2];
    out += B64[((b0 & 3) << 4) | (b1 >> 4)];
    out += i + 1 < bytes.length ? B64[((b1 & 15) << 2) | (b2 >> 6)] : "=";
    out += i + 2 < bytes.length ? B64[b2 & 63] : "=";
  }
  return out;
}

// Very last-resort extraction: strip chrome/script, keep <article> or <body>.
function crudeStrip(html: string): string {
  let h = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<(nav|header|footer|aside)[\s\S]*?<\/\1>/gi, " ");
  const article = h.match(/<article[\s\S]*?<\/article>/i);
  if (article) h = article[0];
  return h
    .replace(/<\/(p|div|h[1-6]|li|br)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function extractWeb(url: string): Promise<ExtractedText> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new ExtractionError("invalid_url");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new ExtractionError("invalid_url");
  }

  // The ONE outbound network request in the whole app.
  let html: string;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(parsed.toString(), {
      headers: { "User-Agent": USER_AGENT, Accept: "text/html,*/*" },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`http_${res.status}`);
    html = await res.text();
  } catch {
    throw new ExtractionError("fetch_failed");
  }

  const htmlB64 = bytesToBase64(new TextEncoder().encode(html));

  try {
    const article = await runInEngine<ExtractedText>("readability", {
      htmlB64,
      baseUrl: parsed.toString(),
    });
    if (article.text && article.text.trim().length >= MIN_CONTENT_CHARS) {
      return {
        title: article.title || parsed.hostname,
        text: article.text.trim(),
        language: article.language,
      };
    }
  } catch (err) {
    console.warn("extractWeb: engine failed, using fallback", (err as Error)?.message);
  }

  const text = crudeStrip(html);
  if (text.length < 50) throw new ExtractionError("no_content");
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const langMatch = html.match(/<html[^>]*\slang=["']?([a-zA-Z-]+)/i);
  return {
    title: (titleMatch?.[1] ?? parsed.hostname).trim().slice(0, 200),
    text,
    language: langMatch?.[1] ?? null,
  };
}
