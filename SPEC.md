# TinyAct — Smart Notification System
## Implementation Spec for Claude Code

> Feed this entire file to Claude Code. It contains everything needed: context, architecture, file structure, Firebase schema, Swift implementation tasks, and the Python AutoResearch agent loop.

---

## 0. Project Context

**App**: TinyAct — iOS habit accountability app (Swift + SwiftUI + Firebase)
**Architecture**: MVVM + Clean Architecture
**Backend**: Firebase (Firestore, Cloud Functions, FCM)
**Goal**: Build a smart notification system that psychologically triggers users to check in to their micro-commitments, using an AutoResearch-style agentic loop to autonomously discover and iterate on the most effective notification strategies.

**Key behavioral mechanic**: TinyAct has partner-linked streaks and group accountability. If one person misses, everyone's streak resets. This creates natural loss aversion and social proof triggers that notifications must leverage.

---

## 1. Core Concepts the Agent Must Understand

### 1.1 Five Psychological Trigger Types
Every notification sent must be tagged with one of these:

| Trigger ID | Name | Example Copy | When to Fire |
|---|---|---|---|
| `LOSS_AVERSION` | Streak at risk | "Your 12-day streak resets in 4 hours" | User hasn't checked in, deadline approaching |
| `SOCIAL_PROOF` | Group momentum | "3 of 5 members checked in — don't be last" | Majority of group done, user hasn't |
| `PARTNER_MOMENTUM` | Partner just acted | "Sarah just checked in. Your turn." | Partner check-in event fires |
| `IDENTITY` | Consistency cue | "Day 8 — you've never missed a Tuesday" | User has consistent day-of-week history |
| `FOMO` | Miss out framing | "The group is building a streak without you" | User inactive for > 18 hours |

### 1.2 AutoResearch Agent Loop (Karpathy-style)
The agent:
1. Pulls Firebase analytics weekly
2. Generates 5–8 notification copy variants per trigger type
3. Schedules A/B splits across user cohorts
4. Waits 24–48 hours, measures **check-in-within-60-min rate** (NOT open rate)
5. Writes conclusions, generates next hypothesis
6. Repeats — no human needed in the loop

**Reward signal**: `check_in_within_60min / notifications_sent` per variant
**Guard rails**: opt-out rate < 2%, uninstall spike detection

---

## 2. Firebase Schema

### 2.1 New Firestore Collections to Create

```
/notificationEvents/{eventId}
  userId: string
  commitmentId: string
  notificationId: string
  triggerType: string           // one of 5 trigger IDs above
  variantId: string             // A/B variant label e.g. "loss_v3"
  sentAt: Timestamp
  openedAt: Timestamp | null
  checkedInWithin60Min: bool
  checkedInAt: Timestamp | null
  userStreakAtSend: number
  partnerStreakAtSend: number
  hourOfDay: number             // 0-23
  dayOfWeek: number             // 0-6
  suppressedReason: string | null  // "already_checked_in" | "opted_out" | "habituation"

/notificationVariants/{variantId}
  triggerType: string
  copyTitle: string
  copyBody: string
  createdByAgent: bool
  agentRunId: string
  createdAt: Timestamp
  isActive: bool
  cohortTag: string             // e.g. "experiment_2026_w12"

/userNotificationProfile/{userId}
  dominantTrigger: string       // agent-inferred dominant trigger type
  optimalWindowStart: number    // hour of day (0-23)
  optimalWindowEnd: number
  lastUpdated: Timestamp
  suppressUntil: Timestamp | null
  openRateHistory: [{ variantId: string, openRate: number, week: string }]
  habituationScore: number      // 0.0–1.0, high = rotate variant

/agentRuns/{runId}
  runAt: Timestamp
  hypothesis: string
  variantsGenerated: [string]   // variantIds
  cohortsAssigned: map
  status: string                // "running" | "complete" | "failed"
  conclusions: string
  nextHypothesis: string
  rewardScores: map             // variantId -> float
```

### 2.2 Existing Collections — Fields to Add

In `/commitments/{commitmentId}`:
```
notificationConfig: {
  preferredTime: string         // "08:00" user-set preferred time
  gracePeriodHours: number      // already exists, confirm present
}
```

In `/users/{userId}`:
```
fcmToken: string                // already exists, confirm present
notificationOptOut: bool        // new
```

---

## 3. iOS Implementation Tasks

### 3.1 File Structure to Create

