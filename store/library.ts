import { create } from "zustand";
import type { DocumentWithPosition } from "@/types";
import { listDocuments } from "@/lib/documents";

type LibraryStatus = "idle" | "loading" | "ready" | "error";

interface LibraryState {
  documents: DocumentWithPosition[];
  status: LibraryStatus;
  fetchDocuments: () => Promise<void>;
  removeDocument: (id: string) => void;
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  documents: [],
  status: "idle",
  fetchDocuments: async () => {
    if (get().documents.length === 0) set({ status: "loading" });
    const documents = await listDocuments();
    if (documents === null) {
      // fetch failed (offline) — keep the cached list
      set({ status: "ready" });
      return;
    }
    set({ documents, status: "ready" });
  },
  removeDocument: (id) =>
    set({ documents: get().documents.filter((d) => d.id !== id) }),
}));
