import { Pressable, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";
import { Check } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { updatePreferences } from "@/lib/preferences";
import { COLORS } from "@/constants";

export const LANGUAGES: { code: string; labelKey: string }[] = [
  { code: "en", labelKey: "settings.english" },
  { code: "it", labelKey: "settings.italian" },
  { code: "es", labelKey: "settings.spanish" },
  { code: "de", labelKey: "settings.german" },
  { code: "fr", labelKey: "settings.french" },
  { code: "pt", labelKey: "settings.portuguese" },
];

export default function LanguageSettingScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();

  async function select(code: string) {
    await i18n.changeLanguage(code);
    await updatePreferences({ app_language: code });
    router.back();
  }

  return (
    <SafeAreaView className="flex-1 bg-paper dark:bg-ink">
      <Stack.Screen options={{ title: t("settings.selectLanguage") }} />
      {LANGUAGES.map(({ code, labelKey }) => (
        <Pressable
          key={code}
          accessibilityRole="button"
          onPress={() => select(code)}
          className="flex-row items-center justify-between border-b border-muted/20 px-6 py-4"
        >
          <Text className="text-base text-ink dark:text-paper">{t(labelKey)}</Text>
          {i18n.language === code && <Check color={COLORS.primary} size={20} />}
        </Pressable>
      ))}
    </SafeAreaView>
  );
}
