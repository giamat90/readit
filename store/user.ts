import { create } from "zustand";
import type { Session } from "@supabase/supabase-js";
import type { Profile } from "@/types";
import { CONFIG } from "@/constants";

interface UserState {
  session: Session | null;
  profile: Profile | null;
  isPro: boolean;
  preferredVoice: string | null;
  preferredRate: number;
  setSession: (session: Session | null) => void;
  setProfile: (profile: Profile | null) => void;
  setIsPro: (isPro: boolean) => void;
  setPreferredVoice: (voice: string | null) => void;
  setPreferredRate: (rate: number) => void;
}

export const useUserStore = create<UserState>((set) => ({
  session: null,
  profile: null,
  isPro: false,
  preferredVoice: null,
  preferredRate: CONFIG.RATE_DEFAULT,
  setSession: (session) => set({ session }),
  setProfile: (profile) =>
    set({
      profile,
      isPro: profile?.is_pro ?? false,
      preferredVoice: profile?.preferred_voice ?? null,
      preferredRate: profile?.preferred_rate ?? CONFIG.RATE_DEFAULT,
    }),
  setIsPro: (isPro) => set({ isPro }),
  setPreferredVoice: (preferredVoice) => set({ preferredVoice }),
  setPreferredRate: (preferredRate) => set({ preferredRate }),
}));
