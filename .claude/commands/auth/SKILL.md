# Auth Audit & Alignment

## What this skill does
Audits authentication configuration, Firebase setup, sign-out cache clearing, and deep link handling to ensure both platforms are correctly configured and that auth errors have clear causes.

## Rules

### Rule 1: Google Sign-In requires SHA-1 fingerprints in Firebase Console
Android Google Sign-In will fail with error code 10 (DEVELOPER_ERROR) if the SHA-1 fingerprint of the signing keystore is not registered in the Firebase Console under Project Settings > Your apps > Android app.

Two SHA-1s are required:
- Debug keystore: `~/.android/debug.keystore`, password `android`, alias `androiddebugkey`
- Release keystore: the production keystore used for Play Store releases

Both must be registered. A common violation is registering only the debug SHA-1 and then seeing error code 10 in release builds.

### Rule 2: google-services.json must be up to date
After adding or changing SHA-1s in the Firebase Console, a new `google-services.json` must be downloaded and placed at `/Users/lokeshpudhari/TinyAct/TinyAct---Android/app/google-services.json`. The old file will not reflect new SHA-1s until replaced.

On iOS, `GoogleService-Info.plist` must similarly be kept current at `/Users/lokeshpudhari/TinyAct/microcommit/micro-commit/GoogleService-Info.plist`.

### Rule 3: Error code 10 = SHA-1 missing from Firebase
When `GoogleSignIn` returns error code 10 (`DEVELOPER_ERROR`), the root cause is always a missing or mismatched SHA-1 fingerprint, not a code issue. Do not attempt to fix this in code — fix it in Firebase Console and re-download `google-services.json`.

### Rule 4: AuthenticationService (iOS) handles all auth state
`AuthenticationService.swift` is the single source of truth for auth state on iOS. It must expose a `@Published var currentUser: User?` (or equivalent observable state). No ViewModel should call Firebase Auth directly — all auth operations route through `AuthenticationService`.

### Rule 5: FirebaseAuthRepository (Android) handles all auth state
`FirebaseAuthRepository.kt` is the Android equivalent. It must expose a `Flow<User?>` or `StateFlow<User?>` for auth state changes. All Hilt-injected ViewModels must receive it via the `AuthRepository` interface, not the concrete class.

### Rule 6: Sign-out must clear all local caches
On sign-out:
- iOS: All SwiftData entities must be deleted from the local store. `SyncEngine` must be stopped. Any in-memory caches must be cleared.
- Android: Room database must be cleared (`db.clearAllTables()`). All in-memory repositories must be reset. FCM token should be cleared from the user document.

Signing out without clearing the local cache means the next user who signs in on the same device could see previous user data.

### Rule 7: Deep link scheme is microcommit://
Both platforms handle `microcommit://` URL scheme for push notification deep links. iOS configures this in `Info.plist` under URL Types. Android configures it in `AndroidManifest.xml` as an intent filter with scheme `microcommit`. No other scheme is used.

### Rule 8: FCM token saved on login
After successful sign-in, the FCM token from `FirebaseMessaging.getInstance().token` (Android) or `Messaging.messaging().token` (iOS) must be saved to the user's Firestore document under the `fcmToken` field. If this step is skipped, server-side push notifications will not reach the device.

### Rule 9: Delete account flow must follow the full deletion protocol
The delete account flow must follow this exact sequence on both platforms:

1. **Deletion flow**: User clicks "Delete Account" → re-authentication prompt → on successful re-auth → show loading screen → delete account → land on social login screen.
2. **Confirmation alert**: Show an alert when the user clicks the delete account button with a clear, appropriate message (e.g., "This will permanently delete your account and all associated data. This action cannot be undone.").
3. **Admin transfer for group commitments**: For all group commitments where this user is admin/creator, transfer admin privileges to another member in the group and silently exit from the group. This must not impact existing members' streak data with those groups. If the user is the sole member, delete the group entirely.
4. **Silent exit for regular members**: If this user is just a member (not admin), silently exit the group without notifying other members.
5. **End partnership before exit**: If the user is a partnered member (has an accountability partner), end the partnership first and then exit the group. Both sides of the accountability pair must be removed.
6. **Permanent data deletion from Firebase**: All user data must be deleted permanently from Firebase, including:
   - User document from `users` collection
   - All completions and their proof photos from Firebase Storage
   - All commitments
   - All streaks the user participates in
   - All group invitations (sent and received)
   - All partnership invitations (sent and received)
   - Group removal notifications
   - Username mapping (Android: `usernames` collection)
   - Avatar images from Firebase Storage
   - Firebase Auth account itself
   - Local caches (SwiftData/Room), sync engine state, widget data, and pending notifications

### Rule 10: Username is the primary login identifier
Per `User.swift`, `username` is the PRIMARY field used for login and adding users to groups. Email is optional and used only for verification. Authentication uses Firebase Auth (email/password or Google), but in-app user lookup/display uses `username`.

## Audit steps

1. Read `/Users/lokeshpudhari/TinyAct/microcommit/micro-commit/Infrastructure/Services/AuthenticationService.swift` and verify:
   - `currentUser` is a `@Published` property
   - Sign-out method clears SwiftData entities
   - FCM token is saved after sign-in

