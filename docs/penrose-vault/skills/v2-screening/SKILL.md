# V2 Screening Skill

## Description

Run or design Full Universe V2 Screening as a diagnostic output of the Penrose Intelligence Brain. V2 screening supports PM review and does not execute trades or portfolio changes.

## When To Use

- After the data coverage layer defines available and missing fields.
- When producing a full current review universe diagnostic.
- When comparing inherited holdings, watch-only names, short candidates, or re-underwrite candidates.
- When updating V2 dashboard contracts.

## Inputs

- `SYSTEM_REGISTRY.md`, `STATUS.md`, and `TODO.md`.
- Current review universe from verified Supabase sources.
- Coverage matrix for sector RS, peer basket RS, global lead-lag, fundamentals, filings, and signal state.
- Existing V2 log interfaces.

## Steps

1. Confirm the universe source before screening.
2. Confirm the workflow is diagnostic only.
3. Load coverage states and keep missing data missing.
4. Score names using current documented rules.
5. Assign diagnostic states without proposing trade execution.
6. Produce a read-only output artifact or Supabase dry-run record.
7. Validate that no trades, rebalance, report publication, or portfolio state changes occurred.
8. Update `STATUS.md` and `TODO.md`.

## Completion Criteria

- Screening covers the whole intended universe.
- Output is clearly labeled diagnostic/shadow PM support.
- Each missing field remains visible.
- No execution, rebalance, or portfolio state change occurred.
- Validation evidence is recorded.

## Safety Boundaries

- Do not optimize for Zeon.
- Do not treat 25 inherited holdings as the future book.
- Do not use v1 model book as primary.
- Do not write trades.
- Do not execute rebalance.
- Do not change portfolio state.
- Do not publish reports.
- Do not trigger browser AI execution.

## Expected Artifacts

- V2 screening output or dry-run artifact.
- Coverage gap list.
- Validation summary.
- Updated vault status/TODO entries.
