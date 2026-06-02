-- ============================================================================
-- DRAFT — securities Japanese-name backfill from Brain company_classification
-- ============================================================================
-- STATUS: DRAFT. DO NOT RUN unattended. Yuki review + manual execution only.
-- Cross-DB: SOURCE = Brain (jviciwafctmmixgjszam) penrose_market.company_classification (1,001 rows);
--           TARGET = prdj (prdjmipmkomhvokwrjid) public.securities.
-- Goal: populate securities.name (Japanese) for TSE tickers that are missing it,
--       using the Shikiho-derived names already in Brain.
--
-- ⚠️ DECISIONS FOR YUKI (do not auto-resolve):
--   1. topix_sector is NOT sourced here. company_classification carries
--      `toyo_keizai_sector` (東洋経済60種), a DIFFERENT taxonomy from
--      securities.topix_sector. There is no 1:1 crosswalk — populating
--      topix_sector needs a separate mapping or the Koyfin source. This script
--      only touches `name`.
--   2. Overwrite policy: this script fills name ONLY where it is currently
--      missing or non-Japanese (non-destructive). It does NOT overwrite an
--      existing Japanese name. Confirm this is desired.
--   3. exchange assumed 'TSE' for all (company_classification is the JP
--      universe). Confirm no non-TSE codes.
--   4. INSERT of brand-new securities is included but DISABLED by default
--      (commented) — decide whether unknown tickers should be auto-created or
--      left for manual review. securities has NO unique constraint on ticker,
--      so all matching is on (ticker, exchange).
--
-- securities has NO unique(ticker) constraint -> all matches use (ticker,'TSE').
-- ============================================================================


-- ----------------------------------------------------------------------------
-- STEP 1 (run on BRAIN jviciwafctmmixgjszam): export source rows.
-- ----------------------------------------------------------------------------
-- Export the result of this to CSV (1,001 rows; ~908 have Japanese-script names):
--
--   select symbol as ticker, company_name, toyo_keizai_sector
--   from penrose_market.company_classification
--   order by symbol;


-- ----------------------------------------------------------------------------
-- STEP 2 (run on PRDJ prdjmipmkomhvokwrjid): load into a staging table.
-- ----------------------------------------------------------------------------
-- Load the Step-1 CSV into this staging table (e.g. via \copy or the SQL editor).
create table if not exists public.securities_jp_name_import (
  ticker             text not null,
  company_name       text not null,
  toyo_keizai_sector text
);
-- truncate public.securities_jp_name_import;   -- if re-loading
-- \copy public.securities_jp_name_import (ticker, company_name, toyo_keizai_sector) from 'company_classification_export.csv' csv header;


-- ----------------------------------------------------------------------------
-- STEP 3 (PRDJ): DRY-RUN preview — how many would update / insert. Run first.
-- ----------------------------------------------------------------------------
select
  (select count(*) from public.securities_jp_name_import) as staged_rows,
  (select count(*) from public.securities_jp_name_import i
     join public.securities s on s.ticker = i.ticker and s.exchange = 'TSE'
     where (s.name is null or s.name = '' or s.name !~ '[ぁ-んァ-ン一-龯]')) as would_update,
  (select count(*) from public.securities_jp_name_import i
     where not exists (select 1 from public.securities s where s.ticker = i.ticker and s.exchange = 'TSE')) as not_in_securities;


-- ----------------------------------------------------------------------------
-- STEP 4 (PRDJ): backfill. Review the dry-run, then run inside a transaction.
-- ----------------------------------------------------------------------------
begin;

-- 4a. Non-destructive UPDATE: fill name only where missing / non-Japanese.
update public.securities s
set name = i.company_name,
    updated_at = now()
from public.securities_jp_name_import i
where s.ticker = i.ticker
  and s.exchange = 'TSE'
  and (s.name is null or s.name = '' or s.name !~ '[ぁ-んァ-ン一-龯]');

-- 4b. (OPTIONAL — DISABLED) Insert tickers not present in securities.
--     Uncomment only after Yuki confirms auto-create + verifies NOT NULL columns
--     on securities (security_type / currency / country may be required).
-- insert into public.securities (ticker, exchange, name, currency, is_active)
-- select i.ticker, 'TSE', i.company_name, 'JPY', true
-- from public.securities_jp_name_import i
-- where not exists (select 1 from public.securities s where s.ticker = i.ticker and s.exchange = 'TSE');

-- Inspect results, then COMMIT or ROLLBACK manually:
-- commit;
rollback;  -- DRAFT default: no write. Change to commit; after review.

-- ----------------------------------------------------------------------------
-- CLEANUP (optional): drop public.securities_jp_name_import when done.
-- ----------------------------------------------------------------------------
