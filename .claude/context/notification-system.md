# Smart Notification System — TinyAct

Full spec: `SPEC.md`. This is the quick-reference overview.

---

## Five Psychological Trigger Types

| Trigger | When to fire |
|---|---|
| `LOSS_AVERSION` | User hasn't checked in, deadline approaching |
| `SOCIAL_PROOF` | Majority of group done, user hasn't |
| `PARTNER_MOMENTUM` | Partner just checked in |
| `IDENTITY` | User has consistent day-of-week history |
| `FOMO` | User inactive >18 hours |

---

## AutoResearch Loop (Dwight's domain)

Weekly cycle (Karpathy-style):
1. Pull Firebase analytics → measure `checkedInWithin60Min / sent` per variant
2. LLM (claude-sonnet-4-6) analyzes results, forms hypothesis
3. Generates 5 new copy variants, deactivates underperformers
4. Writes to Firestore `/notificationVariants` and `/agentRuns`
5. Repeat — no human in the loop

**Reward signal:** `checkedInWithin60Min` rate (NOT open rate)
**Guard rails:** opt-out rate < 2%, habituation score > 0.8 = rotate variant

Agent code: `agent/notification_agent.py`

---

## Key Rules (never violate)

- User already checked in today → **no notification** (suppress with reason "already_checked_in")
- `habituationScore > 0.8` → skip today, wait for agent to rotate variant
- Partner-event notifications fire on the event, not on a schedule
- `suppressUntil` set on check-in → no more notifications today for that commitment
- iOS: respect system DnD. Use `.timeSensitive` only when streak breaks in < 2 hours

---

## Client Capability Baseline (verified 2026-09-10)

- **iOS:** `IPHONEOS_DEPLOYMENT_TARGET = 17.0` → Live Activities / Dynamic Island available. No `ActivityKit` usage yet. Widget extension `MicroCommitWidget` + app-group (`WidgetDataService`, `Shared/WidgetDataModels.swift`) exists.
- **Android:** `compileSdk = 36`, `minSdk = 31` → `Notification.ProgressStyle` + promoted-ongoing available. No `addAction` / `setColorized` / `setOngoing` yet.
- **No notification actions registered on either platform** — check-in-from-notification is net-new.
- **Three iOS schedulers, uncoordinated:** `PushNotificationService` (reminders + expiry), `NotificationScheduler` (smart nudges), `AdaptiveEngineScheduler` (ACE). Android: `SmartNotificationScheduler` + `feature/settings/NotificationScheduler.kt`.
- **iOS template staleness:** `NotificationScheduler` resolves `{{streak}}`/`{{hours}}` at schedule time with `UNCalendarNotificationTrigger(repeats: true)` — stale if app not opened. Android resolves fresh at fire time (`SmartReminderReceiver`).
- Design pitch building on this: `notification_redesign_pitch` memory.

## Architecture

- **Scheduling:** client-side (iOS `NotificationScheduler.swift` / Android `SmartNotificationScheduler.kt`)
- **Profile:** `/userNotificationProfile/{userId}` — agent writes, client reads
- **Events:** every send/open/check-in logged to `/notificationEvents`
- **Variants:** Firestore `/notificationVariants` — client reads, agent writes
- **Partner notifications:** Cloud Function `onPartnerCheckIn` → FCM push

---

## "Vital Signs" Redesign — shipped state (2026-09-11, branch `1.1.6`)

4-tier cost ladder, both platforms, all code-complete and pushed. Design pitch: `notification_redesign_pitch` memory / artifact.

| Tier | iOS | Android | Notes |
|---|---|---|---|
| 0 — inline actions | `PushNotificationService` + `NotificationScheduler.swift` | `SmartNotificationScheduler.kt` | Check-in / Snooze 1h `UNNotificationAction` / `NotificationCompat.Action`. Check-in always routes to Check-in tab with autoCheckIn, bypassing the SOCIAL_PROOF/FOMO→Feed tap-intent routing. |
| 1 — urgency ramp | `NotificationScheduler.swift` | `SmartNotificationScheduler.kt` | Streak/crew/countdown chip + brand-ramp tint (green→yellow→orange→coral by hours-left). Color only applies with an active streak — crew-only chip stays uncolored. PARTNER_MOMENTUM gets the partner's proof photo (`BigPictureStyle`/`UNNotificationAttachment`), reusing the existing `ImageEncryptionService` decrypt pipeline. |
| 2 — live countdown | `CommitmentLiveActivityAttributes` (`Shared/WidgetDataModels.swift`) + Live Activity UI in `MicroCommitWidget.swift`, driven from `WidgetDataService.updateLiveActivity` | `SmartNotificationScheduler.showSmartNotification` — ongoing + `setProgress()` when streak>0 and 1–6h left | iOS: real ActivityKit Live Activity, OS-rendered `Text(timerInterval:)` countdown, one live surface (highest-streak uncompleted commitment), ends on next sync after check-in. Android v1 is a determinate bar refreshed at post-time, **not** OS-live — `androidx.core` is 1.15.0, predates `NotificationCompat.ProgressStyle`/promoted-ongoing (needs 1.17+ for Android 16 Live Updates). TODO left in code. |
| 3 — partner-driven live update | `onPartnerCheckIn` Cloud Function → `apns.liveActivityToken` silent push (client persists the ActivityKit push token to `users/{uid}.liveActivityPushToken`) | `onPartnerCheckIn` FCM → `TinyActFirebaseMessagingService.refreshLiveCountdown` reposts the Tier 2 notification in place | Android: fully live, no new infra, rides existing FCM. iOS: **code-complete but Cloud Function not deployed** — needed `firebase-admin` bump `^12.0.0→^13.5.0` (done, `npm run build` clean); payload shape (esp. `content-state.deadline` as seconds-since-Cocoa-reference-date, not Unix epoch) is unverified against a real device. |

**No `project.pbxproj` hand-edits anywhere in this pass** — all new iOS Tier 2/3 code lives in files already registered for the right target(s) (`Shared/WidgetDataModels.swift` dual-target, `MicroCommitWidget.swift`/`MicroCommitWidgetBundle.swift` already in the widgetkit-extension target). Verified `MicroCommitWidget/Info.plist` → `NSExtensionPointIdentifier = com.apple.widgetkit-extension` before assuming an `ActivityConfiguration` could live there.

**Outstanding before Tier 3 iOS is real:** deploy the bumped Cloud Functions (`npm run deploy` from `microcommit/functions/`) and verify one real push-token round trip. Not done this session — deploying a production function on unverified payload shape was treated as a deliberate, separate step.
