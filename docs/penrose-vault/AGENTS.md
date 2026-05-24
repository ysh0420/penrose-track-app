# Penrose Vault Agent Rules

This folder is the operating memory for the Penrose Intelligence Platform. Treat it as the first stop before changing code, data workflows, or investor-facing artifacts.

## Mandatory Startup

1. Read `docs/penrose-vault/SYSTEM_REGISTRY.md` first.
2. Check `docs/penrose-vault/STATUS.md`.
3. Check `docs/penrose-vault/TODO.md`.
4. Use the registry to decide what is current, legacy, blocked, or forbidden.
5. After meaningful progress, update `STATUS.md` and/or `TODO.md` with the new state, open gaps, and next action.

## Source Of Truth Rules

- Supabase is the data and output source of truth.
- GitHub is the code source of truth.
- Track App is the view layer.
- Notion and Obsidian are operating map and AI handoff hubs, not primary data stores.
- Penrose Intelligence Brain is the core system.
- Model Portfolio V2 is diagnostic and shadow PM decision-support only.
- Model Portfolio V2 is one output of the Brain, not the Brain itself.
- The v1 model portfolio is a legacy archive only.
- The current 25 holdings are inherited inventory for review, not the future portfolio.
- Do not optimize for one name.
- Zeon is a fixture and integration sample, not the project.
- Missing data must remain missing until a verified source fills it.

## Safety Boundaries

- No browser AI execution.
- No AI execution unless explicitly approved for the task.
- No trades.
- No rebalance.
- No portfolio state changes.
- No report publication.
- No secret exposure.
- No static internal report content in the repo.
- No fabrication of missing data.
- No external distribution of internal recommendation, paid-data-derived content, Source Run IDs, or portfolio action.

## Autonomy Policy

Proceed autonomously for safe, reversible, in-scope work. Do not ask Yuki for approval for small changes, local documentation, local tests, read-only checks, safe smoke checks, or branch-local implementation work.

Ask approval only for:

- AI execution or credit-consuming work.
- Trades, rebalance, or portfolio changes.
- Report publication or external distribution.
- Destructive migrations or production data deletion.
- Secrets, auth, or access-control changes.
- External distribution of internal recommendation, paid-data-derived content, Source Run IDs, or portfolio action.
- Merge when merge was not explicitly approved.

If a step is safe but uncertain, make a reasonable assumption, execute it, and record the assumption in the final summary or in `STATUS.md`.

If a step is risky, stop and state the exact proposed command or change, expected effect, approval needed, and rollback plan.

## Completion Standard

Every meaningful task should end with:

- What changed.
- Validation run.
- What was not validated.
- Risks or remaining weaknesses.
- Exact next action.
