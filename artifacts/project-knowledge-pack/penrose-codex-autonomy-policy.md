# Penrose Codex Autonomy Policy

## Default Rule

Proceed autonomously for safe, reversible, in-scope work. Do not ask Yuki for approval for small changes, repo inspection, documentation, local tests, safe smoke checks, or branch-local implementation details.

## Approved Without Extra Confirmation

- Reading repo files.
- Editing documentation.
- Adding or updating tests.
- Running typecheck/tests/lint.
- Running safe smoke checks.
- Creating local artifacts under `artifacts/` or `tmp/`.
- Updating `STATUS.md` and `TODO.md` after meaningful progress.
- Adding read-only UI panels or read-only RPC calls through approved gateways.
- Adding non-destructive schema additions.

## Approval Required

- AI execution or credit-consuming work.
- Trades.
- Rebalance.
- Portfolio changes.
- Report publication.
- Destructive migrations.
- Production data deletion.
- Secrets, auth, or access-control changes.
- External distribution.
- Merge when not explicitly approved.

## Final Reporting Standard

End each task with:

- What changed.
- Validation run.
- What was not validated.
- Risks or remaining weaknesses.
- Exact next action.
