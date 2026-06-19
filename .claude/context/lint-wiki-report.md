# Lint-Wiki Audit Report

Date: 2026-06-19

---

## Summary Table

| Doc | STALE | MISSING | GAP | OK |
|---|---|---|---|---|
| `domain-models.md` | 0 | 0 | 1 | 5 |
| `firebase-schema.md` | 0 | 0 | 1 | 5 |
| `streak-rules.md` | 0 | 0 | 1 | 7 |
| `notification-system.md` | 1 | 0 | 0 | 6 |
| `project-status.md` | 1 | 0 | 0 | 4 |
| **TOTAL** | **2** | **0** | **3** | **27** |

---

## context/domain-models.md

### GAP (pre-existing)

- **`streakBreakAcknowledgedAt`** — Listed as a Streak field but absent from `shared/test-vectors/streak-vectors.json` and `algorithm-spec.md`. May be client-only UI state not part of the canonical algorithm. `<!-- GAP: investigate -->` comment already documented inline. Cannot verify without mobile repo.

### OK (5)

- Commitment key fields (id, userId, title, frequency, gracePeriodHours, groupId, partnerUserId, notificationConfig, renewedAt, extendedAt) — confirmed by `algorithm-spec.md §3` ✓
- User model fields (14 algorithm-facing fields) — confirmed by `shared/test-vectors/award-vectors.json` (id, totalCheckIns, totalPhotoProofs, totalHonorCheckIns, reactionsGiven, reactionsReceived, comebackCount, earnedAwardTypes, currentStreak, longestStreak, lastCheckInDateSeconds, timezone) ✓
- Streak model fields (id, userIDs, isPaused, pausedAtSeconds, pauseResumeDateSeconds, currentStreak, longestStreak, lastCompletionDateSeconds, isBroken formula) — confirmed by `streak-vectors.json` ✓
- Award types (all 18) — confirmed by `algorithm-spec.md §6` and `award-vectors.json` ✓
- XP/Level system (thresholds 0/50/150/350/700, Starter/Committed/Dedicated/Master/Legend) — confirmed by `xp-vectors.json` and `algorithm-spec.md §7` ✓
- Day Key formula (`year * 10000 + dayOfYear`) — confirmed by `algorithm-spec.md §1` ✓

---

## context/firebase-schema.md

### GAP (pre-existing)

- Cloud Functions list (`onGroupInvitationCreated`, `onPartnerInvitationCreated`, `onStreakBreak`, `onUserRemovedFromGroup`, `onPartnerCheckIn`, `suppressAfterCheckIn`, `updateUserNotificationProfile`) — cannot verify without `microcommit/functions/src/index.ts` (lives in iOS repo, not this management repo). `<!-- GAP: verify Cloud Functions list against index.ts when iOS repo is available -->` comment already documented inline in `firebase-schema.md`.

### OK (5)

- Core app Firestore collections (`/users`, `/commitments`, `/checkIns`, `/groups`, `/groupInvitations`, `/partnerInvitations`) ✓
- `notificationEvents` fields — confirmed against `notification_agent.py:pull_experiment_results()` ✓
- `notificationVariants` fields (triggerType, copyTitle, copyBody, createdByAgent, agentRunId, createdAt, isActive, cohortTag) — confirmed by `notification_agent.py:189-203` ✓
- `agentRuns` fields (runAt, hypothesis, conclusions, nextHypothesis, status, rewardScores, variantsGenerated as copyTitle strings, variantsDeactivated, guardRailWarnings, totalEventsSent) — confirmed by `notification_agent.py:207-227`; prior STALE fixes from 2026-06-12 audit still accurate ✓
- Storage path and security rules ✓

---

## context/streak-rules.md

### GAP (pre-existing)

- **`gracePeriodHours` vs "no grace period" contradiction** — The Commitment model carries `gracePeriodHours` but `algorithm-spec.md §4` states "There is no grace period." Field may be enforced only by mobile client logic not captured in the canonical spec. `<!-- GAP: investigate -->` comment already documented inline. Cannot verify without mobile StreakCalculationService files.

### OK (7)