2. Read `/Users/lokeshpudhari/TinyAct/TinyAct---Android/core/data/src/main/java/com/lokesh/tinyact/core/data/repository/FirebaseAuthRepository.kt` and verify:
   - Auth state is exposed as a Flow
   - Sign-out calls `db.clearAllTables()`
   - FCM token is saved after sign-in

3. Check `/Users/lokeshpudhari/TinyAct/TinyAct---Android/app/google-services.json` — open it and verify the `certificate_hash` entries under `oauth_client` include SHA-1s for both debug and release. If only one is present, flag as a violation.

4. Check for `microcommit://` scheme in iOS `Info.plist` (look under `microcommit/micro-commit/` for `Info.plist`) and in `AndroidManifest.xml`.

5. Read `/Users/lokeshpudhari/TinyAct/microcommit/micro-commit/Infrastructure/Services/DeepLinkHandler.swift` and verify it handles the `microcommit://` scheme.

6. Search for any direct `Auth.auth().signOut()` calls in ViewModels (iOS) or `FirebaseAuth.getInstance().signOut()` in ViewModels (Android) that bypass the auth service — those are violations.

7. Verify no ViewModel imports `FirebaseAuth` directly on iOS; all auth must go through `AuthenticationService`.

8. Read `/Users/lokeshpudhari/TinyAct/microcommit/micro-commit/Infrastructure/Services/AccountDeletionService.swift` and verify:
   - Admin transfer logic for group commitments where user is creator
   - Partnership pairs are cleaned up (both sides removed)
   - All user data collections are deleted (completions, commitments, streaks, invitations, notifications, user doc)
   - Storage files (proofs, avatars) are deleted
   - Batched writes are used for atomic deletion

9. Read `/Users/lokeshpudhari/TinyAct/TinyAct---Android/core/data/src/main/java/com/lokesh/tinyact/core/data/repository/FirebaseAuthRepository.kt` `deleteAccount()` method and verify:
   - Admin transfer logic matches iOS
   - Partnership cleanup removes both sides of the pair
   - All Firestore collections are cleaned up
   - Storage folders (proofs, avatars) are deleted
   - Firebase Auth account is deleted after Firestore cleanup

10. Read SettingsView.swift (iOS) and SettingsScreen.kt (Android) and verify:
    - Confirmation alert is shown before deletion
    - Re-authentication is required
    - Loading screen is displayed during deletion
    - User is navigated to social login screen after successful deletion

## Common violations to fix

- **Error code 10 on Android Google Sign-In**: Go to Firebase Console > Project Settings > Your Android app > Add SHA-1 fingerprint. Run `./gradlew signingReport` to get debug SHA-1. Download new `google-services.json` and replace the existing file.
- **Sign-out doesn't clear Room database**: Add `db.clearAllTables()` inside `signOut()` in `FirebaseAuthRepository` — fix by calling it after `FirebaseAuth.getInstance().signOut()`.
- **Sign-out doesn't clear SwiftData on iOS**: Add a `deleteAllLocalData()` call in `AuthenticationService.signOut()` that iterates all SwiftData model types and deletes them.
- **FCM token not saved on login**: Add a `saveFCMToken(uid: userID)` call in the sign-in success handler of `AuthenticationService` / `FirebaseAuthRepository`.
- **Deep link scheme missing from manifest**: Add `<data android:scheme="microcommit" />` to the main activity intent filter in `AndroidManifest.xml`.

## Files to check

- iOS:
  - `/Users/lokeshpudhari/TinyAct/microcommit/micro-commit/Infrastructure/Services/AuthenticationService.swift`
  - `/Users/lokeshpudhari/TinyAct/microcommit/micro-commit/Infrastructure/Services/AccountDeletionService.swift`
  - `/Users/lokeshpudhari/TinyAct/microcommit/micro-commit/Infrastructure/Services/DeepLinkHandler.swift`
  - `/Users/lokeshpudhari/TinyAct/microcommit/micro-commit/Core/Presentation/Screens/Settings/SettingsView.swift`
  - `/Users/lokeshpudhari/TinyAct/microcommit/micro-commit/Core/Presentation/Screens/Settings/SettingsViewModel.swift`
  - `/Users/lokeshpudhari/TinyAct/microcommit/micro-commit/GoogleService-Info.plist`
  - `Info.plist` under `microcommit/micro-commit/`
- Android:
  - `/Users/lokeshpudhari/TinyAct/TinyAct---Android/core/data/src/main/java/com/lokesh/tinyact/core/data/repository/FirebaseAuthRepository.kt`
  - `/Users/lokeshpudhari/TinyAct/TinyAct---Android/feature/settings/src/main/java/com/lokesh/tinyact/feature/settings/SettingsScreen.kt`
  - `/Users/lokeshpudhari/TinyAct/TinyAct---Android/feature/settings/src/main/java/com/lokesh/tinyact/feature/settings/SettingsViewModel.kt`
  - `/Users/lokeshpudhari/TinyAct/TinyAct---Android/app/google-services.json`
  - `/Users/lokeshpudhari/TinyAct/TinyAct---Android/app/src/main/AndroidManifest.xml`
  - `/Users/lokeshpudhari/TinyAct/TinyAct---Android/feature/auth/` (auth feature screens/ViewModels)
- Shared:
  - Firebase Console (external): verify SHA-1 fingerprints are registered
