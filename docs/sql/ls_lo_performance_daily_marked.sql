-- ============================================================================
-- DRAFT — LS/LO daily marked NAV / return -> performance_daily  (Part 2)
-- ============================================================================
-- STATUS: DRAFT. NOT APPLIED. Production apply = Yuki gate ①. Review then run.
-- Target: prdj (prdjmipmkomhvokwrjid).
--
-- WHY: amount-sized books (sizing_mode='value') hold USD-mn notionals, not
-- shares. With per-name daily closes now in market_data_daily (Part 1), we can
-- mark the book daily and produce a true NAV/return series for performance_daily,
-- which Part 3's alpha view (book return − TOPIX total return) builds on.
--
-- BASIS (Yuki decision, Option A): measure from POSITION inception. LS positions
-- were all entered 2026-06-02 (verified: 9 filled txns, single date, no prior
-- trades); portfolios.inception_date corrected to 2026-06-02. So the active
-- track record starts 2026-06-02 (NOT the old 2025-04-30 book label). The 265d
-- price history backfilled in Part 1 is pre-position context/charting only and
-- is NOT part of book return. (Pre-6/02 backfill remains a future option per
-- portfolios.backfilled_period_note.)
--
-- METHODOLOGY (approved):
--   per name:  uPnL_usd = signed_qty_usdmn * 1e6 * (close/entry − 1)
--              mv_usd   = signed_qty_usdmn * 1e6 * (close/entry)   (short = negative)
--   book:      nav_close = initial_nav + Σ uPnL_usd
--              close_based_return = nav_close_t / prev_nav − 1
--                 (prev_nav = nav_close_{t-1}; on the first day prev_nav = initial_nav)
--   calculation_method='daily_marked', nav_basis='absolute', entry_mode='live_tracked',
--   nav_source='calculated_from_positions', evidence_level='documented'.
--   ★ UNITS: quantity is USD-mn; multiply by 1e6 so nav/exposures are full USD,
--     matching portfolios.initial_nav (e.g. LS 60,000,000).
--
-- SAFETY / GUARANTEES:
--   * §1 is CREATE OR REPLACE VIEW (read-only, additive). §2 writes ONLY rows for
--     amount-sized books (current_positions.sizing_basis='value' → LS/LO). It can
--     NOT touch MW_TOPS / PJM_MASTER rows (different portfolios, share-sized) and
--     uses a new calculation_method='daily_marked' that does not exist on them.
--   * Past rows immutable: ON CONFLICT updates ONLY today's row
--     (performance_date >= current_date); finalized past rows are left untouched.
--   * Idempotent + re-runnable (daily cron): recompute view → upsert.
--   * LO is empty (no positions) → it produces a flat NAV=initial_nav row only on
--     days it has marks; with zero holdings it yields no marked rows, so LO's flat
--     100M is inserted by the §2b explicit empty-book row (see note) — review.
--
-- KNOWN LIMITATIONS (track-record honesty — agreed; conservative side):
--   * book return is PRICE return only (from close). dividend_income / borrow_fees
--     are NOT modeled. Longs' dividends received and shorts' dividends paid +
--     borrow cost are omitted. Part 3 compares book(price) vs TOPIX(total, incl
--     dividends), so reported alpha is CONSERVATIVE (slightly understated).
--   * performance_daily already has dividend_income / borrow_fees columns; a future
--     revision can populate them and compare total-return vs total-return.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. book_marked_nav_daily — daily marked NAV/return for amount-sized books.
--    Reusable (Part 3 + daily cron). Read-only.
-- ----------------------------------------------------------------------------
create or replace view public.book_marked_nav_daily as
 with holdings as (
   -- static-as-held positions for amount-sized (value) books only.
   -- cp.quantity is signed (long +, short −); avg_cost_price is the entry.
   select cp.portfolio_id, cp.security_id, cp.ticker, cp.side,
          cp.quantity                      as signed_qty_usdmn,
          cp.avg_cost_price                as entry_price,
          cp.first_trade_date
   from current_positions cp
   where cp.sizing_basis = 'value'
     and cp.avg_cost_price is not null and cp.avg_cost_price > 0
 ), marked as (
   select h.portfolio_id, m.trade_date,
          h.side,
          h.signed_qty_usdmn * 1000000.0 * (m.close_price / h.entry_price - 1) as upnl_usd,
          h.signed_qty_usdmn * 1000000.0 * (m.close_price / h.entry_price)     as mv_usd
   from holdings h
   join market_data_daily m
     on m.security_id = h.security_id
    and m.source = 'jquants'
    and m.trade_date >= h.first_trade_date           -- only days the position existed
    and m.close_price is not null
 ), agg as (
   select mk.portfolio_id, mk.trade_date,
          sum(mk.upnl_usd)                                              as price_pnl,
          sum(mk.mv_usd) filter (where mk.side = 'long')                as long_exposure,
          abs(coalesce(sum(mk.mv_usd) filter (where mk.side = 'short'), 0)) as short_exposure,
          count(*) filter (where mk.side = 'long')                      as long_positions_count,
          count(*) filter (where mk.side = 'short')                     as short_positions_count,
          count(*)                                                      as total_positions_count
   from marked mk
   group by mk.portfolio_id, mk.trade_date
 ), navd as (
   select a.portfolio_id, a.trade_date,
          p.initial_nav,
          p.initial_nav + a.price_pnl                                   as nav_close,
          a.price_pnl,
          a.long_exposure, a.short_exposure,
          a.long_exposure + a.short_exposure                            as gross_exposure,
          a.long_exposure - a.short_exposure                            as net_exposure,
          a.long_positions_count, a.short_positions_count, a.total_positions_count
   from agg a
   join portfolios p on p.id = a.portfolio_id
   where a.trade_date >= p.inception_date                               -- never before book inception
 )
 select n.portfolio_id,
        n.trade_date                                                    as performance_date,
        n.nav_close,
        n.price_pnl,
        -- prev NAV = prior trading day's nav_close; first day falls back to initial_nav (cost)
        coalesce(
          lag(n.nav_close) over (partition by n.portfolio_id order by n.trade_date),
          n.initial_nav
        )                                                               as prev_nav,
        n.nav_close / coalesce(
          lag(n.nav_close) over (partition by n.portfolio_id order by n.trade_date),
          n.initial_nav
        ) - 1                                                           as close_based_return,
        n.long_exposure, n.short_exposure, n.gross_exposure, n.net_exposure,
        case when n.nav_close <> 0 then n.gross_exposure / n.nav_close end as gross_leverage,
        case when n.nav_close <> 0 then n.net_exposure  / n.nav_close end as net_leverage,
        n.long_positions_count, n.short_positions_count, n.total_positions_count
 from navd n;


