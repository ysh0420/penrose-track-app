# Archived — Technicals Screener v2 (Confluence)

**Archived 2026-06-11** during the Screener consolidation. The live **Technical
Screen** page (`/technical-screen.html`, RPC `get_technical_panel`) became the
single **"Screener"** in the Brain nav. Screener v1 was deleted outright; this
v2 draft is kept here pending a decision to fold its ideas in or drop them.

## Status
- The RPC `penrose_market.fn_get_technicals_screener_v2` was **never applied** to
  Brain and is **not** on the brain-query allowlist, so the page only ever showed
  a "pending" state. Nothing live depends on it.
- Not wired into `platform-nav.js`. The in-page `v1` link is dead (v1 removed).

## What v2 was meant to add over the live Technical Screen
The two are **different methodologies**, not versions of one thing. The live
Technical Screen ranks off `superior_signals_daily` — a multi-timeframe
"superior" signal combined with RSI timing and an alpha intersection, served as
precomputed buckets (`high_conviction` / `superior_long` / `superior_short` /
`alpha_only_short`). Screener v2 instead ranks by **confluence count**: how many
of four *independent* categories agree — Trend, Momentum, Volume, Structure, one
0/1 vote each — as the primary sort, plus **divergence detection** (price vs RSI)
as a momentum input and a badge. It is parameterized by `preset`
(momentum/reversal/overheated) and `side` (auto/long/short). In short, v2 is a
transparent multi-factor *confluence sieve*; the live panel is a precomputed
*superior-signal* panel. Folding v2 in would mean applying the RPC and exposing
confluence either as an extra Screener column/filter or as a preset.

## To revive
1. Apply `technicals_screener_v2_rpc.sql` to Brain (`jviciwafctmmixgjszam`) —
   **Yuki gate** (DDL is out of normal scope).
2. Add `fn_get_technicals_screener_v2` to the brain-query allowlist + redeploy.
3. Restore a nav entry and move the html/js back under the served root (the page
   script is currently imported with a relative path from this folder).

## Files
- `technicals-screener-v2.html` — page
- `page-technicals-screener-v2.js` — page logic (calls `getTechnicalsScreenerV2`
  in `js/brain-queries.js`, which was left intact)
- `technicals_screener_v2_rpc.sql` — the unapplied draft RPC
- `technicals-screener-v2-verify-findings.md` — calibration notes
