# Parity Audit & Alignment

## What this skill does
Audits iOS vs Android feature parity by comparing domain models field-by-field, verifying all screens exist on both platforms, and checking that business rules (archive, renewal, streak algorithm) are implemented identically.

## Rules

### Rule 1: All domain model fields must match between platforms
For each domain model, every field must exist with the same name (camelCase), type semantics, and default value on both iOS and Android. The canonical field lists are:

**Commitment**: `id`, `groupID`, `userID`, `specificAction`, `description`, `emoji`, `schedule`, `isActive`, `createdAt`, `expiresAt`, `dateHistory`, `streakBreakAcknowledgedAt`, `isPaused`, `pausedAt`, `pauseResumeDate`, `lastStreakBreakDate`

**Streak**: `id`, `groupID`, `userIDs`, `currentStreak`, `longestStreak`, `lastCompletionDate`, `isActive`, `createdAt`, `isPaused`, `pausedAt`, `pauseResumeDate`, `pauseReason`, `pausedByUserID`

**User**: `id`, `username`, `firstName`, `lastName`, `email`, `avatarURL`, `imageEncryptionKey`, `timezone`, `interests`, `fcmToken`, `streakPartnerID`, `createdAt`, `lastUsernameChangeDate`, `totalXP`, `earnedAwards`, `totalCheckIns`, `totalPhotoProofs`, `totalHonorCheckIns`, `reactionsGiven`, `reactionsReceived`, `comebackCount`, `currentStreak`, `longestStreak`, `lastCheckInDate`

**Group**: `id`, `name`, `commitmentDescription`, `emoji`, `creatorID`, `memberIDs`, `maxMembers`, `isActive`, `createdAt`, `expiresAt`, `durationDays`, `accountabilityPairs`, `lastVoluntaryLeaveUserID`, `allMembersAccountable`

**Award**: `id`, `type`, `earnedAt` (computed: `name`, `description`, `emoji`, `xpValue`, `requirement`)

### Rule 2: Streak algorithm logic must be identical
Both platforms must implement the same computed properties on the Streak model. Verify these match exactly (same formula, same edge cases):
- `isBroken`: no-grace-period, no-mercy-day, paused returns false
- `hoursUntilBreak`: nil when paused/already checked in/already broken, else hours until midnight tonight
- `isAboutToBreak`: `hoursUntilBreak in 1..12`
- `shouldAutoResume`: `isPaused && Date() >= pauseResumeDate`
- `pauseDaysRemaining`: days until resumeDate
- `canResume(userID:)`: only the user who paused can resume

### Rule 3: All screens must exist on both platforms
The following screens must exist and be navigable on both iOS and Android:
- Onboarding / sign-up flow
- Sign-in screen
- Feed / home (active commitments list)
- Check-in screen (with photo proof and honor options)
- Create commitment screen
- Commitment detail / edit screen
- Archive screen (expired commitments)
- Goals screen (if present on iOS, must be on Android)
- Groups list screen
- Group detail screen
- Create group screen
- Group member management (remove member, set accountability pairs)
- Profile screen (username, avatar, level, XP, awards)
- Settings screen
- Awards screen (all earned awards displayed)
- Streak pause/resume screen
- Partnership invitation flow
- Group invitation flow

Read `TinyAct---Android/checklist.md` for current parity status and remaining gaps.

### Rule 4: Archive logic is identical
Both platforms must:
1. Run `archiveExpiredCommitments()` before loading the active feed
2. Archive = `isActive: false` (soft delete, not hard delete)
3. Archive screen queries `isActive == false`
4. Archived commitments are not shown in the active feed

### Rule 5: Renewal and extend logic is identical
Both platforms must implement the same distinction:
- **Renew**: resets streak to 0, appends to `dateHistory`, sets `lastStreakBreakDate`, updates `createdAt`
- **Extend**: pushes `expiresAt` forward, streak continues, no `dateHistory` append