-- ----------------------------------------------------------------------------
-- 2. Upsert performance_daily from the view (calculation_method='daily_marked').
--    Past rows immutable; only today's row (performance_date >= current_date)
--    is refreshed on re-run.
-- ----------------------------------------------------------------------------
insert into public.performance_daily (
  portfolio_id, performance_date, nav_close,
  price_pnl, dividend_income, gross_pnl, net_pnl,
  close_based_return, total_return,
  gross_exposure, net_exposure, long_exposure, short_exposure,
  gross_leverage, net_leverage,
  long_positions_count, short_positions_count, total_positions_count,
  calculation_method, nav_basis, entry_mode, nav_source, evidence_level,
  validation_status, metadata
)
select
  v.portfolio_id, v.performance_date, v.nav_close,
  v.price_pnl, 0 as dividend_income, v.price_pnl as gross_pnl, v.price_pnl as net_pnl,
  v.close_based_return, v.close_based_return as total_return,
  v.gross_exposure, v.net_exposure, v.long_exposure, v.short_exposure,
  v.gross_leverage, v.net_leverage,
  v.long_positions_count, v.short_positions_count, v.total_positions_count,
  'daily_marked', 'absolute', 'live_tracked'::entry_mode,
  'calculated_from_positions'::nav_source, 'documented'::evidence_level,
  'pending',
  jsonb_build_object(
    'source', 'jquants',
    'methodology', 'amount_sized_marked',
    'return_type', 'price_return_only',
    'limitation', 'dividends/borrow not modeled; alpha vs TOPIX total return is conservative'
  )
