import { create } from "zustand";
import { CONFIG } from "@/constants";

// Skeleton store — expo-speech playback engine lands in TASK-003.
// Chunk advancement must be driven by expo-speech onDone (CLAUDE.md rule 7).
interface PlayerState {
  documentId: string | null;
  chunkIndex: number;
  isPlaying: boolean;
  rate: number;
  setDocument: (documentId: string | null) => void;
  setChunkIndex: (chunkIndex: number) => void;
  setIsPlaying: (isPlaying: boolean) => void;
  setRate: (rate: number) => void;
}

export const usePlayerStore = create<PlayerState>((set) => ({
  documentId: null,
  chunkIndex: 0,
  isPlaying: false,
  rate: CONFIG.RATE_DEFAULT,
  setDocument: (documentId) =>
    set({ documentId, chunkIndex: 0, isPlaying: false }),
  setChunkIndex: (chunkIndex) => set({ chunkIndex }),
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setRate: (rate) =>
    set({
      rate: Math.min(CONFIG.RATE_MAX, Math.max(CONFIG.RATE_MIN, rate)),
    }),
}));
