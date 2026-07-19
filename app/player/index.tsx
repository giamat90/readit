import { useEffect, useRef } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Redirect, useRouter } from "expo-router";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { ChevronLeft, Pause, Play, SkipBack, SkipForward } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useSpeechPlayer } from "@/hooks/useSpeechPlayer";
import { usePlayerStore } from "@/store/player";
import { upsertPosition } from "@/lib/documents";
import { COLORS } from "@/constants";

const KEEP_AWAKE_TAG = "readit-player";

export default function PlayerScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { title, chunks, chunkIndex, isPlaying, rate, documentId } =
    usePlayerStore();
  const { play, toggle, next, prev, cycleRate } = useSpeechPlayer();

  const scrollRef = useRef<ScrollView>(null);
  const chunkOffsets = useRef<number[]>([]);

  // Auto-play on entry
  useEffect(() => {
    if (chunks.length > 0) play();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep the screen awake only while speaking
  useEffect(() => {
    if (isPlaying) activateKeepAwakeAsync(KEEP_AWAKE_TAG);
    else deactivateKeepAwake(KEEP_AWAKE_TAG);
    return () => {
      deactivateKeepAwake(KEEP_AWAKE_TAG);
    };
  }, [isPlaying]);

  // Persist position on every chunk advance (fire-and-forget; ~1 write per
  // minute of listening). documentId is null for unsaved/offline documents.
  useEffect(() => {
    if (documentId) upsertPosition(documentId, chunkIndex);
  }, [documentId, chunkIndex]);

  // Follow the spoken chunk (offsets measured via onLayout — no hardcoded pixels)
  useEffect(() => {
    const y = chunkOffsets.current[chunkIndex];
    if (y !== undefined) {
      scrollRef.current?.scrollTo({ y: Math.max(0, y - 24), animated: true });
    }
  }, [chunkIndex]);

  if (chunks.length === 0) {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <SafeAreaView className="flex-1 bg-paper dark:bg-ink">
      <View className="flex-row items-center border-b border-muted/20 px-4 py-3">
        <Pressable
          accessibilityRole="button"
          onPress={() => router.back()}
          className="pr-3"
        >
          <ChevronLeft color={COLORS.muted} size={24} />
        </Pressable>
        <Text
          numberOfLines={1}
          className="flex-1 text-lg font-semibold text-ink dark:text-paper"
        >
          {title}
        </Text>
      </View>

      <ScrollView ref={scrollRef} className="flex-1 px-6 py-4">
        {chunks.map((chunk, i) => (
          <Text
            key={i}
            onLayout={(e) => {
              chunkOffsets.current[i] = e.nativeEvent.layout.y;
            }}
            className={`mb-3 rounded-lg p-2 text-base leading-6 ${
              i === chunkIndex
                ? "bg-primary/10 text-ink dark:text-paper"
                : "text-muted"
            }`}
          >
            {chunk}
          </Text>
        ))}
        <Text className="mb-8 text-center text-sm text-muted">
          — {t("player.done")} —
        </Text>
      </ScrollView>

      <View className="flex-row items-center justify-around border-t border-muted/20 py-4">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("player.speed")}
          onPress={cycleRate}
          className="w-14 items-center"
        >
          <Text className="text-base font-semibold text-secondary">{rate}×</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={prev} disabled={chunkIndex === 0}>
          <SkipBack
            color={chunkIndex === 0 ? COLORS.muted : COLORS.primary}
            size={28}
          />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={toggle}
          className="h-16 w-16 items-center justify-center rounded-full bg-primary"
        >
          {isPlaying ? (
            <Pause color="#FFFFFF" size={28} />
          ) : (
            <Play color="#FFFFFF" size={28} />
          )}
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={next}
          disabled={chunkIndex >= chunks.length - 1}
        >
          <SkipForward
            color={chunkIndex >= chunks.length - 1 ? COLORS.muted : COLORS.primary}
            size={28}
          />
        </Pressable>
        <View className="w-14 items-center">
          <Text className="text-sm text-muted">
            {chunkIndex + 1}/{chunks.length}
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
