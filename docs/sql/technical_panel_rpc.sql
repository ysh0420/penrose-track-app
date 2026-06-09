-- ============================================================================
-- Technical Screen panel RPC — penrose_market.get_technical_panel(text, int)
-- ============================================================================
-- STATUS: ALREADY LIVE in Brain (jviciwafctmmixgjszam). This file DOCUMENTS the
-- running definition — it is NOT an apply script. DO NOT run / migrate it.
-- The live body below was captured read-only via pg_get_functiondef on the
-- deployed function; the panel is operational (high_conviction returns 28 rows).
-- brain-query allowlist: "get_technical_panel":"penrose_market" added + Edge
-- Function redeployed (version 32, ACTIVE, verify_jwt true) on 2026-06-09.
--
-- WHAT: a transparent, read-only panel over penrose_market.superior_signals_daily
-- (a precomputed daily table carrying the technical strength + alpha flags). Four
-- buckets surfaced as panel tabs, selected by p_bucket:
--   high_conviction   — rows flagged high_conviction (default)
--   superior_long     — superior rows with side = 'LONG'
--   superior_short    — superior rows with side = 'SHORT'
--   alpha_only_short  — in_alpha_screen, NOT superior, effective side = 'SHORT'
-- Candidate SIEVE, not investment advice; layer ① only, independent of the ②
-- live LS/LO book.
--
-- ARGS (passed through verbatim by the brain-query gateway / getTechnicalPanel):
--   p_bucket text   default 'high_conviction'  (permissive: case/punctuation-
--                   insensitive, accepts aliases hc/long/short/alpha/… — see norm)
--   p_limit  int    default 100                (frontend currently requests 25)
--
-- RETURNS jsonb {as_of, bucket, count, disclaimer, rows[]} where each row =
--   {rank, side, symbol, company_name, sector, strength_pct, rsi_14,
--    timing, alpha_risk_adj}
-- (Note: `side` is the effective side — COALESCE(side, sign of alpha_risk_adj).
--  There is no `limit` key in the payload. timing ∈ CONSTRUCTIVE/EXTENDED/NEUTRAL.)
--
-- SECURITY (as deployed):
--   * Read-only (language sql STABLE). No writes, no AI triggers.
--   * SECURITY DEFINER; search_path pinned to penrose_market, public.
--   * Execute is granted (function is live and callable via the service-role
--     gateway). Browser never queries Brain directly — only via brain-query (JWT).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- LIVE DEFINITION (verbatim from pg_get_functiondef — reference only, DO NOT apply)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION penrose_market.get_technical_panel(
  p_bucket text DEFAULT 'high_conviction'::text,
  p_limit  integer DEFAULT 100
)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'penrose_market', 'public'
AS $function$
  WITH norm AS (
    SELECT CASE lower(regexp_replace(COALESCE(p_bucket,''), '[^a-zA-Z0-9]', '', 'g'))
      WHEN 'highconviction' THEN 'high_conviction' WHEN 'hc' THEN 'high_conviction'
      WHEN 'conviction' THEN 'high_conviction' WHEN 'high' THEN 'high_conviction'
      WHEN 'superiorlong' THEN 'superior_long' WHEN 'suplong' THEN 'superior_long'
      WHEN 'long' THEN 'superior_long' WHEN 'longs' THEN 'superior_long'
      WHEN 'superiorshort' THEN 'superior_short' WHEN 'supshort' THEN 'superior_short'
      WHEN 'short' THEN 'superior_short' WHEN 'shorts' THEN 'superior_short'
      WHEN 'alphaonlyshort' THEN 'alpha_only_short' WHEN 'alphaonly' THEN 'alpha_only_short'
      WHEN 'alphashort' THEN 'alpha_only_short' WHEN 'alpha' THEN 'alpha_only_short'
      ELSE 'high_conviction' END AS bk),
  rd AS (SELECT max(run_date) AS d FROM penrose_market.superior_signals_daily),
  base AS (
    SELECT s.*, COALESCE(s.side, CASE WHEN s.alpha_risk_adj<0 THEN 'SHORT' WHEN s.alpha_risk_adj>0 THEN 'LONG' END) AS eff_side
    FROM penrose_market.superior_signals_daily s, rd WHERE s.run_date = rd.d),
  picked AS (
    SELECT f.* FROM base f, norm WHERE CASE
      WHEN norm.bk='high_conviction'  THEN f.high_conviction
      WHEN norm.bk='superior_long'    THEN f.superior AND f.side='LONG'
      WHEN norm.bk='superior_short'   THEN f.superior AND f.side='SHORT'
      WHEN norm.bk='alpha_only_short' THEN f.in_alpha_screen AND NOT f.superior AND f.eff_side='SHORT'
      ELSE f.high_conviction END),
  ranked AS (
    SELECT *, row_number() OVER (ORDER BY eff_side, CASE WHEN eff_side='LONG' THEN strength_pct ELSE -COALESCE(strength_pct,0) END DESC NULLS LAST) AS rnk
    FROM picked)
  SELECT jsonb_build_object(
    'as_of', (SELECT d FROM rd),
    'bucket', (SELECT bk FROM norm),
    'count', (SELECT count(*) FROM picked),
    'disclaimer', 'Technical screen for research only; not investment advice.',
    'rows', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'rank', rnk, 'side', eff_side, 'symbol', symbol, 'company_name', company_name,
        'sector', sector, 'strength_pct', strength_pct, 'rsi_14', rsi_14,
        'timing', timing, 'alpha_risk_adj', alpha_risk_adj) ORDER BY rnk)
      FROM ranked WHERE rnk <= p_limit), '[]'::jsonb));
$function$;

-- ----------------------------------------------------------------------------
-- §3. ALLOWLIST / EDGE — DONE.
--   "get_technical_panel": "penrose_market" is in the brain-query ALLOWED_RPCS;
--   Edge Function brain-query redeployed → version 32, ACTIVE, verify_jwt true.
--   js/brain-queries.js → getTechnicalPanel(bucket, limit) passes
--   { p_bucket: bucket, p_limit: limit }, forwarded verbatim to the RPC.
--
-- §4. VERIFICATION (read-only)
-- select jsonb_pretty(penrose_market.get_technical_panel('high_conviction', 25));
-- select jsonb_pretty(penrose_market.get_technical_panel('superior_long', 25));
-- select jsonb_pretty(penrose_market.get_technical_panel('superior_short', 25));
-- select jsonb_pretty(penrose_market.get_technical_panel('alpha_only_short', 25));
-- ============================================================================
