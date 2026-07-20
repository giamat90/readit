import { Pressable, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";
import { Check } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { RATE_STEPS } from "@/hooks/useSpeechPlayer";
import { updatePreferences } from "@/lib/preferences";
import { useUserStore } from "@/store/user";
import { COLORS } from "@/constants";

export default function RateSettingScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const preferredRate = useUserStore((s) => s.preferredRate);

  async function select(rate: number) {
    await updatePreferences({ preferred_rate: rate });
    router.back();
  }

  return (
    <SafeAreaView className="flex-1 bg-paper dark:bg-ink">
      <Stack.Screen options={{ title: t("settings.selectRate") }} />
      {RATE_STEPS.map((rate) => (
        <Pressable
          key={rate}
          accessibilityRole="button"
          onPress={() => select(rate)}
          className="flex-row items-center justify-between border-b border-muted/20 px-6 py-4"
        >
          <Text className="text-base text-ink dark:text-paper">{rate}×</Text>
          {preferredRate === rate && <Check color={COLORS.primary} size={20} />}
        </Pressable>
      ))}
    </SafeAreaView>
  );
}
