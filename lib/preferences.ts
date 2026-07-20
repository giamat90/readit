import { supabase } from "@/lib/supabase";
import { useUserStore } from "@/store/user";
import type { Profile } from "@/types";

type PreferenceUpdate = Partial<
  Pick<Profile, "preferred_voice" | "preferred_rate" | "app_language">
>;

// Applies instantly to the local store (works offline); Supabase sync is
// fire-and-forget, same pattern as upsertPosition — never blocks the UI.
export async function updatePreferences(update: PreferenceUpdate): Promise<void> {
  const { profile, setProfile } = useUserStore.getState();
  if (!profile) return;

  setProfile({ ...profile, ...update });

  const { error } = await supabase
    .from("profiles")
    .update(update)
    .eq("id", profile.id);
  if (error) console.warn("updatePreferences: sync failed", error.code);
}