- No Mercy Rule — confirmed by `algorithm-spec.md §2.1` ✓
- Solo streak rules (check-in → +1, miss → 0, renew resets, extend continues) — confirmed by `algorithm-spec.md §2.2` and `Streakalgorithm.md` ✓
- Group allIn rules (intersection of ALL members, any miss resets everyone, member removal recalculates with remaining) — confirmed by `algorithm-spec.md §2.4` ✓
- Group individual rules (independent solo streaks per member, no cross-member impact) — confirmed by `algorithm-spec.md §2.5` ✓
- Partnership Lifecycle (mid-stream carry-over, dissolution, partner removed → solo continuation) — confirmed by `algorithm-spec.md §2.6` and `Streakalgorithm.md` ✓
- User-Level Streak Outcome (`computeUserStreakOutcome` rules 1–5) — verified against `algorithm-spec.md §5` ✓
- Day Key formula and Pause/Resume semantics ✓

---

## context/notification-system.md

### STALE — Fixed

- **Architecture → Profile writer** — Doc said "agent writes" for `/userNotificationProfile/{userId}`. The Python agent (`agent/notification_agent.py`) does **not** write to `userNotificationProfile` — no references to that collection exist in the agent code. According to `SPEC.md §4`, the profile is written by the `updateUserNotificationProfile` Cloud Function (scheduled, runs nightly). **Fixed:** changed to "Cloud Function writes (nightly via `updateUserNotificationProfile`), client reads".
  - Evidence: `agent/notification_agent.py` — `grep userNotificationProfile` → 0 matches
  - Evidence: `SPEC.md` lines 283-288 — `updateUserNotificationProfile` (scheduled Cloud Function) writes the profile

### OK (6)

- Five trigger types and when-to-fire conditions — confirmed by `notification_agent.py:TRIGGER_TYPES` (23-29) and `SPEC.md §1.1` ✓
- AutoResearch loop (weekly Karpathy-style pull → analyze → hypothesize → deploy) — confirmed by `notification_agent.py:run_agent()` ✓
- Model `claude-sonnet-4-6` — confirmed by `notification_agent.py:21` (`MODEL = "claude-sonnet-4-6"`) ✓
- Generates exactly 5 new copy variants — confirmed by `notification_agent.py:160` ("Generate exactly 5 new variants") ✓
- Reward signal `checkedInWithin60Min` rate — confirmed by `notification_agent.py:57` ✓
- Guard rails (opt-out rate < 2%) — confirmed by `notification_agent.py:32` (`MAX_OPT_OUT_RATE = 0.02`) ✓

---

## context/project-status.md

### STALE — Fixed

- **Last updated date** — Was `2026-06-12`; current date is `2026-06-19`. **Fixed.**

### OK (4)

- Platform overview table ✓
- Active work tracking references (`todo.md`, `checklist.md`, `audit-remediation-status.md`, `NOTES.md`) ✓
- Active branches (iOS `1.0.4`, Android `1.0.1` — live in separate repos; this management repo is on `main` only; branch entries unverifiable against mobile repos but consistent with prior audit) ✓
- Known Bugs section (splash screen + 5 outstanding Android perf bugs added in 2026-06-12 audit) — no new agent memory files indicate these have been resolved; all remain outstanding ✓

---

## Files Verified Against

| File | Used to verify |
|---|---|
| `algorithm-spec.md` | streak rules, award eligibility, XP/level system, day key, isBroken formula, pause/resume semantics |
| `Streakalgorithm.md` | streak product rules, partnership lifecycle |
| `SPEC.md` | Firebase schema, notification architecture, Cloud Functions, agent behavior spec |
| `shared/test-vectors/streak-vectors.json` | Streak model fields, all user-outcome rules |
| `shared/test-vectors/award-vectors.json` | Award types, User model algorithm-facing fields |
| `shared/test-vectors/xp-vectors.json` | Level names and XP thresholds |
| `agent/notification_agent.py` | Firestore write targets (confirming agent does NOT write userNotificationProfile), agentRuns/notificationVariants schema, model name, guard rails |
| `NOTES.md` | Known bugs |
| `.claude/agent-memory/sheldon/project_android_perf_audit.md` | Outstanding Android performance bugs |
| `.claude/agent-memory/sheldon/project_perf_fixes_2026_04_03.md` | Which perf issues were resolved |

## Mobile Code Gap Note

The iOS (`microcommit/`) and Android (`TinyAct---Android/`) repos are not cloned in this management repo. Findings that can only be verified with mobile code are marked as GAP. Affected docs:
- `domain-models.md` → `streakBreakAcknowledgedAt` Streak field
- `firebase-schema.md` → Cloud Functions list in `index.ts`
- `streak-rules.md` → `gracePeriodHours` enforcement in StreakCalculationService

Previous audit (2026-06-12) fixed 3 STALE + 1 MISSING items. This audit found 2 new STALE items (notification-system.md profile writer, project-status.md date). The 3 pre-existing GAPs remain open pending mobile repo access.