New files integrate into the existing `microcommit/micro-commit/` layout alongside `PushNotificationService.swift`, `NotificationSettingsView.swift`, and `GroupRemovalNotification.swift`.

```
microcommit/micro-commit/
├── Core/
│   ├── Domain/Models/
│   │   ├── NotificationTrigger.swift          # NEW — trigger enum + NotificationVariant model
│   │   └── UserNotificationProfile.swift      # NEW — profile model
│   ├── Data/
│   │   ├── Network/DTOs/
│   │   │   ├── NotificationEventDTO.swift     # NEW — Firestore DTO for /notificationEvents
│   │   │   ├── NotificationVariantDTO.swift   # NEW — Firestore DTO for /notificationVariants
│   │   │   └── UserNotificationProfileDTO.swift # NEW — Firestore DTO for /userNotificationProfile
│   │   └── Repositories/
│   │       └── NotificationEventRepository.swift # NEW — read/write notificationEvents & variants
│   └── Presentation/Screens/Settings/
│       └── NotificationSettingsViewModel.swift  # NEW — drives existing NotificationSettingsView
├── Infrastructure/Services/
│   ├── NotificationScheduler.swift              # NEW — decides when/what to send
│   ├── NotificationEventLogger.swift            # NEW — logs send/open/check-in events
│   └── NotificationProfileUpdater.swift         # NEW — pulls profile, feeds scheduler
└── (existing files untouched: PushNotificationService.swift, NotificationNames.swift, etc.)
```

### 3.1b Android File Structure to Create

New files integrate into the existing multi-module Gradle layout alongside `TinyActFirebaseMessagingService.kt`, `NotificationScheduler.kt`, and `NotificationPreferencesScreen.kt`.

```
TinyAct---Android/
├── core/
│   ├── domain/src/main/java/com/lokesh/tinyact/core/domain/
│   │   ├── model/
│   │   │   ├── NotificationTrigger.kt              # NEW — trigger enum
│   │   │   ├── NotificationVariant.kt               # NEW — variant domain model
│   │   │   └── UserNotificationProfile.kt           # NEW — profile domain model
│   │   └── repository/
│   │       └── SmartNotificationRepository.kt       # NEW — interface for events & variants
│   ├── data/src/main/java/com/lokesh/tinyact/core/data/
│   │   ├── local/
│   │   │   ├── entity/
│   │   │   │   └── NotificationEventEntity.kt       # NEW — Room entity for offline event queue
│   │   │   └── dao/
│   │   │       └── NotificationEventDao.kt          # NEW — Room DAO
│   │   ├── repository/
│   │   │   └── FirebaseSmartNotificationRepository.kt # NEW — Firestore impl
│   │   └── di/
│   │       └── SmartNotificationModule.kt           # NEW — Hilt DI bindings
│   └── common/src/main/java/com/lokesh/tinyact/core/common/
│       └── (no new files — reuse existing utilities)
├── feature/settings/src/main/java/com/lokesh/tinyact/feature/settings/
│   └── SmartNotificationSettingsViewModel.kt        # NEW — extends existing settings UI
├── app/src/main/java/com/lokesh/tinyact/notifications/
│   ├── SmartNotificationScheduler.kt                # NEW — decides when/what to send
│   ├── NotificationEventLogger.kt                   # NEW — logs send/open/check-in events
│   └── NotificationProfileUpdater.kt                # NEW — pulls profile, feeds scheduler
└── (existing files untouched: TinyActFirebaseMessagingService.kt, NotificationScheduler.kt, etc.)
```

### 3.1c Firebase Cloud Functions Structure

New functions added to the existing `microcommit/functions/src/` alongside current notification triggers.

```
microcommit/functions/src/
├── index.ts                          # MODIFY — register new triggers + scheduled functions
├── smartNotifications/
│   ├── onPartnerCheckIn.ts           # NEW — Firestore trigger on /checkIns
│   ├── suppressAfterCheckIn.ts       # NEW — Firestore trigger, sets suppressUntil
│   ├── updateUserNotificationProfile.ts # NEW — scheduled nightly profile recalculation
│   └── seedVariants.ts               # NEW — one-time seed script for initial 10 variants
└── (existing functions untouched: onGroupInvitationCreated, etc.)
```

### 3.2 NotificationTrigger.swift

