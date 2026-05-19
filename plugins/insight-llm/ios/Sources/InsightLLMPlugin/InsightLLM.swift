// InsightLLM — thin Swift wrapper over MediaPipeTasksGenai.
//
// Lifecycle:
//   setModel(...)  ─→ build LlmInference + an LlmInferenceSession
//   generate(...)  ─→ optionally addImage(), then generateResponseAsync()
//                     and accumulate streamed chunks
//   reset()        ─→ create a fresh session (clears previous turn)
//
// We open a fresh session per generate() call so the model never
// carries unintended state across journal taps. Cheap on Gemma 3n —
// session creation is ~10 ms after the model is already in RAM.

import Foundation
import MediaPipeTasksGenAI
#if canImport(UIKit)
import UIKit
#endif

enum InsightLLMError: Error {
    case notLoaded
    case modelNotMultimodal
    case imageDecodeFailed
    case downloadFailed(String)
}

enum LLMReadiness: String {
    case uninitialized
    case loading
    case ready
    case error
}

final class InsightLLM {
    private var inference: LlmInference?
    private var modelPath: String?
    private var config: LlmInference.Options?
    private(set) var readiness: LLMReadiness = .uninitialized
    private let queue = DispatchQueue(label: "com.cosaxo.insight.llm", qos: .userInitiated)

    func setModel(
        path: String,
        temperature: Float,
        topK: Int,
        maxTokens: Int,
        maxImages: Int
    ) async throws {
        if modelPath == path && inference != nil { return }
        readiness = .loading

        // Tear down any previous engine before constructing the new
        // one — MediaPipe holds GPU buffers and reloading without a
        // close() leaks memory.
        inference = nil

        let options = LlmInference.Options(modelPath: path)
        options.maxTokens = maxTokens
        // maxNumImages is the session-level cap on attached images.
        // Zero forces text-only behaviour even on a multimodal model.
        options.maxNumImages = maxImages

        do {
            let engine = try LlmInference(options: options)
            self.inference = engine
            self.modelPath = path
            self.config = options
            readiness = .ready
            // Stash sampling params on the actor instance; they're
            // applied per-session in generate() since LlmInference
            // itself only takes structural options at init.
            self.temperature = temperature
            self.topK = topK
        } catch {
            readiness = .error
            throw error
        }
    }

    private var temperature: Float = 0.6
    private var topK: Int = 40

    func generate(
        prompt: String,
        imageBase64: String?,
        onChunk: @escaping (_ text: String, _ done: Bool) -> Void
    ) async throws -> String {
        guard let inference = self.inference else {
            throw InsightLLMError.notLoaded
        }
        let hasImage = (imageBase64 != nil && !(imageBase64?.isEmpty ?? true))
        if hasImage && (config?.maxNumImages ?? 0) == 0 {
            throw InsightLLMError.modelNotMultimodal
        }

        // Build a fresh session per call so we never accidentally
        // carry over a previous user's prompt.
        let sessionOpts = LlmInference.Session.Options()
        sessionOpts.temperature = temperature
        sessionOpts.topK = topK
        let session = try LlmInference.Session(
            llmInference: inference,
            options: sessionOpts
        )

        if let base64 = imageBase64, let image = decodeImage(base64: base64) {
            try session.addImage(image: image)
        } else if hasImage {
            throw InsightLLMError.imageDecodeFailed
        }

        try session.addQueryChunk(inputText: prompt)

        // generateResponseAsync streams chunks via the AsyncStream
        // returned from the SDK. We accumulate and forward.
        var buffer = ""
        let stream = session.generateResponseAsync()
        for try await chunk in stream {
            buffer += chunk
            onChunk(chunk, false)
        }
        onChunk("", true)
        return buffer.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private func decodeImage(base64: String) -> MPImage? {
        // Tolerate a "data:image/...;base64," prefix.
        let cleaned: String
        if let comma = base64.firstIndex(of: ",") {
            cleaned = String(base64[base64.index(after: comma)...])
        } else {
            cleaned = base64
        }
        guard let data = Data(base64Encoded: cleaned, options: .ignoreUnknownCharacters) else {
            return nil
        }
        #if canImport(UIKit)
        guard let ui = UIImage(data: data) else { return nil }
        return try? MPImage(uiImage: ui)
        #else
        return nil
        #endif
    }

    func downloadModel(
        from url: URL,
        filename: String?,
        onProgress: @escaping (Double) -> Void
    ) async throws -> String {
        let fm = FileManager.default
        let docs = try fm.url(
            for: .documentDirectory,
            in: .userDomainMask,
            appropriateFor: nil,
            create: true
        )
        let name = filename ?? url.lastPathComponent
        let dest = docs.appendingPathComponent(name)

        if fm.fileExists(atPath: dest.path) {
            // Already on disk; treat as fully complete and skip the
            // network round trip. Callers can pass a different
            // filename to force a re-download.
            onProgress(1.0)
            return dest.path
        }

        // URLSession download with progress observation. We use a
        // delegate-based session so we get per-byte progress; the
        // simpler `data(from:)` API returns only after the full
        // payload has arrived which is no good for a 2 GB download.
        let delegate = DownloadDelegate(onProgress: onProgress)
        let config = URLSessionConfiguration.default
        let session = URLSession(
            configuration: config,
            delegate: delegate,
            delegateQueue: nil
        )
        let (tmpURL, response) = try await session.download(from: url)
        guard let http = response as? HTTPURLResponse, http.statusCode == 200 else {
            let code = (response as? HTTPURLResponse)?.statusCode ?? -1
            throw InsightLLMError.downloadFailed("HTTP \(code)")
        }
        try fm.moveItem(at: tmpURL, to: dest)
        onProgress(1.0)
        return dest.path
    }
}

// URLSessionDownloadDelegate that converts byte-progress callbacks
// into a single Double in [0, 1] for the plugin's notifyListeners
// pump. Held weakly on the session so it deinits when the download
// completes.
private final class DownloadDelegate: NSObject, URLSessionDownloadDelegate {
    let onProgress: (Double) -> Void
    init(onProgress: @escaping (Double) -> Void) {
        self.onProgress = onProgress
    }

    func urlSession(
        _ session: URLSession,
        downloadTask: URLSessionDownloadTask,
        didWriteData bytesWritten: Int64,
        totalBytesWritten: Int64,
        totalBytesExpectedToWrite: Int64
    ) {
        guard totalBytesExpectedToWrite > 0 else { return }
        let pct = Double(totalBytesWritten) / Double(totalBytesExpectedToWrite)
        onProgress(pct)
    }

    func urlSession(
        _ session: URLSession,
        downloadTask: URLSessionDownloadTask,
        didFinishDownloadingTo location: URL
    ) {
        // The plugin moves the file out of the temp location itself
        // (via the await on `session.download(from:)`), so this
        // hook is a no-op for our pump.
    }
}
