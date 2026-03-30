# Project Status — TinyAct

Last updated: 2026-03-29

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

---

## Key Source Locations

```
iOS app:          microcommit/micro-commit/
iOS tests:        microcommit/TinyActTests/
Android app:      TinyAct---Android/
Cloud Functions:  microcommit/functions/src/
Notification agent: agent/
```