```swift
enum NotificationTrigger: String, Codable, CaseIterable {
    case lossAversion = "LOSS_AVERSION"
    case socialProof = "SOCIAL_PROOF"
    case partnerMomentum = "PARTNER_MOMENTUM"
    case identity = "IDENTITY"
    case fomo = "FOMO"
}

struct NotificationVariant: Codable, Identifiable {
    let id: String
    let triggerType: NotificationTrigger
    let title: String
    let body: String
    let variantId: String
    let isActive: Bool
}
```

### 3.3 NotificationEventLogger.swift

Create a service that logs to `/notificationEvents` on every:
- Notification sent (via Cloud Function callback, or local if sent locally)
- Notification opened (via `userNotificationCenter(_:didReceive:)`)
- Check-in completed (hook into existing check-in flow)

```swift
// Required method signatures:
func logNotificationSent(userId: String, commitmentId: String, variantId: String, triggerType: NotificationTrigger) async

func logNotificationOpened(notificationId: String) async

func logCheckIn(userId: String, commitmentId: String, notificationId: String?) async
// notificationId is nil if user checked in organically (no notification)
```

### 3.4 NotificationScheduler.swift

Logic to decide WHEN and WHAT to send. Pull from Firestore:
1. Fetch `userNotificationProfile` for this user
2. Check `suppressUntil` — if now < suppressUntil, skip
3. Check if user already checked in today for this commitment — if yes, suppress with reason "already_checked_in"
4. Select trigger type from `dominantTrigger`
5. Fetch active variant for that trigger type from `/notificationVariants`
6. Schedule via UNUserNotificationCenter at `optimalWindowStart`

```swift
// Required method signature:
func scheduleNotification(for commitment: Commitment, userId: String) async throws

// Must handle:
// - Habituation suppression (habituationScore > 0.8 → skip this variant)
// - Already checked in today → suppress entirely
// - Partner event driven → fire immediately when partner checks in (not scheduled)
```

### 3.5 Partner-Event-Driven Notifications

When a partner checks in, the Cloud Function (see section 4) sends an FCM push. The iOS app receives this and:
- If recipient hasn't checked in → show PARTNER_MOMENTUM notification
- If recipient already checked in → suppress silently

Hook into the existing real-time activity feed listener to catch partner check-in events and trigger local notification if app is in foreground.

### 3.6 Habituation Guard (iOS side)

In `NotificationScheduler.swift`:

```swift
// If habituationScore > 0.8 for current variant, 
// flag to backend and do NOT send today.
// The agent will assign a new variant within 24h.
// Do not send a stale notification just because it's scheduled.
```

---

## 4. Firebase Cloud Functions

### 4.1 Functions to Create

**`onPartnerCheckIn`** (Firestore trigger on `/checkIns`)
- Triggered when a check-in document is created
- Finds all partners/group members of this commitment
- Sends FCM to each partner who hasn't checked in yet
- Uses PARTNER_MOMENTUM variant copy from active variant in Firestore
- Logs to `/notificationEvents`

**`updateUserNotificationProfile`** (scheduled, runs nightly)
- For each user, looks at last 7 days of `/notificationEvents`
- Calculates optimal window: hour range with highest `checkedInWithin60Min` rate
- Calculates `habituationScore`: open rate trend over last 14 days per variant
- Calculates `dominantTrigger`: which trigger type has highest check-in conversion for this user
- Writes updated `userNotificationProfile` document

**`suppressAfterCheckIn`** (Firestore trigger on `/checkIns`)
- When user checks in, sets `suppressUntil` = end of day in user's timezone
- Prevents any further notifications firing today for that commitment

---

## 5. Python AutoResearch Agent

### 5.1 File: `agent/notification_agent.py`

This runs weekly (cron job or Cloud Scheduler). It implements the Karpathy AutoResearch pattern: hypothesis → experiment → measure → revise.

