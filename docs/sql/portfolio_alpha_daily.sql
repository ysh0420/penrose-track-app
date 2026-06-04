-- ============================================================================
-- DRAFT — portfolio_alpha_daily : book return − TOPIX return (daily + cumulative)
-- ============================================================================
-- STATUS: DRAFT. NOT APPLIED. Production apply = Yuki gate ①. Review then run.
-- Target: prdj (prdjmipmkomhvokwrjid).   (Part 3)
--
-- WHY: turn the marked book NAV/return series (performance_daily, calculation_
-- method='daily_marked', from Part 2) into an alpha series vs TOPIX, daily and
-- cumulative, from each book's position inception (LS/LO = 2026-06-02). Feeds
-- Part 4's books.html alpha section.
--
-- BENCHMARK BASIS (Yuki decision, option ii — COALESCE):
--   topix_return = COALESCE(tr_daily_return, pr_daily_return)
--   topix_return_basis = 'total' when TR is present, else 'price' (else 'none').
--   CURRENT STATE: TOPIX TR columns (tr_close_level/tr_daily_return) are NULL
--   (source=yahoo_finance provides price only), so the basis is 'price' today.
--   Because the book itself is price-return-only (Part 2), this is a SYMMETRIC
--   price-vs-price comparison right now — the dividend asymmetry is currently
--   moot. When TOPIX total-return is backfilled, this view AUTO-UPGRADES per row
--   to 'total' with no change here. (Mixed basis can only occur transiently
--   during a partial TR backfill; backfill TR for the full window to avoid it.)
--
-- METHODOLOGY:
--   book_return  = performance_daily.close_based_return (daily, marked).
--   daily_alpha  = book_return − topix_return (same date).
--   cumulative (from inception, compounding daily returns):
--     cum_x_return(d) = exp( Σ_{inception..d} ln(1 + x_return) ) − 1
--   cum_alpha = cum_book_return − cum_topix_return.
--   Window starts at each portfolio's first 'daily_marked' date (= 6/02), so the
--   cumulative is anchored at inception automatically.
--
-- SAFETY:
--   * Read-only: single CREATE OR REPLACE VIEW. No table, no data change.
--   * Scope = performance_daily WHERE calculation_method='daily_marked' → LS/LO
--     only. MW_TOPS/PJM (other methods) are naturally excluded.
--
-- KNOWN LIMITATIONS (track-record honesty):
--   * Today price-vs-price (TOPIX TR not yet backfilled); auto-upgrades to
--     total-vs-... when TR lands. Book remains price-return-only until dividends/
--     borrow are modeled (Part 2 limitation); when TOPIX is on TR but book still
--     price, alpha becomes conservative (book disadvantaged by dividends).
--   * Inception-day (6/02) alignment: book day-1 return is fill→close while TOPIX
--     day-1 is prevclose→close — a tiny one-off mismatch on the first row only.
-- ============================================================================

create or replace view public.portfolio_alpha_daily as
 with topix as (
   -- exactly one TOPIX row per date: prefer a row carrying total return, then
   -- the most recent. Keeps the COALESCE auto-upgrade working and prevents the
   -- join from multiplying if TR is backfilled as a separate source row.
   select distinct on (bv.value_date)
          bv.value_date,
          coalesce(bv.tr_daily_return, bv.pr_daily_return) as topix_return,
          case when bv.tr_daily_return is not null then 'total'
               when bv.pr_daily_return is not null then 'price'
               else 'none' end                             as topix_return_basis
   from benchmark_values bv
   where bv.benchmark_id = (select id from benchmarks where code = 'TOPIX')
   order by bv.value_date,
            (bv.tr_daily_return is not null) desc,          -- prefer total-return rows
            bv.created_at desc                              -- then most recent
 ), base as (
   select pd.portfolio_id,
          pd.performance_date,
          pd.close_based_return as book_return,
          t.topix_return,
          t.topix_return_basis
   from performance_daily pd
   left join topix t on t.value_date = pd.performance_date
   where pd.calculation_method = 'daily_marked'          -- LS/LO marked series only
 )
 select b.portfolio_id,
        b.performance_date                                 as date,
        b.book_return,
        b.topix_return,
        b.topix_return_basis,
        b.book_return - b.topix_return                     as daily_alpha,
        exp(sum(ln(1 + b.book_return))  over w) - 1         as cum_book_return,
        exp(sum(ln(1 + b.topix_return)) over w) - 1        as cum_topix_return,
        (exp(sum(ln(1 + b.book_return))  over w) - 1)
          - (exp(sum(ln(1 + b.topix_return)) over w) - 1)  as cum_alpha
 from base b
 window w as (
   partition by b.portfolio_id
   order by b.performance_date
   rows between unbounded preceding and current row
 );

-- ----------------------------------------------------------------------------
-- VERIFICATION (run after apply; read-only)
-- ----------------------------------------------------------------------------
-- A. LS/LO alpha series (price basis today):
-- select p.code, a.date, a.topix_return_basis,
--        round(a.book_return,5) book, round(a.topix_return,5) topix,
--        round(a.daily_alpha,5) d_alpha,
--        round(a.cum_book_return,5) cum_book, round(a.cum_topix_return,5) cum_topix,
--        round(a.cum_alpha,5) cum_alpha
--   from portfolio_alpha_daily a join portfolios p on p.id=a.portfolio_id
--  order by p.code, a.date;
--
-- B. Confirms only LS/LO appear (MW_TOPS/PJM excluded):
-- select distinct p.code from portfolio_alpha_daily a join portfolios p on p.id=a.portfolio_id;
--
-- C. Basis check — expect 'price' until TOPIX TR is backfilled:
-- select distinct topix_return_basis from portfolio_alpha_daily;
