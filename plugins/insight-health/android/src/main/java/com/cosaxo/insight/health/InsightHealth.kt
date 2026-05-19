// InsightHealth — Kotlin wrapper over Health Connect.
//
// Mirror of the iOS HealthKit reader, same surface:
//   availability()        — can the device do this at all?
//   permissionStatus()    — what did the user grant?
//   syncToday()           — read a daily snapshot in one round-trip
//
// Health Connect differs from HealthKit in two important ways:
//   1. Per-permission status IS readable (Android privacy model lets
//      apps see which types the user granted). We surface this so
//      the UI can show "your watch is paired but you blocked HRV"
//      type messaging.
//   2. The Health Connect APK can be missing on older devices; the
//      first call to getOrCreate() throws if it isn't installed.
//      isAvailable() catches this.

package com.cosaxo.insight.health

import android.content.Context
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.ActiveCaloriesBurnedRecord
import androidx.health.connect.client.records.HeartRateVariabilityRmssdRecord
import androidx.health.connect.client.records.RestingHeartRateRecord
import androidx.health.connect.client.records.SleepSessionRecord
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.records.Vo2MaxRecord
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import com.getcapacitor.JSObject
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import kotlin.reflect.KClass

sealed class InsightHealthError(message: String) : RuntimeException(message) {
    class NotAvailable(reason: String) : InsightHealthError(reason)
    class PermissionDenied(reason: String = "Permission denied.") : InsightHealthError(reason)
}

data class HealthSnapshot(
    val hrvMs: Double? = null,
    val restingHrBpm: Double? = null,
    val steps: Long? = null,
    val vo2Max: Double? = null,
    val sleepMinutes: Long? = null,
    val sleepDeepMinutes: Long? = null,
    val sleepRemMinutes: Long? = null,
    val activeKcal: Long? = null,
) {
    fun toJSObject(): JSObject {
        val o = JSObject()
        hrvMs?.let { o.put("hrvMs", it) }
        restingHrBpm?.let { o.put("restingHrBpm", it) }
        steps?.let { o.put("steps", it) }
        vo2Max?.let { o.put("vo2Max", it) }
        sleepMinutes?.let { o.put("sleepMinutes", it) }
        sleepDeepMinutes?.let { o.put("sleepDeepMinutes", it) }
        sleepRemMinutes?.let { o.put("sleepRemMinutes", it) }
        activeKcal?.let { o.put("activeKcal", it) }
        return o
    }
}

class InsightHealth(private val context: Context) {

    data class Availability(val available: Boolean, val reason: String?)

    fun availability(): Availability {
        return when (HealthConnectClient.getSdkStatus(context)) {
            HealthConnectClient.SDK_AVAILABLE ->
                Availability(true, null)
            HealthConnectClient.SDK_UNAVAILABLE ->
                Availability(false, "Health Connect not supported on this device.")
            HealthConnectClient.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED ->
                Availability(false, "Install Health Connect from the Play Store.")
            else ->
                Availability(false, "Health Connect status unknown.")
        }
    }

    // Single source of truth for the permission set. The plugin's
    // requestPermissions launcher and the read path both pull from
    // here so they can't drift.
    val requiredPermissions: Set<String> = setOf(
        HealthPermission.getReadPermission(HeartRateVariabilityRmssdRecord::class),
        HealthPermission.getReadPermission(RestingHeartRateRecord::class),
        HealthPermission.getReadPermission(StepsRecord::class),
        HealthPermission.getReadPermission(Vo2MaxRecord::class),
        HealthPermission.getReadPermission(ActiveCaloriesBurnedRecord::class),
        HealthPermission.getReadPermission(SleepSessionRecord::class),
    )

    private val client by lazy { HealthConnectClient.getOrCreate(context) }

    suspend fun permissionStatus(): String {
        if (!availability().available) return "denied"
        val granted = client.permissionController.getGrantedPermissions()
        val want = requiredPermissions
        return when {
            granted.containsAll(want) -> "granted"
            granted.any { it in want } -> "partial"
            else -> "denied"
        }
    }

