# Project Status — TinyAct

Last updated: 2026-08-01

---

## NEXT SESSION — pick up here

- Both platforms are now on 1.1.6 (unreleased, dev branch). 1.1.5 fully shipped on both — see Active Branches below for what's live.
- The Firestore `completions`/`users` access-control rule (see Known Bugs) can now be evaluated for deployment: both platforms' 1.1.5 (with the `visibleTo` migration) are live/in-review, so adoption has started. Still a product/release-timing call, not purely technical — revisit once adoption data is available.

---

## Active Branches

| Platform | Branch | Notes |
|---|---|---|
| iOS | `1.1.6` | github.com/lokii49/microcommit — branched from `1.1.5` (c6d30c6), not `main` (PR #10 not yet merged). 1.1.5 (build 28) submitted to App Store review 2026-08-01; 1.1.4 (build 27) is `READY_FOR_SALE`. PR #10 (`1.1.5`→`main`) open, unmerged |
| Android | `1.1.6` | github.com/lokii49/TinyAct---Android — branched from `main` (PR #8 already merged). versionCode 28 (1.1.5) promoted to **Production** 2026-08-01 via manual Play Console override (see Recently Fixed) |

Never commit directly to `main`. All squad work targets these branches.

---

## Platform Overview

| Platform | Language | UI | Local DB | DI |
|---|---|---|---|---|
| iOS | Swift | SwiftUI | SwiftData | — |
| Android | Kotlin | Jetpack Compose | Room | Hilt |
| Backend | TypeScript | — | — | — |

Both platforms share the same Firebase backend.

---

## Active Work Tracking

- `TinyAct---Android/todo.md` — current Android UI/UX and performance tasks
- `TinyAct---Android/checklist.md` — iOS/Android parity QA checklist
- `TinyAct---Android/audit-remediation-status.md` — security audit tracking
- `NOTES.md` — bugs and feature ideas (quick capture)

---

## Known Bugs

- **[Android] Splash screen dismisses too quickly** — `MainActivity.kt` missing `installSplashScreen()` call. Fix: call before `setContent`, hold with `setKeepOnScreenCondition` tied to auth loading state.

- **[Android] `fastlane deploy_internal` / `deploy_production` lanes are broken** — both call `android_set_version_code`, which is not a real fastlane action (no such action exists in core fastlane or any plugin declared in this project's `Gemfile`/`Pluginfile` — there is no `Pluginfile`). Running either lane fails immediately with "Couldn't find action for the given filter." Worked around 2026-07-26 by bumping `versionCode`/`versionName` manually in `app/build.gradle.kts` and using the plain `internal` lane (build + upload, no version bump) instead. Fix: either add a real plugin (e.g. `fastlane-plugin-increment_version_code`) or remove the broken `android_set_version_code` call and replace with a manual/gradle-based bump, matching what was done here.

- **[SECURITY — HIGH, both platforms, rule not yet deployed] Broken access control on `completions` and `users` lets any signed-in user decrypt any other user's proof photos, including solo/private ones (found 2026-07-26, migration in progress)** — `firestore.rules`: `completions/{completionId}` is (still, as of this writing) `allow read: if isAuthenticated()` with no group-membership scoping, and the completion doc carries `uploaderEncryptionKey`. One read of any completions doc gives an attacker both the photoURL and the AES key needed to decrypt it. This bypasses `storage.rules`' `isGroupMemberOfCommitment` check entirely, because the photoURL is a Firebase Storage tokened download URL — those bypass Storage security rules for anyone holding the URL string (confirmed: `ImageCacheService` fetches with plain `URLSession`, no auth header, and it works).
  - **Fix design (verified against the Firestore emulator, not guessed):** denormalize `visibleTo: [ownerID] + group.memberIDs` onto each completion doc at create time; tighten the rule to `allow read: if request.auth.uid in resource.data.visibleTo`; every client query must filter `visibleTo array-contains <the signed-in caller's own uid>` (not any other user's id) for Firestore to consider the rule satisfiable. Verified empirically: `userID==X + visibleTo array-contains Y` (X≠Y), `groupID==X + visibleTo array-contains Y`, and `userID in [...] + visibleTo array-contains Y` are all **allowed**; a query with no visibleTo filter is correctly **denied**.
  - **Done (2026-07-26):** `visibleTo` field added to `Completion`/`CompletionDTO` on both platforms; populated at every completion-creation call site on both platforms (check-in flows, solo→group conversions); one-time backfill Cloud Function deployed, run once (822 docs), then removed; **permanent** `stampCompletionVisibleTo` Firestore `onDocumentCreated` trigger deployed — server-side backstop that fills `visibleTo` for any completion any client creates without it (covers old installs, including the 1.1.4 build submitted to review this session, indefinitely — not just a point-in-time fix); composite indexes for `userID+visibleTo+timestamp` and `groupID+visibleTo+timestamp` deployed and READY; iOS's `CompletionRepository` (`getUserCompletions`/`getCompletionsForUsers`/`getGroupCompletions`, both `Firebase` and `LocalFirst` implementations, plus every call site — ~14 across HomeViewModel/ArchiveViewModel/GroupsViewModel/GroupDetailView/MyGoalsViewModel/CheckInViewModel/ConvertSoloToGroupView) rewritten to filter by `visibleTo array-contains viewerID`; iOS builds (app + tests) clean.
  - **Also done (2026-07-26, same day, Android):** `CompletionRepository`'s `getUserCompletions`/`getCompletionsForUsers`/`getCompletions(groupID)` rewritten to filter by `visibleTo array-contains viewerID` (Kotlin default param `viewerID = userID` covers the common self-view case); Room migration 10→11 adds `visibleTo` to `CompletionEntity`; all ~35 call sites across CheckInViewModel, CommitmentDetailViewModel, ArchiveViewModel, GroupDetailViewModel, GroupsViewModel, FeedViewModel, MyGoalsViewModel audited — 6 needed explicit fixes to compile, 5 more (partner/member "other user" reads, e.g. `CheckInViewModel.kt:429`, `GroupDetailViewModel.kt:170`, `CommitmentDetailViewModel.kt`'s per-member fallback loops) compiled fine via the wrong default but were silently wrong until fixed. Verified against real production Firestore (disposable throwaway auth account, created+queried+deleted) that all 4 query shapes Android produces succeed with **zero new indexes needed** — the iOS-deployed composite indexes cover them via field-prefix matching. Full build + unit tests pass (pre-existing Paparazzi snapshot-test env failures unrelated). Committed to `1.1.5`, pushed.
  - **The rule itself is STILL not deployed, and the blocker has changed shape.** Both platforms' code is now migration-complete and verified. But: the iOS `1.1.4` build already submitted to App Store review does **NOT** contain this migration (it was built before this work started, from `1.1.4`; the migration landed on `1.1.5` afterward) — and neither platform's fixed code has shipped to any real device yet. Deploying the rule today would still hard-deny completions reads for **100% of currently-installed users on both platforms** until they update to a build that doesn't exist yet. The remaining gate is no longer "finish the code" — it's "ship both platforms' next release, then wait for adoption" before the rule can go out. That's a product/release-timing decision, not an engineering one; flag to the user before doing anything further here.

## Recently Fixed

- **[Android] Production-promotion "existing users can't upgrade" error was a Play Console API limitation, not an app bug (2026-08-01)** — versionCode 28 (1.1.5) failed Google's device-catalog upgrade check when promoted via `fastlane`/Android Publisher API, both from `internal` and via the `production` lane (which promotes from `alpha` — that track was stale at `[23,20,19]`, ruled out as the cause since promoting straight from `internal` failed identically). Diagnosed by diffing build 27 (live in production) against build 28 with the same toolchain: merged `AndroidManifest.xml` byte-identical except version fields; bundletool inspection of 28's AAB showed no `testOnly`/`debuggable`, no `uses-feature` requirements, and its one native lib (`libandroidx.graphics.path.so`) present for all 4 ABIs. No code-level cause exists. Root cause: Play Console's web UI has an "existing users on some devices can't receive this update — continue anyway" override for this exact warning that is **not exposed by the Android Publisher API** — `supply`/fastlane structurally cannot bypass it. Resolved by the user manually promoting through the Play Console UI. Production is now on versionCode 28.
- **[iOS] Keychain image-encryption key survives device backup/migration (2026-07-26)** — `ImageEncryptionService`'s `KeychainService.set()` used `kSecAttrAccessibleAfterFirstUnlock`, so the per-user AES key could ride along in an encrypted iTunes/Finder or iCloud device backup restored onto a different device — unlike Android, which explicitly excludes its equivalent (`tinyact_encryption_keys.xml`) from backup and device-transfer (see `data_extraction_rules.xml`) for exactly this reason. Fixed by switching to `kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly`. Low real-world impact on its own since the same key is currently also readable from Firestore by any signed-in user — see the HIGH severity finding above; this fix has near-zero value until that's closed.
- **[hygiene] Android release keystore (`tinyact-release.jks`) had no `.gitignore` rule at the workspace-root repo (2026-07-26)** — sat untracked but unprotected; one `git add -A` away from being permanently committed to git history. Added `*.jks`, `*.keystore`, `*.p12`, `*.mobileprovision` to the root `.gitignore`.
- **[iOS] Duplicate-looking smart notifications (2026-07-26)** — Not actually duplicates: the app has three independent local notification schedulers (`PushNotificationService` user reminders/expiry warnings, `NotificationScheduler` server-variant "smart nudges", `AdaptiveEngineScheduler` ACE nudges — see comment at top of `AdaptiveEngineScheduler.swift`). When 2+ commitments are simultaneously at-risk, `NotificationScheduler.scheduleNotification` schedules one smart nudge per commitment, all at the same profile-level `optimalWindowStart` minute — and unlike the other two schedulers, its notification title came straight from the A/B-tested variant copy with no commitment name/emoji in it, so two different commitments produced identical-looking text at the identical minute. Fixed by prefixing `content.title` with `commitment.emoji` in `NotificationScheduler.scheduleLocalSmartNotification` (same convention `scheduleExpiryWarning` and ACE's `scheduleNudge` already use), without altering the tested variant copy itself. Note: this makes concurrent nudges distinguishable, it does not reduce how many a user with multiple at-risk commitments receives — the three schedulers still don't coordinate with each other, which is a separate, larger fix not done here.
  - Follow-up fix same day: `scheduleAll` runs from 4 call sites (`ContentView.swift`, `MyGoalsViewModel.swift`, `NotificationProfileUpdater.swift`, `SmartNotificationRefreshTask.swift`), and `NotificationScheduler.scheduleNotification` logged a `notificationEvents` doc at *schedule* time on every pass, inflating `fetchTodaySmartNotificationCount` and silently exhausting the daily cap of 5 after a few app foregrounds. Fixed with a per-commitment per-calendar-day guard (`alreadyScheduledToday`/`markScheduledToday`, UserDefaults-backed) that short-circuits redundant passes before they touch the cap counter or Firestore.

- **[iOS] Feed proof photos not showing for other users (2026-07-26)** — Root cause: when a check-in photo failed to upload while online (transient `FIRStorageErrorDomain`/`NSURLErrorDomain` error) or the device was offline, `OfflineImageQueue` wrote the local `file://` path into `Completion.photoURL`, which got pushed straight to Firestore. Once `OfflineImageQueue.processQueue()` later uploaded the real image, it only updated the local SwiftData row and set `needsSync=true` — but `SyncEngine.pushDirty()` had already run its completions pass earlier in the same call, and nothing else in the app ever calls `syncAll`/`pushDirty` again except another offline→online network transition. The uploader's own device masked the bug (`EncryptedAsyncImage` special-cases `file://` locally), so only other feed viewers saw it. Fixed in `OfflineImageQueue.processQueue()` (push the corrected `photoURL` to Firestore immediately via `updateField`, not just a dirty flag) and `LocalFirstCompletionRepository.uploadProofImage` (retry `processQueue()` right away on the online-but-transient-error path, since no connectivity flap will trigger it otherwise). Also added a `completion.uploaderEncryptionKey ?? user?.imageEncryptionKey` fallback in `FeedView.swift` (parity with the same fallback already in `GroupDetailView.swift`) for legacy completions missing the per-completion key.

---

## Key Source Locations

```
iOS app:          microcommit/micro-commit/
iOS tests:        microcommit/TinyActTests/
Android app:      TinyAct---Android/
Cloud Functions:  microcommit/functions/src/
Notification agent: agent/
```
