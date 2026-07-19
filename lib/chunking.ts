import { CONFIG } from "../constants";

// Sentences end at . ! ? … followed by whitespace (or end of paragraph).
// Implemented without regex lookbehind for Hermes safety.
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

// A sentence longer than this gets force-split on word boundaries.
const HARD_MAX = Math.round(CONFIG.CHUNK_SIZE * 1.5);

function splitLongSentence(sentence: string): string[] {
  const words = sentence.split(/\s+/);
  const out: string[] = [];
  let current = "";
  for (const word of words) {
    if (current && current.length + word.length + 1 > CONFIG.CHUNK_SIZE) {
      out.push(current);
      current = word;
    } else {
      current = current ? `${current} ${word}` : word;
    }
  }
  if (current) out.push(current);
  return out;
}

/**
 * Split text into TTS-sized chunks (~CONFIG.CHUNK_SIZE chars).
 * Chunks break on sentence ends, preferring paragraph boundaries;
 * never returns empty chunks. Same contract the extraction edge
 * functions will implement server-side (TASK-005+).
 */
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
        if (current && current.length + piece.length + 1 > CONFIG.CHUNK_SIZE) {
          flush();
        }
        current = current ? `${current} ${piece}` : piece;
      }
    }
    // Prefer chunk breaks at paragraph boundaries once reasonably full
    if (current.length >= CONFIG.CHUNK_SIZE * 0.6) flush();
  }
  flush();

  return chunks;
}
