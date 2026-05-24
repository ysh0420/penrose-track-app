# Data Coverage & Quality Layer v1

Status: ready for next Codex task
Created: 2026-05-24

## Goal

Build the first platform-wide data coverage and quality layer for Penrose Intelligence Brain so every diagnostic output can state what data is present, missing, stale, partial, derived, or not applicable.

This is the prerequisite for Full Universe V2 Screening v1.

## Non-Negotiable Rules

- Do not call AI.
- Do not write trades.
- Do not execute rebalance.
- Do not change portfolio state.
- Do not publish reports.
- Do not expose secrets.
- Do not rewrite the active V2 log.
- Missing data must remain missing.
- Do not optimize for Zeon.
- Do not treat the current 25 inherited holdings as the future book.
- Do not use v1 model book as primary.

## Current Known Gaps

- Sector RS missing.
- Peer basket RS missing.
- Global lead-lag incomplete.
- Data coverage layer not yet platform-wide.

## Existing Related Assets

- `penrose-research-engine/docs/pipelines/jquants.md` already references `penrose_ops.universe_coverage`.
- `penrose-research-engine/scripts/cron/_jquants_backfill_verify.ts` checks price/technical/date coverage and recent `universe_coverage`.
- `penrose-research-engine/scripts/ingest/jquants/upsert.ts` has universe coverage upsert logic.
- `penrose-track-app/docs/penrose-vault/skills/data-coverage/SKILL.md` defines the workflow.

Verify these files before editing because `penrose-research-engine` currently has unrelated local changes.

## Proposed v1 Scope

### Coverage Dimensions

- Universe membership coverage.
- Price coverage.
- Technical coverage.
- Fundamental coverage.
- Filing/disclosure coverage.
- Sector relative strength coverage.
- Peer basket relative strength coverage.
- Global lead-lag coverage.
- Source freshness.
- Source provenance.

### Coverage States

- `present`
- `missing`
- `stale`
- `partial`
- `derived`
- `not_applicable`
- `blocked`

### Minimum Output Contract

Each row should identify:

- entity type, such as symbol, universe, output, or field.
- entity id, such as symbol or log id.
- field name.
- coverage state.
- source system.
- source timestamp.
- observed timestamp.
- freshness status.
- limitation note.
- downstream impact.

## Suggested Implementation Sequence

1. Read `docs/penrose-vault/SYSTEM_REGISTRY.md`, `STATUS.md`, and `TODO.md`.
2. Inspect `penrose-research-engine` local changes before editing.
3. Verify current Supabase schemas/tables read-only.
4. Design v1 coverage table/view/RPC contract.
5. Add non-destructive migration or SQL artifact only after confirming schema fit.
6. Add bounded read-only verification script.
7. Add Track App read-only surface only after data contract is stable.
8. Validate no AI/trade/rebalance/portfolio/report side effects.
9. Update vault `STATUS.md` and `TODO.md`.
10. Mirror material vault changes to Obsidian and Notion.

## Acceptance Criteria

- Coverage contract exists and can represent all current known gaps.
- Missing values remain missing and visible.
- Sector RS, peer basket RS, and global lead-lag have explicit coverage states even if values are missing.
- Current V2 diagnostic workflow can consume coverage states before screening.
- No active V2 log rewrite occurred.
- No trades, rebalance, portfolio state changes, report publication, AI execution, or secret exposure occurred.

## First Verification Commands

Run from `C:\Users\yukis\penrose-research-engine` after inspecting the worktree:

```powershell
git status -sb
rg -n "universe_coverage|coverage|relative strength|lead-lag|model_portfolio_v2|sector RS|peer basket" docs scripts supabase
```

Use read-only Supabase checks before any schema change.
