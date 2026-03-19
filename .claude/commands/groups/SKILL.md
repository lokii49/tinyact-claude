# Groups Audit & Alignment

## What this skill does
Audits group membership limits, accountability pair logic, member removal cascades, admin-only operations, and group deletion to ensure both platforms implement identical group business rules.

## Rules

### Rule 1: Maximum 8 members per group
`Group.maxMembers` defaults to 8. `Group.isFull` returns `memberIDs.count >= maxMembers`. Any code path that adds a member must check `isFull` before proceeding. The UI must disable the "Join" or "Invite" action when the group is full.

### Rule 2: accountabilityPairs maps userID to partnerUserID
`accountabilityPairs: [String: String]` is a bidirectional map where `accountabilityPairs[userA] == userB` and `accountabilityPairs[userB] == userA`. Both entries must be written atomically. If only one direction is written, the partnership is broken.

### Rule 3: allMembersAccountable means group-wide accountability
When `allMembersAccountable == true`, the group uses full group accountability: if any member misses a day, all members reset to 0. Individual `accountabilityPairs` within the same group are ignored in this mode — the entire group is effectively one accountability unit.

### Rule 4: Removing a member cascades correctly
When a member is removed from a group, all of the following must happen atomically (or in a safe sequence):
1. Remove their `userID` from `group.memberIDs`
2. Remove their accountability pair entries: delete `accountabilityPairs[memberID]` and the reverse entry where their ID is the value
3. Delete their `Commitment` document for this group from Firestore
4. If they were the streak partner of another user, that other user's streak must continue solo from the current count

Skipping any of these steps is a violation.

### Rule 5: Only creator/admin can perform privileged operations
The following actions are restricted to the group creator (`group.creatorID` or fallback `group.memberIDs[0]`):
- Rename the group
- Remove members
- Change accountability pairs
- Delete the group

Any code that performs these operations must first check `group.isCreator(currentUserID)`. Missing this check is a security violation.

### Rule 6: Group deletion cascades
When a group is deleted, the sequence must be:
1. Delete all member `Commitment` documents for this group
2. Delete the `Group` document itself

Deleting only the `Group` document leaves orphan commitment records in Firestore — that is a data integrity violation.

### Rule 7: Partnership streaks tracked separately from group streaks
Users in a partnership within a group have a dedicated `Streak` document with `userIDs = [partnerA, partnerB]` and `groupID = <groupID>`. This is separate from any solo or group-wide streak. The partnership `Streak` document is created when the partnership is formed and must be cleaned up (or left for history) when the partnership ends.

### Rule 8: Voluntary leave vs removal distinction
`group.lastVoluntaryLeaveUserID` tracks who voluntarily left. Server-side Firebase functions skip sending a removal notification if `lastVoluntaryLeaveUserID == removedUserID`. Clearing this field after sending the notification (or after a grace window) is the function's responsibility.

### Rule 9: Group model field parity
Both iOS `Group.swift` and Android `Group.kt` must have exactly these fields:
`id`, `name`, `commitmentDescription`, `emoji`, `creatorID`, `memberIDs`, `maxMembers`, `isActive`, `createdAt`, `expiresAt`, `durationDays`, `accountabilityPairs`, `lastVoluntaryLeaveUserID`, `allMembersAccountable`.

## Audit steps

1. Read `/Users/lokeshpudhari/TinyAct/microcommit/micro-commit/Core/Domain/Models/Group.swift` and verify:
   - All 15 fields from Rule 9 are present
   - `isFull` is `memberIDs.count >= maxMembers`
   - `isCreator(_:)` checks `creatorID` first, falls back to `memberIDs.first`

2. Read the Android Group model at `/Users/lokeshpudhari/TinyAct/TinyAct---Android/core/domain/src/main/java/com/lokesh/tinyact/core/domain/model/Group.kt` and verify the same field list.

3. Read `/Users/lokeshpudhari/TinyAct/TinyAct---Android/core/data/src/main/java/com/lokesh/tinyact/core/data/repository/FirebaseGroupRepository.kt` and verify:
   - `removeMember(...)` removes from `memberIDs`, removes both accountability pair entries, and deletes the member's commitment
   - `deleteGroup(...)` deletes member commitments before deleting the group doc
   - All privileged operations check creator status

4. Read the iOS group repository (look under `Core/Data/Repositories/` for `GroupRepository`) and verify the same cascade behaviors.

5. Search for any `group.memberIDs.append(...)` without a preceding `isFull` check — that is a violation.

6. Search for `accountabilityPairs[userID]` assignments and verify both directions are always set together.

7. Verify the groups feature UI on both platforms disables join/invite when `group.isFull`.

## Common violations to fix

- **Member removed but their commitment not deleted**: Add a `deleteCommitment(for: removedUserID, groupID: groupID)` call inside `removeMember(...)` — fix by adding the cascade delete step.
- **accountabilityPairs only sets one direction**: When setting a partnership, always set both `pairs[userA] = userB` and `pairs[userB] = userA` in the same Firestore update — fix by using a batch write.
- **Group deleted without deleting commitments**: Add a loop to delete all group member commitments before calling `deleteGroup(...)` — fix in the group repository delete function.
- **No creator check before rename**: Add `guard group.isCreator(currentUserID) else { return }` at the top of `renameGroup(...)` — fix in the ViewModel or use case.
- **maxMembers not enforced on join**: Add `guard !group.isFull` before the `memberIDs.append(userID)` call — fix in the join/invite acceptance flow.

## Files to check

- iOS:
  - `/Users/lokeshpudhari/TinyAct/microcommit/micro-commit/Core/Domain/Models/Group.swift`
  - Group repository under `/Users/lokeshpudhari/TinyAct/microcommit/micro-commit/Core/Data/Repositories/`
  - Groups screen ViewModels under `/Users/lokeshpudhari/TinyAct/microcommit/micro-commit/Core/Presentation/`
- Android:
  - `/Users/lokeshpudhari/TinyAct/TinyAct---Android/core/domain/src/main/java/com/lokesh/tinyact/core/domain/model/Group.kt`
  - `/Users/lokeshpudhari/TinyAct/TinyAct---Android/core/data/src/main/java/com/lokesh/tinyact/core/data/repository/FirebaseGroupRepository.kt`
  - `/Users/lokeshpudhari/TinyAct/TinyAct---Android/feature/groups/` (groups feature ViewModels and screens)
- Shared:
  - `/Users/lokeshpudhari/TinyAct/microcommit/functions/src/index.ts` (group removal notification function)
