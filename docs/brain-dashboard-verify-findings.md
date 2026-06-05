# Brain Dashboard (① Information/Data) — verify-findings

STATUS: implemented on `feat/brain-dashboard`. Brain RPCs for P1/P6 are DRAFT (Yuki gate ①).
Page: `brain-dashboard.html` + `js/page-brain-dashboard.js`. Nav: Brain › Dashboard.
This is layer ① (information / AI model). It is INDEPENDENT of ② (prdj live book); the live
LS/LO investment book is never shown here.

## Architecture (verified)
- Browser never queries Brain tables directly. All access via `brain-query` Edge Function
  (`penrose-research-engine/supabase/functions/brain-query/index.ts`) — JWT auth, user allowlist
  (ALLOWED_USERS = Yuki ×2), RPC allowlist (`ALLOWED_RPCS`), service-role executes server-side.
- Frontend reuses `js/brain-client.js` (`mountBrainAuthGate`, `brainQuery`) + `js/brain-queries.js`
  wrappers. Brain project = `jviciwafctmmixgjszam`; anon key + storageKey "brain-auth" (separate
  session from the prdj Track Record auth).

## Panel → RPC mapping (existing allowlisted RPCs preferred)
| Panel | Source RPC (schema) | Status | Shape used |
|---|---|---|---|
| 1 Market Pulse | **fn_get_market_pulse_dashboard** (penrose_market) | **NEW RPC draft** | {as_of, indices[], fx[], industry_flows[], volume_anomalies[]} |
| 2 Signals | `fn_get_signal_dashboard` (penrose_research) | existing ✓ | {generated_at, signals[], by_state[], portfolio_decisions[]} |
| 3 Disclosure/News | `fn_brain_v0_portfolio_disclosures` + `fn_get_latest_news_brief` (public) | existing ✓ | {date,source_links{tdnet,edinet},source_counts,relevant_disclosures[]}; {brief,recent_items[]} |
| 4 AI Model | `fn_get_model_portfolio_dashboard` (public) | existing ✓ | {latest_nav,latest_run,positions[],…} |
| 5 Research | `fn_agent_research_dashboard` + `fn_list_published_reports` | existing ✓ | {cost_summary,recent_syntheses[],recent_runs[]}; {reports[]} |
| 6 Classification/SC | **fn_get_classification_overview** (penrose_market) | **NEW RPC draft** | {as_of, sector_counts[], supply_chain_tags[], us_jp_lead_lag[]} |

→ **Panels 2/3/4/5 work now** (existing allowlisted RPCs). **Panels 1/6** show a "pending Brain RPC"
state until the two draft RPCs are applied (gate ①) AND registered in the brain-query allowlist +
redeployed. `getMarketPulseDashboard` / `getClassificationOverview` wrappers added to brain-queries.js;
an un-allowlisted RPC returns "Unknown rpc_name" → the panel renders the calm pending card.

## New RPC drafts — `docs/sql/brain_dashboard_rpcs.sql` (NOT APPLIED)
Both read-only (sql STABLE, SECURITY DEFINER, pinned search_path), grant execute to service_role/authenticated.
Validated read-only against Brain:
- P1: as_of 2026-06-04 — 5 indices (N225 −1.36%, TOPIX 0000 −1.11%…), 3 FX, 12 JP industry flows, 12 vol anomalies.
- P6: 30 sectors (電子部品・産業用電子機器 84, 化学 58…), 26 supply-chain tags (SC:前工程装置 14, SC:ウエハ素材 10,
  SC:露光レジスト 7…), 30 US→JP lead-lag rows.
After apply, add to `ALLOWED_RPCS` (schema penrose_market) and redeploy brain-query (see SQL §3).

## Security decisions (enforced in RPC and/or render)
- **①②分離**: dashboard is Brain-only; the prdj live book is never queried or shown. Panel 4 carries a
  loud banner "AI Model Portfolio — hypothetical … NOT the live LS/LO investment book".
- **Headlines + links only** (P3): news + disclosures render title + outbound URL, never body text.
- **P2 signals**: render symbol/direction/state/score/family/as_of only. `source_run_ids` and
  `score_components` are NOT rendered; **`portfolio_decisions` (internal actions) are NOT rendered**.
- **P5 research**: aggregates + synthesis title/type/quality/published-flag + report titles only.
  **No Source Run IDs, no synthesis content/key_findings, no drafts.**
- **P6 classification**: ★ company_classification is 100% `do_not_publish_directly=true` (1001/1001, paid
  Toyo Keizai/Shikiho source). The RPC reads ONLY `toyo_keizai_sector` + `supply_chain_tags` and emits
  ONLY anonymous aggregate counts — never feature_text/company_profile/customers/financials/symbols, and
  `koyfin_returns` (paid raw) is untouched. Decision: aggregate counts reveal no prose and satisfy the
  spec's "SC-tag" ask, so they are exposed; flagged in the SQL for gate-① review (drop sector/tag CTEs to
  withhold even aggregates). Conservative per "迷ったら出さない" would otherwise leave only lead-lag.
- Browser is **read-only** (no AI-trigger RPCs called).

## Design notes / decision-guide calls
- Each panel loads independently (`loadP1…loadP6`, no shared barrier) so one failure never blanks others.
- Dense/institutional UI (Penrose navy/gold, Cormorant+DM Sans, tabular nums, compact tables); each panel
  shows an `as of` date + source. Responsive grid (2-col → 1-col under 980px). No tagline.
- Where a table had several candidates, used the latest-dated / highest-coverage source and noted it here.
- TODO (future, non-blocking): TR for any panel needing more series; richer Panel 1 (breadth_daily,
  technical_patterns) once a market-pulse RPC is live; per-symbol drill-through links into existing pages.
