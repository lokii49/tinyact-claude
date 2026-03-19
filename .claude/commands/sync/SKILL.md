# Sync Audit & Alignment

## What this skill does
Audits the offline-first sync architecture on both platforms to ensure writes go to local cache first, reads serve from cache, archive runs before active-commitment fetch, and the offline queue flushes in order on reconnect.

## Rules

### Rule 1: Writes go to local queue first
All create/update/delete operations must write to the local store (SwiftData on iOS, Room on Android) BEFORE attempting a Firestore write. If the device is offline, the write must be queued and the UI must update immediately from the local write. Firestore write happens in the background.

iOS: `SyncEngine.swift` monitors `NWPathMonitor` and flushes dirty records when online.
Android: `OfflineWriteQueue.kt` queues writes; `SyncEngine.kt` calls `offlineWriteQueue.flushPending()` on reconnect.

### Rule 2: Reads serve from local cache first
Repository `get*` methods must return cached data immediately, then optionally refresh from Firestore in the background. The `DataFetchStrategy` enum controls this:
- `.cacheFirst` / `CACHE_FIRST`: return local data immediately, background refresh
- `.serverFirst` / `SERVER_FIRST`: fetch from Firestore, update local cache, return result

The default for feed/home screens must be `.cacheFirst` to prevent loading spinners on every app open.

### Rule 3: archiveExpiredCommitments runs before fetching active commitments
Before any query for active commitments (e.g., loading the feed), the archive service must first move expired commitments (`isCurrentlyActive == false`) to inactive state. Skipping this step causes a race condition where expired commitments briefly appear in the active feed.

iOS: `CommitmentArchiveService.archiveExpiredCommitments()` must be awaited before the feed ViewModel calls `getActiveCommitments()`.
Android: The equivalent archive step must run in the same sequence.

### Rule 4: Offline queue flushes in order on reconnect
When the device comes back online, `SyncEngine` must flush the offline queue in FIFO order (oldest write first). Out-of-order flushing can cause data inconsistencies (e.g., a delete flushed before the corresponding create).

### Rule 5: iOS SwiftData entities live under Core/Data/Local/
All SwiftData model classes (`@Model`) must be in `/microcommit/micro-commit/Core/Data/Local/Models/SDModels.swift`. Mappers between SwiftData entities and domain models live in `Core/Data/Local/Mappers/SDMappers.swift`. Adding a new entity anywhere else violates the architecture.

### Rule 6: Android Room entities live under core/data/local/entity/
All Room `@Entity` classes must be in `core/data/src/main/java/com/lokesh/tinyact/core/data/local/entity/Entities.kt`. DAOs live in `core/data/src/main/java/com/lokesh/tinyact/core/data/local/dao/Daos.kt`. The database class is `TinyActDatabase.kt`.

### Rule 7: Conflict resolution — server wins for clean records, local wins for dirty
When syncing from Firestore back to local:
- If the local record has `needsSync == true` (iOS) or is in the offline queue (Android): local wins, do not overwrite with server data.
- If the local record is clean: server data wins, overwrite local.

Overwriting dirty local records with server data causes write loss.

### Rule 8: cacheValidityMs / cacheValiditySeconds constant must exist
A constant defining the local cache validity window must exist in the codebase. After this window expires, a background refresh from Firestore is triggered even for `.cacheFirst` reads. Search for `cacheValidityMs`, `cacheValiditySeconds`, or `cacheValidUntil` — if not found, the constant is missing and needs to be defined and used.

### Rule 9: SyncEngine is a singleton
Both `SyncEngine.swift` (iOS) and `SyncEngine.kt` (Android, `@Singleton`) must have exactly one instance per app lifetime. Multiple instances cause duplicate Firestore listeners and write conflicts.

## Audit steps

1. Read `/Users/lokeshpudhari/TinyAct/microcommit/micro-commit/Core/Data/Local/Sync/SyncEngine.swift` and verify:
   - It uses `NWPathMonitor` for connectivity
   - It flushes dirty records on reconnect
   - Conflict resolution: server wins only for non-dirty records

2. Read `/Users/lokeshpudhari/TinyAct/TinyAct---Android/core/data/src/main/java/com/lokesh/tinyact/core/data/service/SyncEngine.kt` and verify:
   - `offlineWriteQueue.flushPending()` is called first in `syncCurrentUserScope()`
   - Remote data is only applied when the local record is not in the pending queue

