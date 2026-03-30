"""
TinyAct Notification AutoResearch Agent
Runs weekly. Autonomously discovers best notification strategies.
Uses Claude API (claude-sonnet-4-6) as the reasoning backbone.

Implements the Karpathy AutoResearch pattern:
  hypothesis -> experiment -> measure -> revise

Reward signal: check_in_within_60min / notifications_sent per variant
Guard rails: opt-out rate < 2%, uninstall spike detection
"""

import anthropic
import firebase_admin
from firebase_admin import firestore
from datetime import datetime, timedelta
import json
import sys

ANTHROPIC_CLIENT = anthropic.Anthropic()  # uses ANTHROPIC_API_KEY env var
MODEL = "claude-sonnet-4-6"

TRIGGER_TYPES = [
    "LOSS_AVERSION",
    "SOCIAL_PROOF",
    "PARTNER_MOMENTUM",
    "IDENTITY",
    "FOMO",
]

# Guard rail thresholds
MAX_OPT_OUT_RATE = 0.02  # 2%
MIN_EVENTS_FOR_ANALYSIS = 10


def pull_experiment_results(db, days_back=7) -> dict:
    """Pull notification performance data from Firestore."""
    cutoff = datetime.now() - timedelta(days=days_back)
    events = (
        db.collection("notificationEvents")
        .where("sentAt", ">=", cutoff)
        .stream()
    )

    results = {}
    for event in events:
        d = event.to_dict()
        vid = d.get("variantId")
        if not vid:
            continue
        if vid not in results:
            results[vid] = {
                "variantId": vid,
                "triggerType": d.get("triggerType"),
                "sent": 0,
                "opened": 0,
                "checkedInWithin60Min": 0,
                "suppressed": 0,
            }
        if d.get("suppressedReason"):
            results[vid]["suppressed"] += 1
        else:
            results[vid]["sent"] += 1
        if d.get("openedAt"):
            results[vid]["opened"] += 1
        if d.get("checkedInWithin60Min"):
            results[vid]["checkedInWithin60Min"] += 1

    return results


def fetch_active_variants(db) -> list:
    """Fetch currently active notification variants."""
    variants = (
        db.collection("notificationVariants")
        .where("isActive", "==", True)
        .stream()
    )
    return [{"id": v.id, **v.to_dict()} for v in variants]


def check_guard_rails(results: dict) -> dict:
    """
    Check guard rails before generating new variants.
    Returns a dict with 'safe' bool and any 'warnings'.
    """
    warnings = []
    total_sent = sum(r["sent"] for r in results.values())
    total_suppressed = sum(r["suppressed"] for r in results.values())

    if total_sent > 0:
        opt_out_rate = total_suppressed / (total_sent + total_suppressed)
        if opt_out_rate > MAX_OPT_OUT_RATE:
            warnings.append(
                f"Opt-out rate {opt_out_rate:.1%} exceeds {MAX_OPT_OUT_RATE:.0%} threshold. "
                "Consider reducing notification frequency."
            )

    return {
        "safe": len(warnings) == 0,
        "warnings": warnings,
        "total_sent": total_sent,
        "total_suppressed": total_suppressed,
    }


def agent_analyze_and_hypothesize(
    results: dict, active_variants: list, previous_conclusions: str, guard_rail_report: dict
) -> dict:
    """
    LLM call: analyze results, form new hypothesis, generate new variants.
    Returns structured JSON with new variants and next hypothesis.
    """
    prompt = f"""
You are an autonomous notification optimization agent for TinyAct, a micro-commitment accountability app.

## Your task
Analyze last week's notification performance data. Generate 5 new notification copy variants to test next week. Form a hypothesis about what will perform better.

## App context
- Users have partner-linked streaks: if one person misses, both reset
- Groups of up to 8 people, one miss resets everyone
- Micro-commitments are tiny daily habits (10 pushups, 5 min reading)
- Key psychological levers: loss aversion, social proof, partner momentum, identity, FOMO
- Template variables you can use: {{{{partnerName}}}}, {{{{streak}}}}, {{{{hours}}}}, {{{{checkedIn}}}}, {{{{total}}}}, {{{{dayOfWeek}}}}

## Last week's results (reward = checkedInWithin60Min / sent)
{json.dumps(results, indent=2, default=str)}

## Currently active variants
{json.dumps(active_variants, indent=2, default=str)}

## Previous agent conclusions
{previous_conclusions or "None — this is the first run."}

## Guard rail report
{json.dumps(guard_rail_report, indent=2)}

## Rules
- Reward signal is check-in completion within 60 min, NOT notification opens
- If opt-out warnings exist, generate gentler copy and reduce urgency
- Each variant copyTitle must be ≤ 50 characters
- Each variant copyBody must be ≤ 150 characters
- Mix trigger types based on your hypothesis — don't only generate one type

## Output format (respond ONLY with valid JSON, no markdown, no preamble)
{{
  "conclusions": "1-2 sentences on what worked and why",
  "next_hypothesis": "Specific testable hypothesis for next week",
  "new_variants": [
    {{
      "triggerType": "LOSS_AVERSION",
      "copyTitle": "Your streak is at risk",
      "copyBody": "You have {{{{hours}}}} hours to check in before your {{{{streak}}}}-day streak resets.",
      "rationale": "Tests explicit countdown framing vs generic urgency"
    }}
  ],
  "variants_to_deactivate": ["variantId1", "variantId2"]
}}
Generate exactly 5 new variants. Include variants_to_deactivate for underperforming ones (conversion < 10% if sent > 20).
"""
    response = ANTHROPIC_CLIENT.messages.create(
        model=MODEL,
        max_tokens=2000,
        messages=[{"role": "user", "content": prompt}],
    )
    raw = response.content[0].text.strip()

    # Handle potential markdown wrapping
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[1]
        if raw.endswith("```"):
            raw = raw[:-3]

    return json.loads(raw)


