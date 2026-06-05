# Lint-Wiki Audit Report

Date: 2026-06-05

---

## Summary Table

| Doc | STALE | MISSING | GAP | OK |
|---|---|---|---|---|
| `domain-models.md` | 1 | 3 | 0 | 4 |
| `firebase-schema.md` | 0 | 2 | 1 | 5 |
| `streak-rules.md` | 0 | 3 | 0 | 5 |
| `notification-system.md` | 0 | 0 | 0 | 7 |
| `project-status.md` | 1 | 0 | 0 | 4 |
| **TOTAL** | **2** | **8** | **1** | **25** |

---

## context/domain-models.md

### STALE

- **Award `type` values** — Doc listed `streak_7`, `streak_30`, `streak_100`, `first_checkin`, `group_streak_7`. Actual types per `algorithm-spec.md §6` and `shared/test-vectors/award-vectors.json`: `firstStep`, `weeklyWarrior`, `habitFormed`, `monthlyMaster`, `centuryClub`, `yearStrong`, `phoenixRising`, `secondWind`, `neverGiveUp`, `earlyBird`, `nightOwl`, `perfectWeek`, `perfectMonth`, `teamPlayer`, `cheerleader`, `popular`, `photographer`, `honestAbe`. **Fixed.**

### MISSING

- **User model fields** — Missing `totalCheckIns`, `totalPhotoProofs`, `totalHonorCheckIns`, `reactionsGiven`, `reactionsReceived`, `comebackCount`, `earnedAwardTypes`, `currentStreak`, `longestStreak`, `lastCheckInDateSeconds`. All confirmed by `shared/test-vectors/award-vectors.json` and `shared/test-vectors/streak-vectors.json`. **Fixed.**

- **Streak model fields** — Missing `id`, `userIDs`, `isPaused`, `pausedAtSeconds`, `pauseResumeDateSeconds`, `lastCompletionDateSeconds`, `isBroken`. Also: `totalCheckIns` was incorrectly listed as a Streak field — it's a User field. Confirmed by `shared/test-vectors/streak-vectors.json` (streak-object scenarios). **Fixed.**

- **XP/Level system** — Entirely absent. Level names (Starter, Committed, Dedicated, Master, Legend) and thresholds (0/50/150/350/700 XP) confirmed by `shared/test-vectors/xp-vectors.json` and `algorithm-spec.md §7`. **Fixed** (added XP/Level section).

### OK (4)

- Commitment key fields ✓
- Group model fields ✓
- Completion model fields ✓
- Day Key formula (`year * 10000 + dayOfYear`) ✓

---

## context/firebase-schema.md

### MISSING

- **`/agentRuns/{runId}`** — Missing fields `variantsDeactivated`, `guardRailWarnings`, `totalEventsSent`. Confirmed by `agent/notification_agent.py:222–226` (`save_agent_run` function). **Fixed.**

- **`/notificationVariants/{variantId}`** — Missing field `createdAt: Timestamp`. Confirmed by `agent/notification_agent.py:198` (`deploy_new_variants` function). **Fixed.**

### GAP

- Cloud Functions list (`onGroupInvitationCreated`, `onPartnerInvitationCreated`, `onStreakBreak`, `onUserRemovedFromGroup`, `onPartnerCheckIn`, `suppressAfterCheckIn`, `updateUserNotificationProfile`) — cannot verify without `microcommit/functions/src/index.ts` (lives in iOS repo, not this management repo). <!-- GAP: verify Cloud Functions list against index.ts when iOS repo is available -->

### OK (5)

- Core app collections (`/users`, `/commitments`, `/checkIns`, `/groups`, `/groupInvitations`, `/partnerInvitations`) ✓
- Smart notification collections structure ✓
- `notificationEvents` field set ✓ (confirmed by agent code)
- `agentRuns` core fields (`runAt`, `hypothesis`, `conclusions`, `nextHypothesis`, `status`, `rewardScores`, `variantsGenerated`) ✓
- Storage path and security rules ✓

---

## context/streak-rules.md

### MISSING

- **Partnership lifecycle rules** — No mention of mid-stream partnership creation, dissolution, or partner removal behavior. These are distinct from group rules. Confirmed by `algorithm-spec.md §2.6` and `Streakalgorithm.md`. **Fixed** (added Partnership Lifecycle section).

- **User-level streak outcome / comeback logic** — The `computeUserStreakOutcome` rules (same-day no-op, consecutive day increment, 2-day gap reset without comeback, 3+ day gap comeback) were entirely missing. Confirmed by `algorithm-spec.md §5` and `shared/test-vectors/streak-vectors.json` (user-outcome scenarios). **Fixed** (added User-Level Streak Outcome section).

- **"No Mercy" rule explicit call-out** — The rule that any missed day immediately resets (no grace buffer beyond gracePeriodHours) was implied but not stated. Confirmed by `algorithm-spec.md §2.1`. **Fixed** (added No Mercy Rule section).

### OK (5)

- Solo streak rules ✓
- Group allIn rules ✓
- Group individual rules ✓
- Day Key formula ✓
- Pause/Resume reference ✓

---

## context/notification-system.md

### OK (7)

- Five trigger types and when-to-fire table ✓
- AutoResearch loop (weekly, Karpathy-style) ✓
- Model `claude-sonnet-4-6` confirmed by `agent/notification_agent.py:13` ✓
- Generates exactly 5 new variants ✓ (agent prompt: "Generate exactly 5 new variants")
- Reward signal `checkedInWithin60Min` ✓
- Guard rails (opt-out < 2%, habituationScore > 0.8) ✓
- Architecture (client scheduling, Firestore profile/events/variants, Cloud Functions partner push) ✓

---

## context/project-status.md

### STALE

- **Last updated date** — Was `2026-03-29`; current date is `2026-06-05`. **Fixed.**

### OK (4)

- Platform overview table ✓
- Active work tracking references ✓
- Known bugs section (matches `NOTES.md`) ✓
- Key source locations ✓

---

## Files Verified Against

| File | Used to verify |
|---|---|
| `algorithm-spec.md` | streak rules, award eligibility, XP/level system |
| `Streakalgorithm.md` | streak product rules |
| `shared/test-vectors/streak-vectors.json` | Streak and User model fields |
| `shared/test-vectors/award-vectors.json` | Award types, User model fields |
| `shared/test-vectors/xp-vectors.json` | Level names and thresholds |
| `agent/notification_agent.py` | Firestore schema (agentRuns, notificationVariants), agent behavior |
| `NOTES.md` | Known bugs |
