import { usePreferencesStore } from "@/store/preferences";

type PreferenceUpdate = {
  preferred_voice?: string | null;
  preferred_rate?: number;
  app_language?: string;
};

// Thin adapter over the persisted preferences store. Kept with the old
// snake-case signature so the settings screens don't need to change. Writes
// are synchronous + local now (no network); the Promise is vestigial.
export async function updatePreferences(update: PreferenceUpdate): Promise<void> {
  const s = usePreferencesStore.getState();
  if (update.preferred_voice !== undefined) s.setPreferredVoice(update.preferred_voice);
  if (update.preferred_rate !== undefined) s.setPreferredRate(update.preferred_rate);
  if (update.app_language !== undefined) s.setAppLanguage(update.app_language);
}
