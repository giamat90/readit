import "@/lib/i18n";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import i18n from "@/lib/i18n";
import { supabase } from "@/lib/supabase";
import { useUserStore } from "@/store/user";
import { COLORS } from "@/constants";
import type { Profile } from "@/types";
import "../global.css";

export { ErrorBoundary } from "expo-router";

// Defined outside the component (CLAUDE.md rule 5) — fetches the profile row,
// falling back to a minimal profile when the on_auth_user_created trigger row
// hasn't landed yet (same race GreenThumb hit).
async function fetchProfile(userId: string): Promise<Profile> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();
  if (!error && data) return data as Profile;
  return {
    id: userId,
    is_pro: false,
    preferred_voice: null,
    preferred_rate: 1.0,
    app_language: "en",
    created_at: new Date().toISOString(),
  };
}

// app_language is UI chrome (English/Italiano labels) — independent from a
// document's spoken language, which is resolved per-document elsewhere.
function syncAppLanguage(profile: Profile) {
  if (profile.app_language && profile.app_language !== i18n.language) {
    i18n.changeLanguage(profile.app_language);
  }
}

export default function RootLayout() {
  const [authReady, setAuthReady] = useState(false);
  const { session, setSession, setProfile } = useUserStore();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: current } }) => {
      setSession(current);
      if (current) {
        fetchProfile(current.user.id).then((p) => {
          setProfile(p);
          syncAppLanguage(p);
        });
      }
      setAuthReady(true);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession) {
        fetchProfile(newSession.user.id).then((p) => {
          setProfile(p);
          syncAppLanguage(p);
        });
      } else {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Routing guard: signed-out users always land on login
  useEffect(() => {
    if (!authReady) return;
    const inAuthGroup = segments[0] === "(auth)";
    if (!session && !inAuthGroup) {
      router.replace("/(auth)/login");
    } else if (session && inAuthGroup) {
      router.replace("/(tabs)");
    }
  }, [authReady, session, segments]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!authReady) {
    return (
      <View className="flex-1 items-center justify-center bg-paper dark:bg-ink">
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="auto" />
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="import" options={{ headerShown: false }} />
        <Stack.Screen name="settings" options={{ headerShown: false }} />
        <Stack.Screen name="player" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}
