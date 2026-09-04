import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import { Asset } from "expo-asset";

// A single hidden WebView that runs assets/extraction/engine.html — the only
// place Mozilla Readability + pdf.js can run (they need a real DOM). Mounted
// once in app/_layout.tsx. All comms go through runInEngine().

type Pending = {
  resolve: (v: unknown) => void;
  reject: (e: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

const pending = new Map<string, Pending>();
let injectRaw: ((js: string) => void) | null = null;
let readyResolve: (() => void) | null = null;
const readyPromise = new Promise<void>((r) => {
  readyResolve = r;
});

const REQUEST_TIMEOUT_MS = 25_000;

/** Send an op to the engine and await its typed result. */
export async function runInEngine<T>(
  op: "readability" | "pdf",
  payload: Record<string, unknown>
): Promise<T> {
  await readyPromise;
  if (!injectRaw) throw new Error("engine_not_mounted");

  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error("engine_timeout"));
    }, REQUEST_TIMEOUT_MS);
    pending.set(id, { resolve: resolve as (v: unknown) => void, reject, timer });

    const msg = JSON.stringify({ id, op, payload });
    // Deliver via a synthetic message event so the same handler serves both
    // platforms.
    injectRaw!(
      `(function(){var e=new MessageEvent('message',{data:${JSON.stringify(
        msg
      )}});window.dispatchEvent(e);})();true;`
    );
  });
}

export function ExtractionEngine() {
  const ref = useRef<WebView>(null);
  const [uri, setUri] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const asset = Asset.fromModule(
          require("../../assets/extraction/engine.html")
        );
        await asset.downloadAsync();
        // Load by file:// URI so the ~1.8 MB page never crosses the RN bridge.
        setUri(asset.localUri ?? asset.uri);
      } catch (err) {
        console.warn("ExtractionEngine: failed to load engine.html", (err as Error)?.name);
      }
    })();
  }, []);

  useEffect(() => {
    injectRaw = (js: string) => ref.current?.injectJavaScript(js);
    return () => {
      injectRaw = null;
    };
  }, []);

  function onMessage(ev: WebViewMessageEvent) {
    let data: {
      ready?: boolean;
      id?: string;
      ok?: boolean;
      result?: unknown;
      error?: string;
    };
    try {
      data = JSON.parse(ev.nativeEvent.data);
    } catch {
      return;
    }
    if (data.ready) {
      readyResolve?.();
      return;
    }
    if (!data.id) return;
    const entry = pending.get(data.id);
    if (!entry) return;
    pending.delete(data.id);
    clearTimeout(entry.timer);
    if (data.ok) entry.resolve(data.result);
    else entry.reject(new Error(data.error ?? "engine_error"));
  }

  if (!uri) return null;

  return (
    <View
      style={{ position: "absolute", width: 1, height: 1, opacity: 0 }}
      pointerEvents="none"
    >
      <WebView
        ref={ref}
        source={{ uri }}
        originWhitelist={["*"]}
        javaScriptEnabled
        domStorageEnabled={false}
        allowFileAccess
        allowFileAccessFromFileURLs
        allowUniversalAccessFromFileURLs
        setSupportMultipleWindows={false}
        onMessage={onMessage}
        onError={(e) =>
          console.warn("ExtractionEngine WebView error", e.nativeEvent.description)
        }
      />
    </View>
  );
}