3. Read `/Users/lokeshpudhari/TinyAct/TinyAct---Android/core/data/src/main/java/com/lokesh/tinyact/core/data/repository/OfflineWriteQueue.kt` and verify it queues writes in order and exposes a FIFO flush mechanism.

4. Read `/Users/lokeshpudhari/TinyAct/microcommit/micro-commit/Core/Data/Local/Sync/SyncEngine.swift` for the archive-before-fetch ordering. If not there, check the iOS feed ViewModel.

5. Read the Android feed ViewModel (under `feature/feed/`) and verify `archiveExpiredCommitments()` is called before `getActiveCommitments()`.

6. Read `/Users/lokeshpudhari/TinyAct/microcommit/micro-commit/Core/Domain/Models/DataFetchStrategy.swift` and its Android equivalent — verify `.cacheFirst` is the default for feed queries.

7. Search for `cacheValidity` across Swift and Kotlin files. If not found, flag that a cache TTL constant is missing.

8. Verify `SyncEngine` on iOS is accessed only via `SyncEngine.shared`. On Android verify it is `@Singleton` in Hilt.

## Common violations to fix

- **Firestore write happens before local write**: Swap the order — write to SwiftData/Room first, then `Task.detached { await firestoreRepo.write(...) }`. Fix in the relevant repository implementation.
- **archiveExpiredCommitments not awaited before feed fetch**: Add `await CommitmentArchiveService.shared.archiveExpiredCommitments()` as the first line of the feed ViewModel's `loadCommitments()` function.
- **Offline queue not flushed in FIFO order**: Ensure `OfflineWriteQueue` uses a timestamp or sequence number as the sort key when dequeuing. Fix by adding an `enqueuedAt: Timestamp` field to queued items.
- **Server data overwrites dirty local records**: Add `if canApplyRemote(collection, id)` check (already in the Android SyncEngine) before each local upsert. Mirror this pattern on iOS by checking `needsSync` before overwriting.
- **Cache validity constant missing**: Add `private let cacheValiditySeconds: TimeInterval = 300` (5 minutes) to the repository base class, and skip background refresh if `lastFetchedAt + cacheValiditySeconds > now`.

## Files to check

- iOS:
  - `/Users/lokeshpudhari/TinyAct/microcommit/micro-commit/Core/Data/Local/Sync/SyncEngine.swift`
  - `/Users/lokeshpudhari/TinyAct/microcommit/micro-commit/Core/Data/Local/Sync/InitialSyncBootstrapper.swift`
  - `/Users/lokeshpudhari/TinyAct/microcommit/micro-commit/Core/Data/Local/Sync/OfflineImageQueue.swift`
  - `/Users/lokeshpudhari/TinyAct/microcommit/micro-commit/Core/Data/Local/Models/SDModels.swift`
  - `/Users/lokeshpudhari/TinyAct/microcommit/micro-commit/Core/Data/Local/Mappers/SDMappers.swift`
  - `/Users/lokeshpudhari/TinyAct/microcommit/micro-commit/Infrastructure/Services/CommitmentArchiveService.swift`
  - Feed ViewModel under `/Users/lokeshpudhari/TinyAct/microcommit/micro-commit/Core/Presentation/`
- Android:
  - `/Users/lokeshpudhari/TinyAct/TinyAct---Android/core/data/src/main/java/com/lokesh/tinyact/core/data/service/SyncEngine.kt`
  - `/Users/lokeshpudhari/TinyAct/TinyAct---Android/core/data/src/main/java/com/lokesh/tinyact/core/data/repository/OfflineWriteQueue.kt`
  - `/Users/lokeshpudhari/TinyAct/TinyAct---Android/core/data/src/main/java/com/lokesh/tinyact/core/data/local/TinyActDatabase.kt`
  - `/Users/lokeshpudhari/TinyAct/TinyAct---Android/core/data/src/main/java/com/lokesh/tinyact/core/data/local/entity/Entities.kt`
  - `/Users/lokeshpudhari/TinyAct/TinyAct---Android/core/data/src/main/java/com/lokesh/tinyact/core/data/local/dao/Daos.kt`
  - Feed ViewModel under `/Users/lokeshpudhari/TinyAct/TinyAct---Android/feature/feed/`
