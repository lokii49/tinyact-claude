# Awards Audit & Alignment

## What this skill does
Audits the XP and award system to ensure level thresholds, XP values per award, award type enumerations, and popup behavior are identical across iOS, Android, and Firebase functions, and that the award popup appears exactly once per earned award.

## Rules

### Rule 1: XP level thresholds are canonical in xpLeveling.ts
The single source of truth for XP level thresholds is `/microcommit/functions/src/algorithms/xpLeveling.ts`. Both platform implementations must match exactly:

| Level     | Min XP |
|-----------|--------|
| Starter   | 0      |
| Committed | 50     |
| Dedicated | 150    |
| Master    | 350    |
| Legend    | 700    |

iOS `UserLevel.swift` and Android `UserLevel.kt` must use these exact thresholds. Any deviation is a violation.

### Rule 2: AwardType enum values must match across all three platforms
iOS `AwardType` (Swift enum with `rawValue: String`), Android `AwardType` (Kotlin enum with `value: String`), and any TypeScript award type must all use these exact string values:
`firstStep`, `weeklyWarrior`, `habitFormed`, `monthlyMaster`, `centuryClub`, `yearStrong`, `phoenixRising`, `secondWind`, `neverGiveUp`, `perfectWeek`, `perfectMonth`, `earlyBird`, `nightOwl`, `teamPlayer`, `cheerleader`, `popular`, `photographer`, `honestAbe`.

Adding an award on one platform without adding it on the others is a parity violation.

### Rule 3: XP values per award must match across platforms
The `xpValue` for each award type must be identical on iOS and Android. The canonical values (from `Award.swift` and `Award.kt`) are:

| Award          | XP  |
|----------------|-----|
| firstStep      | 10  |
| weeklyWarrior  | 25  |
| habitFormed    | 50  |
| monthlyMaster  | 75  |
| centuryClub    | 150 |
| yearStrong     | 500 |
| phoenixRising  | 30  |
| secondWind     | 40  |
| neverGiveUp    | 60  |
| perfectWeek    | 25  |
| perfectMonth   | 100 |
| earlyBird      | 20  |
| nightOwl       | 20  |
| teamPlayer     | 15  |
| cheerleader    | 25  |
| popular        | 50  |
| photographer   | 30  |
| honestAbe      | 30  |

Any mismatch between iOS and Android is a violation.

### Rule 4: Award popup shown once per award earned
When a new award is added to `user.earnedAwards`, the award popup must display exactly once. It must NOT appear on every subsequent app open. The earned award must be tracked so it is not shown again. iOS uses `AwardService.showingAwardPopup` + `currentAwardToShow`. Android uses `AwardPopupService` in `core/common/`.

### Rule 5: XP increments on specific events only
`user.totalXP` increments on exactly these events (no others):
- Daily check-in completed: +`XPRewards.dailyCheckIn` (currently 2 XP per iOS `UserLevel.swift`)
- Award earned: the award's `xpValue`
- Photo proof bonus: +`XPRewards.photoProofBonus` (currently 1 XP)
- Reaction given: +`XPRewards.reactionGiven` (currently 1 XP)

Incrementing XP on any other event (e.g., group join, profile update) is a violation unless explicitly added to `XPRewards`.

### Rule 6: totalXP is stored on the User document
`totalXP` is a field on the `users/{userID}` Firestore document. It is NOT computed on-the-fly. Reads use the stored value. After any XP increment, the stored value must be updated in Firestore immediately.

### Rule 7: AwardService (iOS) runs after streak update
`AwardService.checkAndGrantAwards(for:completion:currentStreak:isFirstCheckInEver:isComeback:)` must receive the post-recalculation streak value. Calling it before `StreakCalculationService.calculateStreak(...)` means milestone awards trigger at the wrong streak count.

### Rule 8: isFirstCheckInEver vs isComeback distinction
- `isFirstCheckInEver`: true only on the very first check-in ever across all commitments
- `isComeback`: true only when the user had previous check-ins AND returned after a 3+ day break AND is NOT their first ever check-in

Confusing these two causes `phoenixRising` to award incorrectly on the first check-in.

### Rule 9: earnedAwards stored on User document, not in a separate collection
The full `[Award]` list is stored directly on `users/{userID}.earnedAwards` as an array. There is no separate `awards` collection. `user.hasAward(_:)` checks this array. Do not add code that queries a separate collection.

