import { useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { ClipboardPaste, Play } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { callExtractWeb, getChunks, getDocumentMeta } from "@/lib/documents";
import { usePlayerStore } from "@/store/player";
import { COLORS } from "@/constants";

function looksLikeUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export default function WebImportScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const loadDocument = usePlayerStore((s) => s.loadDocument);
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const canExtract = looksLikeUrl(url) && !loading;

  async function handlePasteFromClipboard() {
    const clipboardText = await Clipboard.getStringAsync();
    if (clipboardText) setUrl(clipboardText.trim());
  }

  async function handleExtract() {
    if (!canExtract) return;
    setLoading(true);
    setErrorKey(null);
    const result = await callExtractWeb(url.trim());
    if ("error" in result) {
      const map: Record<string, string> = {
        invalid_url: "import.errorInvalidUrl",
        fetch_failed: "import.errorFetchFailed",
        network_error: "import.errorFetchFailed",
        no_content: "import.errorNoContent",
        unauthorized: "import.errorFetchFailed",
      };
      setErrorKey(map[result.error] ?? "import.errorFetchFailed");
      setLoading(false);
      return;
    }
    const [chunks, meta] = await Promise.all([
      getChunks(result.documentId),
      getDocumentMeta(result.documentId),
    ]);
    setLoading(false);
    if (chunks.length === 0) {
      setErrorKey("import.errorNoContent");
      return;
    }
    loadDocument(meta?.title ?? url.trim(), chunks, {
      documentId: result.documentId,
      language: meta?.language ?? null,
    });
    router.push("/player");
  }

  return (
    <View className="flex-1 bg-paper px-6 pt-4 dark:bg-ink">
      <Stack.Screen options={{ title: t("import.fromWeb") }} />

      {errorKey && (
        <View className="mb-4 rounded-lg bg-danger/10 px-4 py-3">
          <Text className="text-sm text-danger">{t(errorKey)}</Text>
        </View>
      )}

      <View className="mb-4 flex-row items-center rounded-lg border border-muted/30 bg-white px-4 dark:bg-ink">
        <TextInput
          className="flex-1 py-3 text-base text-ink dark:text-paper"
          placeholder={t("import.urlPlaceholder")}
          placeholderTextColor={COLORS.muted}
          value={url}
          onChangeText={setUrl}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          editable={!loading}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("import.pasteFromClipboard")}
          onPress={handlePasteFromClipboard}
          disabled={loading}
          className="pl-3"
        >
          <ClipboardPaste color={COLORS.secondary} size={20} />
        </Pressable>
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={handleExtract}
        disabled={!canExtract}
        className={`flex-row items-center justify-center rounded-lg bg-primary py-3.5 ${
          canExtract ? "" : "opacity-40"
        }`}
      >
        {loading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <>
            <Play color="#FFFFFF" size={20} />
            <Text className="ml-2 text-base font-semibold text-white">
              {t("import.extract")}
            </Text>
          </>
        )}
      </Pressable>
    </View>
  );
}
