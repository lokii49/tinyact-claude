---
name: App Engine billing investigation — Apr 2026
description: Firebase implicitly enables App Engine Admin API on microcommit-973c7; the ₹2,050.52 charge is from Cloud Scheduler's App Engine dependency, not a rogue App Engine deployment
type: project
---

Firebase's Cloud Scheduler integration (used for `firebase-schedule-*` functions) requires the App Engine Admin API to be enabled. When Firebase sets up scheduled functions, it creates an App Engine app shell silently. This is what triggered the "New" billing line.

**Why:** Cloud Scheduler's Pub/Sub-targeted jobs (`firebase-schedule-updateUserNotificationProfile-us-central1`, `firebase-schedule-monitorOptOutRate-us-central1`, `weekly-notification-agent`) use the App Engine API internally for scheduling infrastructure even when the target is Pub/Sub, not an App Engine endpoint.

**How to apply:** If billing shows App Engine charges on this project in future, check Cloud Scheduler jobs first — they are the true source, not a deployed App Engine app.

Key facts established 2026-04-02:
- `gcloud app describe` confirms NO App Engine application is deployed on microcommit-973c7
- App Engine Admin API IS enabled (firebase did this)
- Cloud Scheduler has 3 active jobs: weekly-notification-agent, firebase-schedule-updateUserNotificationProfile, firebase-schedule-monitorOptOutRate
- All 12 Cloud Functions are 1st gen, running in us-central1
- Firestore is in nam5 (multi-region US), `appEngineIntegrationMode: DISABLED`
- No App Engine instances, no App Engine services, no App Engine versions
