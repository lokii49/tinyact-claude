# Domain Models — TinyAct

Core models shared across iOS (Swift), Android (Kotlin), and Firebase. When in doubt, `algorithm-spec.md` is canonical.

---

## Commitment

The primary entity. A micro-habit a user commits to.

Key fields:
- `id`, `userId`, `title`, `description`
- `frequency` — daily / weekly
- `gracePeriodHours` — window after midnight before streak breaks
- `startDate`, `endDate`
- `isActive`, `isArchived`
- `groupId` (optional) — if part of a group
- `partnerUserId` (optional) — direct accountability pair
- `notificationConfig` — `preferredTime`, `gracePeriodHours`
- `renewedAt`, `extendedAt` — Renew resets all counts; Extend continues streak

## Streak

Calculated, not stored raw — derived from check-ins.

Key fields:
- `id`
- `userIDs` — array of user IDs covered by this streak (solo = 1, partnership = 2, group = all members)
- `currentStreak` — consecutive days with valid check-ins
- `longestStreak`
- `lastCompletionDateSeconds` — Unix timestamp of last check-in
- `isPaused` — bool; paused streaks are never broken regardless of elapsed time
- `pausedAtSeconds` — when pause started
- `pauseResumeDateSeconds` — optional auto-resume date
- `isBroken` — computed: `!isPaused AND lastCompletionDate != null AND lastCompletion < yesterday`
- `streakBreakAcknowledgedAt` — user has seen/acknowledged the break <!-- GAP: investigate — not present in streak-vectors.json or algorithm-spec.md; may be client-only UI state; verify against mobile implementations when available -->

Streak rules → see `Streakalgorithm.md` (product truth) and `algorithm-spec.md` (technical spec).

## User

- `id`, `displayName`, `email`, `photoURL`
- `timezone` — IANA identifier (e.g. "Asia/Kolkata") — used for day key calculation
- `fcmToken` — push notification token
- `notificationOptOut` — bool
- `xp`, `level` — awards system
- `currentStreak`, `longestStreak` — user-level streak counters (updated after every check-in)
- `totalCheckIns` — lifetime check-in count
- `totalPhotoProofs` — lifetime photo proof count
- `totalHonorCheckIns` — lifetime honor (no-photo) check-in count
- `reactionsGiven`, `reactionsReceived` — social engagement counters
- `comebackCount` — number of times user returned after a 3+ day gap
- `earnedAwardTypes` — array of award type strings already earned (deduplication guard)
- `lastCheckInDateSeconds` — Unix timestamp of last check-in

## Group

- `id`, `name`, `ownerId`
- `memberIds` — array
- `accountabilityType` — `allIn` (everyone must check in) or `individual` (independent streaks)
- `inviteCode`
- `isActive`

## Completion (Check-in)

- `id`, `commitmentId`, `userId`
- `completedAt` — Timestamp
- `dayKey` — `year * 10000 + dayOfYear` in user's local timezone
- `photoProofURL` (optional, encrypted)
- `note` (optional)

## Award

- `id`, `userId`, `type`
- `awardedAt`, `xpGranted`
- Award types (see `algorithm-spec.md` §6 for full eligibility rules):
  - Streak milestones: `firstStep`, `weeklyWarrior`, `habitFormed`, `monthlyMaster`, `centuryClub`, `yearStrong`
  - Comeback: `phoenixRising`, `secondWind`, `neverGiveUp`
  - Consistency: `earlyBird`, `nightOwl`, `perfectWeek`, `perfectMonth`
  - Social: `teamPlayer`, `cheerleader`, `popular`
  - Proof: `photographer`, `honestAbe`

## XP / Level

XP is accumulated via events; level is derived from total XP.

Key XP events: daily check-in (+2), photo proof bonus (+1), reaction given (+1). Awards grant bonus XP.

Level thresholds:
- Starter: 0–49 XP
- Committed: 50–149 XP
- Dedicated: 150–349 XP
- Master: 350–699 XP
- Legend: 700+ XP

Full XP table per award type: `algorithm-spec.md` §7.

---

## Day Key

`dayKey = year * 10000 + dayOfYear` (1-indexed, user's local timezone)

Example: 2025-02-19 → day 50 → `20250050`

Critical: always compute in user's local timezone using their IANA `timezone` field.
