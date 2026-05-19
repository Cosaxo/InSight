// InsightHealthPlugin — Capacitor binding for the Health Connect
// bridge. Mirror of the iOS plugin's shape.

package com.cosaxo.insight.health

import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.contract.ActivityResultContracts
import androidx.health.connect.client.PermissionController
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

@CapacitorPlugin(name = "InsightHealth")
class InsightHealthPlugin : Plugin() {

    private val bridge by lazy { InsightHealth(context) }
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)

    // Pending call held while the Health Connect permission UI is
    // showing. Resumed when the ActivityResultLauncher fires.
    private var pendingPermissionCall: PluginCall? = null
    private var permissionLauncher: ActivityResultLauncher<Set<String>>? = null

    override fun load() {
        // Registering the launcher must happen in load() — before
        // any Activity STARTED state — otherwise Android's
        // ActivityResultRegistry rejects the registration.
        val contract = PermissionController.createRequestPermissionResultContract()
        permissionLauncher = activity.activityResultRegistry.register(
            "insight-health-perm",
            contract
        ) { granted ->
            val call = pendingPermissionCall ?: return@register
            pendingPermissionCall = null
            val res = JSObject()
            // Granted is the set of permissions the user agreed to;
            // we report "granted" if at least one of our requested
            // types came back. The syncToday read path checks each
            // type individually.
            res.put("granted", granted.isNotEmpty())
            call.resolve(res)
        }
    }

    override fun handleOnDestroy() {
        scope.coroutineContext[kotlinx.coroutines.Job]?.cancel()
        permissionLauncher?.unregister()
        super.handleOnDestroy()
    }

    @PluginMethod
    fun isAvailable(call: PluginCall) {
        val state = bridge.availability()
        val res = JSObject()
        res.put("available", state.available)
        state.reason?.let { res.put("reason", it) }
        call.resolve(res)
    }

    @PluginMethod
    fun requestPermissions(call: PluginCall) {
        if (!bridge.availability().available) {
            call.reject(
                "NOT_AVAILABLE",
                "Health Connect is not available on this device. Install it from the Play Store or upgrade Android."
            )
            return
        }
        val launcher = permissionLauncher
        if (launcher == null) {
            call.reject("NOT_READY", "Permission launcher was not registered.")
            return
        }
        // Save the call so the launcher callback can resolve it.
        pendingPermissionCall = call
        launcher.launch(bridge.requiredPermissions)
    }

    @PluginMethod
    fun getPermissionStatus(call: PluginCall) {
        scope.launch {
            try {
                val status = bridge.permissionStatus()
                val res = JSObject()
                res.put("status", status)
                call.resolve(res)
            } catch (t: Throwable) {
                call.reject("STATUS_FAILED", t.message ?: t.javaClass.simpleName, t)
            }
        }
    }

    @PluginMethod
    fun syncToday(call: PluginCall) {
        scope.launch {
            try {
                val snap = bridge.syncToday()
                val res = JSObject()
                res.put("snapshot", snap.toJSObject())
                call.resolve(res)
            } catch (e: InsightHealthError.NotAvailable) {
                call.reject("NOT_AVAILABLE", e.message ?: "Health Connect not available.")
            } catch (e: InsightHealthError.PermissionDenied) {
                call.reject("PERMISSION_DENIED", e.message ?: "Permission denied.")
            } catch (t: Throwable) {
                call.reject("SYNC_FAILED", t.message ?: t.javaClass.simpleName, t)
            }
        }
    }
}
