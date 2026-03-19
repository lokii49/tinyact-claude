# Streaks Audit & Alignment

## What this skill does
Audits all streak calculation logic across iOS, Android, and Firebase functions to ensure the no-mercy-day, no-grace-period algorithm is identical on every layer, and that paused streaks are never broken.

## Rules

### Rule 1: No mercy days anywhere
No constant named `MERCY_DAYS_PER_MONTH`, `mercyDays`, `allowedMissedDays`, or similar may exist in any file. The iOS comment in `StreakCalculationService.swift` at line 18 ("Mercy days: 1 missed day per calendar month is allowed.") is **a stale comment that contradicts the implementation** — the code below it does not implement mercy days. That comment must be removed or corrected; it is a documentation bug, not a code bug.

### Rule 2: No grace period
No property, parameter, or function named `gracePeriodHours`, `isInGracePeriod`, `graceHoursRemaining`, or `graceWindow` may exist anywhere. Streak breaks at the exact start of the missed calendar day — midnight.

### Rule 3: isBroken formula
`isBroken` must satisfy all of:
- Returns `false` when `isPaused == true`
- Returns `false` when `lastCompletionDate == nil`
- Returns `true` when `startOfDay(lastCompletionDate) < startOfDay(yesterday)`
- Uses calendar-day comparison (startOfDay), never raw millisecond comparison

iOS canonical form (Streak.swift):
```swift
var isBroken: Bool {
    guard !isPaused else { return false }
    guard let lastDate = lastCompletionDate else { return false }
    let calendar = Calendar.current
    let today = calendar.startOfDay(for: Date())
    let yesterday = calendar.date(byAdding: .day, value: -1, to: today)!
    return calendar.startOfDay(for: lastDate) < yesterday
}
```

Android canonical form (Streak.kt):
```kotlin
val isBroken: Boolean get() {
    if (isPaused) return false
    val lastDate = lastCompletionDate ?: return false
    val yesterday = Calendar.getInstance().apply {
        add(Calendar.DAY_OF_YEAR, -1)
        set(Calendar.HOUR_OF_DAY, 0); set(Calendar.MINUTE, 0)
        set(Calendar.SECOND, 0); set(Calendar.MILLISECOND, 0)
    }.time
    val lastDayStart = Calendar.getInstance().apply {
        time = lastDate
        set(Calendar.HOUR_OF_DAY, 0); set(Calendar.MINUTE, 0)
        set(Calendar.SECOND, 0); set(Calendar.MILLISECOND, 0)
    }.time
    return lastDayStart.before(yesterday)
}
```

### Rule 4: hoursUntilBreak formula
Must return `nil`/`null` when: paused, no lastCompletionDate, already checked in today, or already broken (lastDay < yesterday). Must return hours until 23:59:59 tonight only when lastCompletionDate was yesterday.

### Rule 5: isAboutToBreak formula
Must be `hoursUntilBreak in 1..12` (inclusive). Returning true when hours == 0 is a violation.

### Rule 6: Paused streaks never break
When `isPaused == true`: `isBroken` is false, `hoursUntilBreak` is nil/null, `isAboutToBreak` is false. No code path may call streak-reset logic on a paused streak.

### Rule 7: Any missed non-paused day breaks streak immediately
In `StreakCalculationService.calculateStreak(...)`, the walk-back loop must `break` on the first day that is neither a completion day nor a paused day. No skipping allowed.

### Rule 8: Algorithm identical across all 4 layers
The streak calculation logic must produce the same output for the same input on:
1. `StreakCalculationService.swift` (iOS)
2. `StreakCalculationService.kt` (Android)
3. `streakCalculation.ts` (Firebase functions)
4. Test vectors in `shared/test-vectors/streak-vectors.json` must pass on both platforms

### Rule 9: Change propagation order
When the algorithm changes, updates must flow: `Streakalgorithm.md` → `algorithm-spec.md` → `streakCalculation.ts` → `streak-vectors.json` → `StreakCalculationService.swift` → `StreakCalculationService.kt`.

