# Source Pack Skill

## Description

Create a compact, verified source pack for a company, theme, or output so later AI writing and screening can use claims without relying on chat memory.

## When To Use

- Before Claude writes an article or narrative note.
- Before refreshing a company report.
- Before adding a company to screening examples.
- When a claim needs explicit evidence and freshness.

## Inputs

- Company ticker/name or theme.
- Supabase source records and Brain outputs.
- Public company disclosures and filings.
- EDINET, TDnet, J-Quants, Koyfin CSV/manual outputs where approved and available.
- Existing report metadata if relevant.

## Steps

1. Define the claim scope and audience.
2. Pull only verified source facts.
3. Separate primary-source facts, derived metrics, and analyst interpretation.
4. Record source date, retrieval date, and limitation.
5. Mark missing data as missing.
6. Remove raw paid-data-derived rows and internal-only IDs from public-facing packs.
7. Save a concise source pack in the approved location.

## Completion Criteria

- Claims are traceable to sources.
- Missing data remains visible.
- Internal-only content is excluded from external packs.
- The pack states what it can and cannot support.

## Safety Boundaries

- Do not call AI unless explicitly approved.
- Do not fabricate claims.
- Do not expose secrets.
- Do not expose raw paid-data-derived content.
- Do not include internal recommendation, Source Run IDs, or portfolio action in public packs.
- Do not publish reports.

## Expected Artifacts

- Source pack markdown under `docs/penrose-vault/sources/` or a Supabase output record.
- Claim limitations section.
- Updated `STATUS.md` or `TODO.md` if a source gap blocks downstream work.
