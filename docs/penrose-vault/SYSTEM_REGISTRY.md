# Penrose System Registry

Last updated: 2026-05-24

## Mission

Penrose Intelligence Brain is the core system for collecting source evidence, normalizing it into reusable company and market intelligence, screening the investable universe, and producing diagnostic outputs for Yuki's review.

Model Portfolio V2 is one diagnostic output of the Brain. It is a shadow PM decision-support surface, not an execution system and not the actual future portfolio.

The operating principle is: do not keep current state only inside conversations. Put current state, rules, source maps, and repeatable workflows into files and Supabase records.

## Target Architecture

1. Source intake: EDINET, TDnet, J-Quants, Koyfin CSV/manual exports, company disclosures, platform data, and approved manual notes.
2. Normalization: Brain-owned tables and functions in Supabase turn raw source observations into canonical company, event, market, and coverage records.
3. Coverage layer: every output must know what data exists, what is missing, what is stale, and what should not be inferred.
4. Signal and screening layer: Brain computes screening states, V2 diagnostic states, lead-lag context, source confidence, and exception flags.
5. Output layer: Track App renders read-only views, reports shelves, logs, and diagnostic dashboards from Supabase.
6. Handoff layer: this vault plus Notion/Obsidian provide operating maps for Codex, ChatGPT, Claude, and future agents.

## AI And Team Roles

| Actor | Role | Boundaries |
| --- | --- | --- |
| Yuki | Owner, investment judgment, approval for risky actions | Must approve AI execution, trades, rebalance, publication, destructive data changes, secrets/auth changes, and external distribution. |
| Codex | Code, docs, repo changes, local validation, registry maintenance | No AI calls, trades, portfolio state changes, report publication, or secret exposure unless explicitly approved. |
| ChatGPT Project | Operating map, planning, cross-session memory, reasoning over uploaded pack | Uses project knowledge pack; should not be treated as data SSOT. |
| Claude | Writing and synthesis from verified claim packs | Must use source packs and verified claims only; no unsupported claims or internal-only leakage. |
| Supabase | Data and output SSOT | Tables, RPCs, logs, generated outputs, and audit state live here. |
| GitHub | Code SSOT | Repos, migrations, Track App views, vault docs, and review history live here. |
| Track App | View layer | Read-only UI for current platform surfaces unless a workflow explicitly says otherwise. |
| Notion/Obsidian | Operating map and handoff hub | Useful for navigation and planning; not primary data. |

## Data Sources

| Source | Use | Current Handling |
| --- | --- | --- |
| Supabase Brain database | Canonical data, logs, outputs, RPCs | Data/output SSOT. Verify before changing schemas or writes. |
| GitHub repos | Code, migrations, docs, static views | Code SSOT. Commit documentation and implementation changes here. |
| Track App live pages | Read-only rendered view of Supabase-backed outputs | View layer only. Do not treat page copy as data SSOT. |
| EDINET | Filings, business descriptions, large-holding signals | Brain/research ingestion source. |
| TDnet | Timely disclosures and revisions | Brain/research ingestion source. |
| J-Quants | Market and fundamental feeds | Brain/research ingestion source. |
| Koyfin CSV/manual exports | Sector, peer, relative strength, lead-lag context | Manual or local CSV path only unless an implemented API exists. Do not expose paid-data-derived raw rows. |
| Company disclosures | Verified company facts | Store claim-level citations before using in writing. |
| Existing model book holdings | Inherited review inventory | Current 25 holdings are not the future portfolio. |
| Notion/Obsidian | Handoff and planning notes | Operating map only. Cross-check against Supabase/GitHub before acting. |

## Supabase Table And Interface Map

This map is an operating guide, not a schema guarantee. Verify current schema, migrations, or Supabase metadata before migrations or writes.

