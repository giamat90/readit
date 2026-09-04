import "@/lib/i18n";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import i18n from "@/lib/i18n";
import { initDb } from "@/lib/db";
import { usePreferencesStore } from "@/store/preferences";
import { ExtractionEngine } from "@/lib/extraction/engine";
import { COLORS } from "@/constants";
import "../global.css";

export { ErrorBoundary } from "expo-router";

export default function RootLayout() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        await initDb();
        await usePreferencesStore.persist.rehydrate();
        const lang = usePreferencesStore.getState().appLanguage;
        if (lang && lang !== i18n.language) await i18n.changeLanguage(lang);
      } catch (err) {
        console.warn("bootstrap failed", (err as Error)?.name);
      } finally {
        setReady(true);
      }
    })();
  }, []);

  if (!ready) {
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
        <Stack.Screen name="import" options={{ headerShown: false }} />
        <Stack.Screen name="settings" options={{ headerShown: false }} />
        <Stack.Screen name="player" options={{ headerShown: false }} />
      </Stack>
      <ExtractionEngine />
    </>
  );
}
