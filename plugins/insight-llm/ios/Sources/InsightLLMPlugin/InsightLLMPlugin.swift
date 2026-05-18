// InsightLLMPlugin — Capacitor binding for the on-device multimodal
// LLM. Pure shim: every method translates JS args into a Swift call
// on InsightLLM (the actual MediaPipe wrapper) and resolves /
// rejects the call back.
//
// We deliberately keep the plugin class thin. The hard work
// (session lifecycle, image decoding, response streaming) lives in
// InsightLLM.swift so it's testable from Swift unit tests without
// the Capacitor harness.

import Capacitor
import Foundation

@objc(InsightLLMPlugin)
public class InsightLLMPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "InsightLLMPlugin"
    public let jsName = "InsightLLM"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "setModel", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "downloadModel", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "generate", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getReadiness", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getPluginVersion", returnType: CAPPluginReturnPromise),
    ]

    private lazy var engine = InsightLLM()

    @objc func setModel(_ call: CAPPluginCall) {
        guard let path = call.getString("path"), !path.isEmpty else {
            call.reject("MISSING_PATH", "setModel requires a `path`.")
            return
        }
        let temperature = call.getFloat("temperature") ?? 0.6
        let topK = call.getInt("topK") ?? 40
        let maxTokens = call.getInt("maxTokens") ?? 1024
        let maxImages = call.getInt("maxImages") ?? 1

        Task {
            do {
                try await engine.setModel(
                    path: path,
                    temperature: temperature,
                    topK: topK,
                    maxTokens: maxTokens,
                    maxImages: maxImages
                )
                call.resolve()
            } catch {
                call.reject("SET_MODEL_FAILED", error.localizedDescription, error)
            }
        }
    }

    @objc func downloadModel(_ call: CAPPluginCall) {
        guard let urlString = call.getString("url"),
              let url = URL(string: urlString) else {
            call.reject("INVALID_URL", "downloadModel requires a valid `url`.")
            return
        }
        let filename = call.getString("filename")

        Task {
            do {
                let path = try await engine.downloadModel(
                    from: url,
                    filename: filename
                ) { [weak self] progress in
                    // Forward to JS as a `downloadProgress` event. The
                    // notifyListeners call is thread-safe per Capacitor.
                    self?.notifyListeners(
                        "downloadProgress",
                        data: ["progress": Int(progress * 100)]
                    )
                }
                call.resolve(["path": path])
            } catch {
                call.reject("DOWNLOAD_FAILED", error.localizedDescription, error)
            }
        }
    }

    @objc func generate(_ call: CAPPluginCall) {
        guard let prompt = call.getString("prompt") else {
            call.reject("MISSING_PROMPT", "generate requires a `prompt`.")
            return
        }
        let imageBase64 = call.getString("imageBase64")

        Task {
            do {
                let text = try await engine.generate(
                    prompt: prompt,
                    imageBase64: imageBase64,
                    onChunk: { [weak self] chunk, done in
                        self?.notifyListeners(
                            "responseChunk",
                            data: ["text": chunk, "done": done]
                        )
                    }
                )
                call.resolve(["text": text])
            } catch InsightLLMError.modelNotMultimodal {
                call.reject(
                    "MODEL_NOT_MULTIMODAL",
                    "Active model is text-only; switch to a Gemma 3n multimodal task file to send images."
                )
            } catch InsightLLMError.notLoaded {
                call.reject("NOT_READY", "Call setModel() before generate().")
            } catch {
                call.reject("GENERATE_FAILED", error.localizedDescription, error)
            }
        }
    }

    @objc func getReadiness(_ call: CAPPluginCall) {
        call.resolve(["readiness": engine.readiness.rawValue])
    }

    @objc func getPluginVersion(_ call: CAPPluginCall) {
        call.resolve(["version": "0.1.0"])
    }
}
