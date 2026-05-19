import { WebPlugin } from "@capacitor/core";
// Web stub. On-device Gemma in a browser is technically possible via
// MediaPipe's JS SDK + WebGPU, but it's a multi-GB download per
// session and a noticeably different UX from native — out of scope
// for this plugin. Callers should branch on Capacitor.isNativePlatform()
// before invoking us.
export class InsightLLMWeb extends WebPlugin {
    async setModel(_options) {
        throw this.unavailable("InsightLLM is not available on web.");
    }
    async downloadModel(_options) {
        throw this.unavailable("InsightLLM is not available on web.");
    }
    async generate(_options) {
        throw this.unavailable("InsightLLM is not available on web.");
    }
    async getReadiness() {
        return { readiness: "uninitialized" };
    }
    async getPluginVersion() {
        return { version: "0.1.0-web" };
    }
}
