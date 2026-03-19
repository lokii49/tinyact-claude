/**
 * generateTestVectors.ts
 * Run: ts-node --project microcommit/functions/tsconfig.json scripts/generateTestVectors.ts
 *
 * Produces three JSON files in shared/test-vectors/ by running the canonical
 * TypeScript algorithms against pre-defined input scenarios. The output JSON
 * becomes the source of truth that iOS and Android parity tests load.
 *
 * Philosophy (autoresearch-inspired):
 *   Scenarios define INPUTS. Canonical TS computes EXPECTED OUTPUTS.
 *   Regenerate whenever canonical TS changes; platform tests must still pass.
 */

import * as fs from "fs";
import * as path from "path";

import {
  calculateStreak,
  calculatePartnershipStreak,
  calculateGroupAccountabilityStreak,
  getPausedDayKeys,
  computeStreakObjectProperties,
  computeUserStreakOutcome,
} from "../microcommit/functions/src/algorithms/streakCalculation";
import { computeEligibleAwards } from "../microcommit/functions/src/algorithms/awardLogic";
import {
  levelFromXP,
  progressToNextLevel,
  xpToNextLevel,
} from "../microcommit/functions/src/algorithms/xpLeveling";
import {
  CompletionInput,
  StreakInput,
  UserInput,
} from "../microcommit/functions/src/algorithms/types";

// ---------------------------------------------------------------------------
// Reference timestamps (all UTC midnight)
// 2025-02-19 = day 50, Unix = 1739923200
// ---------------------------------------------------------------------------
const D19 = 1739923200; // Feb 19 midnight UTC (nowSeconds reference)
const D18 = 1739836800; // Feb 18
const D17 = 1739750400; // Feb 17
const D16 = 1739664000; // Feb 16
const D15 = 1739577600; // Feb 15
const D14 = 1739491200; // Feb 14
const D13 = 1739404800; // Feb 13
const D12 = 1739318400; // Feb 12

const TZ = "UTC";
const NOW = D19;

function mkComp(ts: number, uid = "u1"): CompletionInput {
  return { timestampSeconds: ts, userID: uid };
}

function mkStreak(overrides: Partial<StreakInput> = {}): StreakInput {
  return {
    id: "s1",
    userIDs: ["u1"],
    isPaused: false,
    pausedAtSeconds: null,
    pauseResumeDateSeconds: null,
    currentStreak: 5,
    longestStreak: 10,
    lastCompletionDateSeconds: D18,
    ...overrides,
  };
}

