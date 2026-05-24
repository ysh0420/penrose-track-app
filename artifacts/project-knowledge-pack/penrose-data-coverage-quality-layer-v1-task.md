# Penrose Data Coverage & Quality Layer v1 Task

Status: ready for next Codex task
Created: 2026-05-24

## Goal

Build the first platform-wide data coverage and quality layer for Penrose Intelligence Brain so diagnostic outputs can state what data is present, missing, stale, partial, derived, or not applicable.

This is the prerequisite for Full Universe V2 Screening v1.

## Safety Rules

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

## Known Gaps

- Sector RS missing.
- Peer basket RS missing.
- Global lead-lag incomplete.
- Data coverage layer not yet platform-wide.

## Suggested v1 Contract

Each coverage row should identify:

- entity type.
- entity id.
- field name.
- coverage state.
- source system.
- source timestamp.
- observed timestamp.
- freshness status.
- limitation note.
- downstream impact.

Coverage states:

- `present`
- `missing`
- `stale`
- `partial`
- `derived`
- `not_applicable`
- `blocked`

## Suggested Sequence

1. Read the system registry, current status, and TODO.
2. Inspect `penrose-research-engine` worktree before editing.
3. Verify current Supabase schemas/tables read-only.
4. Design v1 coverage table/view/RPC contract.
5. Add non-destructive migration or SQL artifact only after confirming schema fit.
6. Add bounded read-only verification script.
7. Add Track App read-only surface only after the data contract is stable.
8. Validate no AI/trade/rebalance/portfolio/report side effects.
9. Update vault status/TODO and mirrors.

## Acceptance Criteria

- Coverage contract exists and can represent all current known gaps.
- Missing values remain missing and visible.
- Sector RS, peer basket RS, and global lead-lag have explicit coverage states even if values are missing.
- Current V2 diagnostic workflow can consume coverage states before screening.
- No active V2 log rewrite occurred.
- No trades, rebalance, portfolio state changes, report publication, AI execution, or secret exposure occurred.
