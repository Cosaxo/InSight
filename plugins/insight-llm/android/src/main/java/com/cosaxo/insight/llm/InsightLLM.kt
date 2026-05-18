// InsightLLM — Kotlin wrapper over MediaPipe Tasks GenAI's
// LlmInference. Mirrors the iOS Swift wrapper one-to-one: open a
// fresh session per generate() call, decode base64 images to
// Bitmaps via BitmapFactory, stream chunks via the SDK's
// generateResponseAsync coroutine.

package com.cosaxo.insight.llm

import android.content.Context
import android.graphics.BitmapFactory
import android.util.Base64
import com.google.mediapipe.framework.image.BitmapImageBuilder
import com.google.mediapipe.tasks.genai.llminference.GraphOptions
import com.google.mediapipe.tasks.genai.llminference.LlmInference
import com.google.mediapipe.tasks.genai.llminference.LlmInferenceSession
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

sealed class InsightLLMError(message: String) : RuntimeException(message) {
    class NotLoaded : InsightLLMError("Model has not been loaded; call setModel() first.")
    class ModelNotMultimodal : InsightLLMError("Active model is text-only.")
    class ImageDecodeFailed : InsightLLMError("Could not decode image bytes.")
    class DownloadFailed(reason: String) : InsightLLMError("Download failed: $reason")
}

enum class LLMReadiness(val value: String) {
    UNINITIALIZED("uninitialized"),
    LOADING("loading"),
    READY("ready"),
    ERROR("error"),
}

class InsightLLM(private val context: Context) {

    private var inference: LlmInference? = null
    private var modelPath: String? = null
    private var maxImages: Int = 0
    private var temperature: Float = 0.6f
    private var topK: Int = 40
    @Volatile var readiness: LLMReadiness = LLMReadiness.UNINITIALIZED
        private set

    fun close() {
        inference?.close()
        inference = null
        readiness = LLMReadiness.UNINITIALIZED
    }

    suspend fun setModel(
        path: String,
        temperature: Float,
        topK: Int,
        maxTokens: Int,
        maxImages: Int,
    ) = withContext(Dispatchers.IO) {
        if (modelPath == path && inference != null) return@withContext
        readiness = LLMReadiness.LOADING

        // Tear down the previous engine before swapping. MediaPipe
        // hangs on to native buffers / GPU resources that aren't
        // GC'd; an explicit close is the only safe way to reload.
        inference?.close()
        inference = null

        val opts = LlmInference.LlmInferenceOptions.builder()
            .setModelPath(path)
            .setMaxTokens(maxTokens)
            // maxNumImages sets the per-session image cap. Zero
            // forces text-only behaviour on a multimodal model.
            .setMaxNumImages(maxImages)
            .build()
        try {
            inference = LlmInference.createFromOptions(context, opts)
            modelPath = path
            this@InsightLLM.maxImages = maxImages
            this@InsightLLM.temperature = temperature
            this@InsightLLM.topK = topK
            readiness = LLMReadiness.READY
        } catch (t: Throwable) {
            readiness = LLMReadiness.ERROR
            throw t
        }
    }

    suspend fun generate(
        prompt: String,
        imageBase64: String?,
        onChunk: (text: String, done: Boolean) -> Unit,
    ): String = withContext(Dispatchers.IO) {
        val engine = inference ?: throw InsightLLMError.NotLoaded()
        val hasImage = !imageBase64.isNullOrEmpty()
        if (hasImage && maxImages == 0) {
            throw InsightLLMError.ModelNotMultimodal()
        }

        // Fresh session per call so previous prompts can't leak.
        val sessionOpts = LlmInferenceSession.LlmInferenceSessionOptions.builder()
            .setTemperature(temperature)
            .setTopK(topK)
            .setGraphOptions(
                GraphOptions.builder()
                    .setEnableVisionModality(hasImage)
                    .build()
            )
            .build()
        val session = LlmInferenceSession.createFromOptions(engine, sessionOpts)

        try {
            if (hasImage) {
                val bitmap = decodeBitmap(imageBase64!!)
                    ?: throw InsightLLMError.ImageDecodeFailed()
                val mpImage = BitmapImageBuilder(bitmap).build()
                session.addImage(mpImage)
            }
            session.addQueryChunk(prompt)

            val buffer = StringBuilder()
            // generateResponseAsync returns a ListenableFuture; the
            // streaming variant uses a per-chunk callback. We
            // bridge the callback to a suspending pump via a
            // CompletableDeferred.
            val deferred = kotlinx.coroutines.CompletableDeferred<String>()
            session.generateResponseAsync { partial, done ->
                buffer.append(partial)
                onChunk(partial, done)
                if (done) {
                    deferred.complete(buffer.toString().trim())
                }
            }
            deferred.await()
        } finally {
            session.close()
        }
    }

    suspend fun downloadModel(
        url: String,
        filename: String?,
        onProgress: (Double) -> Unit,
    ): String = withContext(Dispatchers.IO) {
        val name = filename ?: url.substringAfterLast('/').ifEmpty { "model.task" }
        val dest = File(context.filesDir, name)
        if (dest.exists() && dest.length() > 0) {
            // Already cached. Skip re-download; callers can rename
            // the file or pass a different `filename` to force a
            // fresh pull.
            onProgress(1.0)
            return@withContext dest.absolutePath
        }

        val conn = URL(url).openConnection() as HttpURLConnection
        conn.requestMethod = "GET"
        conn.connect()
        if (conn.responseCode !in 200..299) {
            throw InsightLLMError.DownloadFailed("HTTP ${conn.responseCode}")
        }

        val total = conn.contentLengthLong.takeIf { it > 0 }
        var downloaded = 0L
        val tmp = File(context.filesDir, "$name.part")
        conn.inputStream.use { input ->
            tmp.outputStream().use { out ->
                val buf = ByteArray(64 * 1024)
                while (true) {
                    val n = input.read(buf)
                    if (n <= 0) break
                    out.write(buf, 0, n)
                    downloaded += n
                    if (total != null) {
                        onProgress(downloaded.toDouble() / total.toDouble())
                    }
                }
            }
        }
        if (!tmp.renameTo(dest)) {
            throw InsightLLMError.DownloadFailed("rename to ${dest.name} failed")
        }
        onProgress(1.0)
        dest.absolutePath
    }

    private fun decodeBitmap(base64: String): android.graphics.Bitmap? {
        // Tolerate "data:image/...;base64," prefixes coming from
        // <input type=file> or canvas exports.
        val cleaned = base64.substringAfter(',', base64)
        return try {
            val bytes = Base64.decode(cleaned, Base64.DEFAULT)
            BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
        } catch (t: Throwable) {
            null
        }
    }
}