function mkUser(overrides: Partial<UserInput> = {}): UserInput {
  return {
    id: "u1",
    totalCheckIns: 1,
    totalPhotoProofs: 0,
    totalHonorCheckIns: 0,
    reactionsGiven: 0,
    reactionsReceived: 0,
    comebackCount: 0,
    earnedAwardTypes: [],
    currentStreak: 1,
    longestStreak: 1,
    lastCheckInDateSeconds: null,
    timezone: TZ,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Streak vectors
// ---------------------------------------------------------------------------
interface StreakVector {
  id: string;
  description: string;
  scenario: string;
  subtype: string;
  input: Record<string, unknown>;
  expected: Record<string, unknown>;
}

function buildStreakVectors(): StreakVector[] {
  const vectors: StreakVector[] = [];

  // Helper for solo streak vectors
  const soloVec = (
    id: string,
    desc: string,
    completions: CompletionInput[],
    pausedDaySeconds: number[],
    breakDateSeconds: number | null,
    nowSeconds: number
  ): StreakVector => {
    const pausedSet =
      pausedDaySeconds.length > 0
        ? new Set(
            pausedDaySeconds.map((ts) => {
              const s = mkStreak({
                isPaused: true,
                pausedAtSeconds: ts,
                pauseResumeDateSeconds: null,
              });
              return getPausedDayKeys(s, nowSeconds, TZ);
            })
          )
        : new Set<number>();
    // Build pausedDayKeys from individual day timestamps
    const flatPausedKeys = new Set<number>();
    for (const ts of pausedDaySeconds) {
      // Each ts is already a full-day start; compute its key
      const dummyStreak = mkStreak({
        isPaused: true,
        pausedAtSeconds: ts,
        pauseResumeDateSeconds: ts + 86400, // one day pause
      });
      for (const k of getPausedDayKeys(dummyStreak, nowSeconds + 86400, TZ)) {
        flatPausedKeys.add(k);
      }
    }
    const count = calculateStreak(
      completions,
      flatPausedKeys,
      nowSeconds,
      breakDateSeconds,
      TZ
    );
    return {
      id,
      description: desc,
      scenario: "solo",
      subtype: "count",
      input: {
        completions,
        pausedDaySeconds,
        breakDateSeconds,
        nowSeconds,
        tzIdentifier: TZ,
      },
      expected: { streakCount: count },
    };
  };

  vectors.push(
    soloVec(
      "solo-no-completions",
      "No completions → streak is 0",
      [],
      [],
      null,
      NOW
    )
  );

  vectors.push(
    soloVec(
      "solo-basic-3day",
      "Three consecutive days ending today",
      [mkComp(D17), mkComp(D18), mkComp(D19)],
      [],
      null,
      NOW
    )
  );

  vectors.push(
    soloVec(
      "solo-yesterday-start",
      "Only yesterday completion: streak = 1",
      [mkComp(D18)],
      [],
      null,
      NOW
    )
  );

  vectors.push(
    soloVec(
      "solo-missed-day-breaks",
      "Feb 18 missed: streak starts over from today (day 1), no mercy",
      [mkComp(D14), mkComp(D15), mkComp(D16), mkComp(D17), mkComp(D19)],
      [],
      null,
      NOW
    )
  );

  vectors.push(
    soloVec(
      "solo-paused-days",
      "Feb 17-18 are paused: streak counts completions before pause",
      [mkComp(D14), mkComp(D15), mkComp(D16), mkComp(D19)],
      [D17, D18],
      null,
      NOW
    )
  );

  vectors.push(
    soloVec(
      "solo-breakdate",
      "Completions before breakDate (Feb 16) are filtered out",
      [mkComp(D12), mkComp(D13), mkComp(D17), mkComp(D18), mkComp(D19)],
      [],
      D16,
      NOW
    )
  );

  vectors.push(
    soloVec(
      "solo-not-today-or-yesterday",
      "Last completion was 3 days ago: streak = 0",
      [mkComp(D12), mkComp(D13), mkComp(D16)],
      [],
      null,
      NOW
    )
  );

  // Partnership streak vectors
  const partnershipVec = (
    id: string,
    desc: string,
    userComps: CompletionInput[],
    partnerComps: CompletionInput[],
    pausedDayKeys: Set<number>,
    nowSeconds: number
  ): StreakVector => {
    const count = calculatePartnershipStreak(
      userComps,
      partnerComps,
      pausedDayKeys,
      nowSeconds,
      TZ
    );
    return {
      id,
      description: desc,
      scenario: "partnership",
      subtype: "partnership-count",
      input: {
        userCompletions: userComps,
        partnerCompletions: partnerComps,
        pausedDaySeconds: [],
        nowSeconds,
        tzIdentifier: TZ,
      },
      expected: { streakCount: count },
    };
  };

  vectors.push(
    partnershipVec(
      "partnership-both-complete",
      "Both users complete same 3 days",
      [mkComp(D17), mkComp(D18), mkComp(D19)],
      [mkComp(D17), mkComp(D18), mkComp(D19)],
      new Set(),
      NOW
    )
  );

  vectors.push(
    partnershipVec(
      "partnership-one-misses",
      "u2 misses Feb 17: intersection breaks, streak = 2 (only Feb 18+19 in both)",
      [mkComp(D14), mkComp(D15), mkComp(D16), mkComp(D17), mkComp(D18), mkComp(D19)],
      [mkComp(D14), mkComp(D15), mkComp(D16), mkComp(D18), mkComp(D19)],
      new Set(),
      NOW
    )
  );

  vectors.push(
    partnershipVec(
      "partnership-missed-breaks",
      "Both miss Feb 17: partnership streak breaks to 2 (no mercy)",
      [mkComp(D14), mkComp(D15), mkComp(D16), mkComp(D18), mkComp(D19)],
      [mkComp(D14), mkComp(D15), mkComp(D16), mkComp(D18), mkComp(D19)],
      new Set(),
      NOW
    )
  );

  vectors.push(
    partnershipVec(
      "partnership-user-only",
      "Only user has completions, partner has none: streak = 0",
      [mkComp(D17), mkComp(D18), mkComp(D19)],
      [],
      new Set(),
      NOW
    )
  );

  // Group accountability vectors
  const groupVec = (
    id: string,
    desc: string,
    memberComps: Record<string, CompletionInput[]>,
    nowSeconds: number
  ): StreakVector => {
    const count = calculateGroupAccountabilityStreak(
      memberComps,
      nowSeconds,
      TZ
    );
    return {
      id,
      description: desc,
      scenario: "group",
      subtype: "group-count",
      input: { memberCompletions: memberComps, nowSeconds, tzIdentifier: TZ },
      expected: { streakCount: count },
    };
  };

  vectors.push(
    groupVec(
      "group-all-complete",
      "All 3 members complete same 3 days",
      {
        u1: [mkComp(D17, "u1"), mkComp(D18, "u1"), mkComp(D19, "u1")],
        u2: [mkComp(D17, "u2"), mkComp(D18, "u2"), mkComp(D19, "u2")],
        u3: [mkComp(D17, "u3"), mkComp(D18, "u3"), mkComp(D19, "u3")],
      },
      NOW
    )
  );

  vectors.push(
    groupVec(
      "group-one-misses",
      "Member u3 misses Feb 17: group streak limited to 2 (no mercy for groups)",
      {
        u1: [mkComp(D17, "u1"), mkComp(D18, "u1"), mkComp(D19, "u1")],
        u2: [mkComp(D17, "u2"), mkComp(D18, "u2"), mkComp(D19, "u2")],
        u3: [mkComp(D18, "u3"), mkComp(D19, "u3")],
      },
      NOW
    )
  );

  vectors.push(
    groupVec(
      "group-missed-day-breaks",
      "All members miss Feb 17: group streak breaks to 2 (same as solo — no mercy for anyone)",
      {
        u1: [mkComp(D14, "u1"), mkComp(D15, "u1"), mkComp(D16, "u1"), mkComp(D18, "u1"), mkComp(D19, "u1")],
        u2: [mkComp(D14, "u2"), mkComp(D15, "u2"), mkComp(D16, "u2"), mkComp(D18, "u2"), mkComp(D19, "u2")],
      },
      NOW
    )
  );

  // Streak object properties
  const streakObjVec = (
    id: string,
    desc: string,
    streak: StreakInput,
    nowSeconds: number
  ): StreakVector => {
    const result = computeStreakObjectProperties(streak, nowSeconds, TZ);
    return {
      id,
      description: desc,
      scenario: "streak-object",
      subtype: "streak-object",
      input: { streak, nowSeconds, tzIdentifier: TZ },
      expected: result,
    };
  };

  // Broken: lastCompletion=Feb15, now=Feb19 — more than 1 day ago
  vectors.push(
    streakObjVec(
      "streak-obj-broken",
      "Last completion Feb 15: grace expired by Feb 19",
      mkStreak({ lastCompletionDateSeconds: D15 }),
      NOW
    )
  );

  // Normal: last completion yesterday, now = today. Not broken, not in grace
  vectors.push(
    streakObjVec(
      "streak-obj-normal",
      "Last completion yesterday (Feb 18), today is Feb 19 — active streak",
      mkStreak({ lastCompletionDateSeconds: D18 }),
      NOW
    )
  );

  // Paused
  vectors.push(
    streakObjVec(
      "streak-obj-paused",
      "Streak is paused — never broken regardless of dates",
      mkStreak({ isPaused: true, pausedAtSeconds: D16 }),
      NOW
    )
  );

  // No last completion
  vectors.push(
    streakObjVec(
      "streak-obj-no-completions",
      "No lastCompletionDate stored — fresh streak",
      mkStreak({ lastCompletionDateSeconds: null, currentStreak: 0 }),
      NOW
    )
  );

  // User streak outcome
  const userOutcomeVec = (
    id: string,
    desc: string,
    user: UserInput,
    completionTs: number,
    nowSeconds: number
  ): StreakVector => {
    const result = computeUserStreakOutcome(user, completionTs, TZ, nowSeconds);
    return {
      id,
      description: desc,
      scenario: "user-outcome",
      subtype: "user-outcome",
      input: {
        user,
        completionTimestampSeconds: completionTs,
        tzIdentifier: TZ,
        nowSeconds,
      },
      expected: result,
    };
  };

  const noonFeb19 = D19 + 43200;

  vectors.push(
    userOutcomeVec(
      "user-outcome-first",
      "First check-in ever: starts streak at 1, no comeback",
      mkUser({ lastCheckInDateSeconds: null, totalCheckIns: 0, currentStreak: 0, longestStreak: 0 }),
      noonFeb19,
      NOW
    )
  );

  vectors.push(
    userOutcomeVec(
      "user-outcome-consecutive",
      "Last check-in yesterday: increments streak",
      mkUser({
        lastCheckInDateSeconds: D18 + 43200,
        totalCheckIns: 5,
        currentStreak: 5,
        longestStreak: 10,
      }),
      noonFeb19,
      NOW
    )
  );

  vectors.push(
    userOutcomeVec(
      "user-outcome-comeback",
      "Last check-in 5 days ago with prior check-ins: comeback",
      mkUser({
        lastCheckInDateSeconds: D14 + 43200,
        totalCheckIns: 10,
        currentStreak: 0,
        longestStreak: 7,
      }),
      noonFeb19,
      NOW
    )
  );

  vectors.push(
    userOutcomeVec(
      "user-outcome-same-day",
      "Already checked in today: no streak update",
      mkUser({
        lastCheckInDateSeconds: D19 + 7200, // 2am today
        totalCheckIns: 5,
        currentStreak: 5,
        longestStreak: 5,
      }),
      noonFeb19,
      NOW
    )
  );

  vectors.push(
    userOutcomeVec(
      "user-outcome-2day-gap",
      "Last check-in 2 days ago (not ≥3): reset streak, not a comeback",
      mkUser({
        lastCheckInDateSeconds: D17 + 43200,
        totalCheckIns: 3,
        currentStreak: 3,
        longestStreak: 5,
      }),
      noonFeb19,
      NOW
    )
  );

  return vectors;
}

// ---------------------------------------------------------------------------
// Award vectors
// ---------------------------------------------------------------------------
interface AwardVector {
  id: string;
  description: string;
  input: Record<string, unknown>;
  expected: { awardTypes: string[] };
}

function buildAwardVectors(): AwardVector[] {
  const vectors: AwardVector[] = [];

  const vec = (
    id: string,
    desc: string,
    user: UserInput,
    streakNow: number,
    completionHour: number,
    groupID: string,
    isComeback: boolean,
    isFirstCheckInEver: boolean
  ): AwardVector => {
    const awardTypes = computeEligibleAwards(
      user,
      streakNow,
      completionHour,
      groupID,
      isComeback,
      isFirstCheckInEver
    );
    return {
      id,
      description: desc,
      input: { user, streakNow, completionHour, groupID, isComeback, isFirstCheckInEver },
      expected: { awardTypes },
    };
  };

  // firstStep
  vectors.push(
    vec(
      "firstStep-granted",
      "First check-in ever grants firstStep",
      mkUser({ totalCheckIns: 1, earnedAwardTypes: [] }),
      1, 12, "solo", false, true
    )
  );

  // weeklyWarrior
  vectors.push(
    vec(
      "weeklyWarrior-granted",
      "Streak of 7 grants weeklyWarrior and perfectWeek",
      mkUser({ totalCheckIns: 7, earnedAwardTypes: ["firstStep"] }),
      7, 12, "solo", false, false
    )
  );

  // weeklyWarrior boundary: streak=6 should NOT grant it
  vectors.push(
    vec(
      "weeklyWarrior-not-yet",
      "Streak of 6 does not grant weeklyWarrior",
      mkUser({ totalCheckIns: 6, earnedAwardTypes: ["firstStep"] }),
      6, 12, "solo", false, false
    )
  );

  // habitFormed
  vectors.push(
    vec(
      "habitFormed-granted",
      "Streak of 21 grants habitFormed",
      mkUser({ totalCheckIns: 21, earnedAwardTypes: ["firstStep", "weeklyWarrior", "perfectWeek"] }),
      21, 12, "solo", false, false
    )
  );

  // monthlyMaster
  vectors.push(
    vec(
      "monthlyMaster-granted",
      "Streak of 30 grants monthlyMaster and perfectMonth",
      mkUser({
        totalCheckIns: 30,
        earnedAwardTypes: ["firstStep", "weeklyWarrior", "habitFormed", "perfectWeek"],
      }),
      30, 12, "solo", false, false
    )
  );

  // centuryClub
  vectors.push(
    vec(
      "centuryClub-granted",
      "Streak of 100 grants centuryClub",
      mkUser({
        totalCheckIns: 100,
        earnedAwardTypes: [
          "firstStep", "weeklyWarrior", "habitFormed", "monthlyMaster",
          "perfectWeek", "perfectMonth",
        ],
      }),
      100, 12, "solo", false, false
    )
  );

  // earlyBird boundary: hour=6, totalCheckIns=7 → granted
  vectors.push(
    vec(
      "earlyBird-granted",
      "Check-in at hour 6 with 7+ total check-ins grants earlyBird",
      mkUser({ totalCheckIns: 7, earnedAwardTypes: ["firstStep"] }),
      1, 6, "solo", false, false
    )
  );

  // earlyBird: hour=7 → NOT before 7am
  vectors.push(
    vec(
      "earlyBird-wrong-hour",
      "Check-in at hour 7 (not <7) does not grant earlyBird",
      mkUser({ totalCheckIns: 7, earnedAwardTypes: ["firstStep"] }),
      1, 7, "solo", false, false
    )
  );

  // earlyBird: hour=6 but totalCheckIns=6 → gate not met
  vectors.push(
    vec(
      "earlyBird-insufficient-checkins",
      "Hour 6 but only 6 total check-ins does not grant earlyBird",
      mkUser({ totalCheckIns: 6, earnedAwardTypes: ["firstStep"] }),
      1, 6, "solo", false, false
    )
  );

  // nightOwl granted
  vectors.push(
    vec(
      "nightOwl-granted",
      "Check-in at hour 21 with 7+ check-ins grants nightOwl",
      mkUser({ totalCheckIns: 7, earnedAwardTypes: ["firstStep"] }),
      1, 21, "solo", false, false
    )
  );

  // nightOwl: hour=20 → NOT ≥21
  vectors.push(
    vec(
      "nightOwl-wrong-hour",
      "Check-in at hour 20 does not grant nightOwl",
      mkUser({ totalCheckIns: 7, earnedAwardTypes: ["firstStep"] }),
      1, 20, "solo", false, false
    )
  );

  // phoenixRising: real comeback
  vectors.push(
    vec(
      "phoenixRising-granted",
      "Comeback with prior check-ins grants phoenixRising",
      mkUser({ totalCheckIns: 11, comebackCount: 1, earnedAwardTypes: ["firstStep"] }),
      1, 12, "solo", true, false
    )
  );

  // phoenixRising: isFirstCheckInEver=true → should NOT grant
  vectors.push(
    vec(
      "phoenixRising-first-checkin",
      "isFirstCheckInEver=true prevents phoenixRising even if isComeback=true",
      mkUser({ totalCheckIns: 1, comebackCount: 0, earnedAwardTypes: [] }),
      1, 12, "solo", true, true
    )
  );

  // secondWind: comebackCount=2
  vectors.push(
    vec(
      "secondWind-granted",
      "comebackCount=2 grants secondWind",
      mkUser({ totalCheckIns: 15, comebackCount: 2, earnedAwardTypes: ["firstStep", "phoenixRising"] }),
      1, 12, "solo", true, false
    )
  );

  // neverGiveUp: comebackCount=5
  vectors.push(
    vec(
      "neverGiveUp-granted",
      "comebackCount=5 grants neverGiveUp",
      mkUser({
        totalCheckIns: 25,
        comebackCount: 5,
        earnedAwardTypes: ["firstStep", "phoenixRising", "secondWind"],
      }),
      1, 12, "solo", true, false
    )
  );

  // teamPlayer
  vectors.push(
    vec(
      "teamPlayer-granted",
      "Non-solo groupID grants teamPlayer",
      mkUser({ totalCheckIns: 5, earnedAwardTypes: ["firstStep"] }),
      1, 12, "group-abc", false, false
    )
  );

  // photographer boundary: totalPhotoProofs=10 → granted
  vectors.push(
    vec(
      "photographer-granted",
      "10 photo proofs grants photographer",
      mkUser({ totalCheckIns: 10, totalPhotoProofs: 10, earnedAwardTypes: ["firstStep"] }),
      1, 12, "solo", false, false
    )
  );

  // photographer: totalPhotoProofs=9 → not yet
  vectors.push(
    vec(
      "photographer-not-yet",
      "9 photo proofs does not grant photographer",
      mkUser({ totalCheckIns: 10, totalPhotoProofs: 9, earnedAwardTypes: ["firstStep"] }),
      1, 12, "solo", false, false
    )
  );

  // honestAbe boundary: 30 honor check-ins → granted
  vectors.push(
    vec(
      "honestAbe-granted",
      "30 honor check-ins grants honestAbe",
      mkUser({ totalCheckIns: 30, totalHonorCheckIns: 30, earnedAwardTypes: ["firstStep"] }),
      1, 12, "solo", false, false
    )
  );

  // honestAbe: 29 honor → not yet
  vectors.push(
    vec(
      "honestAbe-not-yet",
      "29 honor check-ins does not grant honestAbe",
      mkUser({ totalCheckIns: 29, totalHonorCheckIns: 29, earnedAwardTypes: ["firstStep"] }),
      1, 12, "solo", false, false
    )
  );

  // Duplicate guard: user already has award
  vectors.push(
    vec(
      "duplicate-guard",
      "Award already earned is not re-granted",
      mkUser({
        totalCheckIns: 7,
        earnedAwardTypes: ["firstStep", "weeklyWarrior", "perfectWeek"],
      }),
      7, 12, "solo", false, false
    )
  );

  // Multiple awards in one check-in
  vectors.push(
    vec(
      "multiple-awards",
      "First check-in in a group grants firstStep and teamPlayer together",
      mkUser({ totalCheckIns: 1, earnedAwardTypes: [] }),
      1, 12, "group-xyz", false, true
    )
  );

  return vectors;
}

// ---------------------------------------------------------------------------
// XP vectors
// ---------------------------------------------------------------------------
interface XPVector {
  id: string;
  description: string;
  function: string;
  input: { xp: number };
  expected: { result: string | number };
}

function buildXPVectors(): XPVector[] {
  const cases: Array<[string, string, number, string | number]> = [
    ["level-0", "levelFromXP(0) = Starter", 0, levelFromXP(0)],
    ["level-49", "levelFromXP(49) = Starter", 49, levelFromXP(49)],
    ["level-50", "levelFromXP(50) = Committed", 50, levelFromXP(50)],
    ["level-149", "levelFromXP(149) = Committed", 149, levelFromXP(149)],
    ["level-150", "levelFromXP(150) = Dedicated", 150, levelFromXP(150)],
    ["level-349", "levelFromXP(349) = Dedicated", 349, levelFromXP(349)],
    ["level-350", "levelFromXP(350) = Master", 350, levelFromXP(350)],
    ["level-699", "levelFromXP(699) = Master", 699, levelFromXP(699)],
    ["level-700", "levelFromXP(700) = Legend", 700, levelFromXP(700)],
    ["level-1000", "levelFromXP(1000) = Legend", 1000, levelFromXP(1000)],
  ];

  const progressCases: Array<[string, string, number, number]> = [
    ["progress-0", "progressToNextLevel(0) = 0", 0, progressToNextLevel(0)],
    ["progress-25", "progressToNextLevel(25) = 0.5", 25, progressToNextLevel(25)],
    ["progress-50", "progressToNextLevel(50) = 0 (new level)", 50, progressToNextLevel(50)],
    ["progress-100", "progressToNextLevel(100) = 0.5", 100, progressToNextLevel(100)],
    ["progress-700", "progressToNextLevel(700) = 1.0 (Legend)", 700, progressToNextLevel(700)],
  ];

  const xpToNextCases: Array<[string, string, number, number]> = [
    ["xpToNext-0", "xpToNextLevel(0) = 50", 0, xpToNextLevel(0)],
    ["xpToNext-49", "xpToNextLevel(49) = 1", 49, xpToNextLevel(49)],
    ["xpToNext-50", "xpToNextLevel(50) = 100", 50, xpToNextLevel(50)],
    ["xpToNext-700", "xpToNextLevel(700) = 0 (Legend)", 700, xpToNextLevel(700)],
  ];

  return [
    ...cases.map(([id, desc, xp, result]) => ({
      id,
      description: desc,
      function: "levelFromXP",
      input: { xp },
      expected: { result },
    })),
    ...progressCases.map(([id, desc, xp, result]) => ({
      id,
      description: desc,
      function: "progressToNextLevel",
      input: { xp },
      expected: { result },
    })),
    ...xpToNextCases.map(([id, desc, xp, result]) => ({
      id,
      description: desc,
      function: "xpToNextLevel",
      input: { xp },
      expected: { result },
    })),
  ];
}

// ---------------------------------------------------------------------------
// Write JSON files
// ---------------------------------------------------------------------------
const outDir = path.join(__dirname, "..", "shared", "test-vectors");

function writeJSON(filename: string, data: unknown): void {
  const outPath = path.join(outDir, filename);
  fs.writeFileSync(outPath, JSON.stringify(data, null, 2) + "\n");
  console.log(`  Wrote ${outPath}`);
}

console.log("=== Generating test vectors ===");

const streakVectors = buildStreakVectors();
writeJSON("streak-vectors.json", streakVectors);
console.log(`  ${streakVectors.length} streak scenarios`);

const awardVectors = buildAwardVectors();
writeJSON("award-vectors.json", awardVectors);
console.log(`  ${awardVectors.length} award scenarios`);

const xpVectors = buildXPVectors();
writeJSON("xp-vectors.json", xpVectors);
console.log(`  ${xpVectors.length} XP scenarios`);

console.log(`\nTotal: ${streakVectors.length + awardVectors.length + xpVectors.length} vectors generated.`);
