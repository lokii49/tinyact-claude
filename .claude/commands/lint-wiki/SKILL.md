---
name: lint-wiki
description: "Audit all .claude/context/ docs against the actual codebase. Finds stale entries, missing entries, and gaps. Outputs a report and optionally auto-fixes. Use when: audit the wiki, check context docs, lint the wiki, wiki is stale, update context docs, is the wiki accurate."
---

# Lint + Heal the Wiki

The `.claude/context/` docs are the living knowledge base. Over time they go stale — model fields get renamed, new services appear, bugs get fixed. This skill audits every doc against the actual code and surfaces exactly what's wrong.

---

## What you're auditing

Five docs, each with a different verification strategy:

| Doc | How to verify |
|---|---|
| `context/domain-models.md` | Grep actual model files on both platforms. Check every field listed still exists. |
| `context/firebase-schema.md` | Grep Firestore repository files for collection names. Check listed collections match what's actually used. |
| `context/streak-rules.md` | Read `StreakCalculationService.swift` + `StreakCalculationService.kt`. Check rules match actual implementation logic. |
| `context/notification-system.md` | Read `PushNotificationService.swift`, `functions/src/index.ts`, notification agent. Check described behaviors match. |
| `context/project-status.md` | Check active branches with git. Read `TinyAct---Android/todo.md`, `TinyAct---Android/checklist.md`. Update known bugs and status. |

---

## The audit loop

For each doc:

1. **Read the doc** — note every claim it makes (fields, rules, behaviors, statuses)
2. **Verify each claim** — grep or read the relevant source file
3. **Classify findings:**
   - **STALE** — doc says X but code says Y
   - **MISSING** — code has it but doc doesn't mention it
   - **GAP** — obvious topic the doc should cover but doesn't
   - **OK** — verified and accurate
4. **Output findings** in structured format (see below)

---

## Output format

For each doc, output:

```
## context/[doc-name].md

STALE: [what the doc says] → [what the code actually says] (file:line)
MISSING: [field/rule/behavior found in code not in doc]
GAP: [topic that should be documented but isn't]
OK: [count] entries verified accurate
```

Then at the end: **Summary table** showing total STALE / MISSING / GAP / OK per doc.

---

## Auto-heal

After generating the report, ask: "Auto-apply fixes? (yes/no)"

If yes:
- Fix every STALE entry (update doc to match code)
- Add every MISSING entry (add new entries from code)
- Flag GAPs with a `<!-- GAP: investigate -->` comment for human review
- Do NOT guess at GAPs — only fix what you can verify

If no: output the report only. Human decides what to fix.

---

## Platform paths (quick reference)

**iOS models:** `microcommit/micro-commit/Core/Domain/Models/`
**Android models:** `TinyAct---Android/core/domain/src/main/java/com/lokesh/tinyact/core/domain/model/`
**iOS streak service:** `microcommit/micro-commit/Infrastructure/Services/StreakCalculationService.swift`
**Android streak service:** `TinyAct---Android/core/domain/src/main/java/com/lokesh/tinyact/core/domain/service/StreakCalculationService.kt`
**iOS notifications:** `microcommit/micro-commit/Infrastructure/Services/PushNotificationService.swift`
**Cloud Functions:** `microcommit/functions/src/index.ts`
**Firestore repos (iOS):** `microcommit/micro-commit/Core/Data/Repositories/`
**Firestore repos (Android):** `TinyAct---Android/core/data/src/main/java/com/lokesh/tinyact/core/data/repository/`

---

## Token discipline

- Read model files first (small, stable, high-signal)
- Use Grep with precise patterns before opening large files
- Read only the function/struct you need (use offset + limit)
- Never glob the whole repo
