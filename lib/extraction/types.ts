// Shared contract for the on-device extractors (web / pdf / photo).
// Extractors return raw text + a title + an optional language hint only —
// chunking (lib/chunking.ts) and language detection (lib/language.ts) run
// afterwards in lib/documents.ts, exactly as the paste path already does.

export interface ExtractedText {
  title: string;
  text: string;
  language: string | null;
}

// Thrown by an extractor to signal a user-facing failure. `code` must be one
// of the error-code unions the importer screens already map to i18n keys.
export class ExtractionError extends Error {
  constructor(public code: string) {
    super(code);
    this.name = "ExtractionError";
  }
}
