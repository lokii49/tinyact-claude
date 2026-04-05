# Project Status — TinyAct

Last updated: 2026-04-05

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

- `TinyAct---Android/checklist.md` — iOS/Android parity QA checklist (manual QA verification of all scenarios; implementation coverage is in place per Feb 28 status update)
- `NOTES.md` — bugs and feature ideas (quick capture)

Note: `TinyAct---Android/todo.md` and `TinyAct---Android/audit-remediation-status.md` are referenced in CLAUDE.md but do not currently exist on disk.

---

## Known Bugs

- **[Android] Splash screen dismisses too quickly** — `MainActivity.kt` missing `installSplashScreen()` call. Fix: call before `setContent`, hold with `setKeepOnScreenCondition` tied to auth loading state.

- **[Android] 6-issue diagnosis complete (Apr 2026)** — Root causes for 6 Android issues identified by squad (Sheldon + Ross). Ready for fix phase. See memory: `android_diagnosis_2026_04_03.md`.

---

## Key Source Locations

```
iOS app:          microcommit/micro-commit/
iOS tests:        microcommit/TinyActTests/
Android app:      TinyAct---Android/
Cloud Functions:  microcommit/functions/src/
Notification agent: agent/
```
