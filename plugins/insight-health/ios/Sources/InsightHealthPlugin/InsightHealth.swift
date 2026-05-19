// InsightHealth — Swift wrapper over HealthKit.
//
// What we read (one daily snapshot per call):
//   - HRV SDNN          → ms             (most recent in last 24 h)
//   - Resting HR        → bpm            (most recent in last 24 h)
//   - Steps             → count          (sum over today's local day)
//   - VO₂ max           → ml/(kg·min)    (most recent in last 30 d)
//   - Active energy     → kcal           (sum over today's local day)
//   - Sleep analysis    → minutes        (most recent sleep session,
//                                         split into deep / REM / total)
//
// Permission UX: HealthKit shows a per-data-type sheet on first
// authorization request. After the user dismisses it, we can't
// query which types they granted (Apple's privacy stance — it
// would leak inferential info about the user). The honest signal
// is "did the read return data?" — empty results may mean blocked,
// no source paired, or just no readings yet today.

import Foundation
import HealthKit

enum InsightHealthError: Error {
    case notAvailable
    case permissionDenied
}

struct HealthSnapshot {
    var hrvMs: Double?
    var restingHrBpm: Double?
    var steps: Int?
    var vo2Max: Double?
    var sleepMinutes: Int?
    var sleepDeepMinutes: Int?
    var sleepRemMinutes: Int?
    var activeKcal: Int?

    func toDictionary() -> [String: Any] {
        var d: [String: Any] = [:]
        if let v = hrvMs { d["hrvMs"] = v }
        if let v = restingHrBpm { d["restingHrBpm"] = v }
        if let v = steps { d["steps"] = v }
        if let v = vo2Max { d["vo2Max"] = v }
        if let v = sleepMinutes { d["sleepMinutes"] = v }
        if let v = sleepDeepMinutes { d["sleepDeepMinutes"] = v }
        if let v = sleepRemMinutes { d["sleepRemMinutes"] = v }
        if let v = activeKcal { d["activeKcal"] = v }
        return d
    }
}

final class InsightHealth {
    private let store = HKHealthStore()

    // Every data type we may read. Kept in one place so the
    // permission sheet and the read paths can't drift apart.
    private var readTypes: Set<HKObjectType> {
        var set = Set<HKObjectType>()
        if let t = HKObjectType.quantityType(forIdentifier: .heartRateVariabilitySDNN) { set.insert(t) }
        if let t = HKObjectType.quantityType(forIdentifier: .restingHeartRate) { set.insert(t) }
        if let t = HKObjectType.quantityType(forIdentifier: .stepCount) { set.insert(t) }
        if let t = HKObjectType.quantityType(forIdentifier: .vo2Max) { set.insert(t) }
        if let t = HKObjectType.quantityType(forIdentifier: .activeEnergyBurned) { set.insert(t) }
        if let t = HKObjectType.categoryType(forIdentifier: .sleepAnalysis) { set.insert(t) }
        return set
    }

    func isAvailable() -> (available: Bool, reason: String?) {
        if HKHealthStore.isHealthDataAvailable() {
            return (true, nil)
        }
        return (false, "HealthKit not available (likely iPad).")
    }

    func requestPermissions() async throws -> Bool {
        guard HKHealthStore.isHealthDataAvailable() else {
            throw InsightHealthError.notAvailable
        }
        try await store.requestAuthorization(toShare: [], read: readTypes)
        // Apple's privacy contract means we can't read back which
        // types were granted. Treat dismissal as "the user saw the
        // sheet" — the calling code should follow up with a
        // syncToday() and check which fields came back populated.
        return true
    }

    func syncToday() async throws -> HealthSnapshot {
        guard HKHealthStore.isHealthDataAvailable() else {
            throw InsightHealthError.notAvailable
        }
        let calendar = Calendar.current
        let now = Date()
        let startOfDay = calendar.startOfDay(for: now)
        let twentyFourAgo = calendar.date(byAdding: .hour, value: -24, to: now) ?? startOfDay
        let thirtyDaysAgo = calendar.date(byAdding: .day, value: -30, to: now) ?? startOfDay
        let twoDaysAgo = calendar.date(byAdding: .day, value: -2, to: now) ?? startOfDay

        var snap = HealthSnapshot()

        // HRV — most recent reading in the last 24 h. The metric is
        // typically captured during sleep so "yesterday's HRV" is
        // the meaningful value.
        snap.hrvMs = try? await mostRecentQuantity(
            .heartRateVariabilitySDNN,
            unit: HKUnit.secondUnit(with: .milli),
            from: twentyFourAgo,
            to: now
        )

        snap.restingHrBpm = try? await mostRecentQuantity(
            .restingHeartRate,
            unit: HKUnit.count().unitDivided(by: HKUnit.minute()),
            from: twentyFourAgo,
            to: now
        )

        snap.steps = try? await dailySum(
            .stepCount,
            unit: HKUnit.count(),
            from: startOfDay,
            to: now
        ).map(Int.init)

        snap.vo2Max = try? await mostRecentQuantity(
            .vo2Max,
            unit: HKUnit(from: "ml/(kg*min)"),
            from: thirtyDaysAgo,
            to: now
        )

        snap.activeKcal = try? await dailySum(
            .activeEnergyBurned,
            unit: HKUnit.kilocalorie(),
            from: startOfDay,
            to: now
        ).map(Int.init)

        if let sleep = try? await readSleep(from: twoDaysAgo, to: now) {
            snap.sleepMinutes = sleep.total
            snap.sleepDeepMinutes = sleep.deep
            snap.sleepRemMinutes = sleep.rem
        }

        return snap
    }

