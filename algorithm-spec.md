# TinyAct Algorithm Specification

> This is the canonical ground-truth document for all business logic shared between
> the iOS (Swift) and Android (Kotlin) implementations. **`Streakalgorithm.md` is the
> product source of truth; this document translates it into precise technical rules.**
> When there is a discrepancy between this spec and a platform implementation,
> the **platform must be updated**.

---

## 1. Day Key Definition

A **day key** is a timezone-aware integer that uniquely identifies a calendar day:

```
dayKey = year * 10000 + dayOfYear
```

- `year` — calendar year (e.g. 2025)
- `dayOfYear` — 1-indexed day within the year (1–365 or 1–366 on leap years)
- Computed in the **user's local timezone** (IANA identifier stored on User)
- For server-side canonical TypeScript: accepts an IANA `tzIdentifier` parameter (default `UTC`)

**Example:** `2025-02-19` → day 50 of 2025 → key `20250050`

---

## 2. Streak Calculation

### 2.1 Shared Rules

- One completion per calendar day (duplicates are de-duplicated by day key).
- Walk **backwards** from today/yesterday, counting consecutive "active" days.
- A day that is neither completed nor paused **immediately breaks** the streak — no mercy.
- If neither today nor yesterday has a valid starting day, streak = 0.
- **No mercy days** — any missed day resets the streak to 0.

### 2.2 Solo Streak (`calculateStreak`)

If the user misses a day their streak resets to 0. On their next check-in the streak starts at 1.

**Parameters:**
- `completions: CompletionInput[]`
- `pausedDayKeys: Set<number>`  — days that are paused (see §4)
- `nowSeconds: number`          — current time (Unix seconds)
- `breakDateSeconds?: number`   — completions on or before this date are ignored
- `tzIdentifier?: string`       — IANA timezone (default `UTC`)

### 2.3 Partnership Streak (`calculatePartnershipStreak`)

- Compute the **intersection** of both users' completion day keys.
- Walk backwards; any day where either partner did not complete breaks the streak immediately.
- Paused days are skipped.

### 2.4 Group Accountability Streak (`calculateGroupAccountabilityStreak`)

- Compute the **intersection** of ALL members' completion day keys.
- Any member missing a day breaks the entire group's streak immediately (resets to 0).
- When a member leaves or is removed from the group, the streak recalculates using only
  the remaining members' completions.
- No paused days concept for group streaks.

### 2.5 Non-Accountability Group (Individual Streaks)

In groups without the "accountability" setting, each member's streak is calculated
**independently** using solo rules (`calculateStreak` per user). A member leaving or being
removed has no impact on other members' streaks.

### 2.6 Partnership Lifecycle

- **Partnership created mid-stream**: Each user's existing individual streak carries over. From
  the partnership creation date onwards, both users must complete to advance the shared streak.
  If either breaks, both reset to 0.
- **Partnership ended**: Both users continue with their current streak count independently.
  From that point, each user's streak depends only on their own check-ins.
- **Partner removed**: The remaining user continues with the current streak count and their
  streak becomes solo-based from that point.

---

## 3. Pause / Resume Semantics

A streak can be paused by a user for a specific reason (illness, travel, etc.).

- `isPaused` flag is set to `true`.
- `pausedAt` records the start of the pause.
- `pauseResumeDate` (optional): streak auto-resumes on this date.
- **Paused days** = every day from `startOfDay(pausedAt)` up to (not including)
  `startOfDay(pauseResumeDate)` — or up to today if still paused.
- Paused days are **skipped** during streak counting (neither break nor count).
- A **paused** streak is never broken regardless of elapsed time.

### `breakDate` Parameter (Renew)

The `breakDate` is an optional timestamp set when a commitment is **renewed**.
Any completion on or before this date is ignored for streak purposes — the streak
effectively restarts from 0 after renewal. On **extend**, no `breakDate` is set and
the streak continues from existing completions.

---

## 4. Streak Broken State

A streak is considered **broken** when:
- The streak is not paused, AND
- The last completion was **before yesterday** (i.e., more than one calendar day has
  passed without a check-in)

```
isBroken = !isPaused
         AND lastCompletionDate != null
         AND startOfDay(lastCompletionDate) < startOfDay(today) - 86400
```

There is **no grace period** — a streak breaks at the start of the day after the missed day.

---

## 5. User-Level Streak Outcome

`computeUserStreakOutcome` is called after every check-in to update the user's
personal streak counters (`currentStreak`, `longestStreak`).

