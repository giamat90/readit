import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { CONFIG } from "@/constants";
import { deviceLanguage } from "@/lib/i18n";

// User preferences — the only thing outside the SQLite DB. Persisted to
// AsyncStorage; rehydrated explicitly in app/_layout.tsx before first render.
interface PreferencesState {
  preferredVoice: string | null;
  preferredRate: number;
  appLanguage: string;
  setPreferredVoice: (voice: string | null) => void;
  setPreferredRate: (rate: number) => void;
  setAppLanguage: (language: string) => void;
}

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      preferredVoice: null,
      preferredRate: CONFIG.RATE_DEFAULT,
      appLanguage: deviceLanguage(),
      setPreferredVoice: (preferredVoice) => set({ preferredVoice }),
      setPreferredRate: (preferredRate) =>
        set({
          preferredRate: Math.min(
            CONFIG.RATE_MAX,
            Math.max(CONFIG.RATE_MIN, preferredRate)
          ),
        }),
      setAppLanguage: (appLanguage) => set({ appLanguage }),
    }),
    {
      name: "readit-preferences",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        preferredVoice: s.preferredVoice,
        preferredRate: s.preferredRate,
        appLanguage: s.appLanguage,
      }),
    }
  )
);
