# Check-ins Audit & Alignment

## What this skill does
Audits all check-in (completion) logic to ensure photo proofs are encrypted, duplicate prevention is enforced using calendar-day comparison, timestamps use the user's local timezone, and every check-in correctly triggers streak recalculation.

## Rules

### Rule 1: Photo proofs must be encrypted before upload
Any check-in with a photo proof must encrypt the image using `ImageEncryptionService` before uploading to Firebase Storage. Uploading a raw unencrypted image is a violation. The encryption key is stored on the `User.imageEncryptionKey` field.

iOS: `ImageEncryptionService.swift` handles AES-256 encryption.
Android: `ImageEncryptionService.kt` in `core/data/service/` handles the same.

The upload flow must be:
1. Capture/select image
2. Encrypt image bytes using `ImageEncryptionService.encrypt(data:key:)` or equivalent
3. Upload encrypted bytes to Firebase Storage
4. Store the Storage path (not the raw image URL) in the `Completion` document

### Rule 2: Honor check-ins require no proof
When a check-in is marked as an honor check-in (no photo), `proofImageURL` must be `nil`/`null`. The `totalHonorCheckIns` counter on the user document must be incremented. No encryption step should run for honor check-ins.

### Rule 3: Completion timestamp in user's local timezone
The timestamp written to Firestore must be in UTC (Firestore standard), but `hasCheckedInToday` comparisons must use the user's local timezone (`user.timezone`). The Firebase functions use an explicit `tzIdentifier` parameter for this reason.

### Rule 4: hasCheckedInToday uses startOfDay comparison
`hasCheckedInToday` must compare `startOfDay(completion.timestamp, tz: userTimezone)` to `startOfDay(now, tz: userTimezone)`. Raw timestamp comparison (e.g., `completion.timestamp.timeIntervalSinceNow < 86400`) is a violation because it breaks at midnight boundaries.

### Rule 5: Duplicate check-in prevention
Before creating a new completion, the system must verify no completion already exists for the same `commitmentID + userID + today (calendar day in user's timezone)`. If one exists, the check-in must be rejected with a clear error, not silently created as a duplicate.

### Rule 6: Check-in triggers streak recalculation
After a completion is saved (locally and/or synced to Firestore), the streak must be recalculated using `StreakCalculationService.calculateStreak(from:excludingPausedDays:breakDate:)`. The new streak value must be persisted back to the `Streak` document. The check-in flow is not complete until the streak is updated.

### Rule 7: onCompletionCreated Firebase function fires on new completion
The Firebase Cloud Function `onCompletionCreated` (in `functions/src/index.ts`) must be triggered on new completion documents. This function handles streak break notification logic server-side. If this trigger is removed or renamed, server-side streak break alerts will stop working.

### Rule 8: totalCheckIns counter on User document must increment
After each successful check-in, `user.totalCheckIns` must be incremented by 1 in Firestore. `totalPhotoProofs` must also be incremented if it was a photo check-in.

### Rule 9: Completion document fields
Every `Completion` document in Firestore must contain:
`id`, `commitmentID`, `userID`, `groupID`, `timestamp`, `proofImageURL` (nullable), `isHonorCheckIn`, `note` (nullable).

### Rule 10: Awards and XP run after streak update
The `AwardService.checkAndGrantAwards(...)` call must happen after the streak is recalculated, passing the new `currentStreak` value. Running awards before the streak is updated means milestone awards may trigger at the wrong count.

## Audit steps

1. Read the check-in ViewModel for iOS (look under `Core/Presentation/` for a `CheckIn` or `Checkin` screen):
   - Verify `ImageEncryptionService` is called before the upload
   - Verify `hasCheckedInToday` uses `startOfDay` comparison
   - Verify duplicate check before creating the completion

2. Read the check-in feature for Android (look under `feature/checkin/`):
   - Same three verifications as iOS

3. Read `/Users/lokeshpudhari/TinyAct/microcommit/micro-commit/Infrastructure/Services/ImageEncryptionService.swift` and verify it uses AES-256 and the key comes from `user.imageEncryptionKey`.

4. Read `/Users/lokeshpudhari/TinyAct/TinyAct---Android/core/data/src/main/java/com/lokesh/tinyact/core/data/service/ImageEncryptionService.kt` and verify equivalent AES-256 logic.

5. Read `/Users/lokeshpudhari/TinyAct/microcommit/functions/src/index.ts` and confirm `onCompletionCreated` trigger exists on the completions collection.

6. Search for any raw upload of `UIImage` or `Bitmap` to Firebase Storage without going through `ImageEncryptionService` — those are violations.

7. Read `/Users/lokeshpudhari/TinyAct/microcommit/micro-commit/Core/Domain/Models/Completion.swift` (or equivalent) and verify the required fields are present.

8. Verify that after `createCompletion(...)`, the code calls `calculateStreak(...)` and then `checkAndGrantAwards(...)` in that order.

## Common violations to fix

- **Unencrypted photo upload**: Photo bytes passed directly to `StorageReference.putData(_:)` without going through `ImageEncryptionService.encrypt(...)` — fix by wrapping the upload in the encryption step.
- **hasCheckedInToday uses raw timestamp delta**: Replace `completion.timestamp.timeIntervalSinceNow < 86400` with a `Calendar.current.isDateInToday(completion.timestamp)` or proper `startOfDay` comparison using the user's timezone.
- **Duplicate completion allowed**: Add a guard at the start of the check-in submit action: fetch completions for today and return early if one exists for this `commitmentID + userID`.
- **Streak not recalculated after check-in**: Add `StreakCalculationService.calculateStreak(...)` call in the check-in success handler before dismissing the screen.
- **Awards run before streak update**: Move `checkAndGrantAwards(...)` to after the streak persistence call, not before.

## Files to check

- iOS:
  - `/Users/lokeshpudhari/TinyAct/microcommit/micro-commit/Infrastructure/Services/ImageEncryptionService.swift`
  - `/Users/lokeshpudhari/TinyAct/microcommit/micro-commit/Core/Domain/Models/Completion.swift`
  - Check-in ViewModels under `/Users/lokeshpudhari/TinyAct/microcommit/micro-commit/Core/Presentation/`
- Android:
  - `/Users/lokeshpudhari/TinyAct/TinyAct---Android/core/data/src/main/java/com/lokesh/tinyact/core/data/service/ImageEncryptionService.kt`
  - `/Users/lokeshpudhari/TinyAct/TinyAct---Android/core/domain/src/main/java/com/lokesh/tinyact/core/domain/model/Completion.kt`
  - `/Users/lokeshpudhari/TinyAct/TinyAct---Android/feature/checkin/` (check-in ViewModels)
  - `/Users/lokeshpudhari/TinyAct/TinyAct---Android/core/data/src/main/java/com/lokesh/tinyact/core/data/repository/FirebaseCompletionRepository.kt`
- Shared:
  - `/Users/lokeshpudhari/TinyAct/microcommit/functions/src/index.ts` (onCompletionCreated trigger)
