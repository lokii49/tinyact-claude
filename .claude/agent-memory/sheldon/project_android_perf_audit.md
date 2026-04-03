---
name: Android Performance Audit 2026-04-02
description: Full ranked audit of Firebase reads, Room caching, Compose recomposition, sync engine, and memory issues in TinyAct Android
type: project
---

Full audit conducted 2026-04-02. Key findings ranked by severity:

**CRITICAL**
1. `fetchAndCacheUserCompletions` (FirebaseCompletionRepository.kt:140) — unbounded query: `col.whereEqualTo("userID", userID).get()` with no `.limit()`. Fetches ALL completions ever for a user. A user with 365 check-ins reads 365 documents on every SERVER_FIRST call.
2. `getUserStreak` and `getPartnershipStreak` (FirebaseStreakRepository.kt:38,50,62) — ALL THREE methods issue the same `whereArrayContains("userIDs", userID).limit(20)` Firestore query independently. CommitmentDetailViewModel calls getUserStreak twice and getPartnershipStreak twice in a single loadData() — 4 redundant reads, each fetching up to 20 streak docs.
3. `FeedScreen.kt` — `loadFeed()` is called in BOTH `LaunchedEffect(Unit)` (line 131) AND `ON_RESUME` lifecycle observer (line 137-138). On first composition, both fire simultaneously. Every tab switch triggers a full feed reload (throttled to 30s but still wasteful).
4. `dismissAllGroupRemovalNotifications` (FirebaseActivityNotificationRepository.kt:91-107) — double-queues every notification for delete: once in the forEach loop (line 99) AND again in `localIds.forEach` (line 106). Items get enqueued twice into the offline queue.

**HIGH**
5. `getActiveUserCommitments` (FirebaseCommitmentRepository.kt:82-92) — always hits server first, falls back to Room on failure. The comment says "Try server first" but offline-first doctrine requires cache-first. MyGoalsViewModel calls this on every loadCommitments() invocation.
6. `buildCard()` (MyGoalsViewModel.kt:483-486) — calls `streakRepository.getUserStreak(uid)` once PER COMMITMENT CARD inside a parallel `async` block. If user has 5 commitments, that's 5 parallel Firestore reads of the same streak document.
7. `GroupDetailViewModel.loadStreaks()` (GroupDetailViewModel.kt:128-133) — calls `streakRepository.getUserStreak(memberID)` for every group member in parallel. Each call issues a `whereArrayContains` Firestore query fetching up to 20 streak docs. For a 5-member group: 5 separate queries, each reading up to 20 docs = up to 100 reads per group detail load.
8. `collectCompletions()` (GroupDetailViewModel.kt:185-188) — calls `loadStreaks()` on every completion Flow emission. Since `getCompletions` returns a Room-backed Flow that emits on every Room upsert, this triggers a fresh streak recalculation (with Firestore reads) on every background sync upsert.

**MEDIUM**
9. `searchUsers` (FirebaseUserRepository.kt:74) — `col.limit(50).get()` fetches 50 user documents with no field filter, then filters in-memory. Should use Firestore composite index query instead.
10. `expandedGroups` state in `GroupedFeedContent` (FeedScreen.kt:330) — `remember { mutableStateOf(mutableSetOf<String>()) }`. Mutating the inner MutableSet without creating a new reference means Compose does not detect the change. The `toMutableSet()` copy-on-write workaround (line 381) works but is fragile and allocates on every toggle.
11. `SyncEngine.syncCurrentUserScope()` — issues sequential user fetch (completions for uid first, then groups, then more completions for group members) rather than fully parallelizing all independent collections. Phase ordering is good but group-member commits could fan out faster.
12. `OfflineWriteQueue.flushPending()` — serial loop over queue items (line 47). Each item awaits Firestore individually. Should batch SET operations into a Firestore WriteBatch where possible to reduce round-trips.
13. `FeedScreen` auto-refresh `LaunchedEffect` (line 153-157) — polls `refresh()` every 120s unconditionally, even if the screen is not visible (the coroutine lives as long as the composable is in the composition, which includes the backstack). Should be scoped to lifecycle resume.

**LOW**
14. `GroupDao.getUserGroups` (Daos.kt:51) — `LIKE '%' || :userID || '%'` full-table scan on serialized JSON string. No index can help here. Scales poorly with large group counts; would benefit from a proper junction table or JSON-each in SQLite.
15. `StreakDao.getByUserID` (Daos.kt:126) — same LIKE pattern on `userIDsJson`. Same concern.
16. `BitmapMemoryCache` used in `CommitmentDetailViewModel` prefetch (line 548) — prefetches proof bitmaps into memory cache on every detail screen load. No eviction policy visible. With many proof photos, this can grow unbounded.

**Why:** Each of these was verified by reading the actual call sites and tracing the data flow. No guessing.
**How to apply:** When implementing fixes, address Critical items first (they directly multiply Firestore read costs). Route implementation to Ross with the exact method signatures above.
