# Autoresearch Changelog — SKILL.md (TinyAct Navigation Guide)

**Skill:** `.claude/commands/SKILL.md`
**Working copy:** `SKILL-optimized.md`
**Test inputs:** 5 scenarios (Android streak bug, iOS archive feature, partnership invite both platforms, Firebase function streak notifications, Android goals UI debug)
**Evals:** 6 binary checks (correct path, correct platform, correct layer, algorithm protocol, avoids broad search, specific enough)
**Max score per experiment:** 30 (5 runs × 6 evals)

---

## Experiment 0 — baseline

**Score:** 25/30 (83.3%)
**Change:** original skill — no changes
**Reasoning:** Establishing baseline before any mutations
**Result:** 4 evals failing, all in Run 3 (partnership invite) + Run 4 E6 (Firebase specificity)
**Failing outputs:**
- Run 3 (partnership invite both platforms): 4/6 evals fail — partnership invite screens absent from both feature tables, forcing a broad search
- Run 4 (Firebase streak notifications): E6 fails — `index.ts` listed but no function names, can't go directly to `onStreakUpdated`

---

## Experiment 1 — keep

**Score:** 29/30 (96.7%)
**Change:** Added `Invitations/InvitationsView.swift` + `InvitationsViewModel.swift` to iOS feature table; added `NotificationsScreen.kt` + `NotificationsViewModel.kt` and `PartnershipManagementScreen.kt` + `PartnershipManagementViewModel.kt` to Android feature table. Also corrected iOS Auth path from `Auth/` to `Authentication/`.
**Reasoning:** Run 3 was failing 4/6 evals because neither platform's feature table had any entry for invitations or partnership management screens. Adding them directly eliminates the need for any search.
**Result:** Run 3 jumped from 2/6 to 6/6. Total: 25→29. Only remaining failure: Run 4 E6.
**Failing outputs:** Run 4 — knows to look in `functions/src/index.ts` but can't pinpoint which function handles streak breaks without reading the whole file.

---

## Experiment 2 — keep

**Score:** 30/30 (100.0%)
**Change:** Added named function entry points under Firebase Cloud Functions section: `onStreakUpdated`, `onGroupInvitationCreated/Updated`, `onPartnershipInvitationCreated/Updated`, `sendSmartNudges`, `onCompletionCreated`, `onGroupUpdated`, `onGroupDeleted` — each with a brief description of what it handles.
**Reasoning:** Run 4 E6 failed because the skill said "look in index.ts" but didn't say which function. Naming all 9 functions with their purpose lets Claude jump directly to `onStreakUpdated` for streak notifications.
**Result:** Run 4 E6 now passes. 30/30 = 100%.
**Failing outputs:** None on test suite. One structural bug remains (see Experiment 3).

---

## Experiment 3 — keep (correctness fix, score unchanged)

**Score:** 30/30 (100.0%)
**Change:** Fixed iOS Goals / My Goals path from `Core/Presentation/Screens/Goals/MyGoalsView.swift` to `Core/Presentation/Screens/MyGoals/MyGoalsView.swift`. Also corrected ViewModel column from "same file" to `MyGoalsViewModel.swift` (it is in a separate file in that directory).
**Reasoning:** The original path was factually wrong — the actual directory is `MyGoals/`, not `Goals/`. The test suite doesn't include an iOS Goals task so this doesn't show in scores, but any real task touching the iOS goals screen would send Claude to a nonexistent path on the first try.
**Result:** Score unchanged (30/30) but the skill is now factually correct for the iOS Goals use case.
**Failing outputs:** None. Score ceiling hit. Stopping.
