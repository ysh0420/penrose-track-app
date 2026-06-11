-- ============================================================================
-- DRAFT — Technicals Screener v2 (Confluence) RPC. SEPARATE from v1.
-- ============================================================================
-- STATUS: DRAFT. NOT APPLIED. Apply target = Brain (jviciwafctmmixgjszam);
-- apply = Yuki gate ①. This is a NEW function (fn_get_technicals_screener_v2);
-- v1 (fn_get_technicals_screener) is untouched. After apply, add the v2 name to
-- the brain-query allowlist + redeploy (Claude Code) — see §3.
--
-- WHAT: implements the two core ideas of the Notion report — CONFLUENCE counting
-- (how many INDEPENDENT categories agree: trend + momentum + volume + structure,
-- each one 0/1 vote) as the PRIMARY rank, and DIVERGENCE detection (price vs RSI)
-- as a momentum input + badge. Candidate sieve, NOT investment advice; layer ①,
-- independent of the ② live LS/LO book. Calibration: docs/technicals-screener-v2-verify-findings.md.
--
-- PARAMS:
--   p_preset : 'momentum' | 'reversal' | 'overheated' (A/B/C aliases ok)
--   p_limit  : top-N (1..50, default 20)
--   p_side   : 'long' | 'short' | 'auto' (default). 'auto' derives long for
--              momentum/reversal, short for overheated; 'long'/'short' override.
--
-- SECURITY: read-only (sql STABLE), SECURITY DEFINER, pinned search_path. No
-- writes, no AI triggers. Reads only company_name + toyo_keizai_sector for context
-- (paid prose never selected); koyfin_returns supplies an English-name fallback
-- (track-app is Yuki-only). Same name-coverage policy as v1 (761/762).
-- ============================================================================

begin;

