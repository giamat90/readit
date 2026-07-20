import { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import { FileText, Upload } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { callExtractPdf, getChunks, uploadPdf } from "@/lib/documents";
import { usePlayerStore } from "@/store/player";
import { COLORS } from "@/constants";

type Phase = "idle" | "uploading" | "extracting";

export default function PdfImportScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const loadDocument = usePlayerStore((s) => s.loadDocument);
  const [phase, setPhase] = useState<Phase>("idle");
  const [pickedName, setPickedName] = useState<string | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const loading = phase !== "idle";

  async function handlePick() {
    const result = await DocumentPicker.getDocumentAsync({
      type: "application/pdf",
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.[0]) return;

    const file = result.assets[0];
    setPickedName(file.name);
    setErrorKey(null);
    setPhase("uploading");

    const storagePath = await uploadPdf(file.uri, file.name);
    if (!storagePath) {
      setErrorKey("import.errorFetchFailed");
      setPhase("idle");
      return;
    }

    setPhase("extracting");
    const extraction = await callExtractPdf(storagePath, file.name);
    if ("error" in extraction) {
      const map: Record<string, string> = {
        password_protected: "import.errorPasswordProtected",
        no_text_found: "import.errorNoTextFound",
        corrupt_file: "import.errorCorruptFile",
        download_failed: "import.errorFetchFailed",
        network_error: "import.errorFetchFailed",
        unauthorized: "import.errorFetchFailed",
        invalid_request: "import.errorCorruptFile",
      };
      setErrorKey(map[extraction.error] ?? "import.errorCorruptFile");
      setPhase("idle");
      return;
    }

    const chunks = await getChunks(extraction.documentId);
    setPhase("idle");
    if (chunks.length === 0) {
      setErrorKey("import.errorNoTextFound");
      return;
    }
    loadDocument(file.name.replace(/\.pdf$/i, ""), chunks, {
      documentId: extraction.documentId,
    });
    router.push("/player");
  }

  return (
    <View className="flex-1 bg-paper px-6 pt-4 dark:bg-ink">
      <Stack.Screen options={{ title: t("import.fromPdf") }} />

      {errorKey && (
        <View className="mb-4 rounded-lg bg-danger/10 px-4 py-3">
          <Text className="text-sm text-danger">{t(errorKey)}</Text>
        </View>
      )}

      {pickedName && (
        <View className="mb-4 flex-row items-center rounded-lg border border-muted/30 bg-white px-4 py-3 dark:bg-ink">
          <FileText color={COLORS.primary} size={20} />
          <Text
            numberOfLines={1}
            className="ml-3 flex-1 text-sm text-ink dark:text-paper"
          >
            {pickedName}
          </Text>
        </View>
      )}

      <Pressable
        accessibilityRole="button"
        onPress={handlePick}
        disabled={loading}
        className={`flex-row items-center justify-center rounded-lg bg-primary py-3.5 ${
          loading ? "opacity-40" : ""
        }`}
      >
        {loading ? (
          <>
            <ActivityIndicator color="#FFFFFF" />
            <Text className="ml-2 text-base font-semibold text-white">
              {t(phase === "uploading" ? "import.uploading" : "import.extracting")}
            </Text>
          </>
        ) : (
          <>
            <Upload color="#FFFFFF" size={20} />
            <Text className="ml-2 text-base font-semibold text-white">
              {t("import.selectPdf")}
            </Text>
          </>
        )}
      </Pressable>
    </View>
  );
}
