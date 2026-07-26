import { Alert, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Gauge, Globe, LogOut, Mic } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import type { LucideIcon } from "lucide-react-native";
import { supabase } from "@/lib/supabase";
import { useUserStore } from "@/store/user";
import { COLORS } from "@/constants";
import { LANGUAGES } from "@/app/settings/language";

function SettingsRow({
  icon: Icon,
  label,
  hint,
  onPress,
}: {
  icon: LucideIcon;
  label: string;
  hint: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="flex-row items-center border-b border-muted/20 px-6 py-4"
    >
      <Icon color={COLORS.muted} size={20} />
      <Text className="ml-4 flex-1 text-base text-ink dark:text-paper">{label}</Text>
      <Text className="text-sm text-muted">{hint}</Text>
    </Pressable>
  );
}

export default function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const session = useUserStore((s) => s.session);
  const preferredVoice = useUserStore((s) => s.preferredVoice);
  const preferredRate = useUserStore((s) => s.preferredRate);

  const languageHint = t(
    LANGUAGES.find((l) => l.code === i18n.language)?.labelKey ?? "settings.english"
  );

  function confirmSignOut() {
    Alert.alert(t("auth.signOut"), t("auth.signOutConfirm"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("auth.signOut"),
        style: "destructive",
        onPress: () => {
          supabase.auth.signOut();
        },
      },
    ]);
  }

  return (
    <SafeAreaView className="flex-1 bg-paper dark:bg-ink">
      <View className="px-6 pt-4 pb-2">
        <Text className="text-3xl font-bold text-ink dark:text-paper">
          {t("settings.title")}
        </Text>
      </View>

      <SettingsRow
        icon={Mic}
        label={t("settings.voice")}
        hint={preferredVoice ?? t("settings.voiceDefault")}
        onPress={() => router.push("/settings/voice")}
      />
      <SettingsRow
        icon={Gauge}
        label={t("settings.rate")}
        hint={`${preferredRate}×`}
        onPress={() => router.push("/settings/rate")}
      />
      <SettingsRow
        icon={Globe}
        label={t("settings.language")}
        hint={languageHint}
        onPress={() => router.push("/settings/language")}
      />

      <Pressable
        accessibilityRole="button"
        onPress={confirmSignOut}
        className="flex-row items-center border-b border-muted/20 px-6 py-4"
      >
        <LogOut color={COLORS.danger} size={20} />
        <View className="ml-4 flex-1">
          <Text className="text-base text-danger">{t("auth.signOut")}</Text>
          {session?.user.email && (
            <Text className="mt-0.5 text-xs text-muted">
              {t("settings.signedInAs")} {session.user.email}
            </Text>
          )}
        </View>
      </Pressable>
    </SafeAreaView>
  );
}
