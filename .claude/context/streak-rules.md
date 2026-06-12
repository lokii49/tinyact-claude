# Streak Rules — TinyAct

Source of truth: `Streakalgorithm.md` (product) + `algorithm-spec.md` (technical).
This is a quick-reference summary.

---

## No Mercy Rule

Any missed day (not paused) **immediately resets** the streak to 0. There are no grace days — the streak breaks at the start of the day after the missed day.

---

## Solo Commitments

- Check-in done → streak +1
- Missed → streak resets to 0. Next check-in = streak of 1.
- **Renew** → streak, check-in count, total check-ins all reset to 0 (fresh start)
- **Extend** → streak continues, nothing resets

---

## Groups — "All In" (accountable, `accountabilityType: allIn`)

- ALL current members must check in → streak +1 for everyone
- Any member misses → everyone's streak resets to 0
- **Renew** → all counts reset to 0
- **Extend** → streak continues based on all-member check-ins
- Member leaves/removed → streak continues with remaining members (their history unaffected)

---

## Groups — Individual (`accountabilityType: individual`)

- Each person's streak is independent of others
- Check-in done → that person's streak +1
- Missed → that person's streak resets to 0
- Member leaves/removed → zero impact on other members' streaks
- **Renew/Extend** → same rules as Solo applied per individual

---

## Partnership Lifecycle

- **Created mid-stream:** Each user's existing solo streak carries over. From partnership creation onwards both must check in together. If either breaks, both reset to 0.
- **Partnership ended:** Both users continue independently from their current streak count. Each user's streak depends only on their own check-ins from that point.
- **Partner removed:** Remaining user continues solo from current streak count.

---

## User-Level Streak Outcome (after every check-in)

`computeUserStreakOutcome` updates `currentStreak`/`longestStreak` on the User:

1. **No prior check-ins** (`lastCheckInDate == null`): `currentStreak = 1`, not a comeback.
2. **Same day** as last check-in: no change to counters.
3. **Consecutive day** (yesterday): `currentStreak += 1`.
4. **Gap of 2 days**: `currentStreak = 1`, not a comeback (< 3 day gap doesn't qualify).
5. **Gap of 3+ days** with prior check-ins: `currentStreak = 1`, `isComeback = true` → increments `comebackCount`.

`longestStreak` is always `max(longestStreak, newCurrentStreak)`.

---

## Technical Details

**Day Key:** `year * 10000 + dayOfYear` (1-indexed, user's local IANA timezone)

**Grace period:** `gracePeriodHours` on the Commitment — window after midnight before a streak is considered broken. User can still check in during grace period and it counts for the previous day.
<!-- GAP: investigate — algorithm-spec.md §4 says "There is no grace period — a streak breaks at the start of the day after the missed day", but the Commitment model carries gracePeriodHours. This field may be enforced by mobile client logic not captured in the canonical algorithm spec. Verify against StreakCalculationService.swift / .kt when mobile repos are available. -->

**Pause/Resume:** Complex — see `algorithm-spec.md` section on pause logic. Paused days are not counted as misses.

**Implementation files:**
- iOS: `Infrastructure/Services/StreakCalculationService.swift`
- Android: `core/domain/.../StreakCalculationService.kt`
- Firebase: `microcommit/functions/src/` (TypeScript)
- Tests: `AlgorithmParityTests.swift` + `AlgorithmParityTest.kt` (sacred — update vectors if algo changes)
