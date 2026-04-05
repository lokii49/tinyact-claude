# Domain Models — TinyAct

Core models shared across iOS (Swift), Android (Kotlin), and Firebase. When in doubt, `algorithm-spec.md` is canonical.

---

## Commitment

The primary entity. A micro-habit a user commits to.

Key fields:
- `id`, `groupID`, `userID`
- `specificAction` — e.g., "10 pushups before breakfast" (the commitment title)
- `description` (optional) — e.g., "Get blood flowing before the day starts"
- `emoji` — visual representation
- `schedule` — `CommitmentSchedule` containing `days: [Weekday]` and `preferredTime: String?` (e.g., "07:00")
- `isActive`
- `createdAt` — updated on renewal to reflect new start date
- `expiresAt: Date?`
- `dateHistory: [CommitmentPeriod]` — history of previous commitment periods (startDate, endDate)
- `streakBreakAcknowledgedAt: Date?` — when user acknowledged a broken streak alert
- `isPaused`, `pausedAt`, `pauseResumeDate` — pause functionality
- `lastStreakBreakDate: Date?` — used when partnership ends to avoid counting old completions

Note: There is no `frequency`, `startDate`, `endDate`, `isArchived`, `renewedAt`, or `extendedAt` field. Renewal/extension history is captured via `dateHistory`. Archival is implicit from `isActive = false` + `isExpired`.

## Streak

Calculated and also stored as a Firestore document (one per partnership/group).

Key fields:
- `id`, `groupID`, `userIDs: [String]` — for partnership streaks (2 people within the group)
- `currentStreak`, `longestStreak`
- `lastCompletionDate: Date?`
- `isActive`
- `createdAt`
- `isPaused`, `pausedAt`, `pauseResumeDate`
- `pauseReason: PauseReason?` — illness / travel / vacation / work_busy / family_emergency / mental_health_break / other
- `pausedByUserID: String?` — only this user can resume

Note: `totalCheckIns` and `streakBreakAcknowledgedAt` live on `Commitment`, not `Streak`. `lastCheckInDate` is on both `User` (global) and `Streak`.

Streak rules → see `streak-rules.md` (summary) and `algorithm-spec.md` (technical spec).

## User

- `id`, `username` (primary — used for login and group adds), `firstName`, `lastName`
- `email` (optional — only for verification)
- `avatarURL` (not `photoURL`)
- `imageEncryptionKey` — Base64 AES-256 key for encrypted images
- `timezone: TimeZone` (iOS) / `timezone: String` (Android, IANA identifier)
- `interests: [MicroCommitmentInterest]`
- `fcmToken: String?`
- `streakPartnerID: String?` — current accountability partner
- `createdAt`, `lastUsernameChangeDate`

Gamification:
- `totalXP`, `earnedAwards: [Award]`
- `totalCheckIns`, `totalPhotoProofs`, `totalHonorCheckIns`
- `reactionsGiven`, `reactionsReceived`, `comebackCount`

User-level streak (persists across deleted commitments):
- `currentStreak`, `longestStreak`, `lastCheckInDate`

Computed: `displayName` (fullName if set, else username), `currentLevel: UserLevel`

Note: There is no `notificationOptOut`, `xp`, or `level` field. XP is `totalXP`; level is a computed property via `UserLevel.from(totalXP)`.

## Group

- `id`, `name`, `commitmentDescription`, `emoji`
- `creatorID: String?` — user who created the group (admin)
- `memberIDs: [String]`
- `maxMembers: Int` — recommended 3–8
- `isActive`
- `createdAt`, `expiresAt: Date?`, `durationDays: Int?` — time-boxing (7, 14, 21, 30)
- `accountabilityPairs: [String: String]` — userID → partnerUserID mapping within group
- `allMembersAccountable: Bool` — when true, any member miss resets everyone's streak to 0
- `lastVoluntaryLeaveUserID: String?` — skip removal notification for voluntary leave

Note: There is no `accountabilityType` enum, no `inviteCode`, no `ownerId`. Accountability mode is `allMembersAccountable: Bool`. Owner/admin is `creatorID`.

## Completion (Check-in)

- `id`, `userID`, `groupID`, `commitmentID`
- `timestamp: Date` (not `completedAt`)
- `proofType: ProofType` — `.honor`, `.photo`, or `.location`
- `photoURL: String?` (not `photoProofURL`) — encrypted at rest
- `uploaderEncryptionKey: String?` — key to decrypt the photo
- `location: LocationProof?` — latitude, longitude, timestamp
- `reactions: [Reaction]`
- `timezoneIdentifier: String?` — timezone at check-in time for historical correctness

Note: There is no `dayKey` field on Completion — it is computed by `StreakCalculationService` using `year * 10000 + dayOfYear` in the user's local timezone. There is no `note` field.

## Award

- `id`, `type: AwardType`, `earnedAt: Date`

XP value is derived from `type.xpValue` (not a stored field).

Award types (from `AwardType` enum):
- Streak: `firstStep` (10 XP), `weeklyWarrior` (25), `habitFormed` (50), `monthlyMaster` (75), `centuryClub` (150), `yearStrong` (500)
- Comebacks: `phoenixRising` (30), `secondWind` (40), `neverGiveUp` (60)
- Consistency: `perfectWeek` (25), `perfectMonth` (100), `earlyBird` (20), `nightOwl` (20)
- Social: `teamPlayer` (15), `cheerleader` (25), `popular` (50)
- Proof: `photographer` (30), `honestAbe` (30)

Note: There is no `userId` field on Award — awards are embedded in the `User.earnedAwards` array.

---

## Day Key

`dayKey = year * 10000 + dayOfYear` (1-indexed, user's local timezone)

Example: 2025-02-19 → day 50 → `20250050`

Critical: always compute in user's local timezone using their IANA `timezone` field.
