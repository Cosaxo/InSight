// InsightLLMPlugin — Capacitor binding for the on-device multimodal
// LLM on Android. Mirror of the iOS plugin's shape and contract;
// the real work lives in InsightLLM.kt.

package com.cosaxo.insight.llm

import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

@CapacitorPlugin(name = "InsightLLM")
class InsightLLMPlugin : Plugin() {

    // Holds the MediaPipe engine + per-call sessions. Lazily
    // constructed so plugin instantiation doesn't load any native
    // libraries until setModel() is called.
    private val engine by lazy { InsightLLM(context) }

    // Dedicated scope so cancelling the plugin (e.g. on Activity
    // destroy) tears down in-flight inference and downloads.
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override fun handleOnDestroy() {
        scope.coroutineContext[kotlinx.coroutines.Job]?.cancel()
        engine.close()
        super.handleOnDestroy()
    }

    @PluginMethod
    fun setModel(call: PluginCall) {
        val path = call.getString("path")
        if (path.isNullOrBlank()) {
            call.reject("MISSING_PATH", "setModel requires a `path`.")
            return
        }
        val temperature = call.getFloat("temperature") ?: 0.6f
        val topK = call.getInt("topK") ?: 40
        val maxTokens = call.getInt("maxTokens") ?: 1024
        val maxImages = call.getInt("maxImages") ?: 1

        scope.launch {
            try {
                engine.setModel(
                    path = path,
                    temperature = temperature,
                    topK = topK,
                    maxTokens = maxTokens,
                    maxImages = maxImages
                )
                call.resolve()
            } catch (t: Throwable) {
                call.reject("SET_MODEL_FAILED", t.message ?: t.javaClass.simpleName, t)
            }
        }
    }

    @PluginMethod
    fun downloadModel(call: PluginCall) {
        val url = call.getString("url")
        if (url.isNullOrBlank()) {
            call.reject("INVALID_URL", "downloadModel requires a `url`.")
            return
        }
        val filename = call.getString("filename")

        scope.launch {
            try {
                val path = engine.downloadModel(
                    url = url,
                    filename = filename
                ) { progress ->
                    // Forward 0..1 → 0..100 to JS. notifyListeners is
                    // thread-safe per Capacitor.
                    val data = JSObject()
                    data.put("progress", (progress * 100).toInt())
                    notifyListeners("downloadProgress", data)
                }
                val res = JSObject()
                res.put("path", path)
                call.resolve(res)
            } catch (t: Throwable) {
                call.reject("DOWNLOAD_FAILED", t.message ?: t.javaClass.simpleName, t)
            }
        }
    }

    @PluginMethod
    fun generate(call: PluginCall) {
        val prompt = call.getString("prompt")
        if (prompt == null) {
            call.reject("MISSING_PROMPT", "generate requires a `prompt`.")
            return
        }
        val imageBase64 = call.getString("imageBase64")

        scope.launch {
            try {
                val text = engine.generate(
                    prompt = prompt,
                    imageBase64 = imageBase64,
                    onChunk = { chunk, done ->
                        val data = JSObject()
                        data.put("text", chunk)
                        data.put("done", done)
                        notifyListeners("responseChunk", data)
                    }
                )
                val res = JSObject()
                res.put("text", text)
                call.resolve(res)
            } catch (e: InsightLLMError.ModelNotMultimodal) {
                call.reject(
                    "MODEL_NOT_MULTIMODAL",
                    "Active model is text-only; switch to a Gemma 3n multimodal task file to send images."
                )
            } catch (e: InsightLLMError.NotLoaded) {
                call.reject("NOT_READY", "Call setModel() before generate().")
            } catch (t: Throwable) {
                call.reject("GENERATE_FAILED", t.message ?: t.javaClass.simpleName, t)
            }
        }
    }

    @PluginMethod
    fun getReadiness(call: PluginCall) {
        val res = JSObject()
        res.put("readiness", engine.readiness.value)
        call.resolve(res)
    }

    @PluginMethod
    fun getPluginVersion(call: PluginCall) {
        val res = JSObject()
        res.put("version", "0.1.0")
        call.resolve(res)
    }
}
