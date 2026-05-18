// useLLM — wraps the in-repo `insight-llm` Capacitor plugin into a
// small React API.
//
// Strategy:
// - Multimodal Gemma 3n E2B (int4 MediaPipe `.task` / `.litertlm`,
//   ~2.5 GB) on every native device. Same model on iOS and Android.
//   Vision + audio capable, though we currently only exercise the
//   text + image paths.
// - Web: feature hidden (Capacitor.isNativePlatform() is false).
//
// First launch downloads the model and caches the file path in
// localStorage; every subsequent inference is offline and instant.
//
// Public surface:
//   ready              — true when a model is loaded and we can call generate()
//   available          — true on a native platform (false on web — feature hidden)
//   downloading        — true while the first-launch model fetch is in flight
//   downloadPct        — 0–100
//   error              — last error string, if any
//   visionAvailable    — true when the model was loaded with maxImages > 0
//   ensure()           — load the model (downloads on first call if needed)
//   generate(p, img?)  — single round-trip prompt → full response.
//                        Pass base64 image bytes to use the vision path;
//                        the plugin rejects MODEL_NOT_MULTIMODAL otherwise.

import { useCallback, useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { InsightLLM } from "insight-llm";

// Default model: Gemma 3n E2B IT multimodal, int4 MediaPipe `.task`
// (~2.5 GB). Apache 2.0. Hosted on the LiteRT Community repo. The
// E2B variant uses per-layer embeddings so the effective active
// param count fits on phones with ≥6 GB RAM.
//
// Override per-build by exporting VITE_LLM_MODEL_URL in .env (for
// example, the E4B variant for higher quality on capable devices,
// or a text-only `.task` to skip the vision encoder).
const DEFAULT_MODEL_URL =
  (import.meta.env.VITE_LLM_MODEL_URL as string | undefined) ||
  "https://huggingface.co/litert-community/gemma-3n-E2B-it-litert-preview/resolve/main/gemma-3n-E2B-it-int4.task";

// Bumped from v1 so existing devices that have a text-only Gemma 4
// E2B cached under the old key re-download into a fresh entry. The
// old file stays on disk until the user clears app storage — small
// price for not bricking inference on first launch after upgrade.
const STORAGE_MODEL_PATH = "insight.llm.modelPath.v2";

// Default to vision-enabled (maxImages=1). Set VITE_LLM_TEXT_ONLY=1
// to load the same model as text-only — saves a small amount of
// memory and disables the vision graph.
const TEXT_ONLY = import.meta.env.VITE_LLM_TEXT_ONLY === "1";

interface LLMState {
  available: boolean;
  ready: boolean;
  visionAvailable: boolean;
  downloading: boolean;
  downloadPct: number;
  error: string | null;
}

type Listener = { remove: () => Promise<void> };

export function useLLM(): LLMState & {
  ensure: () => Promise<void>;
  generate: (prompt: string, imageBase64?: string) => Promise<string>;
} {
  const available = Capacitor.isNativePlatform();
  const [state, setState] = useState<LLMState>({
    available,
    ready: false,
    visionAvailable: false,
    downloading: false,
    downloadPct: 0,
    error: null,
  });
  const progressListenerRef = useRef<Listener | null>(null);
  const loadingPromiseRef = useRef<Promise<void> | null>(null);

  // Restore last-known-good model path on mount. We only mark ready
  // here if the plugin agrees — the underlying engine may have been
  // torn down by Android low-memory pressure since the last session.
  useEffect(() => {
    if (!available) return;
    void (async () => {
      const status = await InsightLLM.getReadiness().catch(
        () => ({ readiness: "uninitialized" as const }),
      );
      if (status.readiness === "ready") {
        setState((s) => ({
          ...s,
          ready: true,
          visionAvailable: !TEXT_ONLY,
        }));
      }
    })();
  }, [available]);

  // Hook download progress.
  useEffect(() => {
    if (!available) return;
    let mounted = true;
    void (async () => {
      const sub = await InsightLLM.addListener("downloadProgress", (e) => {
        if (!mounted) return;
        setState((s) => ({ ...s, downloadPct: Math.round(e.progress ?? 0) }));
      });
      progressListenerRef.current = sub;
    })();
    return () => {
      mounted = false;
      void progressListenerRef.current?.remove();
      progressListenerRef.current = null;
    };
  }, [available]);

  const ensure = useCallback(async () => {
    if (!available) return;
    if (state.ready) return;
    if (loadingPromiseRef.current) {
      return loadingPromiseRef.current;
    }
    const run = (async () => {
      try {
        setState((s) => ({ ...s, error: null }));

        let path = localStorage.getItem(STORAGE_MODEL_PATH);
        if (!path) {
          setState((s) => ({ ...s, downloading: true, downloadPct: 0 }));
          const result = await InsightLLM.downloadModel({
            url: DEFAULT_MODEL_URL,
          });
          path = result.path;
          localStorage.setItem(STORAGE_MODEL_PATH, path);
          setState((s) => ({ ...s, downloading: false, downloadPct: 100 }));
        }

        await InsightLLM.setModel({
          path,
          temperature: 0.6,
          topK: 40,
          maxTokens: 1024,
          // 0 = text-only behaviour even on a multimodal model.
          // 1 = single image per inference (our meal-photo case).
          maxImages: TEXT_ONLY ? 0 : 1,
        });
        setState((s) => ({
          ...s,
          ready: true,
          visionAvailable: !TEXT_ONLY,
        }));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[useLLM] ensure failed:", err);
        setState((s) => ({
          ...s,
          downloading: false,
          ready: false,
          error: msg,
        }));
        throw err;
      } finally {
        loadingPromiseRef.current = null;
      }
    })();
    loadingPromiseRef.current = run;
    return run;
  }, [available, state.ready]);

  const generate = useCallback(
    async (prompt: string, imageBase64?: string): Promise<string> => {
      if (!available) throw new Error("LLM not available in this environment");
      if (!state.ready) await ensure();
      const { text } = await InsightLLM.generate({
        prompt,
        imageBase64,
      });
      return text.trim();
    },
    [available, state.ready, ensure],
  );

  return { ...state, ensure, generate };
}
