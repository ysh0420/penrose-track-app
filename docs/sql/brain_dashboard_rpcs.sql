-- ============================================================================
-- DRAFT — Brain dashboard read-only RPCs for Panel 1 (Market Pulse) & Panel 6
--          (Classification / Supply-Chain).
-- ============================================================================
-- STATUS: DRAFT. NOT APPLIED. Apply target = Brain (jviciwafctmmixgjszam).
-- Apply = Yuki gate ①. After apply, ALSO register both names in the brain-query
-- Edge Function allowlist and redeploy (see step 3) — until then the browser
-- gets "Unknown rpc_name" and brain-dashboard Panels 1 & 6 show a pending state.
--
-- WHY: brain-dashboard.html Panels 1 & 6 need server-side, read-only,
-- allowlist-gated access to market-pulse and classification data. The browser
-- never queries Brain tables directly; it calls these via brain-query (JWT).
--
-- SECURITY:
--   * Read-only (language sql STABLE). No writes, no AI triggers.
--   * SECURITY DEFINER so the service-role gateway can read penrose_market /
--     penrose_us without broad table grants; search_path pinned.
--   * Panel 6 exposes ONLY anonymous AGGREGATE taxonomy — sector→company-count,
--     supply-chain-tag→count, and US→JP lead-lag (Penrose-derived). It NEVER
--     selects feature_text / company_profile / customers (paid Toyo Keizai /
--     Shikiho prose), per-name financials, symbols, or any Koyfin paid raw
--     (koyfin_returns is untouched).
--     ★ NOTE for gate ① review: company_classification is currently 100%
--       do_not_publish_directly=true (all 1001 rows; paid source). The flag
--       guards per-row PROSE publication; this RPC returns only counts that
--       reveal no prose, no per-company data, satisfying the spec's "SC-tag"
--       ask. If you want even aggregates withheld, delete the `sectors` and
--       `tags` CTEs below and keep `us_jp_lead_lag` only.
--   * Panel 1 returns only price/return/flow summaries (public market data).
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. Panel 1 · Market Pulse: latest indices, FX, JP industry flows, vol anomalies
-- ----------------------------------------------------------------------------
create or replace function penrose_market.fn_get_market_pulse_dashboard(p_limit int default 12)
returns jsonb
language sql stable security definer
set search_path = penrose_market, public
as $$
  with idx as (
    select distinct on (index_symbol) index_symbol, trade_date, close, change_pct, category
    from penrose_market.indices_daily
    order by index_symbol, trade_date desc
  ), fxx as (
    select distinct on (pair) pair, trade_date, close, change_pct
    from penrose_market.fx_daily
    order by pair, trade_date desc
  ), flow_day as (select max(as_of_date) d from penrose_market.industry_flows_jp_daily),
  flows as (
    select industry_code, price_change_1d, price_change_1m, flow_status, momentum_stage
    from penrose_market.industry_flows_jp_daily
    where as_of_date = (select d from flow_day)
    order by abs(coalesce(price_change_1d, 0)) desc
    limit p_limit
  ), anom_day as (select max(trade_date) d from penrose_market.volume_anomalies),
  anom as (
    select symbol, anomaly_type, vol_rel_20d
    from penrose_market.volume_anomalies
    where trade_date = (select d from anom_day)
    order by coalesce(vol_rel_20d, 0) desc
    limit p_limit
  )
  select jsonb_build_object(
    'as_of', greatest(
      (select max(trade_date) from idx), (select max(trade_date) from fxx),
      (select d from flow_day), (select d from anom_day)),
    'indices', coalesce((select jsonb_agg(jsonb_build_object(
        'index_symbol', index_symbol, 'close', close, 'change_pct', change_pct, 'category', category)
        order by category nulls last, index_symbol) from idx), '[]'::jsonb),
    'fx', coalesce((select jsonb_agg(jsonb_build_object(
        'pair', pair, 'close', close, 'change_pct', change_pct) order by pair) from fxx), '[]'::jsonb),
    'industry_flows', coalesce((select jsonb_agg(jsonb_build_object(
        'industry_code', industry_code, 'price_change_1d', price_change_1d,
        'price_change_1m', price_change_1m, 'flow_status', flow_status,
        'momentum_stage', momentum_stage)) from flows), '[]'::jsonb),
    'volume_anomalies', coalesce((select jsonb_agg(jsonb_build_object(
        'symbol', symbol, 'anomaly_type', anomaly_type, 'vol_rel_20d', vol_rel_20d)) from anom), '[]'::jsonb)
  );
$$;

-- ----------------------------------------------------------------------------
-- 2. Panel 6 · Classification / Supply-Chain (aggregate, publish-safe only)
-- ----------------------------------------------------------------------------
create or replace function penrose_market.fn_get_classification_overview(p_limit int default 30)
returns jsonb
language sql stable security definer
set search_path = penrose_market, penrose_us, public
as $$
  with cc as (
    -- only the two non-sensitive columns are read; prose columns (feature_text,
    -- company_profile, customers) and financials/symbols are never selected.
    select toyo_keizai_sector, supply_chain_tags
    from penrose_market.company_classification
    where as_of_date = (select max(as_of_date) from penrose_market.company_classification)
  ), sectors as (
    select toyo_keizai_sector as sector, count(*) c
    from cc where toyo_keizai_sector is not null
    group by toyo_keizai_sector order by count(*) desc limit p_limit
  ), tags as (
    select tag, count(*) c
    from cc, lateral unnest(coalesce(supply_chain_tags, array[]::text[])) as tag
    group by tag order by count(*) desc limit p_limit
  ), ll as (
    select us_industry, jp_industry, expected_lag_days, learned_median_lag_days, status, n_observations
    from penrose_us.us_jp_industry_mapping
    order by coalesce(n_observations, 0) desc, us_industry limit p_limit
  )
  select jsonb_build_object(
    'as_of', (select max(as_of_date) from penrose_market.company_classification),
    'sector_counts', coalesce((select jsonb_agg(jsonb_build_object('sector', sector, 'count', c)) from sectors), '[]'::jsonb),
    'supply_chain_tags', coalesce((select jsonb_agg(jsonb_build_object('tag', tag, 'count', c)) from tags), '[]'::jsonb),
    'us_jp_lead_lag', coalesce((select jsonb_agg(jsonb_build_object(
        'us_industry', us_industry, 'jp_industry', jp_industry,
        'expected_lag_days', expected_lag_days, 'learned_median_lag_days', learned_median_lag_days,
        'status', status)) from ll), '[]'::jsonb)
  );
$$;

grant execute on function penrose_market.fn_get_market_pulse_dashboard(int) to service_role, authenticated;
grant execute on function penrose_market.fn_get_classification_overview(int) to service_role, authenticated;

commit;

-- ----------------------------------------------------------------------------
-- 3. AFTER APPLY — register in brain-query allowlist + redeploy (Yuki)
--    penrose-research-engine/supabase/functions/brain-query/index.ts, in
--    ALLOWED_RPCS add:
--      "fn_get_market_pulse_dashboard": "penrose_market",
--      "fn_get_classification_overview": "penrose_market",
--    then redeploy the brain-query Edge Function. Browser calls these via
--    brain-client.getMarketPulseDashboard() / getClassificationOverview().
--
-- 4. VERIFICATION (read-only, after apply)
-- select jsonb_pretty(penrose_market.fn_get_market_pulse_dashboard(12));
-- select jsonb_pretty(penrose_market.fn_get_classification_overview(30));
