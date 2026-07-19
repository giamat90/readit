import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Gauge, Globe, Mic, User } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import type { LucideIcon } from "lucide-react-native";
import { COLORS } from "@/constants";

function SettingsRow({ icon: Icon, label, hint }: { icon: LucideIcon; label: string; hint: string }) {
  return (
    <View className="flex-row items-center border-b border-muted/20 px-6 py-4">
      <Icon color={COLORS.muted} size={20} />
      <Text className="ml-4 flex-1 text-base text-ink dark:text-paper">{label}</Text>
      <Text className="text-sm text-muted">{hint}</Text>
    </View>
  );
}

export default function SettingsScreen() {
  const { t } = useTranslation();

  // Placeholder rows — real settings land in TASK-008
  return (
    <SafeAreaView className="flex-1 bg-paper dark:bg-ink">
      <View className="px-6 pt-4 pb-2">
        <Text className="text-3xl font-bold text-ink dark:text-paper">
          {t("settings.title")}
        </Text>
      </View>

      <SettingsRow icon={Mic} label={t("settings.voice")} hint={t("settings.comingSoon")} />
      <SettingsRow icon={Gauge} label={t("settings.rate")} hint={t("settings.comingSoon")} />
      <SettingsRow icon={Globe} label={t("settings.language")} hint={t("settings.comingSoon")} />
      <SettingsRow icon={User} label={t("settings.account")} hint={t("settings.comingSoon")} />
    </SafeAreaView>
  );
}
