import { WebPlugin } from "@capacitor/core";

import type {
  DownloadModelOptions,
  DownloadModelResult,
  GenerateOptions,
  GenerateResult,
  InsightLLMPlugin,
  ReadinessState,
  SetModelOptions,
} from "./definitions";

// Web stub. On-device Gemma in a browser is technically possible via
// MediaPipe's JS SDK + WebGPU, but it's a multi-GB download per
// session and a noticeably different UX from native — out of scope
// for this plugin. Callers should branch on Capacitor.isNativePlatform()
// before invoking us.
export class InsightLLMWeb extends WebPlugin implements InsightLLMPlugin {
  async setModel(_options: SetModelOptions): Promise<void> {
    throw this.unavailable("InsightLLM is not available on web.");
  }

  async downloadModel(
    _options: DownloadModelOptions,
  ): Promise<DownloadModelResult> {
    throw this.unavailable("InsightLLM is not available on web.");
  }

  async generate(_options: GenerateOptions): Promise<GenerateResult> {
    throw this.unavailable("InsightLLM is not available on web.");
  }

  async getReadiness(): Promise<{ readiness: ReadinessState }> {
    return { readiness: "uninitialized" };
  }

  async getPluginVersion(): Promise<{ version: string }> {
    return { version: "0.1.0-web" };
  }
}
