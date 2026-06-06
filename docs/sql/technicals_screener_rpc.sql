-- ============================================================================
-- DRAFT — Technicals Screener RPC (① information layer / candidate sieve).
-- ============================================================================
-- STATUS: DRAFT. NOT APPLIED. Apply target = Brain (jviciwafctmmixgjszam).
-- Apply = Yuki gate ①. After apply, ALSO register the name in the brain-query
-- Edge Function allowlist and redeploy (see §3) — until then the browser gets
-- "Unknown rpc_name" and the Screener page shows a pending state.
--
-- WHAT: a transparent, rule-based technical screen over penrose_market.technicals_daily,
-- joined to company_classification for name/sector context. Three intent presets;
-- each returns the top-N by a documented weighted-sum score, with a rule-based
-- one-line interpretation. This is a CANDIDATE SIEVE, not investment advice; it
-- is layer ① and is independent of the ② live LS/LO book (no holdings mixed in).
-- Calibration + rationale: docs/technicals-screener-verify-findings.md.
--
-- SECURITY:
--   * Read-only (language sql STABLE). No writes, no AI triggers.
--   * SECURITY DEFINER so the service-role gateway can read penrose_market
--     without broad table grants; search_path pinned.
--   * Selects only company_name + toyo_keizai_sector for context. It does NOT
--     select paid prose (feature_text / company_profile / customers) or per-name
--     financials. track-app is Yuki-only (auth-gated) so names/sectors/metrics
--     are fine to display; public outputs keep their existing paid-raw protection.
-- ============================================================================

begin;

