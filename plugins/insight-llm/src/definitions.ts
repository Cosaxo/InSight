// InsightLLM — on-device multimodal LLM plugin.
//
// Wraps Google's MediaPipe Tasks GenAI (iOS: MediaPipeTasksGenai
// CocoaPod; Android: com.google.mediapipe:tasks-genai Gradle
// dependency) into a single Capacitor-native surface that supports
// both text-only and image+text inference.
//
// Why a custom plugin instead of @capgo/capacitor-llm: that plugin's
// surface only accepts `sendMessage({ chatId, message: string })` and
// the native side never wires image input through MediaPipe's
// addImage() / Bitmap pathway. Patching it upstream is possible but
// the team didn't want a fork; this is our own minimal surface that
// tracks MediaPipe's actual capabilities one-to-one.

export interface InsightLLMPlugin {
  /**
   * Initialise the underlying MediaPipe LlmInference engine with a
   * model file. Idempotent — calling again with the same path is a
   * no-op; calling with a different path tears down and reloads.
   */
  setModel(options: SetModelOptions): Promise<void>;

  /**
   * Download the model bytes from a URL into the app's documents
   * directory and resolve to its on-disk path. Emits
   * `downloadProgress` events while in flight.
   */
  downloadModel(options: DownloadModelOptions): Promise<DownloadModelResult>;

  /**
   * Run inference and resolve to the full response. Image input is
   * optional — when provided, the model must be a multimodal Gemma
   * 3n variant (E2B / E4B) or the call rejects with
   * `MODEL_NOT_MULTIMODAL`.
   *
   * Image format: base64-encoded JPEG/PNG bytes. The plugin handles
   * decoding to a platform-native bitmap and forwarding to
   * MediaPipe's addImage() before sending the prompt.
   */
  generate(options: GenerateOptions): Promise<GenerateResult>;

  /**
   * Cheap readiness check that doesn't load the model — returns
   * "ready" only after a successful setModel().
   */
  getReadiness(): Promise<{ readiness: ReadinessState }>;

  /**
   * Plugin version (for diagnostics — does not match the underlying
   * MediaPipe version).
   */
  getPluginVersion(): Promise<{ version: string }>;

  addListener(
    eventName: "downloadProgress",
    listenerFunc: (event: DownloadProgressEvent) => void,
  ): Promise<PluginListenerHandle>;

  /**
   * Streamed inference output. The `generate()` call accumulates
   * these chunks internally; subscribe directly only if you want to
   * render a streaming UI.
   */
  addListener(
    eventName: "responseChunk",
    listenerFunc: (event: ResponseChunkEvent) => void,
  ): Promise<PluginListenerHandle>;
}

export type ReadinessState = "uninitialized" | "loading" | "ready" | "error";

export interface SetModelOptions {
  /** Absolute path to a MediaPipe `.task` or `.litertlm` model file. */
  path: string;
  /** Sampling temperature (0.0–1.0). Default 0.6. */
  temperature?: number;
  /** Top-k sampling. Default 40. */
  topK?: number;
  /** Max output tokens. Default 1024. */
  maxTokens?: number;
  /**
   * Optional max image count the model should accept per generation
   * call. MediaPipe needs this at session-creation time. Default 1.
   * Set to 0 to force text-only mode even on a multimodal model
   * (saves memory).
   */
  maxImages?: number;
}

export interface DownloadModelOptions {
  url: string;
  /** Override the on-disk filename; defaults to the URL basename. */
  filename?: string;
}

export interface DownloadModelResult {
  path: string;
}

export interface GenerateOptions {
  prompt: string;
  /**
   * Optional base64-encoded image bytes (no data URI prefix). When
   * present the underlying model must be multimodal — calls with an
   * image against a text-only model reject with
   * `MODEL_NOT_MULTIMODAL`.
   */
  imageBase64?: string;
}

export interface GenerateResult {
  text: string;
}

export interface DownloadProgressEvent {
  progress: number; // 0..100
  downloadedBytes?: number;
  totalBytes?: number;
}

export interface ResponseChunkEvent {
  text: string;
  /** True for the final chunk of a generation. */
  done: boolean;
}

export interface PluginListenerHandle {
  remove: () => Promise<void>;
}
