import { create } from "zustand";
import type { Profile } from "@/types";
import { CONFIG } from "@/constants";

// Skeleton store — auth wiring lands in TASK-002, Pro gating in TASK-009
interface UserState {
  profile: Profile | null;
  isPro: boolean;
  preferredVoice: string | null;
  preferredRate: number;
  setProfile: (profile: Profile | null) => void;
  setIsPro: (isPro: boolean) => void;
  setPreferredVoice: (voice: string | null) => void;
  setPreferredRate: (rate: number) => void;
}

export const useUserStore = create<UserState>((set) => ({
  profile: null,
  isPro: false,
  preferredVoice: null,
  preferredRate: CONFIG.RATE_DEFAULT,
  setProfile: (profile) =>
    set({ profile, isPro: profile?.is_pro ?? false }),
  setIsPro: (isPro) => set({ isPro }),
  setPreferredVoice: (preferredVoice) => set({ preferredVoice }),
  setPreferredRate: (preferredRate) => set({ preferredRate }),
}));
