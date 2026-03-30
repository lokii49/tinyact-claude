# Streak Rules — TinyAct

Source of truth: `Streakalgorithm.md` (product) + `algorithm-spec.md` (technical).
This is a quick-reference summary.

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

## Technical Details

**Day Key:** `year * 10000 + dayOfYear` (1-indexed, user's local IANA timezone)

**Grace period:** `gracePeriodHours` on the Commitment — window after midnight before a streak is considered broken. User can still check in during grace period and it counts for the previous day.

**Pause/Resume:** Complex — see `algorithm-spec.md` section on pause logic. Paused days are not counted as misses.

**Implementation files:**
- iOS: `Infrastructure/Services/StreakCalculationService.swift`
- Android: `core/domain/.../StreakCalculationService.kt`
- Firebase: `microcommit/functions/src/` (TypeScript)
- Tests: `AlgorithmParityTests.swift` + `AlgorithmParityTest.kt` (sacred — update vectors if algo changes)
