// Shared types — mirror the on-device SQLite schema in lib/db.ts

export type SourceType = "paste" | "web" | "pdf" | "photo";

export type DocumentStatus = "processing" | "ready" | "error";

export interface Preferences {
  preferredVoice: string | null;
  preferredRate: number;
  appLanguage: string;
}

export interface Document {
  id: string;
  title: string;
  source_type: SourceType;
  source_ref: string | null;
  language: string | null;
  char_count: number;
  chunk_count: number;
  status: DocumentStatus;
  error_msg: string | null;
  created_at: string;
}

export interface DocumentChunk {
  document_id: string;
  seq: number;
  content: string;
}

export interface PlaybackPosition {
  document_id: string;
  chunk_seq: number;
  updated_at: string;
}

// documents row with its playback position folded in (kept as an array so the
// library UI's progressOf() helper stays unchanged from the old embed shape)
export interface DocumentWithPosition extends Document {
  playback_positions: Pick<PlaybackPosition, "chunk_seq">[];
}
