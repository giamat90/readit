import { useCallback, useEffect, useRef } from "react";
import * as Speech from "expo-speech";
import { getLocales } from "expo-localization";
import { usePlayerStore } from "@/store/player";
import { useUserStore } from "@/store/user";
import { CONFIG } from "@/constants";

export const RATE_STEPS = [0.75, 1, 1.25, 1.5, 2] as const;

// Cached for the app session — avoids re-querying the OS voice list on
// every chunk. Used only to confirm the preferred voice actually matches
// the document's spoken language before applying it.
let voicesCache: Speech.Voice[] | null = null;
async function voiceMatchesLanguage(
  identifier: string,
  languagePrefix: string
): Promise<boolean> {
  if (!voicesCache) voicesCache = await Speech.getAvailableVoicesAsync();
  const voice = voicesCache.find((v) => v.identifier === identifier);
  return !!voice && voice.language.toLowerCase().startsWith(languagePrefix.toLowerCase());
}

// Wraps expo-speech around the player store. Chunk advancement happens ONLY
// in the onDone callback (CLAUDE.md rule 7). Every utterance gets an id so a
// stale onDone (fired by Speech.stop during skip/pause) can't double-advance.
export function useSpeechPlayer() {
  const utteranceId = useRef(0);

  const speakChunk = useCallback(async (index: number) => {
    const id = ++utteranceId.current;
    const { chunks, rate, language } = usePlayerStore.getState();
    const text = chunks[index];
    if (text === undefined) return;

    const resolvedLanguage = language ?? getLocales()[0]?.languageTag ?? "en-US";
    const preferredVoice = useUserStore.getState().preferredVoice;
    const voice =
      preferredVoice && (await voiceMatchesLanguage(preferredVoice, resolvedLanguage))
        ? preferredVoice
        : undefined;

    if (utteranceId.current !== id) return; // superseded while awaiting voice check

    Speech.stop();
    Speech.speak(text, {
      rate,
      language: resolvedLanguage,
      voice,
      onDone: () => {
        if (utteranceId.current !== id) return; // stale utterance
        const s = usePlayerStore.getState();
        const nextIndex = s.chunkIndex + 1;
        if (nextIndex < s.chunks.length) {
          s.setChunkIndex(nextIndex);
          speakChunk(nextIndex);
        } else {
          s.setIsPlaying(false); // end of document
        }
      },
      onError: () => {
        if (utteranceId.current !== id) return;
        usePlayerStore.getState().setIsPlaying(false);
      },
    });
  }, []);

  const play = useCallback(() => {
    const s = usePlayerStore.getState();
    if (s.chunks.length === 0) return;
    s.setIsPlaying(true);
    speakChunk(s.chunkIndex);
  }, [speakChunk]);

  const pause = useCallback(() => {
    utteranceId.current++; // invalidate pending onDone
    Speech.stop();
    usePlayerStore.getState().setIsPlaying(false);
  }, []);

  const toggle = useCallback(() => {
    if (usePlayerStore.getState().isPlaying) pause();
    else play();
  }, [pause, play]);

  const skipTo = useCallback(
    (index: number) => {
      const s = usePlayerStore.getState();
      const clamped = Math.min(s.chunks.length - 1, Math.max(0, index));
      if (clamped === s.chunkIndex) return;
      s.setChunkIndex(clamped);
      if (s.isPlaying) {
        speakChunk(clamped);
      } else {
        utteranceId.current++;
        Speech.stop();
      }
    },
    [speakChunk]
  );

  const next = useCallback(
    () => skipTo(usePlayerStore.getState().chunkIndex + 1),
    [skipTo]
  );
  const prev = useCallback(
    () => skipTo(usePlayerStore.getState().chunkIndex - 1),
    [skipTo]
  );

  const cycleRate = useCallback(() => {
    const s = usePlayerStore.getState();
    const currentStep = RATE_STEPS.findIndex((r) => r >= s.rate - 0.01);
    const nextRate =
      RATE_STEPS[(Math.max(0, currentStep) + 1) % RATE_STEPS.length] ??
      CONFIG.RATE_DEFAULT;
    s.setRate(nextRate);
    if (s.isPlaying) speakChunk(s.chunkIndex); // restart chunk at new rate
  }, [speakChunk]);

  // Screen unmount → no zombie audio
  useEffect(() => {
    return () => {
      utteranceId.current++;
      Speech.stop();
      usePlayerStore.getState().setIsPlaying(false);
    };
  }, []);

  return { play, pause, toggle, next, prev, cycleRate };
}