    suspend fun syncToday(): HealthSnapshot {
        val avail = availability()
        if (!avail.available) {
            throw InsightHealthError.NotAvailable(avail.reason ?: "unavailable")
        }
        val granted = client.permissionController.getGrantedPermissions()
        if (granted.isEmpty()) {
            throw InsightHealthError.PermissionDenied()
        }

        val now = Instant.now()
        val zone = ZoneId.systemDefault()
        val startOfDay = LocalDate.now(zone).atStartOfDay(zone).toInstant()
        val twentyFourAgo = now.minusSeconds(24 * 60 * 60)
        val thirtyDaysAgo = now.minusSeconds(30L * 24 * 60 * 60)
        val twoDaysAgo = now.minusSeconds(2L * 24 * 60 * 60)

        // For each metric: only attempt the read if the user
        // granted that permission. Skipping silently is the right
        // call — the read API throws on missing permission.

        val hrv = if (granted.contains(HealthPermission.getReadPermission(HeartRateVariabilityRmssdRecord::class)))
            mostRecent(HeartRateVariabilityRmssdRecord::class, twentyFourAgo, now) { it.heartRateVariabilityMillis }
        else null

        val rhr = if (granted.contains(HealthPermission.getReadPermission(RestingHeartRateRecord::class)))
            mostRecent(RestingHeartRateRecord::class, twentyFourAgo, now) { it.beatsPerMinute.toDouble() }
        else null

        val steps = if (granted.contains(HealthPermission.getReadPermission(StepsRecord::class)))
            sumLong(StepsRecord::class, startOfDay, now) { it.count }
        else null

        val vo2 = if (granted.contains(HealthPermission.getReadPermission(Vo2MaxRecord::class)))
            mostRecent(Vo2MaxRecord::class, thirtyDaysAgo, now) { it.vo2MillilitersPerMinuteKilogram }
        else null

        val active = if (granted.contains(HealthPermission.getReadPermission(ActiveCaloriesBurnedRecord::class)))
            sumDouble(ActiveCaloriesBurnedRecord::class, startOfDay, now) { it.energy.inKilocalories }?.toLong()
        else null

        val sleep = if (granted.contains(HealthPermission.getReadPermission(SleepSessionRecord::class)))
            readSleep(twoDaysAgo, now)
        else SleepBreakdown()

        return HealthSnapshot(
            hrvMs = hrv,
            restingHrBpm = rhr,
            steps = steps,
            vo2Max = vo2,
            sleepMinutes = sleep.total.takeIf { it > 0 },
            sleepDeepMinutes = sleep.deep.takeIf { it > 0 },
            sleepRemMinutes = sleep.rem.takeIf { it > 0 },
            activeKcal = active,
        )
    }

    // Generic helpers — Health Connect's typed reads compose nicely
    // around a single read-request scaffold.

    private suspend fun <T : androidx.health.connect.client.records.Record> mostRecent(
        recordClass: KClass<T>,
        start: Instant,
        end: Instant,
        valueOf: (T) -> Double,
    ): Double? {
        val resp = client.readRecords(
            ReadRecordsRequest(
                recordType = recordClass,
                timeRangeFilter = TimeRangeFilter.between(start, end),
                ascendingOrder = false,
                pageSize = 1,
            )
        )
        return resp.records.firstOrNull()?.let(valueOf)
    }

    private suspend fun <T : androidx.health.connect.client.records.Record> sumLong(
        recordClass: KClass<T>,
        start: Instant,
        end: Instant,
        valueOf: (T) -> Long,
    ): Long? {
        val resp = client.readRecords(
            ReadRecordsRequest(
                recordType = recordClass,
                timeRangeFilter = TimeRangeFilter.between(start, end),
            )
        )
        if (resp.records.isEmpty()) return null
        return resp.records.sumOf(valueOf)
    }

    private suspend fun <T : androidx.health.connect.client.records.Record> sumDouble(
        recordClass: KClass<T>,
        start: Instant,
        end: Instant,
        valueOf: (T) -> Double,
    ): Double? {
        val resp = client.readRecords(
            ReadRecordsRequest(
                recordType = recordClass,
                timeRangeFilter = TimeRangeFilter.between(start, end),
            )
        )
        if (resp.records.isEmpty()) return null
        return resp.records.sumOf(valueOf)
    }

    private data class SleepBreakdown(
        val total: Long = 0,
        val deep: Long = 0,
        val rem: Long = 0,
    )

    private suspend fun readSleep(start: Instant, end: Instant): SleepBreakdown {
        val resp = client.readRecords(
            ReadRecordsRequest(
                recordType = SleepSessionRecord::class,
                timeRangeFilter = TimeRangeFilter.between(start, end),
                ascendingOrder = false,
                pageSize = 1,
            )
        )
        val session = resp.records.firstOrNull() ?: return SleepBreakdown()

        var total = 0L
        var deep = 0L
        var rem = 0L
        for (stage in session.stages) {
            val mins = java.time.Duration.between(stage.startTime, stage.endTime).toMinutes()
            when (stage.stage) {
                SleepSessionRecord.STAGE_TYPE_DEEP -> { deep += mins; total += mins }
                SleepSessionRecord.STAGE_TYPE_REM -> { rem += mins; total += mins }
                SleepSessionRecord.STAGE_TYPE_LIGHT,
                SleepSessionRecord.STAGE_TYPE_SLEEPING -> { total += mins }
                else -> { /* awake / out-of-bed — don't count */ }
            }
        }
        // Fallback when no stage breakdown is available — count the
        // whole session as "total".
        if (total == 0L) {
            total = java.time.Duration.between(session.startTime, session.endTime).toMinutes()
        }
        return SleepBreakdown(total, deep, rem)
    }
}
