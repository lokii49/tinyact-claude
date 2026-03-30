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
/checkIns/{checkInId}
/groups/{groupId}
/groupInvitations/{invitationId}
/partnerInvitations/{invitationId}
```

### Smart Notifications (from SPEC.md)

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
- `onGroupInvitationCreated` — sends group invite push
- `onPartnerInvitationCreated` — sends partner invite push
- `onStreakBreak` — streak break alert
- `onUserRemovedFromGroup` — removal notification
- `onPartnerCheckIn` — fires PARTNER_MOMENTUM notification to partner
- `suppressAfterCheckIn` — sets suppressUntil on check-in
- `updateUserNotificationProfile` — nightly profile recalculation (scheduled)

Client-side scheduling (iOS + Android): all other notification timing.

---

## Storage

`gs://microcommit.appspot.com/`
- Check-in photo proofs: encrypted at rest (AES-256 via `ImageEncryptionService`)

---

## Security Rules Constraints
- `notificationVariants` — readable by authenticated users, writable by service account only
- `agentRuns` — admin read only
