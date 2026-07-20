import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import { Link2, Play } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { chunkText } from "@/lib/chunking";
import { detectLanguage } from "@/lib/language";
import { saveDocument } from "@/lib/documents";
import { usePlayerStore } from "@/store/player";
import { COLORS } from "@/constants";

export default function PasteScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const loadDocument = usePlayerStore((s) => s.loadDocument);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");

  const canListen = text.trim().length > 0;

  function handleListen() {
    const chunks = chunkText(text);
    if (chunks.length === 0) return;
    const first = chunks[0] ?? "";
    const docTitle =
      title.trim() || first.slice(0, 40) + (first.length > 40 ? "…" : "");
    const language = detectLanguage(text);
    loadDocument(docTitle, chunks, { language });
    router.push("/player");
    // Persist in the background — playback must never wait for the network.
    // Offline failure is silent by design: the text still plays.
    saveDocument({ title: docTitle, chunks, sourceType: "paste", language }).then(
      (id) => {
        if (id) usePlayerStore.getState().setDocumentId(id);
      }
    );
  }

  return (
    <View className="flex-1 bg-paper px-6 pt-4 dark:bg-ink">
      <Stack.Screen options={{ title: t("import.pasteTitle") }} />

      <TextInput
        className="mb-3 rounded-lg border border-muted/30 bg-white px-4 py-3 text-base text-ink dark:bg-ink dark:text-paper"
        placeholder={t("import.titlePlaceholder")}
        placeholderTextColor={COLORS.muted}
        value={title}
        onChangeText={setTitle}
      />
      <TextInput
        className="flex-1 rounded-lg border border-muted/30 bg-white px-4 py-3 text-base text-ink dark:bg-ink dark:text-paper"
        placeholder={t("import.textPlaceholder")}
        placeholderTextColor={COLORS.muted}
        value={text}
        onChangeText={setText}
        multiline
        textAlignVertical="top"
      />

      <Pressable
        accessibilityRole="button"
        onPress={handleListen}
        disabled={!canListen}
        className={`my-4 flex-row items-center justify-center rounded-lg bg-primary py-3.5 ${
          canListen ? "" : "opacity-40"
        }`}
      >
        <Play color="#FFFFFF" size={20} />
        <Text className="ml-2 text-base font-semibold text-white">
          {t("import.listen")}
        </Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        onPress={() => router.push("/import/web")}
        className="mb-4 flex-row items-center justify-center py-2"
      >
        <Link2 color={COLORS.secondary} size={18} />
        <Text className="ml-2 text-sm text-secondary">{t("import.fromWeb")}</Text>
      </Pressable>
    </View>
  );
}
