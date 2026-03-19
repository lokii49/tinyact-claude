/**
 * algorithmCheck.ts — Autoresearch loop: verifies canonical TS algorithms
 * match stored test vectors.
 *
 * Run: ts-node --project microcommit/functions/tsconfig.json scripts/algorithmCheck.ts
 *
 * Exit code 0 = 100% pass (CI green)
 * Exit code 1 = any failure (CI red)
 *
 * Writes shared/test-vectors/check-results.json for AI-assisted remediation.
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

const vectorDir = path.join(__dirname, "..", "shared", "test-vectors");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function loadJSON<T>(filename: string): T {
  return JSON.parse(
    fs.readFileSync(path.join(vectorDir, filename), "utf8")
  ) as T;
}

interface TestResult {
  id: string;
  passed: boolean;
  expected: unknown;
  actual: unknown;
  error?: string;
}

function approxEqual(a: unknown, b: unknown, eps = 0.001): boolean {
  if (typeof a === "number" && typeof b === "number") {
    return Math.abs(a - b) < eps;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    // Order-insensitive for award arrays
    const sa = [...a].sort().join(",");
    const sb = [...b].sort().join(",");
    return sa === sb;
  }
  if (typeof a === "object" && a !== null && typeof b === "object" && b !== null) {
    const aObj = a as Record<string, unknown>;
    const bObj = b as Record<string, unknown>;
    for (const key of Object.keys(bObj)) {
      if (!approxEqual(aObj[key], bObj[key], eps)) return false;
    }
    return true;
  }
  return a === b;
}

// ---------------------------------------------------------------------------
// Run streak vectors
// ---------------------------------------------------------------------------

function runStreakVectors(): TestResult[] {
  const vectors = loadJSON<Array<Record<string, unknown>>>("streak-vectors.json");
  const results: TestResult[] = [];

  for (const v of vectors) {
    const id = v.id as string;
    const subtype = v.subtype as string;
    const input = v.input as Record<string, unknown>;
    const expected = v.expected as Record<string, unknown>;

    try {
      let actual: Record<string, unknown>;

      if (subtype === "count") {
        const completions = input.completions as CompletionInput[];
        const pausedDaySeconds = input.pausedDaySeconds as number[];
        const breakDateSeconds = input.breakDateSeconds as number | null;
        const nowSeconds = input.nowSeconds as number;
        const tzIdentifier = (input.tzIdentifier as string) || "UTC";

        // Build paused day keys from day-level timestamps
        const flatPausedKeys = new Set<number>();
        for (let i = 0; i < pausedDaySeconds.length; i++) {
          const dummyStreak: StreakInput = {
            id: "p",
            userIDs: [],
            isPaused: true,
            pausedAtSeconds: pausedDaySeconds[i],
            pauseResumeDateSeconds: pausedDaySeconds[i] + 86400,
            currentStreak: 0,
            longestStreak: 0,
            lastCompletionDateSeconds: null,
          };
          for (const k of getPausedDayKeys(dummyStreak, nowSeconds + 86400, tzIdentifier)) {
            flatPausedKeys.add(k);
          }
        }

        const count = calculateStreak(
          completions,
          flatPausedKeys,
          nowSeconds,
          breakDateSeconds,
          tzIdentifier
        );
        actual = { streakCount: count };

      } else if (subtype === "partnership-count") {
        const userComps = input.userCompletions as CompletionInput[];
        const partnerComps = input.partnerCompletions as CompletionInput[];
        const nowSeconds = input.nowSeconds as number;
        const tzIdentifier = (input.tzIdentifier as string) || "UTC";
        const count = calculatePartnershipStreak(
          userComps,
          partnerComps,
          new Set(),
          nowSeconds,
          tzIdentifier
        );
        actual = { streakCount: count };

      } else if (subtype === "group-count") {
        const memberComps = input.memberCompletions as Record<string, CompletionInput[]>;
        const nowSeconds = input.nowSeconds as number;
        const tzIdentifier = (input.tzIdentifier as string) || "UTC";
        const count = calculateGroupAccountabilityStreak(
          memberComps,
          nowSeconds,
          tzIdentifier
        );
        actual = { streakCount: count };

      } else if (subtype === "streak-object") {
        const streak = input.streak as StreakInput;
        const nowSeconds = input.nowSeconds as number;
        const tzIdentifier = (input.tzIdentifier as string) || "UTC";
        actual = computeStreakObjectProperties(streak, nowSeconds, tzIdentifier) as unknown as Record<string, unknown>;

      } else if (subtype === "user-outcome") {
        const user = input.user as UserInput;
        const completionTs = input.completionTimestampSeconds as number;
        const tzIdentifier = (input.tzIdentifier as string) || "UTC";
        const nowSeconds = input.nowSeconds as number;
        actual = computeUserStreakOutcome(user, completionTs, tzIdentifier, nowSeconds) as unknown as Record<string, unknown>;

      } else {
        throw new Error(`Unknown subtype: ${subtype}`);
      }

      const passed = approxEqual(actual, expected);
      results.push({ id, passed, expected, actual });

    } catch (err) {
      results.push({
        id,
        passed: false,
        expected,
        actual: null,
        error: String(err),
      });
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Run award vectors
// ---------------------------------------------------------------------------

function runAwardVectors(): TestResult[] {
  const vectors = loadJSON<Array<Record<string, unknown>>>("award-vectors.json");
  const results: TestResult[] = [];

  for (const v of vectors) {
    const id = v.id as string;
    const input = v.input as Record<string, unknown>;
    const expected = v.expected as { awardTypes: string[] };

    try {
      const awardTypes = computeEligibleAwards(
        input.user as UserInput,
        input.streakNow as number,
        input.completionHour as number,
        input.groupID as string,
        input.isComeback as boolean,
        input.isFirstCheckInEver as boolean
      );
      const actual = { awardTypes };
      const passed = approxEqual(actual, expected);
      results.push({ id, passed, expected, actual });
    } catch (err) {
      results.push({ id, passed: false, expected, actual: null, error: String(err) });
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Run XP vectors
// ---------------------------------------------------------------------------

function runXPVectors(): TestResult[] {
  const vectors = loadJSON<
    Array<{ id: string; function: string; input: { xp: number }; expected: { result: unknown } }>
  >("xp-vectors.json");
  const results: TestResult[] = [];

  for (const v of vectors) {
    try {
      let actual: unknown;
      switch (v.function) {
        case "levelFromXP":
          actual = levelFromXP(v.input.xp);
          break;
        case "progressToNextLevel":
          actual = progressToNextLevel(v.input.xp);
          break;
        case "xpToNextLevel":
          actual = xpToNextLevel(v.input.xp);
          break;
        default:
          throw new Error(`Unknown function: ${v.function}`);
      }
      const passed = approxEqual(actual, v.expected.result);
      results.push({ id: v.id, passed, expected: v.expected.result, actual });
    } catch (err) {
      results.push({
        id: v.id,
        passed: false,
        expected: v.expected.result,
        actual: null,
        error: String(err),
      });
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const allResults: TestResult[] = [
  ...runStreakVectors(),
  ...runAwardVectors(),
  ...runXPVectors(),
];

const passed = allResults.filter((r) => r.passed).length;
const total = allResults.length;
const pct = ((passed / total) * 100).toFixed(1);

console.log(`\n=== Algorithm Parity Check ===`);
console.log(`Pass rate: ${pct}% (${passed}/${total})`);

const failures = allResults.filter((r) => !r.passed);
if (failures.length > 0) {
  console.log(`\nFAILURES:`);
  for (const f of failures) {
    console.log(`  [FAIL] ${f.id}`);
    if (f.error) {
      console.log(`         error: ${f.error}`);
    } else {
      console.log(`         expected: ${JSON.stringify(f.expected)}`);
      console.log(`         actual:   ${JSON.stringify(f.actual)}`);
    }
  }
}

// Write check-results.json for AI-assisted remediation
const checkResults = {
  timestamp: new Date().toISOString(),
  passRate: `${pct}%`,
  passed,
  total,
  failures: failures.map((f) => ({
    id: f.id,
    expected: f.expected,
    actual: f.actual,
    error: f.error,
  })),
};
fs.writeFileSync(
  path.join(vectorDir, "check-results.json"),
  JSON.stringify(checkResults, null, 2) + "\n"
);

process.exit(failures.length > 0 ? 1 : 0);