from public.book_marked_nav_daily v
on conflict (portfolio_id, performance_date) do update set
  nav_close             = excluded.nav_close,
  price_pnl             = excluded.price_pnl,
  gross_pnl             = excluded.gross_pnl,
  net_pnl               = excluded.net_pnl,
  close_based_return    = excluded.close_based_return,
  total_return          = excluded.total_return,
  gross_exposure        = excluded.gross_exposure,
  net_exposure          = excluded.net_exposure,
  long_exposure         = excluded.long_exposure,
  short_exposure        = excluded.short_exposure,
  gross_leverage        = excluded.gross_leverage,
  net_leverage          = excluded.net_leverage,
  long_positions_count  = excluded.long_positions_count,
  short_positions_count = excluded.short_positions_count,
  total_positions_count = excluded.total_positions_count,
  metadata              = excluded.metadata,
  calculated_at         = now()
where performance_daily.performance_date >= current_date;   -- past rows immutable

commit;

-- ----------------------------------------------------------------------------
-- 3. VERIFICATION (run after apply; read-only)
-- ----------------------------------------------------------------------------
-- 3a. LS series (expect 2 rows: 2026-06-02 entry≈cost, 2026-06-03 marked):
-- select p.code, pd.performance_date, round(pd.nav_close,0) nav, round(pd.close_based_return,5) ret,
--        round(pd.gross_exposure,0) gross, round(pd.net_exposure,0) net,
--        pd.long_positions_count l, pd.short_positions_count s, pd.calculation_method, pd.entry_mode
--   from performance_daily pd join portfolios p on p.id=pd.portfolio_id
--  where p.code in ('LS','LO') and pd.calculation_method='daily_marked'
--  order by p.code, pd.performance_date;
--
-- 3b. MW_TOPS / PJM_MASTER untouched (row counts unchanged, no 'daily_marked'):
-- select p.code, count(*) n, string_agg(distinct pd.calculation_method, ',')
--   from performance_daily pd join portfolios p on p.id=pd.portfolio_id
--  where p.code in ('MW_TOPS','PJM_MASTER') group by p.code;
--
-- 3c. NAV sanity: 6/02 nav_close ≈ 60,000,000 (entry-day mark vs fill is tiny);
--     6/03 reflects the day-1 marked move.

-- ----------------------------------------------------------------------------
-- 4. NOTE — LO (empty book): with zero held positions the view yields NO rows
--    for LO, so §2 inserts nothing for LO. If a flat NAV=100M baseline row for
--    LO's inception day is wanted before it holds positions, add it explicitly:
-- insert into public.performance_daily
--   (portfolio_id, performance_date, nav_close, close_based_return, total_return,
--    gross_exposure, net_exposure, long_exposure, short_exposure,
--    long_positions_count, short_positions_count, total_positions_count,
--    calculation_method, nav_basis, entry_mode, nav_source, evidence_level, validation_status)
-- select id, inception_date, initial_nav, 0, 0, 0,0,0,0, 0,0,0,
--        'daily_marked','absolute','live_tracked'::entry_mode,
--        'calculated_from_positions'::nav_source,'documented'::evidence_level,'pending'
--   from portfolios where code='LO'
-- on conflict (portfolio_id, performance_date) do nothing;
-- (Left commented — decide whether an empty book should appear in performance_daily.)
