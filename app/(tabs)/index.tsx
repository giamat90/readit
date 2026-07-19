import { useCallback } from "react";
import { Alert, FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { BookOpen, FileText, Plus } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useLibraryStore } from "@/store/library";
import { usePlayerStore } from "@/store/player";
import { deleteDocument, getChunks } from "@/lib/documents";
import { COLORS } from "@/constants";
import type { DocumentWithPosition } from "@/types";

function progressOf(doc: DocumentWithPosition): { current: number; pct: number } {
  const seq = doc.playback_positions[0]?.chunk_seq;
  const current = seq === undefined ? 0 : seq + 1;
  const pct =
    doc.chunk_count > 0 ? Math.round((current / doc.chunk_count) * 100) : 0;
  return { current, pct };
}

export default function LibraryScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { documents, status, fetchDocuments, removeDocument } = useLibraryStore();

  useFocusEffect(
    useCallback(() => {
      fetchDocuments();
    }, [fetchDocuments])
  );

  async function openDocument(doc: DocumentWithPosition) {
    const chunks = await getChunks(doc.id);
    if (chunks.length === 0) return;
    const s = usePlayerStore.getState();
    s.loadDocument(doc.title, chunks, {
      documentId: doc.id,
      language: doc.language,
    });
    const seq = doc.playback_positions[0]?.chunk_seq ?? 0;
    if (seq > 0 && seq < chunks.length) s.setChunkIndex(seq);
    router.push("/player");
  }

  function confirmDelete(doc: DocumentWithPosition) {
    Alert.alert(
      t("library.deleteTitle"),
      t("library.deleteConfirm", { title: doc.title }),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.delete"),
          style: "destructive",
          onPress: () => {
            removeDocument(doc.id); // optimistic
            deleteDocument(doc.id);
          },
        },
      ]
    );
  }

  function renderRow({ item }: { item: DocumentWithPosition }) {
    const { current, pct } = progressOf(item);
    return (
      <Pressable
        accessibilityRole="button"
        onPress={() => openDocument(item)}
        onLongPress={() => confirmDelete(item)}
        className="flex-row items-center border-b border-muted/20 px-6 py-4"
      >
        <FileText color={COLORS.primary} size={22} />
        <View className="ml-4 flex-1">
          <Text
            numberOfLines={1}
            className="text-base font-medium text-ink dark:text-paper"
          >
            {item.title}
          </Text>
          <Text className="mt-0.5 text-xs text-muted">
            {new Date(item.created_at).toLocaleDateString(i18n.language)} ·{" "}
            {t("library.progress", { current, total: item.chunk_count })} · {pct}%
          </Text>
        </View>
      </Pressable>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-paper dark:bg-ink">
      <View className="px-6 pt-4">
        <Text className="text-3xl font-bold text-ink dark:text-paper">
          {t("library.title")}
        </Text>
      </View>

      <FlatList
        data={documents}
        keyExtractor={(d) => d.id}
        renderItem={renderRow}
        refreshControl={
          <RefreshControl
            refreshing={status === "loading"}
            onRefresh={fetchDocuments}
            tintColor={COLORS.primary}
          />
        }
        ListEmptyComponent={
          status === "loading" ? null : (
            <View className="items-center px-10 pt-24">
              <BookOpen color={COLORS.muted} size={48} />
              <Text className="mt-4 text-center text-base text-muted">
                {t("library.empty")}
              </Text>
            </View>
          )
        }
      />

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
