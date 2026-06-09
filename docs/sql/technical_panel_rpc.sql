-- ============================================================================
-- DRAFT — Technical Screen panel RPC (① information layer / candidate sieve).
-- ============================================================================
-- STATUS: NEW read-only RPC. Apply target = Brain (jviciwafctmmixgjszam);
-- apply = Yuki gate ①. After apply, ADD to the brain-query allowlist and
-- redeploy the Edge Function (see §3) — without that the panel stays in its
-- "Pending Brain RPC" state by design (it never reads tables directly).
--
-- WHAT: a transparent, read-only bucketing of penrose_market.technicals_daily
-- (technical strength + RSI + a rule-based timing read) joined to the nightly
-- beta-adjusted alpha screen penrose_market.alpha_screen_daily (risk_adj, side),
-- plus company_classification for name/sector context. Four buckets surfaced as
-- panel tabs:
--   high_conviction   — technical strength and alpha agree on side (top reads)
--   superior_long     — strong technicals + positive risk-adjusted alpha
--   superior_short    — weak/extended technicals + negative risk-adjusted alpha
--   alpha_only_short  — negative alpha where technicals are not yet confirming
-- This is a CANDIDATE SIEVE, not investment advice; layer ① only, independent of
-- the ② live LS/LO book (no holdings mixed in).
--
-- TIMING (rule-based, no AI): one of
--   CONSTRUCTIVE — trend-supportive, not yet stretched (room to run / fall)
--   EXTENDED     — stretched vs trend / overbought-oversold extreme
--   NEUTRAL      — basing; technicals not yet confirming the alpha read
--
-- CONTRACT (consumed by js/page-technical-screen.js via getTechnicalPanel):
--   returns jsonb {as_of, bucket, count, disclaimer, rows[]}
--   rows[] = {rank, symbol, company_name, sector, strength_pct, rsi_14,
--             timing, alpha_risk_adj}
--
-- SECURITY:
--   * Read-only (language sql STABLE). No writes, no AI triggers.
--   * SECURITY DEFINER so the service-role gateway can read penrose_market
--     without broad table grants; search_path pinned.
--   * Selects only company_name + sector for context (no paid prose columns).
--     track-app is Yuki-only (auth-gated) so names/sectors/metrics are fine.
--   * Browser NEVER queries Brain directly — only via the brain-query Edge
--     Function allowlist (JWT). Adding get_technical_panel to ALLOWED_RPCS +
--     redeploy is a Yuki step (§3).
-- ============================================================================

begin;

