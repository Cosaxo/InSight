// useLLM — wraps @capgo/capacitor-llm into a small React API.
//
// Strategy:
// - Strict Gemma 4 E2B (int4 MediaPipe `.task`, ~2 GB) on every
//   native device. Same model on iOS and Android. No vendor lock-in,
//   no Apple Intelligence preference: the same observational voice
//   every InSight user gets.
// - Web: feature hidden (Capacitor.isNativePlatform() is false).
//
// First launch downloads the model and caches the file path in
// localStorage; every subsequent inference is offline and instant.
//
// Public surface:
//   ready          — true when a model is loaded and we can call generate()
//   available      — true on a native platform (false on web — feature hidden)
//   downloading    — true while the first-launch model fetch is in flight
//   downloadPct    — 0–100
//   error          — last error string, if any
//   ensure()       — load the model (downloads on first call if needed)
//   generate(p)    — single round-trip prompt → full response
//
// This deliberately exposes a non-streaming `generate(prompt) → string`
// so callers don't have to manage chat sessions, listeners, or
// teardown. The plugin streams underneath; we accumulate to a buffer
// and resolve on `aiFinished`.

import { useCallback, useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { CapgoLLM } from "@capgo/capacitor-llm";

// Default model: Gemma 4 E2B IT, int4 MediaPipe `.task` (~2 GB).
// Effective-2B multimodal (text/vision/audio capable, though we only
// use text right now), 256 K context, Apache 2.0. Hosted on the
// LiteRT Community repo as a MediaPipe-friendly `.task` file.
//
// Override per-build by exporting `VITE_LLM_MODEL_URL` in .env — for
// example, swap to a mobile-tuned variant of the same family when one
// lands, or to Gemma 4 E4B for higher quality on capable devices.
const DEFAULT_MODEL_URL =
  (import.meta.env.VITE_LLM_MODEL_URL as string | undefined) ||
  "https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm/resolve/main/gemma-4-E2B-it-web.task";

const STORAGE_MODEL_PATH = "insight.llm.modelPath.v1";

interface LLMState {
  available: boolean;
  ready: boolean;
  downloading: boolean;
  downloadPct: number;
  error: string | null;
}

type Listener = { remove: () => Promise<void> };

export function useLLM(): LLMState & {
  ensure: () => Promise<void>;
  generate: (prompt: string) => Promise<string>;
} {
  const available = Capacitor.isNativePlatform();
  const [state, setState] = useState<LLMState>({
    available,
    ready: false,
    downloading: false,
    downloadPct: 0,
    error: null,
  });
  const progressListenerRef = useRef<Listener | null>(null);
  const loadingPromiseRef = useRef<Promise<void> | null>(null);

  // Restore last-known-good model path on mount if we already
  // downloaded once.
  useEffect(() => {
    if (!available) return;
    void (async () => {
      const status = await CapgoLLM.getReadiness().catch(
        () => ({ readiness: "uninitialized" }),
      );
      if (status.readiness === "ready") {
        setState((s) => ({ ...s, ready: true }));
      }
    })();
  }, [available]);

  // Hook download progress.
  useEffect(() => {
    if (!available) return;
    let mounted = true;
    void (async () => {
      const sub = await CapgoLLM.addListener("downloadProgress", (e) => {
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

        // Strict Gemma 4 E2B path. We deliberately don't try Apple
        // Intelligence first — every InSight user runs the same
        // open-weight Gemma model, no matter which phone they're on.
        let path = localStorage.getItem(STORAGE_MODEL_PATH);
        if (!path) {
          setState((s) => ({ ...s, downloading: true, downloadPct: 0 }));
          const result = await CapgoLLM.downloadModel({
            url: DEFAULT_MODEL_URL,
          });
          path = result.path;
          localStorage.setItem(STORAGE_MODEL_PATH, path);
          setState((s) => ({ ...s, downloading: false, downloadPct: 100 }));
        }

        await CapgoLLM.setModel({
          path,
          engine: "mediapipe",
          modelType: "task",
          maxTokens: 1024,
          temperature: 0.6,
          topk: 40,
        });
        setState((s) => ({ ...s, ready: true }));
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
    async (prompt: string): Promise<string> => {
      if (!available) throw new Error("LLM not available in this environment");
      if (!state.ready) await ensure();
      const { id: chatId } = await CapgoLLM.createChat();
      return new Promise<string>((resolve, reject) => {
        let buf = "";
        let textSub: Listener | null = null;
        let finSub: Listener | null = null;
        const cleanup = () => {
          void textSub?.remove();
          void finSub?.remove();
        };
        void CapgoLLM.addListener("textFromAi", (e) => {
          if (e.chatId !== chatId) return;
          buf += e.text;
        }).then((s) => {
          textSub = s;
        });
        void CapgoLLM.addListener("aiFinished", (e) => {
          if (e.chatId !== chatId) return;
          cleanup();
          resolve(buf.trim());
        }).then((s) => {
          finSub = s;
        });
        CapgoLLM.sendMessage({ chatId, message: prompt }).catch((err) => {
          cleanup();
          reject(err);
        });
      });
    },
    [available, state.ready, ensure],
  );

  return { ...state, ensure, generate };
}
