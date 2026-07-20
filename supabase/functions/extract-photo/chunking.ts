// Deno port of lib/chunking.ts — same output contract, kept in sync by hand
// since the Edge Function runtime can't import the RN app's TS directly.

const CHUNK_SIZE = 1000;
const HARD_MAX = Math.round(CHUNK_SIZE * 1.5);

function splitSentences(paragraph: string): string[] {
  const out: string[] = [];
  let start = 0;
  for (let i = 0; i < paragraph.length; i++) {
    const ch = paragraph[i];
    if (ch === "." || ch === "!" || ch === "?" || ch === "…") {
      const next = paragraph[i + 1];
      if (next === undefined || next === " " || next === "\t") {
        const sentence = paragraph.slice(start, i + 1).trim();
        if (sentence) out.push(sentence);
        start = i + 1;
      }
    }
  }
  const rest = paragraph.slice(start).trim();
  if (rest) out.push(rest);
  return out;
}

function splitLongSentence(sentence: string): string[] {
  const words = sentence.split(/\s+/);
  const out: string[] = [];
  let current = "";
  for (const word of words) {
    if (current && current.length + word.length + 1 > CHUNK_SIZE) {
      out.push(current);
      current = word;
    } else {
      current = current ? `${current} ${word}` : word;
    }
  }
  if (current) out.push(current);
  return out;
}

export function chunkText(raw: string): string[] {
  const text = raw.replace(/\r/g, "").trim();
  if (!text) return [];

  const paragraphs = text
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let current = "";

  const flush = () => {
    const trimmed = current.trim();
    if (trimmed) chunks.push(trimmed);
    current = "";
  };

  for (const paragraph of paragraphs) {
    for (const sentence of splitSentences(paragraph)) {
      const pieces =
        sentence.length > HARD_MAX ? splitLongSentence(sentence) : [sentence];
      for (const piece of pieces) {
        if (current && current.length + piece.length + 1 > CHUNK_SIZE) {
          flush();
        }
        current = current ? `${current} ${piece}` : piece;
      }
    }
    if (current.length >= CHUNK_SIZE * 0.6) flush();
  }
  flush();

  return chunks;
}
