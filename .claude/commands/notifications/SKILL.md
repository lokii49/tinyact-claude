# Notifications Audit & Alignment

## What this skill does
Audits the boundary between server-side (Firebase Cloud Functions) and client-side (local) notification scheduling to ensure no notifications are sent from the wrong layer, push tokens are saved correctly, and streak break alerts fire reliably.

## Rules

### Rule 1: Server-side notifications are exactly these four types
Firebase Cloud Functions (`functions/src/index.ts`) must handle ONLY:
1. Group invitation notifications (when a user is invited to a group)
2. Partnership invitation notifications (when a user is invited into a partnership)
3. Streak break alerts (when a partner's or group member's streak breaks)
4. User removal from group notifications

Any other notification type sent from Cloud Functions is a violation. Client-side reminder notifications must NOT be implemented in Cloud Functions.

### Rule 2: Client-side notifications are exactly these types
`PushNotificationService.swift` (iOS) and Android `NotificationScheduler` (or equivalent) handle ONLY:
- Daily reminder notifications (scheduled at `commitment.schedule.preferredTime`)
- Check-in nudge notifications (smart nudges based on user behavior)

These must be scheduled locally using `UNUserNotificationCenter` (iOS) or `WorkManager`/`AlarmManager` (Android). They must NOT trigger Cloud Function calls.

### Rule 3: onStreakUpdated handles streak break notifications
The Firebase function responsible for streak break notifications listens on streak document writes. When a streak is updated and `isBroken` transitions from false to true (or `currentStreak` resets to 0), it sends a push notification to the affected user's partners or group members. Verify this function exists and is deployed.

### Rule 4: sendSmartNudges handles scheduled nudge notifications
If a `sendSmartNudges` Cloud Function exists, it must ONLY be used for server-triggered nudges (e.g., cron-based). The primary nudge path should be client-side. Verify this function is not duplicating client-side reminder logic.

### Rule 5: Push token must be saved to Firestore on login
After sign-in, the device FCM token must be written to `users/{userID}` under the `fcmToken` field. Without this, all server-side push notifications will silently fail. This must happen every login (tokens rotate) not just on first login.

### Rule 6: PushNotificationService (iOS) is the single iOS notification authority
No ViewModel or service other than `PushNotificationService.swift` should call `UNUserNotificationCenter.current().add(...)` directly. All local notification scheduling must route through `PushNotificationService`.

### Rule 7: Android NotificationScheduler is the single Android notification authority
All local notification scheduling on Android must go through one centralized class (the equivalent of `PushNotificationService`). No ViewModel should schedule notifications directly.

### Rule 8: Notification permission is requested at onboarding
Both platforms must request notification permission during the onboarding flow, not on first launch of the main app. Missing this step means users who skip permission prompts will never receive nudges.

### Rule 9: Notification data payload enables deep linking
All push notifications sent by Cloud Functions must include a `data` payload with at minimum:
- `type`: the notification type (e.g., `"groupInvite"`, `"streakBreak"`)
- `targetID`: the relevant document ID (groupID, userID, etc.)

This enables `DeepLinkHandler.swift` / the Android intent handler to navigate to the correct screen on tap. Missing `data` payloads means notifications open the app to the home screen with no context.

## Audit steps

1. Read `/Users/lokeshpudhari/TinyAct/microcommit/functions/src/index.ts` fully and list all Cloud Function exports. Verify only the four permitted server-side notification types are present. Flag any reminder or nudge functions as violations.

2. Read `/Users/lokeshpudhari/TinyAct/microcommit/micro-commit/Infrastructure/Services/PushNotificationService.swift` fully and verify:
   - It uses `UNUserNotificationCenter` for local notifications
   - It saves the FCM token to Firestore
   - No ViewModel bypasses it for notification scheduling

3. Search Android source for the notification scheduler class (look under `feature/` or `core/common/` for a class named `NotificationScheduler` or similar). Verify it is the single scheduling authority.

4. Search for `UNUserNotificationCenter.current().add(` across all Swift files excluding `PushNotificationService.swift` — any hits are violations.

5. Search for `NotificationManagerCompat` or `NotificationManager.notify(` across all Kotlin files excluding the centralized scheduler — any hits in ViewModels are violations.

6. Verify that every `sendNotification(...)` call in `index.ts` includes a `data` object with `type` and `targetID` fields.

7. Check the onboarding flow on both platforms to confirm notification permission is requested there.

8. Read `/Users/lokeshpudhari/TinyAct/microcommit/micro-commit/Infrastructure/Services/DeepLinkHandler.swift` and verify it handles the notification `data.type` values defined in `index.ts`.

## Common violations to fix

- **Daily reminder implemented in Cloud Functions**: Move reminder scheduling to `PushNotificationService` (iOS) or the Android scheduler. Delete the Cloud Function. Fix by adding `UNUserNotificationCenter` scheduling triggered by commitment creation.
- **FCM token not refreshed on each login**: Add `Messaging.messaging().token { token, _ in self.saveToken(token) }` inside `AuthenticationService.signIn(...)` on iOS. On Android, call `FirebaseMessaging.getInstance().token.addOnSuccessListener { saveToken(it) }` in `FirebaseAuthRepository.signIn(...)`.
- **Push notification missing data payload**: Add `data: { type: "groupInvite", targetID: groupID }` to every `sendNotification(...)` call in `index.ts` — fix by updating each Cloud Function call site.
- **ViewModel schedules notification directly**: Move the `UNUserNotificationCenter.add(...)` call into `PushNotificationService.scheduleReminder(...)` and call that method from the ViewModel instead.

## Files to check

- iOS:
  - `/Users/lokeshpudhari/TinyAct/microcommit/micro-commit/Infrastructure/Services/PushNotificationService.swift`
  - `/Users/lokeshpudhari/TinyAct/microcommit/micro-commit/Infrastructure/Services/DeepLinkHandler.swift`
  - Onboarding screen under `/Users/lokeshpudhari/TinyAct/microcommit/micro-commit/Core/Presentation/`
- Android:
  - Notification scheduler under `/Users/lokeshpudhari/TinyAct/TinyAct---Android/core/common/` or `feature/`
  - `/Users/lokeshpudhari/TinyAct/TinyAct---Android/core/data/src/main/java/com/lokesh/tinyact/core/data/repository/FirebaseAuthRepository.kt` (FCM token save)
  - `/Users/lokeshpudhari/TinyAct/TinyAct---Android/app/src/main/AndroidManifest.xml` (notification permissions)
  - `/Users/lokeshpudhari/TinyAct/TinyAct---Android/feature/onboarding/` (permission request)
- Shared:
  - `/Users/lokeshpudhari/TinyAct/microcommit/functions/src/index.ts` (all Cloud Functions)