create or replace function penrose_market.fn_get_technicals_screener_v2(
  p_preset text default 'momentum',
  p_limit  int  default 20,
  p_side   text default 'auto'
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
      greatest(1, least(coalesce(p_limit,20), 50)) as lim,
      lower(coalesce(p_side,'auto')) as side_in
  ),
  resolved as (
    select preset, lim,
      case
        when side_in in ('long','l')  then 'long'
        when side_in in ('short','s') then 'short'
        else case when preset = 'overheated' then 'short' else 'long' end
      end as side
    from params
  ),
  maxd as (select max(trade_date) d from penrose_market.technicals_daily),
  hist as (
    select symbol, trade_date, rsi_14, macd_histogram, bollinger_position,
      pct_from_sma_50, sma_50, sma_200, pct_from_sma_200, rel_volume_20d,
      price_change_1d_pct, price_change_1m_pct, price_change_3m_pct, price_change_5d_pct,
      max(rsi_14) over w7 as rsi_hi7,
      min(rsi_14) over w7 as rsi_lo7
    from penrose_market.technicals_daily
    window w7 as (partition by symbol order by trade_date rows between 6 preceding and current row)
  ),
  t as (select * from hist where trade_date = (select d from maxd)),
  pat as (
    select symbol,
      bool_or(pattern_type in ('bb_breakout_up','golden_cross'))   as struct_long,
      bool_or(pattern_type in ('bb_breakout_down','death_cross'))  as struct_short
    from penrose_market.technical_patterns
    where detected_date >= (select d from maxd) - 5
    group by symbol
  ),
  cc as (
    select symbol, company_name, toyo_keizai_sector
    from penrose_market.company_classification
    where as_of_date = (select max(as_of_date) from penrose_market.company_classification)
  ),
  kr as (
    select distinct on (symbol) symbol, company_name as kr_name
    from penrose_market.koyfin_returns
    order by symbol, as_of_date desc
  ),
  v as (
    select t.*,
      coalesce(p.struct_long, false)  as struct_long,
      coalesce(p.struct_short, false) as struct_short,
      coalesce(cc.company_name, kr.kr_name, '(code only)') as name,
      cc.toyo_keizai_sector as sector,
      (t.price_change_5d_pct >  2 and (t.rsi_hi7 - t.rsi_14) >= 8 and t.rsi_hi7 >= 65) as bearish_div,
      (t.price_change_5d_pct < -2 and (t.rsi_14 - t.rsi_lo7) >= 8 and t.rsi_lo7 <= 35) as bullish_div
    from t
    left join pat p on p.symbol = t.symbol
    left join cc on cc.symbol = t.symbol
    left join kr on kr.symbol = t.symbol
  ),
  cats as (
    select v.*, r.preset, r.side, r.lim,
      -- LONG votes
      (case when pct_from_sma_50 > 0 and sma_50 > sma_200 then 1 else 0 end) as l_trend,
      (case when (rsi_14 between 45 and 72) or macd_histogram > 0 or bullish_div then 1 else 0 end) as l_mom,
      (case when rel_volume_20d > 1 then 1 else 0 end) as l_vol,
      (case when struct_long then 1 else 0 end) as l_struct,
      -- SHORT votes
      (case when pct_from_sma_50 < 0 and sma_50 < sma_200 then 1 else 0 end) as s_trend,
      (case when rsi_14 < 50 or macd_histogram < 0 or bearish_div then 1 else 0 end) as s_mom,
      (case when rel_volume_20d > 1 then 1 else 0 end) as s_vol,
      (case when struct_short then 1 else 0 end) as s_struct
    from v cross join resolved r
  ),
  picked as (
    select *,
      (case when side = 'long' then l_trend  else s_trend  end) as c_trend,
      (case when side = 'long' then l_mom    else s_mom    end) as c_mom,
      (case when side = 'long' then l_vol    else s_vol    end) as c_vol,
      (case when side = 'long' then l_struct else s_struct end) as c_struct,
      (case when side = 'long' and bullish_div then 'bullish'
            when side = 'short' and bearish_div then 'bearish'
            when bearish_div then 'bearish' when bullish_div then 'bullish'
            else 'none' end) as divergence
    from cats
  ),
  filtered as (
    select * from picked
    where case preset
      when 'reversal'   then (rsi_14 < 45 or bollinger_position < 0.3)
      when 'overheated' then (rsi_14 > 60 or pct_from_sma_200 > 15)
      else true            -- momentum: confluence itself selects
    end
  ),
  scored as (
    select *,
      (c_trend + c_mom + c_vol + c_struct) as confluence_count,
      round((case preset
        when 'momentum' then
            0.30 * least(greatest(pct_from_sma_200,0),50)/50*100
          + 0.25 * least(greatest(price_change_3m_pct,0),40)/40*100
          + 0.20 * least(greatest(price_change_1m_pct,0),20)/20*100
          + 0.15 * (least(greatest(rel_volume_20d,1),3)-1)/2*100
          + 0.10 * greatest(0, 100 - abs(rsi_14-65)/10*100)
        when 'reversal' then
            0.40 * least(greatest((45-rsi_14)/20*100,0),100)
          + 0.30 * least(greatest((0.3-bollinger_position)/0.3*100,0),100)
          + 0.30 * (case when bullish_div then 100 else 0 end)
        when 'overheated' then
            0.30 * least(greatest(rsi_14-70,0),15)/15*100
          + 0.30 * least(greatest(least(pct_from_sma_200,60)-15,0),45)/45*100
          + 0.20 * least(greatest(bollinger_position-0.85,0),0.4)/0.4*100
          + 0.20 * (case when bearish_div then 100 else 0 end)
        else 0 end)::numeric, 1) as score
    from filtered
  ),
  ranked as (
    select *, row_number() over (order by confluence_count desc, score desc nulls last, symbol) as rank
    from scored
    order by confluence_count desc, score desc nulls last, symbol
    limit (select lim from resolved)
  ),
  rows_json as (
    select jsonb_agg(jsonb_build_object(
      'rank', rank,
      'symbol', symbol,
      'name', name,
      'sector', sector,
      'confluence_count', confluence_count,
      'categories', jsonb_build_object(
        'trend', c_trend = 1, 'momentum', c_mom = 1, 'volume', c_vol = 1, 'structure', c_struct = 1),
      'divergence', divergence,
      'score', score,
      'rsi', round(rsi_14,1),
      'pct_from_sma_200', round(pct_from_sma_200,1),
      'ret_1m', round(price_change_1m_pct,1),
      'rel_vol', round(rel_volume_20d,2),
      'macd_hist', round(macd_histogram,4),
      'bb_pos', round(bollinger_position,3),
      'interpretation',
        'Confluence ' || confluence_count || '/4 — '
        || 'Trend' || (case when c_trend=1 then '✓' else '—' end) || ' '
        || 'Momentum' || (case when c_mom=1 then '✓' else '—' end) || ' '
        || 'Volume' || (case when c_vol=1 then '✓' else '—' end) || ' '
        || 'Structure' || (case when c_struct=1 then '✓' else '—' end)
        || (case when divergence <> 'none' then ' · ' || divergence || ' divergence' else '' end)
        || ' · RSI ' || round(rsi_14)::text
    ) order by rank) as rows
    from ranked
  )
  select jsonb_build_object(
    'as_of', (select d from maxd),
    'preset', (select preset from resolved),
    'side', (select side from resolved),
    'limit', (select lim from resolved),
    'count', (select count(*) from ranked),
    'disclaimer', 'Confluence technical screen — candidate sieve, not investment advice.',
    'rows', coalesce((select rows from rows_json), '[]'::jsonb)
  );
$$;

grant execute on function penrose_market.fn_get_technicals_screener_v2(text, int, text) to service_role, authenticated;

commit;

-- ----------------------------------------------------------------------------
-- §3. AFTER APPLY — register in brain-query allowlist + redeploy (Claude Code)
--   penrose-research-engine/supabase/functions/brain-query/index.ts, in
--   ALLOWED_RPCS add:
--       "fn_get_technicals_screener_v2": "penrose_market",
--   then redeploy brain-query. v1's fn_get_technicals_screener stays as-is.
--
-- §4. VERIFICATION (read-only, after apply)
-- select jsonb_pretty(penrose_market.fn_get_technicals_screener_v2('momentum', 20));        -- long
-- select jsonb_pretty(penrose_market.fn_get_technicals_screener_v2('reversal', 20));        -- long
-- select jsonb_pretty(penrose_market.fn_get_technicals_screener_v2('overheated', 20));      -- short (auto)
-- select jsonb_pretty(penrose_market.fn_get_technicals_screener_v2('momentum', 20, 'short'));-- explicit side override
-- ============================================================================