### Rule 10: Partnership streak logic
For partnership streaks: both partners must have a completion on the same calendar day. If either partner misses, both reset to 0. After partnership ends, each user continues individually from their current streak value. When partnership is paused, both users' streaks are frozen and resume at the same value after the pause ends.

### Rule 11: Group accountability streak logic
When `allMembersAccountable == true`: if ANY member misses a day, ALL members reset to 0. When a member leaves/is removed, the remaining members' streak continues unchanged from the current value.

## Audit steps

1. Read `/Users/lokeshpudhari/TinyAct/microcommit/micro-commit/Core/Domain/Models/Streak.swift` and verify:
   - `isBroken` uses `startOfDay` comparisons
   - `hoursUntilBreak` returns nil when paused or broken
   - `isAboutToBreak` is `hours in 1..12`
   - No grace period properties exist anywhere in the struct

2. Read `/Users/lokeshpudhari/TinyAct/TinyAct---Android/core/domain/src/main/java/com/lokesh/tinyact/core/domain/model/Streak.kt` and verify the same 4 points.

3. Read `/Users/lokeshpudhari/TinyAct/microcommit/micro-commit/Infrastructure/Services/StreakCalculationService.swift` fully and verify:
   - Line 18 stale mercy-day comment is removed or corrected
   - The walk-back loop breaks immediately on any missed non-paused day
   - No `MERCY_DAYS_PER_MONTH` constant or logic

4. Read `/Users/lokeshpudhari/TinyAct/TinyAct---Android/core/domain/src/main/java/com/lokesh/tinyact/core/domain/service/StreakCalculationService.kt` fully and verify the same points.

5. Read `/Users/lokeshpudhari/TinyAct/microcommit/functions/src/algorithms/streakCalculation.ts` fully and confirm the no-mercy-day, no-grace-period rules are enforced.

6. Search for banned terms across all Swift, Kotlin, and TypeScript files:
   - `MERCY_DAYS_PER_MONTH`
   - `gracePeriodHours`
   - `isInGracePeriod`
   - `graceHoursRemaining`
   - `allowedMissedDays`

7. If `shared/test-vectors/streak-vectors.json` exists, verify it contains test cases for: solo streak (no miss, one miss, two misses), paused streak, partnership streak (one partner misses), group accountability (one member misses).

## Common violations to fix

- **Stale mercy-day comment in StreakCalculationService.swift line 18**: Remove the line `/// Mercy days: 1 missed day per calendar month is allowed.` — fix by deleting that comment line.
- **grace period property added during development**: Remove any `gracePeriodHours` computed var and all callsites — fix by deleting the property and replacing callsites with `hoursUntilBreak`.
- **isAboutToBreak includes hours == 0**: Change `hours <= 12` to `hours in 1..12` or `hours > 0 && hours <= 12`.
- **isBroken uses raw Date comparison instead of startOfDay**: Replace `lastDate < yesterday` with `calendar.startOfDay(for: lastDate) < yesterday`.
- **Partnership streak not resetting both users**: Ensure the partnership streak update function resets both userIDs' streaks when either partner misses.

## Files to check

- iOS:
  - `/Users/lokeshpudhari/TinyAct/microcommit/micro-commit/Core/Domain/Models/Streak.swift`
  - `/Users/lokeshpudhari/TinyAct/microcommit/micro-commit/Infrastructure/Services/StreakCalculationService.swift`
  - `/Users/lokeshpudhari/TinyAct/microcommit/TinyActTests/StreakTests.swift`
- Android:
  - `/Users/lokeshpudhari/TinyAct/TinyAct---Android/core/domain/src/main/java/com/lokesh/tinyact/core/domain/model/Streak.kt`
  - `/Users/lokeshpudhari/TinyAct/TinyAct---Android/core/domain/src/main/java/com/lokesh/tinyact/core/domain/service/StreakCalculationService.kt`
- Shared:
  - `/Users/lokeshpudhari/TinyAct/Streakalgorithm.md`
  - `/Users/lokeshpudhari/TinyAct/microcommit/functions/src/algorithms/streakCalculation.ts`
  - `/Users/lokeshpudhari/TinyAct/shared/test-vectors/streak-vectors.json` (if present)
