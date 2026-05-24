# Data Coverage Skill

## Description

Build and maintain the platform-wide Penrose data coverage and quality layer. The goal is to make each output explicit about what data exists, what is missing, what is stale, and what must not be inferred.

## When To Use

- Before building or refreshing V2 screening.
- Before publishing any diagnostic dashboard that depends on sector RS, peer RS, lead-lag, or source quality.
- When a page or report has blanks that need to remain visible rather than fabricated.
- When adding a new data source or table to the Brain.

## Inputs

- `docs/penrose-vault/SYSTEM_REGISTRY.md`.
- `docs/penrose-vault/STATUS.md`.
- Current Supabase schema, tables, and RPCs.
- Current review universe or holdings inventory.
- Source availability from EDINET, TDnet, J-Quants, Koyfin CSV/manual exports, company disclosures, and approved manual notes.

## Steps

1. Identify the output or universe that needs coverage.
2. List each required data field and its source.
3. Mark each field as present, missing, stale, partial, derived, or not applicable.
4. Preserve missing values as missing.
5. Add source timestamps and provenance where available.
6. Define read-only query/RPC contracts before building UI.
7. Update `STATUS.md` and `TODO.md` with remaining gaps.

## Completion Criteria

- Every required field has a coverage state.
- Missing data is visible and not fabricated.
- Source provenance is recorded.
- The next blocked input is named concretely.
- No portfolio state or report publication changed.

## Safety Boundaries

- Do not call AI.
- Do not write trades.
- Do not execute rebalance.
- Do not change portfolio state.
- Do not publish reports.
- Do not expose secrets.
- Do not replace missing data with guessed values.
- Do not expose raw paid-data-derived rows.

## Expected Artifacts

- Coverage matrix or Supabase-backed coverage table/interface.
- Notes under `docs/penrose-vault/sources/` if needed.
- Updated `STATUS.md` and `TODO.md`.
- Optional read-only UI spec after data contracts are confirmed.
