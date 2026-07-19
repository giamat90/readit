// Shared types — mirror the database schema in CLAUDE.md

export type SourceType = "paste" | "web" | "pdf" | "photo";

export type DocumentStatus = "processing" | "ready" | "error";

export interface Profile {
  id: string;
  is_pro: boolean;
  preferred_voice: string | null;
  preferred_rate: number;
  app_language: string;
  created_at: string;
}

export interface Document {
  id: string;
  user_id: string;
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
  id: string;
  document_id: string;
  seq: number;
  content: string;
}

export interface PlaybackPosition {
  document_id: string;
  user_id: string;
  chunk_seq: number;
  updated_at: string;
}
