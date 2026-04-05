# Firebase Schema — TinyAct

## Auth
Firebase Authentication — email/password + Google Sign-In.
Deep links use `microcommit://` scheme.

---

## Firestore Collections

### Core App

```
/users/{userId}
/commitments/{commitmentId}
/completions/{completionId}          ← collection name is "completions", not "checkIns"
/groups/{groupId}
/streaks/{streakId}
/group_invitations/{invitationId}
/partnership_invitations/{invitationId}
/group_removal_notifications/{notificationId}
/usernames/{username}                ← username uniqueness registry
```

### Smart Notifications

```
/notificationEvents/{eventId}
  userId, commitmentId, notificationId
  triggerType         // LOSS_AVERSION | SOCIAL_PROOF | PARTNER_MOMENTUM | IDENTITY | FOMO
  variantId           // A/B variant label
  sentAt, openedAt, checkedInAt
  checkedInWithin60Min: bool   ← reward signal
  userStreakAtSend, partnerStreakAtSend
  hourOfDay (0-23), dayOfWeek (0-6)
  suppressedReason    // "already_checked_in" | "opted_out" | "habituation"

/notificationVariants/{variantId}
  triggerType, copyTitle, copyBody
  createdByAgent: bool, agentRunId
  isActive, cohortTag

/userNotificationProfile/{userId}
  dominantTrigger       // agent-inferred best trigger type for this user
  optimalWindowStart/End  // hour range (0-23)
  suppressUntil         // set when user checks in (no more notifs today)
  habituationScore      // 0.0–1.0, >0.8 = rotate variant

/agentRuns/{runId}
  runAt, hypothesis, conclusions, nextHypothesis
  status: "running" | "complete" | "failed"
  rewardScores: { variantId -> float }
  variantsGenerated: [variantId]
```

Full schema with all fields: `SPEC.md` section 2.

---

## Cloud Functions

Server-side only (all in `microcommit/functions/src/`):

**Group & Partnership lifecycle:**
- `onGroupInvitationCreated` — sends group invite push when invitation doc created
- `onGroupInvitationUpdated` — sends accepted/declined response notification to inviter
- `onPartnershipInvitationCreated` — sends partner invite push
- `onPartnershipInvitationUpdated` — sends accepted/declined response to requester
- `onGroupUpdated` — detects member removal; sends push + creates `group_removal_notifications` doc; skips voluntary leaves
- `onGroupDeleted` — cascades group deletion to all member commitments; notifies members

**Streak events:**
- `onStreakUpdated` — fires when `currentStreak` transitions from >0 to 0 and not paused; sends personalized streak-broken push to each partner

**Smart notifications:**
- `onPartnerCheckIn` — fires PARTNER_MOMENTUM notification to partner
- `suppressAfterCheckIn` — sets `suppressUntil` on user's notification profile after check-in
- `updateUserNotificationProfile` — nightly scheduled profile recalculation
- `monitorOptOutRate` — monitors opt-out rate against guard rails

**Social nudges:**
- `onCompletionCreated` — when a group completion is created, sends smart_nudge to unchecked-in members whose preferred time is within 2 hours; respects daily notification cap

**User lifecycle:**
- `onPartnershipEnded` — clears `streakPartnerID` on former partner's document when user dissolves partnership (admin SDK bypasses Firestore rules)
- `onCompletionReactionAdded` — increments `reactionsReceived` on completion owner when new reactions are added (admin SDK bypasses rules)

Client-side scheduling (iOS + Android): daily reminders and expiry warnings.

Note: `sendDailyReminders` Cloud Function is **disabled** — client-side local notifications handle all daily reminders to prevent duplicates.

---

## Storage

`gs://microcommit.appspot.com/`
- Check-in photo proofs: `proof_photos/` — encrypted at rest (AES-256 via `ImageEncryptionService`)
- Avatars: `avatars/`

---

## Security Rules Constraints
- `notificationVariants` — readable by authenticated users, writable by service account only
- `agentRuns` — admin read only
