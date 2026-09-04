import { runInEngine } from "@/lib/extraction/engine";
import { ExtractionError, type ExtractedText } from "@/lib/extraction/types";

// PDF text extraction runs pdf.js inside the hidden WebView. The picked file
// stays on disk; the engine reads it via fetch('file://…') so multi-MB data
// never crosses the RN bridge.
export async function extractPdf(
  fileUri: string,
  filename: string
): Promise<ExtractedText> {
  const fallbackTitle = filename.replace(/\.pdf$/i, "").slice(0, 200);

  let result: ExtractedText;
  try {
    result = await runInEngine<ExtractedText>("pdf", { fileUri, fallbackTitle });
  } catch (err) {
    const code = (err as Error)?.message;
    if (code === "password_protected") throw new ExtractionError("password_protected");
    if (code === "corrupt_file") throw new ExtractionError("corrupt_file");
    console.warn("extractPdf: engine failed", code);
    throw new ExtractionError("corrupt_file");
  }

  const text = (result.text ?? "").trim();
  if (!text) throw new ExtractionError("no_text_found");

  return {
    title: result.title || fallbackTitle || "Untitled",
    text,
    language: null,
  };
}
