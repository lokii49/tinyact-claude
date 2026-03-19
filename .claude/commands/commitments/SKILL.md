# Commitments Audit & Alignment

## What this skill does
Audits commitment model fields, lifecycle rules (active/expired/archived), renewal vs extend behavior, schedule validation, and deletion rules to ensure iOS and Android implement them identically and correctly.

## Rules

### Rule 1: isCurrentlyActive must check both flags
`isCurrentlyActive` must return `isActive && !isExpired`. Checking only `isActive` or only `!isExpired` is a violation. Both conditions are required.

iOS canonical (Commitment.swift):
```swift
var isCurrentlyActive: Bool {
    return isActive && !isExpired
}
```

Android canonical (Commitment.kt):
```kotlin
val isCurrentlyActive: Boolean
    get() = isActive && !isExpired
```

### Rule 2: isExpired is a calendar-day comparison
`isExpired` must compare `expiresAt` to start-of-today using calendar-day boundaries, not raw timestamp comparison. On Android, the current implementation normalizes both `expiresAt` and today to midnight before comparing — this is correct. On iOS, `Date() > expiresAt` uses raw timestamps — verify this aligns with intended behavior or normalize to match Android's day-boundary approach.

### Rule 3: Solo commitments use groupID = "solo"
Any commitment not part of a group must have `groupID == "solo"`. Queries for solo commitments must filter on `groupID == "solo"`, not on the absence of a groupID field.

### Rule 4: Soft-delete on expiry, not hard delete
Expired commitments must have `isActive` set to `false`. They must NOT be deleted from Firestore. `CommitmentArchiveService.swift` on iOS handles this. Android equivalent must do the same.

### Rule 5: Archive flow — expired goes to archive, never deleted
Expired commitments (`isExpired == true`) must be visible in the archive screen and must not appear in the active feed. The archive query is `isActive == false`. Hard-deleting an expired commitment is a violation.

### Rule 6: dateHistory tracks renewal periods
On renewal, the current `(createdAt, expiresAt)` period must be appended to `dateHistory` as a `CommitmentPeriod` before `createdAt` is reset to the new start date. Skipping this write means historical periods are lost.

### Rule 7: breakDate filters completions on renewal
On renewal, `lastStreakBreakDate` must be set to the date of renewal. `StreakCalculationService.calculateStreak(breakDate:)` uses this to ignore completions from the previous period so the new streak starts at 0.

### Rule 8: Schedule days must have at least 1 day
`CommitmentSchedule.days` must never be empty. Any creation or edit path must validate this before saving. A commitment with zero scheduled days is invalid.

### Rule 9: Creator-only deletion for group commitments
Only the group creator (`group.creatorID` or fallback `group.memberIDs[0]`) may delete a group commitment. Deletion must cascade: delete all member commitments for that group, then delete the group document.

### Rule 10: Extend vs Renew distinction
- **Extend**: `expiresAt` is pushed forward; streak continues from current count; `dateHistory` is NOT appended.
- **Renew**: new period starts; streak resets to 0; `lastStreakBreakDate` is set; current period is appended to `dateHistory`; `createdAt` is updated to new start date.

### Rule 11: Field parity between iOS and Android
Both platforms must have exactly these fields on the Commitment model:
`id`, `groupID`, `userID`, `specificAction`, `description`, `emoji`, `schedule`, `isActive`, `createdAt`, `expiresAt`, `dateHistory`, `streakBreakAcknowledgedAt`, `isPaused`, `pausedAt`, `pauseResumeDate`, `lastStreakBreakDate`.

## Audit steps

1. Read `/Users/lokeshpudhari/TinyAct/microcommit/micro-commit/Core/Domain/Models/Commitment.swift` and verify:
   - `isCurrentlyActive` checks both `isActive` and `!isExpired`
   - `isExpired` compares to `expiresAt` (note: iOS uses raw `Date() > expiresAt` while Android normalizes to day start — decide which is canonical and align)
   - All 14 fields listed in Rule 11 are present

2. Read `/Users/lokeshpudhari/TinyAct/TinyAct---Android/core/domain/src/main/java/com/lokesh/tinyact/core/domain/model/Commitment.kt` and verify the same fields and computed properties.

3. Compare the two field lists side by side. Any field present on one platform but absent on the other is a parity violation.

4. Read `/Users/lokeshpudhari/TinyAct/microcommit/micro-commit/Infrastructure/Services/CommitmentArchiveService.swift` and verify:
   - It sets `isActive = false` (not deletes) on expiry
   - It runs before active commitments are fetched

5. Search for any hard-delete of commitment documents (`delete()` calls on commitment collections) outside of group-cascade-delete paths — those are violations.

6. Search for `schedule.days.isEmpty` or equivalent validation at commitment creation time. If missing, add the guard.

7. Read the renewal logic (look in ViewModels under `create` feature) and verify `dateHistory` is appended and `lastStreakBreakDate` is set.

## Common violations to fix

- **`isCurrentlyActive` only checks `isActive`**: Add `&& !isExpired` — fix by updating the computed property on both platforms.
- **Commitment deleted instead of soft-archived**: Replace `delete(commitmentID:)` with `update(isActive: false)` — fix by changing the repository call in the archive service.
- **dateHistory not appended on renewal**: Add `commitment.dateHistory.append(CommitmentPeriod(startDate: commitment.createdAt, endDate: commitment.expiresAt!))` before resetting `createdAt`.
- **Empty schedule days allowed**: Add `guard !schedule.days.isEmpty` at the top of the create/save flow — fix by adding validation in the ViewModel before calling the repository.
- **Non-creator can delete group commitment**: Add `guard group.isCreator(currentUserID)` before the cascade delete — fix by adding the check in the ViewModel or use case.

## Files to check

- iOS:
  - `/Users/lokeshpudhari/TinyAct/microcommit/micro-commit/Core/Domain/Models/Commitment.swift`
  - `/Users/lokeshpudhari/TinyAct/microcommit/micro-commit/Infrastructure/Services/CommitmentArchiveService.swift`
  - `/Users/lokeshpudhari/TinyAct/microcommit/TinyActTests/CommitmentTests.swift`
  - `/Users/lokeshpudhari/TinyAct/microcommit/TinyActTests/ArchiveFilteringTests.swift`
  - `/Users/lokeshpudhari/TinyAct/microcommit/TinyActTests/RenewalTests.swift`
- Android:
  - `/Users/lokeshpudhari/TinyAct/TinyAct---Android/core/domain/src/main/java/com/lokesh/tinyact/core/domain/model/Commitment.kt`
  - `/Users/lokeshpudhari/TinyAct/TinyAct---Android/core/data/src/main/java/com/lokesh/tinyact/core/data/repository/FirebaseCommitmentRepository.kt`
  - `/Users/lokeshpudhari/TinyAct/TinyAct---Android/feature/create/` (creation/renewal ViewModels)
  - `/Users/lokeshpudhari/TinyAct/TinyAct---Android/feature/archive/` (archive screen)
