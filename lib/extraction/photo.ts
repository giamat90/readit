import TextRecognition from "@react-native-ml-kit/text-recognition";
import { ExtractionError, type ExtractedText } from "@/lib/extraction/types";

// On-device OCR via Google ML Kit (bundled model, no network). Replaces the
// old Claude-vision edge function.
export async function extractPhoto(
  imageUri: string,
  filename: string
): Promise<ExtractedText> {
  let text: string;
  try {
    const result = await TextRecognition.recognize(imageUri);
    text = (result.text ?? "").trim();
  } catch (err) {
    console.warn("extractPhoto: OCR error", (err as Error)?.name);
    throw new ExtractionError("ocr_failed");
  }

  if (!text) throw new ExtractionError("no_text_detected");

  const firstLine = text.split("\n").map((l) => l.trim()).find(Boolean) ?? "";
  const base = filename.replace(/\.(jpe?g|png|heic|webp)$/i, "").trim();
  const title =
    base || (firstLine.length > 60 ? `${firstLine.slice(0, 60)}…` : firstLine) || "Photo";

  return { title: title.slice(0, 200), text, language: null };
}
