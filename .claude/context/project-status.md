# Project Status — TinyAct

Last updated: 2026-06-19

---

## Active Branches

| Platform | Branch | Notes |
|---|---|---|
| iOS | `1.0.4` | microcommit (local repo) |
| Android | `1.0.1` | github.com/lokii49/TinyAct---Android |

Never commit directly to `main`. All squad work targets these branches.

---

## Platform Overview

| Platform | Language | UI | Local DB | DI |
|---|---|---|---|---|
| iOS | Swift | SwiftUI | SwiftData | — |
| Android | Kotlin | Jetpack Compose | Room | Hilt |
| Backend | TypeScript | — | — | — |

Both platforms share the same Firebase backend.

---

## Active Work Tracking

- `TinyAct---Android/todo.md` — current Android UI/UX and performance tasks
- `TinyAct---Android/checklist.md` — iOS/Android parity QA checklist
- `TinyAct---Android/audit-remediation-status.md` — security audit tracking
- `NOTES.md` — bugs and feature ideas (quick capture)

---

## Known Bugs

- **[Android] Splash screen dismisses too quickly** — `MainActivity.kt` missing `installSplashScreen()` call. Fix: call before `setContent`, hold with `setKeepOnScreenCondition` tied to auth loading state.

### Android Performance — Outstanding Critical Issues (from Sheldon audit 2026-04-02; issues 1, 2, 6 fixed 2026-04-03)

- **[Android] FeedScreen double-load on first composition** — `loadFeed()` called in both `LaunchedEffect(Unit)` (line 131) AND `ON_RESUME` observer (line 137-138), plus a 120s polling `LaunchedEffect` that runs even when screen is off-screen. `FeedScreen.kt`.
- **[Android] GroupRemoval notification double-queued** — `dismissAllGroupRemovalNotifications` (FirebaseActivityNotificationRepository.kt:91-107) enqueues each notification twice into the offline write queue (forEach loop at line 99 AND localIds.forEach at line 106).
- **[Android] MyGoalsViewModel N+1 streak reads** — `buildCard()` (MyGoalsViewModel.kt:483-486) calls `streakRepository.getUserStreak(uid)` once per commitment card in parallel async blocks. 5 commitments = 5 duplicate Firestore reads of the same streak document.
- **[Android] GroupDetailViewModel thundering herd** — `loadStreaks()` queries one streak doc per member via `whereArrayContains`. 5-member group = 5 queries × up to 20 docs each = up to 100 reads per group detail load. Worse: `collectCompletions()` (line 185-188) calls `loadStreaks()` on every Room Flow emission from background sync.
- **[Android] fetchAndCacheUserCompletions unbounded query** — `FirebaseCompletionRepository.kt:140` fetches ALL completions ever for a user with no `.limit()`. Unfixed (not in 2026-04-03 batch).

---

## Key Source Locations

```
iOS app:          microcommit/micro-commit/
iOS tests:        microcommit/TinyActTests/
Android app:      TinyAct---Android/
Cloud Functions:  microcommit/functions/src/
Notification agent: agent/
```
