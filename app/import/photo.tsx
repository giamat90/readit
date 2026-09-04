import { useState } from "react";
import { ActivityIndicator, Image, Pressable, Text, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Camera, ImageIcon } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { callExtractPhoto, getChunks, getDocumentMeta } from "@/lib/documents";
import { usePlayerStore } from "@/store/player";
import { COLORS } from "@/constants";

export default function PhotoImportScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const loadDocument = usePlayerStore((s) => s.loadDocument);
  const [loading, setLoading] = useState(false);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  async function process(uri: string) {
    setPreviewUri(uri);
    setErrorKey(null);
    setLoading(true);

    const filename = `photo-${Date.now()}.jpg`;
    const extraction = await callExtractPhoto(uri, filename);
    if ("error" in extraction) {
      const map: Record<string, string> = {
        no_text_detected: "import.errorNoTextDetected",
        ocr_failed: "import.errorOcrFailed",
      };
      setErrorKey(map[extraction.error] ?? "import.errorOcrFailed");
      setLoading(false);
      return;
    }

    const [chunks, meta] = await Promise.all([
      getChunks(extraction.documentId),
      getDocumentMeta(extraction.documentId),
    ]);
    setLoading(false);
    if (chunks.length === 0) {
      setErrorKey("import.errorNoTextDetected");
      return;
    }
    loadDocument(meta?.title ?? filename, chunks, {
      documentId: extraction.documentId,
      language: meta?.language ?? null,
    });
    router.push("/player");
  }

  async function handleTakePhoto() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setErrorKey("import.cameraPermissionDenied");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.9 });
    if (!result.canceled && result.assets?.[0]) process(result.assets[0].uri);
  }

  async function handleChooseFromGallery() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.9,
    });
    if (!result.canceled && result.assets?.[0]) process(result.assets[0].uri);
  }

  return (
    <View className="flex-1 bg-paper px-6 pt-4 dark:bg-ink">
      <Stack.Screen options={{ title: t("import.fromPhoto") }} />

      {errorKey && (
        <View className="mb-4 rounded-lg bg-danger/10 px-4 py-3">
          <Text className="text-sm text-danger">{t(errorKey)}</Text>
        </View>
      )}

      {previewUri && (
        <Image
          source={{ uri: previewUri }}
          className="mb-4 h-48 w-full rounded-lg"
          resizeMode="cover"
        />
      )}

      <Pressable
        accessibilityRole="button"
        onPress={handleTakePhoto}
        disabled={loading}
        className={`mb-3 flex-row items-center justify-center rounded-lg bg-primary py-3.5 ${
          loading ? "opacity-40" : ""
        }`}
      >
        {loading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <>
            <Camera color="#FFFFFF" size={20} />
            <Text className="ml-2 text-base font-semibold text-white">
              {t("import.takePhoto")}
            </Text>
          </>
        )}
      </Pressable>

      {loading && (
        <Text className="mb-3 text-center text-sm text-muted">
          {t("import.readingPhoto")}
        </Text>
      )}

      <Pressable
        accessibilityRole="button"
        onPress={handleChooseFromGallery}
        disabled={loading}
        className={`flex-row items-center justify-center rounded-lg border border-muted/30 py-3.5 ${
          loading ? "opacity-40" : ""
        }`}
      >
        <ImageIcon color={COLORS.secondary} size={20} />
        <Text className="ml-2 text-base font-medium text-secondary">
          {t("import.chooseFromGallery")}
        </Text>
      </Pressable>
    </View>
  );
}
