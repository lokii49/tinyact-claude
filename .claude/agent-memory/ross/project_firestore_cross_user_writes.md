---
name: Firestore cross-user write pattern
description: Client writes to another user's Firestore document are blocked by security rules; the correct pattern is Cloud Function (admin SDK) propagation
type: project
---

Firestore rules enforce `request.auth.uid == userId` on all `users/{userId}` writes. Any client-side code that writes to a different user's document will fail with "Missing or insufficient permissions".

Established pattern for bidirectional updates (e.g. partnership formation/dissolution, reaction counters):
- Client writes only to its own document
- A Firestore-triggered Cloud Function (admin SDK) detects the change and propagates to the other user's document

**Why:** Security rules deny cross-user writes. Admin SDK in Cloud Functions bypasses rules.

**How to apply:** When a feature requires writing to another user's document (streakPartnerID, reactionsReceived, etc.), always implement propagation in `microcommit/functions/src/index.ts` rather than calling the repository from the client. The `onPartnershipEnded` and `onCompletionReactionAdded` functions in index.ts are the canonical examples of this pattern.

Note: `acceptInvitation` uses a Firestore transaction that still writes to both user documents. This works because the transaction runs through the Firestore client SDK with the current user's auth token — it is allowed because the security rules permit the `toUserID` (the accepting user) to update their own document, and the `fromUserID` update within the same transaction is currently permitted as a side effect. If rules are tightened further, this transaction will also need to move server-side.
