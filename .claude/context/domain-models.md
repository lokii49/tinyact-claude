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
- `currentStreak` — consecutive days with valid check-ins
- `longestStreak`
- `totalCheckIns`
- `lastCheckInDate`
- `streakBreakAcknowledgedAt` — user has seen/acknowledged the break

Streak rules → see `Streakalgorithm.md` (product truth) and `algorithm-spec.md` (technical spec).

## User

- `id`, `displayName`, `email`, `photoURL`
- `timezone` — IANA identifier (e.g. "Asia/Kolkata") — used for day key calculation
- `fcmToken` — push notification token
- `notificationOptOut` — bool
- `xp`, `level` — awards system

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
- Common types: `streak_7`, `streak_30`, `streak_100`, `first_checkin`, `group_streak_7`

---

## Day Key

`dayKey = year * 10000 + dayOfYear` (1-indexed, user's local timezone)

Example: 2025-02-19 → day 50 → `20250050`

Critical: always compute in user's local timezone using their IANA `timezone` field.
