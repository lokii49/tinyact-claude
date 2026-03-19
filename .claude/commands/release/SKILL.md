# Release Audit & Alignment

## What this skill does
Runs all pre-release checks across iOS, Android, and Firebase — streak algorithm correctness, platform parity, security audit status, build integrity, and branch verification — before any release is pushed.

## Pre-release checklist

Work through each step in order. A release must NOT proceed if any step fails.

---

### Step 1: Run streak audit
Execute the `/streaks` skill. Verify:
- No `MERCY_DAYS_PER_MONTH`, `gracePeriodHours`, `isInGracePeriod`, or `graceHoursRemaining` anywhere
- `isBroken`, `hoursUntilBreak`, `isAboutToBreak` logic is identical on iOS and Android
- Stale mercy-day comment at line 18 of `StreakCalculationService.swift` is removed

File to open first: `/Users/lokeshpudhari/TinyAct/microcommit/micro-commit/Infrastructure/Services/StreakCalculationService.swift`

---

### Step 2: Run parity audit
Execute the `/parity` skill. Read `TinyAct---Android/checklist.md` and verify there are no unchecked items for features that are shipping in this release. Flag any item marked as incomplete.

File to open first: `/Users/lokeshpudhari/TinyAct/TinyAct---Android/checklist.md`

---

### Step 3: Verify algorithm test vectors pass on both platforms
Check that both test suites exist and are passing:

**iOS**: `/Users/lokeshpudhari/TinyAct/microcommit/TinyActTests/StreakTests.swift`
- Run: open `microcommit/micro-commit.xcodeproj` then Cmd+U, or `xcodebuild test -project microcommit/micro-commit.xcodeproj -scheme micro-commit`
- Must contain tests that exercise `isBroken`, `hoursUntilBreak`, `isAboutToBreak` with explicit date injection

**Android**: Look for `AlgorithmParityTest.kt` under `TinyAct---Android/` (search under any module's `test/` directory)
- Run: `cd TinyAct---Android && ./gradlew test`
- Must contain equivalent test cases

If `shared/test-vectors/streak-vectors.json` exists, verify it has not had test cases removed — check git history if needed.

---

### Step 4: Scan for banned grace period / mercy day code
Run a search across the entire codebase for these exact strings. Any hit is a blocker:

Banned terms:
- `MERCY_DAYS_PER_MONTH`
- `gracePeriodHours`
- `isInGracePeriod`
- `graceHoursRemaining`
- `allowedMissedDays`
- `mercy` (case-insensitive in comments that describe implementation, not just removed code)

Search in:
- All `.swift` files under `/Users/lokeshpudhari/TinyAct/microcommit/`
- All `.kt` files under `/Users/lokeshpudhari/TinyAct/TinyAct---Android/`
- All `.ts` files under `/Users/lokeshpudhari/TinyAct/microcommit/functions/`

---

### Step 5: Verify streak-vectors.json has no removed test cases
If `/Users/lokeshpudhari/TinyAct/shared/test-vectors/streak-vectors.json` exists:
- Open it and count the test vector entries
- Compare count against the previous known count (check with git: `git log --oneline -- shared/test-vectors/streak-vectors.json`)
- A decrease in test vector count without a corresponding deprecation note is a blocker

---

### Step 6: Build integrity check — search for removed properties
Search for references to any properties that were recently removed (e.g., `gracePeriodHours`, `MERCY_DAYS_PER_MONTH`) to catch places where old code still compiles but produces wrong behavior:
- Build iOS: `xcodebuild build -project microcommit/micro-commit.xcodeproj -scheme micro-commit` — must succeed with 0 errors
- Build Android: `cd TinyAct---Android && ./gradlew assembleDebug` — must succeed with 0 errors

---

### Step 7: Firebase functions — verify deployment is current
From `/Users/lokeshpudhari/TinyAct/microcommit/functions/`:
```bash
npm run build
```
Must complete with 0 TypeScript errors.

Then verify the deployed version is current. Check the last deploy timestamp by running:
```bash
firebase functions:list
```
If the local source has changes not yet deployed, run:
```bash
npm run deploy
```

Confirm these four functions are deployed and active:
1. Group invitation function
2. Partnership invitation function
3. Streak break alert function
4. User removal notification function

---

### Step 8: Check security audit status
Read `/Users/lokeshpudhari/TinyAct/TinyAct---Android/audit-remediation-status.md`.

Any item marked as:
- `OPEN` or `IN PROGRESS` with HIGH severity: **blocker** — do not release
- `OPEN` with MEDIUM severity: document and decide deliberately
- `CLOSED` or `RESOLVED`: pass

---

### Step 9: Check todo.md for critical pending items
Read `/Users/lokeshpudhari/TinyAct/TinyAct---Android/todo.md`.

Look for any item marked as `CRITICAL`, `BLOCKING`, or tagged with the current release version. These must be resolved before release. Other items may be deferred.

---

### Step 10: iOS branch — must be on 1.0.3
Verify the iOS app is on the `1.0.3` branch, not `main`:
```bash
cd /Users/lokeshpudhari/TinyAct && git branch --show-current
```
If on `main`, the iOS release must be pushed to `1.0.3` branch:
```bash
git checkout 1.0.3
# or if branch doesn't exist:
git checkout -b 1.0.3
git push origin 1.0.3
```

Do NOT push iOS release changes to `main`.

---

### Step 11: Android branch — push to main
Android releases go to `main`. Verify the Android changes are committed and pushed:
```bash
cd /Users/lokeshpudhari/TinyAct && git status
git push origin main
```

---

## Release blockers (any of these = do not release)

1. Any banned grace period / mercy day term found in source
2. Streak test suite failing on either platform
3. iOS build fails with errors
4. Android build fails with errors
5. Firebase functions have TypeScript errors or are not deployed
6. Security audit has open HIGH severity items
7. iOS is not on branch `1.0.3`
8. Parity checklist has unchecked items for features shipping in this release
9. streak-vectors.json has fewer test cases than the previous release

---

## Files to check (in order)

1. `/Users/lokeshpudhari/TinyAct/TinyAct---Android/checklist.md`
2. `/Users/lokeshpudhari/TinyAct/TinyAct---Android/audit-remediation-status.md`
3. `/Users/lokeshpudhari/TinyAct/TinyAct---Android/todo.md`
4. `/Users/lokeshpudhari/TinyAct/microcommit/micro-commit/Infrastructure/Services/StreakCalculationService.swift`
5. `/Users/lokeshpudhari/TinyAct/TinyAct---Android/core/domain/src/main/java/com/lokesh/tinyact/core/domain/service/StreakCalculationService.kt`
6. `/Users/lokeshpudhari/TinyAct/microcommit/functions/src/algorithms/streakCalculation.ts`
7. `/Users/lokeshpudhari/TinyAct/shared/test-vectors/streak-vectors.json` (if present)
8. `/Users/lokeshpudhari/TinyAct/microcommit/TinyActTests/StreakTests.swift`
9. iOS: AlgorithmParityTests.swift (search under `TinyActTests/`)
10. Android: AlgorithmParityTest.kt (search under any `test/` directory in the Android project)

---

## Sub-skills to invoke during release

Run each of these in sequence before declaring a release ready:
- `/streaks` — algorithm audit
- `/commitments` — lifecycle audit
- `/check-ins` — check-in and encryption audit
- `/groups` — group membership and cascade audit
- `/auth` — SHA-1 and sign-out audit
- `/notifications` — server vs client boundary audit
- `/sync` — offline-first audit
- `/awards` — XP and award parity audit
- `/parity` — full cross-platform parity audit
