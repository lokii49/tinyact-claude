# Lint-Wiki Audit Report

Date: 2026-06-12

---

## Summary Table

| Doc | STALE | MISSING | GAP | OK |
|---|---|---|---|---|
| `domain-models.md` | 0 | 0 | 1 | 5 |
| `firebase-schema.md` | 2 | 0 | 1 | 5 |
| `streak-rules.md` | 0 | 0 | 1 | 7 |
| `notification-system.md` | 0 | 0 | 0 | 7 |
| `project-status.md` | 1 | 1 | 0 | 4 |
| **TOTAL** | **3** | **1** | **3** | **28** |

---

## context/domain-models.md

### GAP

- **`streakBreakAcknowledgedAt`** — Listed as a Streak field but absent from `shared/test-vectors/streak-vectors.json` and `algorithm-spec.md`. May be client-only UI state not part of the canonical algorithm. <!-- GAP: investigate --> comment added inline. Cannot verify without mobile repo.

### OK (5)

- Commitment key fields (id, userId, title, frequency, gracePeriodHours, groupId, partnerUserId, notificationConfig, renewedAt, extendedAt) ✓
- User model fields (all 14 fields) — confirmed by `shared/test-vectors/streak-vectors.json` and `award-vectors.json` ✓
- Streak model fields (id, userIDs, isPaused, pausedAtSeconds, pauseResumeDateSeconds, currentStreak, longestStreak, lastCompletionDateSeconds, isBroken formula) — confirmed by `streak-vectors.json` (streak-object scenarios) ✓
- Award types (all 18: firstStep, weeklyWarrior, habitFormed, monthlyMaster, centuryClub, yearStrong, phoenixRising, secondWind, neverGiveUp, earlyBird, nightOwl, perfectWeek, perfectMonth, teamPlayer, cheerleader, popular, photographer, honestAbe) — confirmed by `algorithm-spec.md §6` and `award-vectors.json` ✓
- XP/Level system (thresholds 0/50/150/350/700, level names Starter/Committed/Dedicated/Master/Legend) — confirmed by `xp-vectors.json` and `algorithm-spec.md §7` ✓
- Day Key formula (`year * 10000 + dayOfYear`) — confirmed by `algorithm-spec.md §1` ✓

---

## context/firebase-schema.md

### STALE

- **`agentRuns.variantsGenerated` type** — Doc said `[variantId]` (implying IDs). Actual: `agent/notification_agent.py:219-221` stores `[v["copyTitle"] for v in new_variants]` — a list of copy title strings, not IDs. **Fixed:** changed to `[string] // list of copyTitle strings (not IDs)`.

- **`agentRuns.status` value set** — Doc said `"running" | "complete" | "failed" | "skipped"`. Agent code only writes `"complete"` (`notification_agent.py:213`) or `"skipped"` (`notification_agent.py:272`). `"running"` and `"failed"` appear in `SPEC.md §2.1` but are not implemented in current agent code. **Fixed:** narrowed to `"complete" | "skipped"` with note about planned values.

### GAP

- Cloud Functions list (`onGroupInvitationCreated`, `onPartnerInvitationCreated`, `onStreakBreak`, `onUserRemovedFromGroup`, `onPartnerCheckIn`, `suppressAfterCheckIn`, `updateUserNotificationProfile`) — cannot verify without `microcommit/functions/src/index.ts` (lives in iOS repo, not this management repo). <!-- GAP: verify Cloud Functions list against index.ts when iOS repo is available -->

### OK (5)

- Core app Firestore collections (`/users`, `/commitments`, `/checkIns`, `/groups`, `/groupInvitations`, `/partnerInvitations`) ✓
- `notificationEvents` fields (all confirmed against agent pull_experiment_results code) ✓
- `notificationVariants` fields (triggerType, copyTitle, copyBody, createdByAgent, agentRunId, createdAt, isActive, cohortTag) — confirmed by `notification_agent.py:189-203` ✓
- `agentRuns` core fields (runAt, hypothesis, conclusions, nextHypothesis, rewardScores, variantsDeactivated, guardRailWarnings, totalEventsSent) — confirmed by `notification_agent.py:209-227` ✓
- Storage path and security rules ✓

---

## context/streak-rules.md

### GAP

- **`gracePeriodHours` vs "no grace period" contradiction** — The "Technical Details" section documents `gracePeriodHours` as a window after midnight before a streak breaks. But `algorithm-spec.md §4` states explicitly: "There is no grace period — a streak breaks at the start of the day after the missed day." The field exists on the Commitment model but may be enforced only by client code, not reflected in the canonical algorithm spec. <!-- GAP: investigate --> comment added inline.

### OK (7)