**Rules:**
1. **No prior check-ins** (`lastCheckInDate == null`): `currentStreak = 1`, `isComeback = false`.
2. **Same day** as last check-in: no change, `shouldUpdateLastCheckInDate = false`.
3. **Consecutive day** (yesterday): `currentStreak += 1`, `isComeback = false`.
4. **Gap of 2 days**: `currentStreak = 1`, `isComeback = false` (gap < 3 doesn't qualify).
5. **Gap of 3+ days** with prior check-ins (`totalCheckIns > 0`): `currentStreak = 1`, `isComeback = true`.

`longestStreak` is always `max(longestStreak, newCurrentStreak)`.

---

## 6. Award Eligibility

`computeEligibleAwards` receives the **post-increment** user state (totalCheckIns,
totalPhotoProofs, totalHonorCheckIns, comebackCount already updated) and returns
only awards not already in `earnedAwardTypes`.

### 6.1 Streak Milestones

| Award | Condition |
|---|---|
| `firstStep` | `totalCheckIns >= 1` |
| `weeklyWarrior` | `streakNow >= 7` |
| `habitFormed` | `streakNow >= 21` |
| `monthlyMaster` | `streakNow >= 30` |
| `centuryClub` | `streakNow >= 100` |
| `yearStrong` | `streakNow >= 365` |

### 6.2 Comeback Awards

| Award | Condition |
|---|---|
| `phoenixRising` | `isComeback == true AND isFirstCheckInEver == false` |
| `secondWind` | `comebackCount >= 2` (checked unconditionally) |
| `neverGiveUp` | `comebackCount >= 5` (checked unconditionally) |

`isFirstCheckInEver` = `totalCheckIns` was 0 **before** the current check-in increment.

### 6.3 Consistency Awards

| Award | Condition |
|---|---|
| `earlyBird` | `completionHour < 7 AND totalCheckIns >= 7` |
| `nightOwl` | `completionHour >= 21 AND totalCheckIns >= 7` |
| `perfectWeek` | `streakNow >= 7` |
| `perfectMonth` | `streakNow >= 30` |

`completionHour` is 0–23 in the user's local timezone.

### 6.4 Social Awards

| Award | Condition |
|---|---|
| `teamPlayer` | `groupID != "solo"` |
| `cheerleader` | `reactionsGiven >= 10` |
| `popular` | `reactionsReceived >= 50` |

### 6.5 Proof Awards

| Award | Condition |
|---|---|
| `photographer` | `totalPhotoProofs >= 10` |
| `honestAbe` | `totalHonorCheckIns >= 30` |

---

## 7. XP / Level System

### 7.1 Daily XP

| Event | XP |
|---|---|
| Daily check-in | 2 |
| Photo proof bonus | +1 |
| Reaction given | 1 |

### 7.2 Award XP

| Award | XP |
|---|---|
| `firstStep` | 10 |
| `weeklyWarrior` | 25 |
| `habitFormed` | 50 |
| `monthlyMaster` | 75 |
| `centuryClub` | 150 |
| `yearStrong` | 500 |
| `phoenixRising` | 30 |
| `secondWind` | 40 |
| `neverGiveUp` | 60 |
| `perfectWeek` | 25 |
| `perfectMonth` | 100 |
| `earlyBird` | 20 |
| `nightOwl` | 20 |
| `teamPlayer` | 15 |
| `cheerleader` | 25 |
| `popular` | 50 |
| `photographer` | 30 |
| `honestAbe` | 30 |

### 7.3 Level Thresholds

| Level | Min XP | Max XP |
|---|---|---|
| Starter | 0 | 49 |
| Committed | 50 | 149 |
| Dedicated | 150 | 349 |
| Master | 350 | 699 |
| Legend | 700 | ∞ |

---

## 8. Long-Term Maintenance (Autoresearch Loop)

When adding a new algorithm feature:

1. Update `Streakalgorithm.md` first (write the product intent)
2. Update this `algorithm-spec.md` (translate intent into precise rules)
3. Update canonical TypeScript in `microcommit/functions/src/algorithms/`
4. Regenerate vectors: `ts-node scripts/generateTestVectors.ts`
5. Verify: `ts-node scripts/algorithmCheck.ts` — must print `Pass rate: 100.0%`
6. Update Swift/Kotlin implementations to match
7. Platform parity tests (`AlgorithmParityTests.swift`, `AlgorithmParityTest.kt`) will
   fail until platforms are updated — fix them before merging

PRs that reduce `algorithmCheck.ts` pass rate below 100% are blocked.
