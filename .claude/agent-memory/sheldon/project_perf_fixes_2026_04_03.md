---
name: Android Performance Fixes 2026-04-03
description: Issues 1, 2, 6 fixed — progress circle gate, cold launch Firestore block, nav jank, sync optimizations. Key architectural observations.
type: project
---

Three performance fixes implemented and committed on 2026-04-03 (branch 1.0.1, commit 81ad740).

**Why:** Root cause diagnosis done by Sheldon on 2026-04-03, all 6 issues analyzed. Issues 1, 2, 6 assigned to Sheldon.

**How to apply:** When touching CommitmentDetail or sync engine, these patterns are now established and should not be regressed.

---

## Issue 1 — Progress circle render gate

`CommitmentDetailUiState.progress` changed from `Float` to `Float?`.
- `null` = true cache miss (show spinner)
- Non-null = any loaded value (show ring, even 0%)

Screen gate changed from `!uiState.isRoleResolved` to `uiState.progress == null`.
`isRoleResolved` is still in state but no longer gates the progress ring.
`resolvedProgress = uiState.progress ?: 0f` extracted as a local val for use outside the null check block (smart cast on delegated property from StateFlow doesn't work in Compose lambdas).

**Key insight:** Kotlin smart cast does NOT work on delegated properties (`by collectAsState()`). Must extract to local val before using in comparisons outside the null-check block.

---

## Issue 2 — Navigation jank

`CommitmentDetailViewModel` now uses `dagger.Lazy<ActivityNotificationRepository>` for `activityNotificationRepositoryLazy`. Access via `.get()` only in `removeGroupMember()`.

`activityNotificationRepository` was the only dependency used in a single rare admin action. Wrapping in Lazy defers instantiation from ViewModel construction (during 300ms animation) to first use.

Import: `import dagger.Lazy` (from Dagger, not Java).

---

## Issue 6 — Sync performance

**Cold launch fix:** `getActiveUserCommitments()` now triggers `repositoryScope.launch { syncEngine.syncCurrentUserScope() }` on cache miss and returns `emptyList()` immediately. `FirebaseCommitmentRepository` now takes `SyncEngine` as a constructor dependency. `DataModule.provideCommitmentRepository()` updated accordingly.

**SyncEngine already fixed (pre-existing work):** phases 3/4/5 parallelized, group_members junction table populated. These were already in working tree when this session started.

**Room indexes:** `CommitmentEntity` now has `@Entity(indices = [Index("userID"), Index("groupID")])`. `CompletionEntity` has composite indexes on `(userID, timestamp)` and `(groupID, timestamp)`. DB version bumped 8→9. `MIGRATION_8_9` adds `CREATE INDEX IF NOT EXISTS` statements.

**Bulk queue delete:** `SyncQueueDao` gains `deleteByIds(List<Long>)` with `WHERE id IN (:ids)`. `OfflineWriteQueue.flushPending()` uses it instead of N individual deletes.

**pushToActivityFeed:** Reads user username and commitment fields from `db.userDao().getById()` and `db.commitmentDao().getById()` instead of 2 Firestore reads per check-in.

---

## Observation — Android repo is a separate git repo

The Android code lives in `/Users/lokeshpudhari/TinyAct/TinyAct---Android/` which is its OWN git repository on branch `1.0.1`. It is NOT tracked by the outer `microcommit` repo's git. To commit Android changes, `cd TinyAct---Android` and run git there. The outer repo's `git status` will show the directory as clean.
