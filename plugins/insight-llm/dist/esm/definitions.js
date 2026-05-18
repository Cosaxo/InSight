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
export {};
