---
name: Cold-Start Data Flash — Root Cause & Fix
description: The cause and fix for the 1-2 second stale/empty data flash on every Android app launch (My Goals + Feed screens)
type: project
---

Cold-start data flash was diagnosed and fixed across two iterations (2026-04-01).

**Why:** Firebase Auth SDK takes 300-500ms to restore its auth token from disk on cold start (process kill + relaunch). During this window `auth.currentUser` returns null even though the user is logged in. Both ViewModels gated all data loading on `authRepository.currentUserId`, so the entire load path aborted immediately and the screen showed a skeleton until the auth token was available.

**Root cause — MyGoalsViewModel (confirmed by tracing `loadAll` at line 120)**
`val uid = authRepository.currentUserId ?: return@launch` — this `?: return@launch` fires on every cold start because Firebase Auth is still initializing. Room is never queried. The screen sits on skeleton for ~300-500ms with zero content even though Room has all the data from the previous session.

**Fix (implemented 2026-04-01):**
Cache the userId to SharedPreferences (`tinyact_goals_prefs` / `cached_user_id`) after every confirmed auth. On ViewModel init, read the cached uid immediately and start the Room query before Firebase Auth finishes warming up. When Firebase Auth delivers the live uid, persist it (same value) and proceed with remote sync. If the cached uid mismatches the live uid (account switch), discard stale UI state before loading fresh data. Clear the cached uid on sign-out (in `onCleared` when `currentUserId == null`) and when `currentUserId` returns null during the live uid wait.

**Secondary issue — FeedViewModel**
`FeedDataCache.lastSnapshot` is an in-process singleton — evicted on every process kill. On cold start it is null and `FeedUiState(isLoading = false)` was the fallback. Fix: initialize with `isLoading = true` when no cached snapshot exists (already fixed in the 2026-04-01 pass).

**How to apply:** Any new ViewModel that gates data loading on `authRepository.currentUserId` must also implement the SharedPreferences uid cache pattern so Room can be queried immediately on cold start. Never leave the screen with `isLoading = false` AND empty data simultaneously.

**Files changed (latest fix):**
- `TinyAct---Android/feature/goals/src/main/java/com/lokesh/tinyact/feature/goals/MyGoalsViewModel.kt` — added SharedPreferences uid cache, split `loadAll` into cached-uid fast-path + live-uid confirm path, added `onCleared` cleanup
- `TinyAct---Android/app/src/main/res/drawable/ic_launcher_foreground_inset.xml` — reverted insets from 25dp to 12dp
