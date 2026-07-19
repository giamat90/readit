import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { BookOpen, Plus } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { COLORS } from "@/constants";

export default function LibraryScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-paper dark:bg-ink">
      <View className="px-6 pt-4">
        <Text className="text-3xl font-bold text-ink dark:text-paper">
          {t("library.title")}
        </Text>
      </View>

      <View className="flex-1 items-center justify-center px-10">
        <BookOpen color={COLORS.muted} size={48} />
        <Text className="mt-4 text-center text-base text-muted">
          {t("library.empty")}
        </Text>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("import.pasteTitle")}
        onPress={() => router.push("/import/paste")}
        className="absolute bottom-8 right-6 h-14 w-14 items-center justify-center rounded-full bg-primary"
      >
        <Plus color="#FFFFFF" size={28} />
      </Pressable>
    </SafeAreaView>
  );
}
