import "@/lib/i18n";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import "../global.css";

export { ErrorBoundary } from "expo-router";

export default function RootLayout() {
  return (
    <>
      <StatusBar style="auto" />
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}
