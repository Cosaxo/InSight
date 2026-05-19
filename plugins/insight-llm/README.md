# insight-llm

On-device multimodal LLM Capacitor plugin for InSight. Wraps Google's MediaPipe Tasks GenAI (`MediaPipeTasksGenai` on iOS, `com.google.mediapipe:tasks-genai` on Android) into a thin surface that supports both text-only and image + text inference.

Built to replace `@capgo/capacitor-llm` because that plugin's API only takes a text message and never wires image input through MediaPipe's `addImage()` pathway. This plugin matches MediaPipe's capabilities one-to-one.

## Install

Already wired as a `file:./plugins/insight-llm` dep in the root `package.json`. After making changes to the plugin sources:

```bash
# Rebuild the TS surface (only needed when src/*.ts changes)
cd plugins/insight-llm && npm run build && cd ../..

# Sync into iOS + Android native shells
npm run sync
```

## Native build steps

The plugin pulls MediaPipe Tasks GenAI via CocoaPods (iOS) and Maven Central (Android). Both happen automatically on `npx cap sync`. The first iOS build resolves a ~50 MB pod; the first Android sync pulls a ~30 MB Gradle dependency.

### iOS minimum

- iOS deployment target: 14.0+
- Tested on iPhone 12 and newer (8 GB RAM minimum recommended for E2B vision)

### Android minimum

- minSdk 24 (Android 7.0)
- 6 GB device RAM minimum recommended for E2B vision

## Model file

The default model URL points to Gemma 3n E2B multimodal int4 (~2.5 GB) on Hugging Face. Override per-build by setting `VITE_LLM_MODEL_URL` in `.env`:

```env
# Higher quality, larger memory footprint
VITE_LLM_MODEL_URL=https://huggingface.co/litert-community/gemma-3n-E4B-it-litert-preview/resolve/main/gemma-3n-E4B-it-int4.task
```

Set `VITE_LLM_TEXT_ONLY=1` to load the model with `maxImages: 0`, disabling the vision graph for memory savings.

## API surface

```ts
import { InsightLLM } from "insight-llm";

// One-time model load
await InsightLLM.setModel({
  path: "/path/to/gemma-3n-E2B.task",
  temperature: 0.6,
  topK: 40,
  maxTokens: 1024,
  maxImages: 1,
});

// Text-only inference
const { text } = await InsightLLM.generate({
  prompt: "Estimate the calories in two eggs and toast.",
});

// Vision + text
const { text } = await InsightLLM.generate({
  prompt: "Estimate the calories in this meal.",
  imageBase64: "<raw base64, no data URI prefix>",
});
```

## Known limits

- The vision encoder downsamples internally to 768×768. Sending images larger than that wastes bytes — use `quality: 75, targetWidth: 1024, targetHeight: 1024` on the Camera side.
- One image per `generate()` call. The plugin's `maxImages` is set at session creation; MediaPipe's runtime enforces it.
- Model load takes 2–4 seconds on first call. The download takes 5–15 minutes on Wi-Fi for the E2B variant.

## Why not just MediaPipe-LlmInference directly?

Because the InSight app already speaks Capacitor and the bridge layer needs to handle: download progress events, base64 image decoding to platform bitmaps, multi-session lifecycle, and the JS → native call dispatch. Easier to put that in a plugin once than re-implement it inline in every consumer.
