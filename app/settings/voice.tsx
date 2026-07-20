import { useEffect, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";
import * as Speech from "expo-speech";
import { Check } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { updatePreferences } from "@/lib/preferences";
import { useUserStore } from "@/store/user";
import { COLORS } from "@/constants";

export default function VoiceSettingScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const preferredVoice = useUserStore((s) => s.preferredVoice);
  const [voices, setVoices] = useState<Speech.Voice[]>([]);

  useEffect(() => {
    Speech.getAvailableVoicesAsync().then((list) => {
      // Sort by language so voices for the same locale sit together
      setVoices([...list].sort((a, b) => a.language.localeCompare(b.language)));
    });
  }, []);

  async function select(identifier: string | null) {
    await updatePreferences({ preferred_voice: identifier });
    router.back();
  }

  return (
    <SafeAreaView className="flex-1 bg-paper dark:bg-ink">
      <Stack.Screen options={{ title: t("settings.selectVoice") }} />
      <FlatList
        data={voices}
        keyExtractor={(v) => v.identifier}
        ListHeaderComponent={
          <Pressable
            accessibilityRole="button"
            onPress={() => select(null)}
            className="flex-row items-center justify-between border-b border-muted/20 px-6 py-4"
          >
            <Text className="text-base text-ink dark:text-paper">
              {t("settings.voiceDefault")}
            </Text>
            {preferredVoice === null && <Check color={COLORS.primary} size={20} />}
          </Pressable>
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            onPress={() => select(item.identifier)}
            className="flex-row items-center justify-between border-b border-muted/20 px-6 py-4"
          >
            <View className="flex-1 pr-3">
              <Text className="text-base text-ink dark:text-paper">{item.name}</Text>
              <Text className="mt-0.5 text-xs text-muted">{item.language}</Text>
            </View>
            {preferredVoice === item.identifier && (
              <Check color={COLORS.primary} size={20} />
            )}
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}
