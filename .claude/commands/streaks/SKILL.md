# Streaks Audit & Alignment

## What this skill does
Audits all streak calculation logic across iOS, Android, and Firebase functions to ensure streak algorithm is identical on every layer, and paused streaks are never broken.

**Source of truth:** `/Users/lokeshpudhari/TinyAct/Streakalgorithm.md` — all rules below are derived from this document. When in doubt, defer to Streakalgorithm.md.

## Rules

### Rule 0: Solo streak logic
Check-in done = streak +1. Check-in missed = streak resets to 0. Next day check-in after a reset = streak is 1.
- **Renew**: streak, check-in count, and total check-ins all start from 0 (treated as a brand-new commitment).
- **Extend**: streak continues based on check-ins done, no reset.

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

### Rule 9: Change propagation order (which should never change in any case)
When the algorithm changes, updates must flow: `Streakalgorithm.md` → `algorithm-spec.md` → `streakCalculation.ts` → `streak-vectors.json` → `StreakCalculationService.swift` → `StreakCalculationService.kt`.

### Rule 10: Partnership streak logic
Each user in a partnership displays their own **individual streak count** (calculated from their own completions). The partnership streak document is used only to track `lastCompletionDate` for mutual break detection and pause state — its stored `currentStreak` field is **not** used for display (except during a pause, see below).

Both partners must check in each day for either partner's streak to increment. If either partner misses a day, **both** partners' streaks reset to 0.