    // MARK: - HealthKit query helpers

    private func mostRecentQuantity(
        _ identifier: HKQuantityTypeIdentifier,
        unit: HKUnit,
        from start: Date,
        to end: Date
    ) async throws -> Double? {
        guard let type = HKObjectType.quantityType(forIdentifier: identifier) else {
            return nil
        }
        let predicate = HKQuery.predicateForSamples(withStart: start, end: end)
        let sort = NSSortDescriptor(key: HKSampleSortIdentifierEndDate, ascending: false)
        return try await withCheckedThrowingContinuation { continuation in
            let q = HKSampleQuery(
                sampleType: type,
                predicate: predicate,
                limit: 1,
                sortDescriptors: [sort]
            ) { _, samples, error in
                if let error = error {
                    continuation.resume(throwing: error)
                    return
                }
                let value = (samples?.first as? HKQuantitySample)?.quantity.doubleValue(for: unit)
                continuation.resume(returning: value)
            }
            store.execute(q)
        }
    }

    private func dailySum(
        _ identifier: HKQuantityTypeIdentifier,
        unit: HKUnit,
        from start: Date,
        to end: Date
    ) async throws -> Double? {
        guard let type = HKObjectType.quantityType(forIdentifier: identifier) else {
            return nil
        }
        let predicate = HKQuery.predicateForSamples(withStart: start, end: end)
        return try await withCheckedThrowingContinuation { continuation in
            let q = HKStatisticsQuery(
                quantityType: type,
                quantitySamplePredicate: predicate,
                options: .cumulativeSum
            ) { _, statistics, error in
                if let error = error {
                    continuation.resume(throwing: error)
                    return
                }
                let value = statistics?.sumQuantity()?.doubleValue(for: unit)
                continuation.resume(returning: value)
            }
            store.execute(q)
        }
    }

    private struct SleepBreakdown {
        var total: Int = 0
        var deep: Int = 0
        var rem: Int = 0
    }

    /// Sum sleep-stage minutes from the most recent sleep block.
    /// HealthKit treats each stage as a separate category sample;
    /// we group by their `endDate` proximity and sum durations.
    private func readSleep(from start: Date, to end: Date) async throws -> SleepBreakdown? {
        guard let type = HKObjectType.categoryType(forIdentifier: .sleepAnalysis) else {
            return nil
        }
        let predicate = HKQuery.predicateForSamples(withStart: start, end: end)
        let sort = NSSortDescriptor(key: HKSampleSortIdentifierEndDate, ascending: false)
        return try await withCheckedThrowingContinuation { continuation in
            let q = HKSampleQuery(
                sampleType: type,
                predicate: predicate,
                limit: HKObjectQueryNoLimit,
                sortDescriptors: [sort]
            ) { _, samples, error in
                if let error = error {
                    continuation.resume(throwing: error)
                    return
                }
                guard let cs = samples as? [HKCategorySample], !cs.isEmpty else {
                    continuation.resume(returning: nil)
                    return
                }
                // Group samples into the most recent sleep "block" —
                // anything within 4 hours of the latest end date.
                let latest = cs.first!.endDate
                let blockCutoff = latest.addingTimeInterval(-12 * 60 * 60)
                let block = cs.filter { $0.endDate >= blockCutoff }

                var br = SleepBreakdown()
                for sample in block {
                    let minutes = Int(sample.endDate.timeIntervalSince(sample.startDate) / 60)
                    // Apple's category values shift across iOS releases.
                    // We map by the modern enum values that exist on
                    // iOS 16+ and silently bucket older or
                    // unrecognised values into "total" only.
                    switch HKCategoryValueSleepAnalysis(rawValue: sample.value) {
                    case .asleepDeep:
                        br.deep += minutes
                        br.total += minutes
                    case .asleepREM:
                        br.rem += minutes
                        br.total += minutes
                    case .asleepCore, .asleepUnspecified, .asleep:
                        br.total += minutes
                    case .inBed, .awake, .none:
                        // Don't count "in bed" or awake periods as sleep.
                        break
                    @unknown default:
                        br.total += minutes
                    }
                }
                continuation.resume(returning: br)
            }
            store.execute(q)
        }
    }
}

// Optional-mapping helper so the call sites stay terse.
private extension Optional {
    func map<U>(_ transform: (Wrapped) -> U) -> U? {
        switch self {
        case .some(let v): return transform(v)
        case .none: return nil
        }
    }
}
