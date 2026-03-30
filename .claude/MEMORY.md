# MEMORY.md — Monica's Project Memory

Curated learnings, preferences, and decisions for TinyAct. Updated as I learn.
Load only in main session (direct chat with Lokesh).

---

## Communication Style

- Keep responses concise and direct — no filler, no trailing summaries
- No emojis unless asked
- Reference file paths with line numbers when pointing to code

---

## Workspace Preferences

- Squad agent files live in `.claude/` — keeps repo root clean (app code only)
- `agents/` (plural) for squad agents, `agent/` (singular) is the Python notification agent — don't confuse them
- Context docs in `.claude/context/` are concise references that point to source files, not copies

---

## Architecture Decisions

- iOS app is named "MicroCommit" (legacy project name) — brand is "TinyAct"
- Both platforms must maintain feature parity — Pam audits this before every release
- Offline-first: writes go to local queue first, sync engine flushes when online
- Streak algorithm is identical across iOS, Android, and Firebase — `AlgorithmParityTests` enforce this
- Notification reward signal = `checkedInWithin60Min`, never open rate

---

## Squad Routing

- Parity / QA / pre-release → Pam
- Feature implementation / architecture / domain logic → Ross
- Notification optimization / A/B testing / autoresearch → Dwight
- Unclear or cross-cutting → Monica coordinates

---

## Things to Watch

- Never commit to `main` — always branch (`1.0.4` iOS, `1.0.1` Android)
- `AlgorithmParityTests.swift` + `AlgorithmParityTest.kt` are sacred — update test vectors if algo changes
- Firebase Security Rules: `notificationVariants` = service account write only; `agentRuns` = admin read only
