import { create } from "zustand";
import { CONFIG } from "@/constants";

// Playback engine lives in hooks/useSpeechPlayer.ts; this store is pure state.
// Chunk advancement is driven by expo-speech onDone (CLAUDE.md rule 7).
interface PlayerState {
  documentId: string | null; // null for unsaved (pasted) documents; TASK-004 fills it
  title: string;
  chunks: string[];
  language: string | null; // BCP-47 tag; null → device locale decides the voice
  chunkIndex: number;
  isPlaying: boolean;
  rate: number;
  loadDocument: (
    title: string,
    chunks: string[],
    opts?: { documentId?: string; language?: string | null }
  ) => void;
  reset: () => void;
  setChunkIndex: (chunkIndex: number) => void;
  setIsPlaying: (isPlaying: boolean) => void;
  setRate: (rate: number) => void;
}

export const usePlayerStore = create<PlayerState>((set) => ({
  documentId: null,
  title: "",
  chunks: [],
  language: null,
  chunkIndex: 0,
  isPlaying: false,
  rate: CONFIG.RATE_DEFAULT,
  loadDocument: (title, chunks, opts) =>
    set({
      title,
      chunks,
      documentId: opts?.documentId ?? null,
      language: opts?.language ?? null,
      chunkIndex: 0,
      isPlaying: false,
    }),
  reset: () =>
    set({
      documentId: null,
      title: "",
      chunks: [],
      language: null,
      chunkIndex: 0,
      isPlaying: false,
    }),
  setChunkIndex: (chunkIndex) => set({ chunkIndex }),
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setRate: (rate) =>
    set({
      rate: Math.min(CONFIG.RATE_MAX, Math.max(CONFIG.RATE_MIN, rate)),
    }),
}));
