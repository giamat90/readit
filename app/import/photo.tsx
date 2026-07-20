import { useState } from "react";
import { ActivityIndicator, Image, Pressable, Text, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { Camera, ImageIcon } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { callExtractPhoto, getChunks, uploadPhoto } from "@/lib/documents";
import { usePlayerStore } from "@/store/player";
import { COLORS } from "@/constants";

type Phase = "idle" | "uploading" | "extracting";

// Downscale before upload — keeps OCR latency/cost sane without hurting
// legibility (CLAUDE.md / TASK-007 notes).
async function downscale(uri: string): Promise<string> {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 1600 } }],
    { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
  );
  return result.uri;
}

export default function PhotoImportScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const loadDocument = usePlayerStore((s) => s.loadDocument);
  const [phase, setPhase] = useState<Phase>("idle");
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const loading = phase !== "idle";

  async function process(uri: string) {
    setPreviewUri(uri);
    setErrorKey(null);
    setPhase("uploading");

    const resizedUri = await downscale(uri);
    const filename = `photo-${Date.now()}.jpg`;
    const storagePath = await uploadPhoto(resizedUri, filename);
    if (!storagePath) {
      setErrorKey("import.errorImageUnreadable");
      setPhase("idle");
      return;
    }

    setPhase("extracting");
    const extraction = await callExtractPhoto(storagePath, filename);
    if ("error" in extraction) {
      const map: Record<string, string> = {
        no_text_detected: "import.errorNoTextDetected",
        image_unreadable: "import.errorImageUnreadable",
        download_failed: "import.errorImageUnreadable",
        network_error: "import.errorImageUnreadable",
        unauthorized: "import.errorImageUnreadable",
        invalid_request: "import.errorImageUnreadable",
      };
      setErrorKey(map[extraction.error] ?? "import.errorImageUnreadable");
      setPhase("idle");
      return;
    }

    const chunks = await getChunks(extraction.documentId);
    setPhase("idle");
    if (chunks.length === 0) {
      setErrorKey("import.errorNoTextDetected");
      return;
    }
    const first = chunks[0] ?? "";
    const title = first.slice(0, 40) + (first.length > 40 ? "…" : "");
    loadDocument(title, chunks, { documentId: extraction.documentId });
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
          {t(phase === "uploading" ? "import.uploading" : "import.readingPhoto")}
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
