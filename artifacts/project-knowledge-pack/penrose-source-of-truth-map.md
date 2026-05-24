# Penrose Source Of Truth Map

## Current SSOT Rules

| Domain | Source Of Truth | Notes |
| --- | --- | --- |
| Data and generated outputs | Supabase | Current tables, logs, output records, and read RPCs. |
| Code and migrations | GitHub | Repos, branch history, PRs, migrations, app code, docs. |
| Rendered views | Track App | View layer only. Do not treat as canonical data. |
| Operating map | Vault, Notion, Obsidian | Handoff and navigation. Cross-check before acting. |
| Writing input | Source packs | Must contain verified claims and limitations. |

## Repo Map

- `penrose-track-app`: view layer, Brain pages, vault docs, project knowledge pack.
- `penrose-research-engine`: ingestion, orchestration, data pipelines, Supabase migrations/functions.
- `penrose-intelligence`: older local dashboard/prototype reference.
- `penrose-uk-website`: public website/client portal, separate from Brain.

## Data Source Map

- Supabase Brain database: canonical system state and outputs.
- EDINET: filings and large-holding signals.
- TDnet: timely disclosure feed.
- J-Quants: market/fundamental feed.
- Koyfin CSV/manual exports: relative strength, peer, sector, and lead-lag context where available.
- Company disclosures: public claim evidence.
- Existing holdings inventory: inherited review inventory, not future portfolio.

## Missing Data Rule

Missing data must remain missing. Do not infer sector RS, peer basket RS, global lead-lag, or future portfolio state from incomplete inputs.