def deploy_new_variants(db, agent_output: dict, run_id: str):
    """Write new variants to Firestore, deactivate old ones."""
    batch = db.batch()

    # Deactivate old variants
    for vid in agent_output.get("variants_to_deactivate", []):
        ref = db.collection("notificationVariants").document(vid)
        batch.update(ref, {"isActive": False})

    # Create new variants
    for v in agent_output.get("new_variants", []):
        ref = db.collection("notificationVariants").document()
        batch.set(
            ref,
            {
                "triggerType": v["triggerType"],
                "copyTitle": v["copyTitle"],
                "copyBody": v["copyBody"],
                "createdByAgent": True,
                "agentRunId": run_id,
                "createdAt": firestore.SERVER_TIMESTAMP,
                "isActive": True,
                "cohortTag": f"experiment_{run_id}",
            },
        )

    batch.commit()


def save_agent_run(db, run_id: str, agent_output: dict, results: dict, guard_rail_report: dict):
    """Save the agent run to /agentRuns for monitoring."""
    db.collection("agentRuns").document(run_id).set(
        {
            "runAt": firestore.SERVER_TIMESTAMP,
            "hypothesis": agent_output.get("next_hypothesis"),
            "conclusions": agent_output.get("conclusions"),
            "status": "complete",
            "rewardScores": {
                vid: (r["checkedInWithin60Min"] / r["sent"]) if r["sent"] > 0 else 0
                for vid, r in results.items()
            },
            "variantsGenerated": [
                v["copyTitle"] for v in agent_output.get("new_variants", [])
            ],
            "variantsDeactivated": agent_output.get("variants_to_deactivate", []),
            "nextHypothesis": agent_output.get("next_hypothesis"),
            "guardRailWarnings": guard_rail_report.get("warnings", []),
            "totalEventsSent": guard_rail_report.get("total_sent", 0),
        }
    )


def run_agent():
    """Main agent loop: pull → analyze → hypothesize → deploy → log."""
    if not firebase_admin._apps:
        firebase_admin.initialize_app()
    db = firestore.client()

    run_id = f"run_{datetime.now().strftime('%Y%m%d_%H%M')}"
    print(f"[Agent] Starting run {run_id}")

    # Pull last week's run conclusions
    prev_runs = (
        db.collection("agentRuns")
        .order_by("runAt", direction=firestore.Query.DESCENDING)
        .limit(1)
        .stream()
    )
    prev_conclusions = ""
    for r in prev_runs:
        prev_conclusions = r.to_dict().get("conclusions", "")

    results = pull_experiment_results(db)
    active_variants = fetch_active_variants(db)

    print(
        f"[Agent] Analyzing {len(results)} variant results, "
        f"{len(active_variants)} active variants"
    )

    # Check guard rails
    guard_rail_report = check_guard_rails(results)
    if guard_rail_report["warnings"]:
        for w in guard_rail_report["warnings"]:
            print(f"[Agent] WARNING: {w}")

    # Skip analysis if not enough data
    total_sent = sum(r["sent"] for r in results.values())
    if total_sent < MIN_EVENTS_FOR_ANALYSIS:
        print(
            f"[Agent] Only {total_sent} events sent (min {MIN_EVENTS_FOR_ANALYSIS}). "
            "Skipping analysis — need more data."
        )
        db.collection("agentRuns").document(run_id).set(
            {
                "runAt": firestore.SERVER_TIMESTAMP,
                "status": "skipped",
                "conclusions": f"Only {total_sent} events — insufficient data for analysis.",
                "nextHypothesis": "Collect more data before next run.",
            }
        )
        return

    agent_output = agent_analyze_and_hypothesize(
        results, active_variants, prev_conclusions, guard_rail_report
    )

    print(f"[Agent] Conclusions: {agent_output.get('conclusions')}")
    print(f"[Agent] Next hypothesis: {agent_output.get('next_hypothesis')}")
    print(
        f"[Agent] Deactivating: {agent_output.get('variants_to_deactivate', [])}"
    )

    deploy_new_variants(db, agent_output, run_id)
    save_agent_run(db, run_id, agent_output, results, guard_rail_report)

    new_count = len(agent_output.get("new_variants", []))
    print(f"[Agent] Run {run_id} complete. {new_count} new variants deployed.")


if __name__ == "__main__":
    run_agent()