```python
"""
TinyAct Notification AutoResearch Agent
Runs weekly. Autonomously discovers best notification strategies.
Uses Claude API (claude-sonnet-4-6) as the reasoning backbone.
"""

import anthropic
import firebase_admin
from firebase_admin import firestore
from datetime import datetime, timedelta
import json

ANTHROPIC_CLIENT = anthropic.Anthropic()  # uses ANTHROPIC_API_KEY env var
MODEL = "claude-sonnet-4-6"

TRIGGER_TYPES = [
    "LOSS_AVERSION",
    "SOCIAL_PROOF", 
    "PARTNER_MOMENTUM",
    "IDENTITY",
    "FOMO"
]

def pull_experiment_results(db, days_back=7) -> dict:
    """Pull notification performance data from Firestore."""
    cutoff = datetime.now() - timedelta(days=days_back)
    events = db.collection("notificationEvents")\
        .where("sentAt", ">=", cutoff)\
        .stream()
    
    results = {}
    for event in events:
        d = event.to_dict()
        vid = d.get("variantId")
        if vid not in results:
            results[vid] = {
                "variantId": vid,
                "triggerType": d.get("triggerType"),
                "sent": 0,
                "opened": 0,
                "checkedInWithin60Min": 0,
                "optedOut": 0,
            }
        results[vid]["sent"] += 1
        if d.get("openedAt"): results[vid]["opened"] += 1
        if d.get("checkedInWithin60Min"): results[vid]["checkedInWithin60Min"] += 1
    return results

def fetch_active_variants(db) -> list:
    variants = db.collection("notificationVariants")\
        .where("isActive", "==", True).stream()
    return [v.to_dict() for v in variants]

def agent_analyze_and_hypothesize(results: dict, active_variants: list, previous_conclusions: str) -> dict:
    """
    LLM call: analyze results, form new hypothesis, generate new variants.
    Returns structured JSON with new variants and next hypothesis.
    """
    prompt = f"""
You are an autonomous notification optimization agent for TinyAct, a micro-commitment accountability iOS app.

## Your task
Analyze last week's notification performance data. Generate 5 new notification copy variants to test next week. Form a hypothesis about what will perform better.

## App context
- Users have partner-linked streaks: if one person misses, both reset
- Groups of up to 8 people, one miss resets everyone
- Micro-commitments are tiny daily habits (10 pushups, 5 min reading)
- Key psychological levers: loss aversion, social proof, partner momentum, identity, FOMO

## Last week's results (reward = checkedInWithin60Min / sent)
{json.dumps(results, indent=2)}

## Currently active variants
{json.dumps(active_variants, indent=2)}

## Previous agent conclusions
{previous_conclusions or "None — this is the first run."}

## Output format (respond ONLY with valid JSON, no markdown, no preamble)
{{
  "conclusions": "1-2 sentences on what worked and why",
  "next_hypothesis": "Specific testable hypothesis for next week",
  "new_variants": [
    {{
      "triggerType": "LOSS_AVERSION",  // must be one of the 5 trigger types
      "copyTitle": "Your streak is at risk",
      "copyBody": "You have 3 hours to check in before your 12-day streak resets.",
      "rationale": "Tests explicit countdown framing vs generic urgency"
    }}
    // exactly 5 variants total, mix trigger types based on hypothesis
  ],
  "variants_to_deactivate": ["variantId1", "variantId2"]  // underperforming variants to retire
}}
"""
    response = ANTHROPIC_CLIENT.messages.create(
        model=MODEL,
        max_tokens=1500,
        messages=[{"role": "user", "content": prompt}]
    )
    raw = response.content[0].text.strip()
    return json.loads(raw)

def deploy_new_variants(db, agent_output: dict, run_id: str):
    """Write new variants to Firestore, deactivate old ones."""
    batch = db.batch()
    
    # Deactivate old variants
    for vid in agent_output.get("variants_to_deactivate", []):
        ref = db.collection("notificationVariants").document(vid)
        batch.update(ref, {"isActive": False})
    
    # Create new variants
    for v in agent_output.get("new_variants", []):
        ref = db.collection("notificationVariants").document()
        batch.set(ref, {
            "triggerType": v["triggerType"],
            "copyTitle": v["copyTitle"],
            "copyBody": v["copyBody"],
            "createdByAgent": True,
            "agentRunId": run_id,
            "createdAt": firestore.SERVER_TIMESTAMP,
            "isActive": True,
            "cohortTag": f"experiment_{run_id}"
        })
    
    batch.commit()

def save_agent_run(db, run_id: str, agent_output: dict, results: dict):
    db.collection("agentRuns").document(run_id).set({
        "runAt": firestore.SERVER_TIMESTAMP,
        "hypothesis": agent_output.get("next_hypothesis"),
        "conclusions": agent_output.get("conclusions"),
        "status": "complete",
        "rewardScores": {
            vid: (r["checkedInWithin60Min"] / r["sent"]) if r["sent"] > 0 else 0
            for vid, r in results.items()
        },
        "variantsGenerated": [v["copyTitle"] for v in agent_output.get("new_variants", [])],
        "nextHypothesis": agent_output.get("next_hypothesis")
    })

def run_agent():
    app = firebase_admin.initialize_app()
    db = firestore.client()
    
    run_id = f"run_{datetime.now().strftime('%Y%m%d_%H%M')}"
    print(f"[Agent] Starting run {run_id}")
    
    # Pull last week's run conclusions
    prev_runs = db.collection("agentRuns")\
        .order_by("runAt", direction=firestore.Query.DESCENDING)\
        .limit(1).stream()
    prev_conclusions = ""
    for r in prev_runs:
        prev_conclusions = r.to_dict().get("conclusions", "")
    
    results = pull_experiment_results(db)
    active_variants = fetch_active_variants(db)
    
    print(f"[Agent] Analyzing {len(results)} variant results, {len(active_variants)} active variants")
    
    agent_output = agent_analyze_and_hypothesize(results, active_variants, prev_conclusions)
    
    print(f"[Agent] Conclusions: {agent_output.get('conclusions')}")
    print(f"[Agent] Next hypothesis: {agent_output.get('next_hypothesis')}")
    
    deploy_new_variants(db, agent_output, run_id)
    save_agent_run(db, run_id, agent_output, results)
    
    print(f"[Agent] Run {run_id} complete. {len(agent_output.get('new_variants', []))} new variants deployed.")

if __name__ == "__main__":
    run_agent()
```