create or replace function penrose_market.fn_get_technicals_screener(
  p_preset text default 'momentum',
  p_limit  int  default 20
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
        when lower(coalesce(p_preset,'')) in ('a','momentum','breakout') then 'momentum'
        when lower(coalesce(p_preset,'')) in ('b','reversal','oversold')  then 'reversal'
        when lower(coalesce(p_preset,'')) in ('c','overheated','caution') then 'overheated'
        else 'momentum'
      end as preset,
      greatest(1, least(coalesce(p_limit,20), 50)) as lim
  ),
  latest as (select max(trade_date) d from penrose_market.technicals_daily),
  prev as (
    select max(trade_date) d from penrose_market.technicals_daily
    where trade_date < (select d from latest)
  ),
  t  as (select * from penrose_market.technicals_daily where trade_date = (select d from latest)),
  tp as (select symbol, macd_histogram as prev_macdh from penrose_market.technicals_daily where trade_date = (select d from prev)),
  cc as (
    select symbol, company_name, toyo_keizai_sector
    from penrose_market.company_classification
    where as_of_date = (select max(as_of_date) from penrose_market.company_classification)
  ),
  base as (
    select
      t.*,
      tp.prev_macdh,
      cc.company_name,
      cc.toyo_keizai_sector,
      (select preset from params) as preset
    from t
    left join tp on tp.symbol = t.symbol
    left join cc on cc.symbol = t.symbol
  ),
  filtered as (
    select * from base b
    where case b.preset
      when 'momentum' then
        b.pct_from_sma_50 > 0 and b.sma_50 > b.sma_200 and b.rsi_14 between 55 and 75
        and b.macd_histogram > 0 and b.price_change_1m_pct > 0 and b.rel_volume_20d > 1
      when 'reversal' then
        b.rsi_14 < 35 and b.bollinger_position <= 0.2
      when 'overheated' then
        b.rsi_14 > 70 and b.bollinger_position >= 0.85 and b.pct_from_sma_200 > 15
      else false
    end
  ),
  scored as (
    select
      symbol,
      company_name,
      toyo_keizai_sector,
      rsi_14, pct_from_sma_200, price_change_1m_pct, price_change_3m_pct, price_change_5d_pct,
      price_change_1d_pct, rel_volume_20d, macd_histogram, bollinger_position,
      (macd_histogram is not null and prev_macdh is not null and macd_histogram > prev_macdh) as macd_improving,
      round((case preset
        when 'momentum' then
            0.30 * least(greatest(pct_from_sma_200,0),50)/50*100
          + 0.25 * least(greatest(price_change_3m_pct,0),40)/40*100
          + 0.20 * least(greatest(price_change_1m_pct,0),20)/20*100
          + 0.15 * (least(greatest(rel_volume_20d,1),3)-1)/2*100
          + 0.10 * greatest(0, 100 - abs(rsi_14-65)/10*100)
        when 'reversal' then
            0.35 * least(greatest((35-rsi_14)/15*100,0),100)
          + 0.25 * least(greatest((0.2-bollinger_position)/0.2*100,0),100)
          + 0.20 * (case when price_change_1d_pct > 0 then least(price_change_1d_pct,5)/5*100 else 0 end)
          + 0.20 * (case when macd_histogram is not null and prev_macdh is not null and macd_histogram > prev_macdh then 100 else 0 end)
        when 'overheated' then
            0.30 * least(greatest(rsi_14-70,0),15)/15*100
          + 0.30 * least(greatest(least(pct_from_sma_200,60)-15,0),45)/45*100
          + 0.20 * least(greatest(bollinger_position-0.85,0),0.4)/0.4*100
          + 0.20 * least(greatest(price_change_5d_pct,0),15)/15*100
        else 0 end)::numeric, 1) as score,
      preset
    from filtered
  ),
  ranked as (
    select *, row_number() over (order by score desc nulls last, symbol) as rank
    from scored
    order by score desc nulls last, symbol
    limit (select lim from params)
  ),
  rows_json as (
    select jsonb_agg(jsonb_build_object(
      'rank', rank,
      'symbol', symbol,
      'name', coalesce(company_name, '(code only)'),
      'sector', toyo_keizai_sector,
      'score', score,
      'rsi', round(rsi_14,1),
      'pct_from_sma_200', round(pct_from_sma_200,1),
      'ret_1m', round(price_change_1m_pct,1),
      'ret_3m', round(price_change_3m_pct,1),
      'rel_vol', round(rel_volume_20d,2),
      'macd_hist', round(macd_histogram,4),
      'bb_pos', round(bollinger_position,3),
      'interpretation',
        case preset
          when 'momentum' then
            'Uptrend (px>50>200MA, +' || round(pct_from_sma_200)::text || '% vs 200MA), RSI '
            || round(rsi_14)::text || ', MACD+, vol ' || round(rel_volume_20d,1)::text
            || 'x; 1m +' || round(price_change_1m_pct,1)::text || '%'
          when 'reversal' then
            'RSI ' || round(rsi_14)::text || ' oversold, BB ' || round(bollinger_position,2)::text || ' (lower); '
            || (case when price_change_1d_pct > 0
                  then '+' || round(price_change_1d_pct,1)::text || '% today (bounce)'
                  else round(price_change_1d_pct,1)::text || '% today' end)
            || (case when macd_improving then ', MACD improving' else '' end)
          when 'overheated' then
            'RSI ' || round(rsi_14)::text || ' overbought, +' || round(pct_from_sma_200)::text
            || '% vs 200MA (extended), BB ' || round(bollinger_position,2)::text
            || (case when bollinger_position >= 1 then ' (>upper)' else '' end)
          else ''
        end
    ) order by rank) as rows
    from ranked
  )
  select jsonb_build_object(
    'as_of', (select d from latest),
    'preset', (select preset from params),
    'limit', (select lim from params),
    'count', (select count(*) from ranked),
    'disclaimer', 'Technical screen — candidate sieve, not investment advice.',
    'rows', coalesce((select rows from rows_json), '[]'::jsonb)
  );
$$;

grant execute on function penrose_market.fn_get_technicals_screener(text, int) to service_role, authenticated;

commit;

-- ----------------------------------------------------------------------------
-- §3. AFTER APPLY — register in brain-query allowlist + redeploy (Yuki)
--   penrose-research-engine/supabase/functions/brain-query/index.ts, in
--   ALLOWED_RPCS add:
--       "fn_get_technicals_screener": "penrose_market",
--   then redeploy the brain-query Edge Function. Browser calls it via
--   brain-client.getTechnicalsScreener(preset, limit).
--
-- §4. VERIFICATION (read-only, after apply)
-- select jsonb_pretty(penrose_market.fn_get_technicals_screener('momentum', 20));
-- select jsonb_pretty(penrose_market.fn_get_technicals_screener('reversal', 20));
-- select jsonb_pretty(penrose_market.fn_get_technicals_screener('overheated', 20));
-- ============================================================================
