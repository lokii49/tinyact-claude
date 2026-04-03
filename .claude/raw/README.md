# raw/ — Intake Inbox

This folder is the intake queue for unprocessed sources.

Drop anything here that should eventually make it into the wiki (`.claude/context/`):

- Design decisions that were made in Slack/chat
- External articles or docs relevant to the codebase
- Meeting notes with architectural decisions
- Screenshots of Firebase console configs
- Pasted spec docs from Notion/Linear
- Anything you want to "not forget" but haven't processed yet

---

## How it gets processed

Monica or Dwight picks this up and absorbs it into the right context doc:

| Content type | Destination |
|---|---|
| Model field decisions | `context/domain-models.md` |
| Firestore schema decisions | `context/firebase-schema.md` |
| Notification behavior/rules | `context/notification-system.md` |
| Feature status, bugs, branches | `context/project-status.md` |
| Streak edge cases, rules | `context/streak-rules.md` |

After processing, the file is deleted or moved to `raw/processed/`.

---

## To trigger processing

Tell Monica: "process the raw inbox" — she'll route to Dwight if needed.