## Audit steps

1. Read `/Users/lokeshpudhari/TinyAct/microcommit/functions/src/algorithms/xpLeveling.ts` and extract the LEVELS array. Note the 5 levels and their minXP thresholds.

2. Read `/Users/lokeshpudhari/TinyAct/microcommit/micro-commit/Core/Domain/Models/UserLevel.swift` and verify each `minXP` case matches exactly: Starter=0, Committed=50, Dedicated=150, Master=350, Legend=700.

3. Read `/Users/lokeshpudhari/TinyAct/TinyAct---Android/core/domain/src/main/java/com/lokesh/tinyact/core/domain/model/UserLevel.kt` and verify the same thresholds.

4. Read `/Users/lokeshpudhari/TinyAct/microcommit/micro-commit/Core/Domain/Models/Award.swift` and extract all `AwardType` rawValues and their `xpValue` cases.

5. Read `/Users/lokeshpudhari/TinyAct/TinyAct---Android/core/domain/src/main/java/com/lokesh/tinyact/core/domain/model/Award.kt` and compare every enum `value` and `xpValue` against iOS. Flag any mismatch.

6. Read `/Users/lokeshpudhari/TinyAct/microcommit/micro-commit/Infrastructure/Services/AwardService.swift` and verify:
   - `checkAndGrantAwards(...)` receives `currentStreak` (post-recalculation)
   - `isFirstCheckInEver` and `isComeback` are correctly computed
   - `showingAwardPopup` is set to true when a new award is granted

7. Find the Android `AwardPopupService` under `/Users/lokeshpudhari/TinyAct/TinyAct---Android/core/common/` and verify equivalent popup-once behavior.

8. Read `/Users/lokeshpudhari/TinyAct/microcommit/micro-commit/Core/Domain/Models/UserLevel.swift` `XPRewards` struct and note all XP increment values. Verify these are used (not hardcoded magic numbers) at every XP-increment callsite.

## Common violations to fix

- **Level threshold mismatch between iOS and TypeScript**: Update the mismatched `minXP` case in `UserLevel.swift` or `UserLevel.kt` to match the canonical values in `xpLeveling.ts`.
- **Award type exists on iOS but not Android**: Add the missing `AwardType` entry to `Award.kt` with the same string value and xpValue — fix by copying the enum case from `Award.swift`.
- **Award popup shown every app open**: Track shown awards in `UserDefaults` (iOS) or `SharedPreferences` (Android) with the award ID as the key. Only show popup if `!shownAwards.contains(award.id)`.
- **isComeback triggers on first check-in**: Guard with `!isFirstCheckInEver` before computing isComeback — the current `AwardService.swift` already does this correctly; verify Android matches.
- **XP magic number instead of XPRewards constant**: Replace any hardcoded `+2` or `+1` XP increment with `XPRewards.dailyCheckIn` or `XPRewards.photoProofBonus`.

## Files to check

- iOS:
  - `/Users/lokeshpudhari/TinyAct/microcommit/micro-commit/Core/Domain/Models/Award.swift`
  - `/Users/lokeshpudhari/TinyAct/microcommit/micro-commit/Core/Domain/Models/UserLevel.swift`
  - `/Users/lokeshpudhari/TinyAct/microcommit/micro-commit/Core/Domain/Models/User.swift`
  - `/Users/lokeshpudhari/TinyAct/microcommit/micro-commit/Infrastructure/Services/AwardService.swift`
- Android:
  - `/Users/lokeshpudhari/TinyAct/TinyAct---Android/core/domain/src/main/java/com/lokesh/tinyact/core/domain/model/Award.kt`
  - `/Users/lokeshpudhari/TinyAct/TinyAct---Android/core/domain/src/main/java/com/lokesh/tinyact/core/domain/model/UserLevel.kt`
  - `/Users/lokeshpudhari/TinyAct/TinyAct---Android/core/common/` (AwardPopupService)
- Shared:
  - `/Users/lokeshpudhari/TinyAct/microcommit/functions/src/algorithms/xpLeveling.ts`
  - `/Users/lokeshpudhari/TinyAct/microcommit/functions/src/algorithms/awardLogic.ts`