### 5.2 Agent Setup Files to Create

**`agent/requirements.txt`**
```
anthropic>=0.40.0
firebase-admin>=6.0.0
```

**`agent/deploy.sh`** (for Cloud Scheduler)
```bash
#!/bin/bash
# Run weekly via Cloud Scheduler or cron
# Schedule: every Monday 02:00 UTC
python notification_agent.py >> agent_logs/$(date +%Y%m%d).log 2>&1
```

---

## 6. Implementation Order (tell Claude Code to follow this sequence)

### Week 1
1. Create Firestore collections: `notificationEvents`, `notificationVariants`, `userNotificationProfile`, `agentRuns`
2. Seed 2 initial variants per trigger type (10 total) into `notificationVariants`
3. Implement `NotificationEventLogger.swift` — logging is the foundation of everything else
4. Hook logger into existing check-in flow

### Week 2
5. Implement `NotificationScheduler.swift` — basic version using user's preferred time
6. Implement `suppressAfterCheckIn` Cloud Function
7. Test suppression: user who already checked in must NOT receive any more notifications today

### Week 3
8. Implement `onPartnerCheckIn` Cloud Function
9. Add partner-event-driven notification on iOS (foreground + background handling)
10. Implement `updateUserNotificationProfile` Cloud Function (nightly)

### Week 4
11. Implement `NotificationProfileUpdater.swift` — pull profile and use in scheduler
12. Add habituation score check in scheduler
13. Run agent manually for the first time with seeded data

### Week 5+
14. Schedule agent to run weekly via Cloud Scheduler
15. Monitor `agentRuns` collection for conclusions and deployed variants
16. Review opt-out rates — if > 2%, reduce notification frequency

---

## 7. Key Constraints for Claude Code

- **Never send a notification if the user has already checked in today** for that commitment — check before scheduling
- **Reward signal is check-in completion, NOT notification opens** — do not let Claude Code optimize for clicks
- **Habituation score > 0.8 = no notification today** — wait for agent to rotate variant
- **Partner-event notifications are exempt from the daily window** — they fire on the event, not a schedule
- **iOS: all notification scheduling must respect system Do Not Disturb** — use `UNNotificationInterruptionLevel.timeSensitive` only for streak-reset-imminent cases (< 2 hours to midnight)
- **Agent runs on Python, not on-device** — the Swift code only reads variants from Firestore, never generates copy
- **Firebase Security Rules**: `notificationVariants` readable by all authenticated users, writable only by service account; `agentRuns` readable by admin only

---

## 8. Acceptance Criteria

The system is working when:
- [ ] A user who checks in today receives zero more notifications for that commitment today
- [ ] When a partner checks in, the other user receives a notification within 60 seconds
- [ ] `notificationEvents` documents are created for every send, open, and check-in
- [ ] `userNotificationProfile` updates nightly with correct optimal window
- [ ] Agent runs and produces valid JSON with 5 new variants
- [ ] New variants appear in Firestore after agent run
- [ ] `checkedInWithin60Min` rate is calculable from `notificationEvents` data
- [ ] Opt-out rate is tracked and visible in `notificationEvents` via `suppressedReason`