create or replace function penrose_market.get_technical_panel(
  p_bucket text default 'high_conviction',
  p_limit  int  default 25
)
returns jsonb
language sql
stable
security definer
set search_path = penrose_market, public
as $$
  with params as (
    select
      case
        when lower(coalesce(p_bucket,'')) in ('high_conviction','hc')      then 'high_conviction'
        when lower(coalesce(p_bucket,'')) in ('superior_long','long')       then 'superior_long'
        when lower(coalesce(p_bucket,'')) in ('superior_short','short')     then 'superior_short'
        when lower(coalesce(p_bucket,'')) in ('alpha_only_short','alpha')   then 'alpha_only_short'
        else 'high_conviction'
      end as bucket,
      greatest(1, least(coalesce(p_limit,25), 50)) as lim
  ),
  latest as (select max(trade_date) d from penrose_market.technicals_daily),
  t as (select * from penrose_market.technicals_daily where trade_date = (select d from latest)),
  -- nightly beta-adjusted alpha screen (vs TOPIX); most recent run.
  a as (
    select symbol, side, risk_adj
    from penrose_market.alpha_screen_daily
    where run_date = (select max(run_date) from penrose_market.alpha_screen_daily)
  ),
  cc as (
    select symbol, company_name, toyo_keizai_sector as sector
    from penrose_market.company_classification
    where as_of_date = (select max(as_of_date) from penrose_market.company_classification)
  ),
  base as (
    select
      t.symbol,
      cc.company_name,
      cc.sector,
      -- technical strength percentile (0..100) over today's universe.
      round((100.0 * percent_rank() over (order by t.pct_from_sma_200 nulls first))::numeric, 0) as strength_pct,
      round(t.rsi_14, 0) as rsi_14,
      a.side       as alpha_side,
      a.risk_adj   as alpha_risk_adj,
      -- rule-based timing read (no AI).
      case
        when t.rsi_14 >= 70 or t.rsi_14 <= 30 or abs(t.pct_from_sma_200) > 25 then 'EXTENDED'
        when t.pct_from_sma_50 > 0 and t.sma_50 > t.sma_200 and t.rsi_14 between 45 and 68 then 'CONSTRUCTIVE'
        when t.pct_from_sma_50 < 0 and t.sma_50 < t.sma_200 and t.rsi_14 between 32 and 55 then 'CONSTRUCTIVE'
        else 'NEUTRAL'
      end as timing
    from t
    left join a  on a.symbol  = t.symbol
    left join cc on cc.symbol = t.symbol
  ),
  bucketed as (
    select b.*, (select bucket from params) as bucket from base b
    where case (select bucket from params)
      when 'high_conviction' then
        (b.alpha_side = 'LONG'  and b.strength_pct >= 60)
        or (b.alpha_side = 'SHORT' and b.strength_pct <= 40)
      when 'superior_long' then
        b.alpha_side = 'LONG' and b.alpha_risk_adj > 0
      when 'superior_short' then
        b.alpha_side = 'SHORT' and b.alpha_risk_adj < 0
      when 'alpha_only_short' then
        b.alpha_side = 'SHORT' and b.alpha_risk_adj < 0 and b.timing = 'NEUTRAL'
      else false
    end
  ),
  ranked as (
    select *,
      row_number() over (
        order by
          case when (select bucket from params) in ('superior_short','alpha_only_short')
               then  coalesce(alpha_risk_adj, 0)        -- most-negative alpha first
               else -coalesce(alpha_risk_adj, 0) end,    -- most-positive alpha first
          symbol
      ) as rank
    from bucketed
    order by rank
    limit (select lim from params)
  ),
  rows_json as (
    select jsonb_agg(jsonb_build_object(
      'rank', rank,
      'symbol', symbol,
      'company_name', coalesce(company_name, '(code only)'),
      'sector', sector,
      'strength_pct', strength_pct,
      'rsi_14', rsi_14,
      'timing', timing,
      'alpha_risk_adj', round(alpha_risk_adj, 3)
    ) order by rank) as rows
    from ranked
  )
  select jsonb_build_object(
    'as_of', (select d from latest),
    'bucket', (select bucket from params),
    'limit', (select lim from params),
    'count', (select count(*) from ranked),
    'disclaimer', 'Technical screen — candidate sieve, not investment advice.',
    'rows', coalesce((select rows from rows_json), '[]'::jsonb)
  );
$$;

grant execute on function penrose_market.get_technical_panel(text, int) to service_role, authenticated;

commit;

-- ----------------------------------------------------------------------------
-- §3. ALLOWLIST / EDGE — REQUIRED for this NEW RPC (Yuki gate ①).
--   Add to the brain-query Edge Function ALLOWED_RPCS map, then redeploy:
--       "get_technical_panel": "penrose_market"
--   The browser calls this only through brain-query (JWT, verify_jwt true);
--   js/brain-queries.js → getTechnicalPanel() passes rpc_name "get_technical_panel".
--
-- §4. VERIFICATION (read-only, after apply)
-- select jsonb_pretty(penrose_market.get_technical_panel('high_conviction', 25));
-- select jsonb_pretty(penrose_market.get_technical_panel('superior_long', 25));
-- select jsonb_pretty(penrose_market.get_technical_panel('superior_short', 25));
-- select jsonb_pretty(penrose_market.get_technical_panel('alpha_only_short', 25));
-- ============================================================================
