// Lightweight stopword-based language detection for pasted text.
// Covers launch languages (en/it) only; returns null when ambiguous so the
// caller falls back to the device locale. Extraction edge functions
// (TASK-005+) will replace this with proper server-side detection.

const IT_STOPWORDS = new Set([
  "il", "lo", "la", "le", "gli", "un", "una", "uno", "di", "del", "della",
  "che", "per", "non", "con", "sono", "ho", "ha", "ma", "più", "anche",
  "come", "questo", "questa", "è", "sì", "nel", "nella", "dei", "delle",
  "questo", "quella", "essere", "molto", "quando", "perché",
]);

const EN_STOPWORDS = new Set([
  "the", "of", "and", "to", "in", "that", "for", "not", "with", "this",
  "are", "was", "were", "have", "has", "but", "also", "as", "on", "at",
  "it", "is", "be", "from", "they", "their", "there", "what", "which",
  "when", "because", "very",
]);

export function detectLanguage(text: string): string | null {
  const words = text
    .toLowerCase()
    .split(/[^a-zàèéìíòóùú']+/)
    .filter(Boolean)
    .slice(0, 400);

  let it = 0;
  let en = 0;
  for (const word of words) {
    if (IT_STOPWORDS.has(word)) it++;
    if (EN_STOPWORDS.has(word)) en++;
  }

  if (it >= 3 && it > en * 1.5) return "it-IT";
  if (en >= 3 && en > it * 1.5) return "en-US";
  return null;
}
