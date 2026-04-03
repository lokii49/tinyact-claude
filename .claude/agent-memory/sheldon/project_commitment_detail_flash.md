---
name: CommitmentDetailScreen derived-field flash — full history
description: Two rounds of fixes for split-second zero-state flash on CommitmentDetailScreen. Stage 1a/1b sequencing was the root cause.
type: project
---

## Round 1 fix (2026-04-01) — missing derived fields in Stage 1b

Stage 1b's `_uiState.update` populated completions-based fields but left `remainingDays`, `totalDays`, and `progress` at default values (null/0/0f). Extended Stage 1b to compute those from `localCommitment` date fields. All derived fields populated in one atomic update from Room.

## Round 2 fix (2026-04-01) — Stage 1a set isLoading = false too early

**Root cause:** Stage 1a set `isLoading = false` with only `commitment` populated. Stage 1b then ran sequentially, arriving ~20-50ms later with `totalCheckins`, `hasCheckedInToday`, `streakDays`, `progress`. Because `isLoading` was already false, the screen rendered immediately with zero-defaults on all those fields.

**Fix applied (Option B):**
1. Stage 1a now sets `isLoading = true` (not false) — commitment is stored but spinner stays.
2. Stage 1b's `_uiState.update` includes `isLoading = false` — one atomic update clears spinner with all fields populated.
3. Added `else` branch in Stage 1b for the zero-completions case (brand-new commitment): computes commitment-only date fields and sets `isLoading = false` so the screen doesn't hang.
4. Both spinner guards in `CommitmentDetailScreen.kt` changed from `isLoading && commitment == null` to just `isLoading`.

**Files changed:**
- `TinyAct---Android/feature/goals/src/main/java/com/lokesh/tinyact/feature/goals/CommitmentDetailViewModel.kt`
- `TinyAct---Android/feature/goals/src/main/java/com/lokesh/tinyact/feature/goals/CommitmentDetailScreen.kt`

**Why:** Stage 1a and Stage 1b are semantically one operation — "load cached state from Room". Splitting them into two separate `isLoading = false` transitions was always wrong. The spinner should clear exactly once, after all Room data is in place.

**How to apply:** Any time you see a multi-stage local cache load, `isLoading = false` must only appear in the LAST stage's update. Never set it early to "paint something" — you will paint wrong data.
