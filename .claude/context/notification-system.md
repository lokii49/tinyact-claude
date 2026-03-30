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

## Architecture

- **Scheduling:** client-side (iOS `NotificationScheduler.swift` / Android `SmartNotificationScheduler.kt`)
- **Profile:** `/userNotificationProfile/{userId}` — agent writes, client reads
- **Events:** every send/open/check-in logged to `/notificationEvents`
- **Variants:** Firestore `/notificationVariants` — client reads, agent writes
- **Partner notifications:** Cloud Function `onPartnerCheckIn` → FCM push