### Rule 6: PauseReason enum values match
iOS `PauseReason` and Android `PauseReason` must have the same cases with the same raw string values:
`illness`, `travel`, `vacation`, `work_busy`, `family_emergency`, `mental_health_break`, `other`.

### Rule 7: CommitmentSchedule.Weekday values match
iOS `CommitmentSchedule.Weekday` and Android `Weekday` must use the same raw values:
`monday`, `tuesday`, `wednesday`, `thursday`, `friday`, `saturday`, `sunday`.

### Rule 8: No feature on iOS that's absent from Android
Any feature added to the iOS app must be tracked in `checklist.md` and implemented on Android before the next release. An iOS-only feature that is not in the checklist and has no Android counterpart is a parity violation.

## Audit steps

1. Read `TinyAct---Android/checklist.md` to get the current parity status. Note any items marked as missing or in-progress on Android.

2. Read `/Users/lokeshpudhari/TinyAct/microcommit/micro-commit/Core/Domain/Models/Commitment.swift` and list all fields. Read the Android counterpart and list all fields. Compare side by side — flag any field present on one but not the other.

3. Repeat the field comparison for:
   - `Streak.swift` vs `Streak.kt`
   - `User.swift` vs `User.kt`
   - `Group.swift` vs `Group.kt`
   - `Award.swift` vs `Award.kt`

4. Read `Streak.swift` and `Streak.kt` side by side. For each computed property (`isBroken`, `hoursUntilBreak`, `isAboutToBreak`, `shouldAutoResume`, `pauseDaysRemaining`), verify the logic is identical. Any behavioral difference is a parity violation.

5. Read `PauseReason` on both platforms and compare raw values.

6. Read `CommitmentSchedule.Weekday` (iOS) and `Weekday` (Android) and compare raw values.

7. List all screens under iOS `Core/Presentation/` and compare against Android `feature/` modules. Flag any screen that exists on one platform but not the other.

8. Check `TinyAct---Android/audit-remediation-status.md` for any open security items that may affect parity-relevant features.

## Common violations to fix

- **Field present on iOS but missing on Android model**: Add the missing field to the Android `data class` with the same name and a suitable default — fix by editing the Kotlin model and updating the corresponding Room entity and DTO mapper.
- **isBroken logic differs**: Align the Android `isBroken` implementation to match the iOS formula exactly, paying attention to `startOfDay` vs raw timestamp comparison.
- **Screen exists on iOS but not Android**: Create the missing Android feature module under `TinyAct---Android/feature/<name>/` following the existing module structure. Add it to `checklist.md` as completed.
- **PauseReason case mismatch**: Add the missing case to the Android enum with the same string value. Update the Firestore DTO mapper to handle the new value.
- **Weekday raw value mismatch**: If iOS uses `"monday"` and Android uses `"MONDAY"`, align to `"monday"` (lowercase) everywhere — fix in the Android `Weekday` enum and its `fromValue` parser.

## Files to check

- iOS:
  - `/Users/lokeshpudhari/TinyAct/microcommit/micro-commit/Core/Domain/Models/` (all model files)
  - `/Users/lokeshpudhari/TinyAct/microcommit/micro-commit/Core/Presentation/` (all screen directories)
- Android:
  - `/Users/lokeshpudhari/TinyAct/TinyAct---Android/core/domain/src/main/java/com/lokesh/tinyact/core/domain/model/` (all model files)
  - `/Users/lokeshpudhari/TinyAct/TinyAct---Android/feature/` (all feature modules)
- Shared:
  - `/Users/lokeshpudhari/TinyAct/TinyAct---Android/checklist.md` (parity QA checklist)
  - `/Users/lokeshpudhari/TinyAct/TinyAct---Android/audit-remediation-status.md` (security audit status)
  - `/Users/lokeshpudhari/TinyAct/Streakalgorithm.md` (algorithm source of truth)