- No Mercy Rule — confirmed by `algorithm-spec.md §2.1` ✓
- Solo streak rules (check-in → +1, miss → 0, renew resets, extend continues) — confirmed by `algorithm-spec.md §2.2` and `Streakalgorithm.md` ✓
- Group allIn rules (intersection of ALL members, any miss resets everyone, member removal recalculates with remaining) — confirmed by `algorithm-spec.md §2.4` ✓
- Group individual rules (independent solo streaks per member, no cross-member impact) — confirmed by `algorithm-spec.md §2.5` ✓
- Partnership Lifecycle (mid-stream carry-over, dissolution, removal) — confirmed by `algorithm-spec.md §2.6` and `Streakalgorithm.md` ✓
- User-Level Streak Outcome (`computeUserStreakOutcome` rules 1–5) — verified against `algorithm-spec.md §5` and all 5 user-outcome vectors in `streak-vectors.json` ✓
- Day Key formula and Pause/Resume reference ✓

---

## context/notification-system.md

### OK (7)

- Five trigger types and when-to-fire conditions — confirmed by `algorithm-spec.md §1.1` and `notification_agent.py:23-29` ✓
- AutoResearch loop (weekly Karpathy-style, pull → analyze → hypothesize → deploy) — confirmed by `notification_agent.py:run_agent()` ✓
- Model `claude-sonnet-4-6` — confirmed by `notification_agent.py:21` (`MODEL = "claude-sonnet-4-6"`) ✓
- Generates exactly 5 new variants — confirmed by `notification_agent.py:160` ("Generate exactly 5 new variants") ✓
- Reward signal `checkedInWithin60Min` rate — confirmed by `notification_agent.py:57` ✓
- Guard rails (opt-out rate < 2%) — confirmed by `notification_agent.py:32` (`MAX_OPT_OUT_RATE = 0.02`) ✓
- Architecture (client scheduling, Firestore profile/events/variants, Cloud Functions partner push) ✓

---

## context/project-status.md

### STALE

- **Last updated date** — Was `2026-06-05`; current date is `2026-06-12`. **Fixed.**

### MISSING

- **Outstanding Android performance bugs** — Known Bugs section only listed the splash screen issue. Sheldon's 2026-04-02 perf audit identified 16 issues; only 3 were fixed in the 2026-04-03 session (issues 1, 2, 6). Five CRITICAL/HIGH issues remain unaddressed (FeedScreen double-load, GroupRemoval double-queue, MyGoalsViewModel N+1 streak reads, GroupDetailViewModel thundering herd, unbounded completions fetch). **Fixed:** added all 5 to Known Bugs section with file:line references.

### OK (4)

- Platform overview table ✓
- Active work tracking references (`todo.md`, `checklist.md`, `audit-remediation-status.md`, `NOTES.md`) ✓
- Active branches noted (cannot verify against remote — branches live in separate repos) ✓
- Key source locations ✓

---

## Files Verified Against

| File | Used to verify |
|---|---|
| `algorithm-spec.md` | streak rules, award eligibility, XP/level system, day key, isBroken formula |
| `Streakalgorithm.md` | streak product rules, partnership lifecycle |
| `SPEC.md` | Firebase schema (agentRuns, notificationVariants, notificationEvents, userNotificationProfile) |
| `shared/test-vectors/streak-vectors.json` | Streak model fields, all user-outcome rules, solo/group/partnership calc |
| `shared/test-vectors/award-vectors.json` | Award types, User model fields |
| `shared/test-vectors/xp-vectors.json` | Level names and XP thresholds |
| `agent/notification_agent.py` | Firestore schema (agentRuns, notificationVariants), agent behavior, model name, guard rails |
| `NOTES.md` | Known bugs |
| `.claude/agent-memory/sheldon/project_android_perf_audit.md` | Outstanding Android performance bugs |
| `.claude/agent-memory/sheldon/project_perf_fixes_2026_04_03.md` | Which perf issues were resolved |

## Mobile Code Gap Note

The iOS (`microcommit/`) and Android (`TinyAct---Android/`) repos are not cloned in this management repo. Findings that could only be verified with mobile code are marked as GAP. Affected docs:
- `domain-models.md` → `streakBreakAcknowledgedAt` field, gracePeriodHours in client streak logic
- `firebase-schema.md` → Cloud Functions list
- `streak-rules.md` → gracePeriodHours enforcement in StreakCalculationService
- `notification-system.md` → SmartNotificationScheduler.kt / NotificationScheduler.swift paths

Previous audit (2026-06-05) fixed all major STALE/MISSING items. This audit found 3 new STALE (2 in firebase-schema.md, 1 date in project-status.md), 1 MISSING (Android perf bugs in project-status.md), and 3 GAPs documented inline.