**Display rule:**
- When partnership is NOT paused: show `personalStreakDays` / `individualStreak` (individual, calculated from the user's own completions filtered by `lastStreakBreakDate`)
- When partnership IS paused: show `partnershipStreak.currentStreak` (frozen value at time of pause)

**Pause/resume streak rule:**
When a partnership is paused, the displayed streak freezes at `partnershipStreak.currentStreak`. When resumed, the streak **continues from the frozen value** — paused days are skipped in the streak walk-back so that pre-pause completions still count toward the total. If paused for N days, streak should auto-resume after N days.

- **DO pass partnership paused days to `calculateIndividualStreak` / `personalStreakDays`** so the walk-back skips the pause period and continues counting pre-pause completions.
- The streak walk-back must treat paused days as if they don't exist — they are neither completions nor missed days.

Verified scenario — 1-day pause:
- Day 1: check-in (streak=1), Day 2: check-in (streak=2)
- Day 3: paused → display shows frozen value (2)
- Day 4: resumed + check-in (3), Day 5: check-in (4)
- Expected display (not paused): **4** (days 1+2+4+5 all counted; day 3 skipped as paused)
- Wrong if paused days NOT skipped: 2 (only days 4+5 counted, streak breaks at day 3) ← this is the bug to avoid

**Mutual break rule:**
If either partner misses a day (gap detected when both next check in together), `lastStreakBreakDate = today` is set on **both** users' commitment documents. Both individual streak calculations then filter completions from that date forward, causing both to reset to 0. when both partners check-ins, streak continues to build from 1.

**Partnership formation rule:**
Forming a partnership does NOT reset either user's streak. Both users continue showing their pre-partnership individual counts. From partnership formation onward, both must check in for either's streak to grow; if either breaks, both reset to 0.
- iOS: partnership streak doc is created only on the first day both check in together (with `currentStreak: 1`, `lastCompletionDate: today`)
- Android: partnership streak doc is created immediately on invitation acceptance (with `currentStreak: 0`, `lastCompletionDate: null`); the first mutual check-in is treated as `lastDay == null` (not a gap) and only updates `lastCompletionDate`

**Partnership dissolution rule:**
When a partnership is ended, both users continue individually with their current streak from that point onward. Each user's streak then depends solely on their own check-ins.
- Example: A and B have streak 3 with partnership → end partnership → A has 3+, B has 3+ → if B misses next day, B resets to 0, no impact on A.

**Partner leaving/removal rule:**
If partner A is removed/leaves at partner streak 3, partner B continues with streak 3 and from then on B's streak depends solely on B's own check-ins.
If an un-partnered member leaves/is removed, there is no impact on other users' streaks.

**Renew/Extend:**
- **Renew**: streak, check-in count, total check-ins, progress ring start from 0. No partnership details and no previous photo proofs are shown after renewal — groups are completely new.
- **Extend**: streak continues based on check-ins done by partner members, nothing resets.

**Verified scenario — day 6 partnership formation in a 14-day group:**
- Pre-partnership: A has 5-day streak, B has 2-day streak
- Right after partnering (before day 6 check-in): A sees 5, B sees 2 ✓
- Day 6 — both check in: A sees 6, B sees 3 (each gained one day, no reset) ✓
- Day 7+ — both check in daily: A=7/B=4, A=8/B=5, etc. (streaks grow independently) ✓
- If B misses day 8, then on day 9 both check in: gap detected → `lastStreakBreakDate = day9` on both → A resets to 1, B resets to 1 ✓

**Key implementation files:**
- iOS display: `GroupDetailView.swift` → `displayStreak` (shows `individualStreak`, paused uses `streakObj.currentStreak`)
- iOS check-in display: `CheckInViewModel.swift` → `getStreakDays` (returns `streaks[commitment.id]`, individual)
- iOS break enforcement: `CheckInViewModel.swift` → `updatePartnershipStreakAfterCheckIn` → `updateCommitmentsWithStreakBreak`
- Android display: `CommitmentDetailViewModel.kt` → `displayStreakDays` (shows `personalStreakDays`, paused uses `partnershipStreak.currentStreak`)
- Android check-in display: `CheckInViewModel.kt` → `buildPerCommitmentStreaks` (calculates individual streak with `lastStreakBreakDate` filter)
- Android break enforcement: `CheckInViewModel.kt` → `updatePartnershipStreakInFirestore`
- Android doc creation: `FirebaseInvitationRepository.kt` → `acceptPartnershipInvitation` (initializes with `currentStreak=0`)

### Rule 11: Group accountability streak logic
When `allMembersAccountable == true`: if ALL members check in, streak +1. If ANY member misses a day, ALL members reset to 0. When a member leaves/is removed, the remaining members' streak continues unchanged from the current value.
- **Renew**: streak, check-in count, total check-ins start from 0 (treated as new commitment). no previous photo proofs should be shown.
- **Extend**: streak continues based on check-ins done by all group members.

### Rule 12: Non-accountable group streak logic
Each member's streak depends solely on their own check-ins. Check-in done = +1, missed = reset to 0. Other members' check-ins or absences have no effect.
- If a member leaves/is removed, there is no impact on other users' streaks.
- **Renew**: streak, check-in count, total check-ins start from 0. no previous photo proofs should be shown.
- **Extend**: streak continues based on each member's own check-ins.

### Rule 14: Solo-to-group conversion
When a solo commitment is converted to a group, data must be handled differently for the original user (User A) vs newly invited members (User B):

**User A (original creator):**
- Streak continues from the solo period (no reset)
- All check-ins/completions carry forward (migrated to the new group commitment)
- All photo proofs carry forward
- `commitment.createdAt` preserved from the original solo commitment

**User B (newly invited member):**
- Starts with 0 day streak and 0 check-ins
- `commitment.createdAt = Date()` (acceptance time) — no historical completions
- `commitment.expiresAt` inherited from the group

**Group-level data (same for all members):**
- "X day challenge" label uses `group.durationDays` = original duration (createdAt → expiresAt), NOT remaining days
- Remaining days calculated from `group.expiresAt` minus today (shared)
- Progress ring is group-wide (`todayCheckIns / memberCount`)
- `group.createdAt` preserved from the original solo commitment's `createdAt`

**Verified scenario — 7-day solo converted on day 3:**
- User A created 7-day solo commitment on Day 1
- Day 3: User A converts to group, invites User B
- Group shows: "7 day challenge", 4 days remaining
- User A sees: streak = 2 (carried forward), check-ins = 2 (carried forward)
- User B accepts on Day 3: streak = 0, check-ins = 0
- Day 4: both check in → User A streak = 3, User B streak = 1

**Key implementation files:**
- iOS: `ConvertSoloToGroupView.swift` — calculates `totalDays` from `createdAt` to `expiresAt`, migrates ALL completions from `commitment.createdAt`
- Android: `ConvertSoloToGroupScreen.kt` — calculates `originalDuration` from `createdAt` to `expiresAt`, migrates ALL completions from `commitment.createdAt`

### Rule 13: Streak display logic
User streak calculation logic for views: Calculate user streak for each commitment at one location and pull the same data to get loaded in checkins-view, my goals view and detailed view. Ex: calculate user streak with all possibles rules metioned above like all-in group? Or partnered with ? Or  solo? Or paused for ? Etc... w.r.t each commitment only once and update the value with checkins and populate the same data in all views, that way streak stays consistent across views. Streak algo still remains same but we are doing it at one place and pulling the data in diff views to stay consistent.

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

8. For pause/resume streak display, verify:
   - Paused days ARE passed to the streak calculation so the walk-back skips paused days and continues counting pre-pause completions
   - After resume, the displayed streak continues from the frozen value (not reset to 0)
   - Pause auto-resumes after the set pause duration

9. For partnership streak display, verify:
   - `GroupDetailView.swift`: `displayStreak` returns `viewModel.individualStreak` (not `streakObj.currentStreak`) unless `streakObj.isPaused`
   - `CommitmentDetailViewModel.kt`: `displayStreakDays` returns `personalStreakDays` (not `partnershipStreak.currentStreak`) unless `partnershipStreak.isPaused`
   - `CheckInViewModel.swift` `getStreakDays`: returns `streaks[commitment.id]` always (no `partnershipStreaks` path)
   - `CheckInViewModel.kt` `buildPerCommitmentStreaks`: partnership case calls `calculateStreak(userGroupComps, pausedDays)` not `calculatePartnershipStreak(userGroupComps, partnerComps, pausedDays)`

9. For partnership formation, verify:
   - `FirebaseInvitationRepository.kt` `acceptPartnershipInvitation`: initializes streak with `currentStreak=0`, NOT `min(A, B)`
   - `CheckInViewModel.swift` `updatePartnershipStreakAfterCheckIn`: initializes new streak doc with `currentStreak: 1`, NOT `min(userStreak, partnerStreak)`
   - `CheckInViewModel.kt` `updatePartnershipStreakInFirestore`: `lastDay == null` branch does NOT trigger break (must be covered by `lastDay == null || lastDay == yesterday` → consecutive branch)

10. For mutual break enforcement, verify:
    - iOS `updateCommitmentsWithStreakBreak`: sets `lastStreakBreakDate` on both users' commitments when gap detected
    - Android `updatePartnershipStreakInFirestore` `else` branch: sets `lastStreakBreakDate = today` on both users' commitments before resetting streak doc

11. For partnership dissolution, verify:
    - When partnership is ended, both users continue with their current streak value
    - After dissolution, each user's streak depends solely on their own check-ins (no mutual break logic)

12. For partner leaving/removal, verify:
    - Remaining partner continues with the current streak value
    - Remaining partner's streak becomes individual (no mutual break logic)

13. For renew vs extend, verify:
    - Renew: streak, check-in count, and total check-ins reset to 0 for all commitment types
    - Extend: streak continues from current value for all commitment types
    - Partnership renew: no partnership details shown after renewal

14. For non-accountable groups, verify:
    - Each member's streak is calculated independently from their own check-ins only
    - Member leaving/removal has no impact on other members' streaks

15. For solo-to-group conversion, verify:
    - `group.durationDays` is set to the ORIGINAL duration (createdAt → expiresAt), NOT remaining days from today
    - `group.createdAt` is preserved from the original solo commitment's `createdAt`, NOT set to `Date()`
    - ALL completions from the entire solo period are migrated (fetched from `commitment.createdAt`, not just today)
    - User A's `commitment.createdAt` is preserved from the solo commitment
    - User B's `commitment.createdAt` defaults to `Date()` (acceptance time) — fresh start
    - iOS: `ConvertSoloToGroupView.swift` calculates `totalDays` from `commitment.createdAt` to `expiresAt`
    - Android: `ConvertSoloToGroupScreen.kt` calculates `originalDuration` from `commitment.createdAt` to `expiresAt`

## Common violations to fix

- **Stale mercy-day comment in StreakCalculationService.swift line 18**: Remove the line `/// Mercy days: 1 missed day per calendar month is allowed.` — fix by deleting that comment line.
- **grace period property added during development**: Remove any `gracePeriodHours` computed var and all callsites — fix by deleting the property and replacing callsites with `hoursUntilBreak`.
- **isAboutToBreak includes hours == 0**: Change `hours <= 12` to `hours in 1..12` or `hours > 0 && hours <= 12`.
- **isBroken uses raw Date comparison instead of startOfDay**: Replace `lastDate < yesterday` with `calendar.startOfDay(for: lastDate) < yesterday`.
- **Streak resetting after pause/resume (NOT skipping paused days)**: `calculateIndividualStreak` or `personalStreakDays` MUST receive paused days so the walk-back skips the pause period and continues counting pre-pause completions. If paused days are not passed, the streak breaks at the pause boundary and only counts post-resume check-ins, showing a lower count than expected. Fix: pass paused days so the streak continues from the frozen value after resume.
- **Partnership streak not resetting both users**: Ensure the partnership streak update function sets `lastStreakBreakDate = today` on both users' commitment documents when a gap is detected. iOS: `updateCommitmentsWithStreakBreak` in `CheckInViewModel.swift`. Android: `else` branch of `updatePartnershipStreakInFirestore` in `CheckInViewModel.kt`.
- **Partnership display showing stored `currentStreak` instead of individual**: `displayStreak` / `displayStreakDays` must return `individualStreak` / `personalStreakDays` for all non-paused partnership states. Only `isPaused == true` should show the stored `partnershipStreak.currentStreak`.
- **Partnership formation resetting existing streaks**: `FirebaseInvitationRepository.kt` must initialize with `currentStreak=0`, not `min(A, B)`. iOS `updatePartnershipStreakAfterCheckIn` must initialize with `currentStreak: 1`, not `min(...)`. First mutual check-in (`lastCompletionDate == null`) must NOT trigger a break.
- **CheckIn screen using intersection instead of individual streak**: `buildPerCommitmentStreaks` in `CheckInViewModel.kt` must call `calculateStreak(userGroupComps, pausedDays)` for partnership commitments, not `calculatePartnershipStreak`. iOS `getStreakDays` must return `streaks[commitment.id]`, not `partnershipStreaks[commitment.id]`.
- **Partnership dissolution not preserving streak**: When partnership ends, both users must keep their current streak value and continue individually. Fix: do not reset streak on partnership dissolution.
- **Partner removal resetting remaining partner's streak**: When partner A leaves at streak N, partner B must continue with N. Fix: do not reset remaining partner's streak on removal.
- **Renew not resetting streak to 0**: On commitment renewal, streak/check-in count/total check-ins must all start from 0. Fix: ensure renew logic resets all counters.
- **Extend resetting streak**: On commitment extension, streak must continue from current value. Fix: ensure extend logic does not reset counters.
- **Non-accountable group members affecting each other's streaks**: In non-accountable groups, each member's streak must be independent. Fix: ensure no cross-member streak logic runs for non-accountable groups.
- **Solo-to-group conversion using remaining days instead of original duration**: `group.durationDays` must be the ORIGINAL duration (createdAt → expiresAt), not remaining days (today → expiresAt). Fix: calculate from `commitment.createdAt` to `commitment.expiresAt`.
- **Solo-to-group conversion setting group.createdAt to Date()**: `group.createdAt` must be preserved from the original solo commitment. Fix: use `commitment.createdAt`.
- **Solo-to-group conversion only migrating today's completions**: ALL completions from the entire solo period must be migrated. Fix: fetch from `commitment.createdAt`, not `startOfToday`.

## Files to check

- iOS:
  - `/Users/lokeshpudhari/TinyAct/microcommit/micro-commit/Core/Domain/Models/Streak.swift`
  - `/Users/lokeshpudhari/TinyAct/microcommit/micro-commit/Infrastructure/Services/StreakCalculationService.swift`
  - `/Users/lokeshpudhari/TinyAct/microcommit/TinyActTests/StreakTests.swift`
- Android:
  - `/Users/lokeshpudhari/TinyAct/TinyAct---Android/core/domain/src/main/java/com/lokesh/tinyact/core/domain/model/Streak.kt`
  - `/Users/lokeshpudhari/TinyAct/TinyAct---Android/core/domain/src/main/java/com/lokesh/tinyact/core/domain/service/StreakCalculationService.kt`
- iOS (solo-to-group conversion):
  - `/Users/lokeshpudhari/TinyAct/microcommit/micro-commit/Core/Presentation/Screens/MyGoals/ConvertSoloToGroupView.swift`
- Android (solo-to-group conversion):
  - `/Users/lokeshpudhari/TinyAct/TinyAct---Android/feature/goals/src/main/java/com/lokesh/tinyact/feature/goals/ConvertSoloToGroupScreen.kt`
- Shared:
  - `/Users/lokeshpudhari/TinyAct/Streakalgorithm.md`
  - `/Users/lokeshpudhari/TinyAct/microcommit/functions/src/algorithms/streakCalculation.ts`
  - `/Users/lokeshpudhari/TinyAct/shared/test-vectors/streak-vectors.json` (if present)
