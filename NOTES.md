# TinyAct — Notes, Bugs & Feature Ideas

Quick capture log. Updated by AI assistant during conversations.

---

## 🐛 Bugs

### [Android] Splash screen dismisses too quickly
- **Observed:** Splash screen duration feels very short on Android compared to iOS
- **Root cause:** `MainActivity.onCreate()` has no `installSplashScreen()` call. Android 12+ Splash Screen API requires this — without it, the splash dismisses at the minimum cold-start render time with no condition to hold it.
- **Fix:** Call `installSplashScreen()` before `setContent` in `MainActivity`, then use `setKeepOnScreenCondition { }` tied to auth loading state so splash stays visible until Firebase Auth resolves the current user.
- **File:** `TinyAct---Android/app/src/main/java/com/lokesh/Tinyact/MainActivity.kt`

---

## 💡 Feature Ideas

_(none yet)_

---

## 🔍 Observations / Other

_(none yet)_

---