| Area | Known table or interface | Role | Status |
| --- | --- | --- | --- |
| V2 daily log | `model_portfolio_v2_logs` | V2 log header/state | Current. Active log id is tracked in `STATUS.md`. |
| V2 daily log items | `model_portfolio_v2_log_items` | Per-name diagnostic V2 rows | Current. Should cover full inherited review inventory when producing official daily log. |
| Current holdings inventory | `penrose_model.model_portfolio_positions` | Source for inherited 25 holding inventory | Current inventory source, not future portfolio target. |
| V2 dashboard | `fn_get_model_portfolio_v2_log_dashboard` | Read path for current V2 log dashboard | Current read interface. |
| Brain query gateway | `brain-query` Edge Function and whitelisted RPCs | Authenticated read path from Track App | Current read boundary for Brain views. |
| Brain active ideas | `fn_get_active_ideas` | Active idea view for Brain portfolio pages | Current Brain view interface. |
| Brain company cards | `company_research_card` and stock header/fundamental/history RPCs | Company detail view | Current read interface. |
| Research logs | research log RPCs and tables behind them | Research session visibility | Current or transitional. Do not trigger browser AI execution. |
| Reports shelf | report metadata/content tables behind Track App reports | Completed report output shelf | Current where deployed, but publication requires explicit approval. |
| Legacy model book | legacy model book archive tables/views | Historical archive | Legacy archive only. Do not use as primary V2 source. |

## Track App Page Map

| Page or surface | Role | Status |
| --- | --- | --- |
| Portfolio V2 Review | Diagnostic review surface for current V2 state | Live. Read-only operating surface. |
| Portfolio V2 Log | Daily V2 log view | Live. Active log id is in `STATUS.md`. |
| Legacy Model Book Archive | Historical v1 archive | Live archive only. |
| Brain portfolio/company/pipeline pages | Early Brain SPA surfaces | Current or transitional view layer depending on branch/deploy. Keep read-only unless explicitly scoped. |
| Research log browser run controls | Browser-triggered research execution | Do not use or extend under current safety rules. |
| Static internal report content | Hard-coded internal report bodies in repo | Do not add. Reports should come from Supabase/output workflows. |

## Repo Ownership

| Repo | Ownership | Notes |
| --- | --- | --- |
| `penrose-track-app` | Track App views, read-only Brain pages, vault docs, project knowledge pack | Current vault home. Track App is view layer, not data SSOT. |
| `penrose-research-engine` | Ingestion, research orchestration, Supabase migrations/functions, pipeline code | Use for Brain data and pipeline implementation. It may have active worktree changes; inspect before editing. |
| `penrose-intelligence` | Earlier local intelligence/dashboard tooling | Legacy/reference unless explicitly revived. |
| `penrose-uk-website` | Public website and client portal | Separate from Brain data pipeline. Do not mix public website edits into Brain tasks. |

## Current Live Components

- Portfolio V2 Review is live.
- Portfolio V2 Log is live.
- Legacy Model Book Archive is live.
- Active V2 daily log id: `3dcb8fa4-38c2-4afc-9cde-a0d470aec5be`.
- Active V2 log date: `2026-05-21`.
- Active item count: 25.
- The 25 items are inherited current holding inventory for diagnostic review.
- Zeon can remain a fixture and integration sample, but it is not the project.

## Legacy And Deprecated Components

- v1 model portfolio is legacy archive only.
- Zeon-only V2 daily log was superseded and must not be treated as the official current log.
- Any workflow that optimizes one name instead of the whole review universe is deprecated.
- Browser-triggered AI execution paths are not acceptable for new work under the current rules.
- Static internal report content in repo should not be added or used as the primary content path.

## What Not To Use

- Do not use v1 model portfolio as the primary source for V2.
- Do not treat the current 25 holdings as the future book.
- Do not treat Zeon as the project.
- Do not fill missing sector RS, peer basket RS, or global lead-lag values with placeholders.
- Do not use stale chat context as current state.
- Do not expose raw paid-data-derived rows or internal recommendations.
- Do not publish or externally distribute generated report content without explicit approval.
- Do not trigger AI from the browser.

## Safety Rules

- No AI execution without explicit approval.
- No trades.
- No rebalance.
- No portfolio state changes.
- No report publication.
- No secret exposure.
- No destructive migrations without explicit approval.
- No production data deletion without explicit approval.
- No static internal report content.
- Missing data must remain missing and visible.

## Current Build Priorities

1. Penrose Data Coverage & Quality Layer v1.
2. Full Universe V2 Screening v1.
3. Source pack standard for company-level evidence.
4. Report refresh workflow that consumes verified Supabase outputs without publishing by default.
5. Claude article brief workflow that uses only verified claims and source packs.

## Registry Maintenance

Update this file when:

- A component becomes current, deprecated, or retired.
- A source of truth changes.
- A new table/interface becomes the supported path.
- A safety boundary changes by explicit user instruction.
- A build priority changes.
