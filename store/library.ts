import { create } from "zustand";
import type { Document } from "@/types";

// Skeleton store — document fetching lands in TASK-004
type LibraryStatus = "idle" | "loading" | "ready" | "error";

interface LibraryState {
  documents: Document[];
  status: LibraryStatus;
  setDocuments: (documents: Document[]) => void;
  setStatus: (status: LibraryStatus) => void;
}

export const useLibraryStore = create<LibraryState>((set) => ({
  documents: [],
  status: "idle",
  setDocuments: (documents) => set({ documents, status: "ready" }),
  setStatus: (status) => set({ status }),
}));
