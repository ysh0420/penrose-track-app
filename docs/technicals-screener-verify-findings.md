# Technicals Screener (① information layer) — verify-findings (Part 1)

STATUS: Part 1 (distribution study + threshold calibration) DONE, validated read-only against
Brain (`jviciwafctmmixgjszam`) on as_of **2026-06-05**. Thresholds/scores below are the spec for
the Part 2 RPC. This is layer ① (information / candidate sieve) — **a screen, NOT investment
advice**; final judgement is Yuki's. It is independent of ② (the prdj live LS/LO book); no
holdings are mixed in.

## Why this design (closing the 4 past-failure modes)
1. **Too many signals** → each preset returns the **top N (default 20, cap 25) by score**, not the
   whole market. Hard filters keep the candidate pool small (24 / 47 / 17 — see below).
2. **Technicals alone are weak** → every row is joined to **company_name + toyo_keizai_sector**
   (and supply-chain tags available) so a hit is a *discovery entry point with context*, not a bare
   ticker. (Validation already showed coherent clusters: semicap names in Momentum, rail defensives
   in Reversal, semi-materials/carbon in Overheated.)
3. **Disconnected from Yuki's thinking** → positioned explicitly as a **"candidate sieve"**; Yuki
   decides. UI carries a "technical screen, not investment advice" banner.
4. **No interpretation** → each row carries a **rule-based one-liner** (not AI) built from its own
   metrics.

## Data source
- `penrose_market.technicals_daily` — 762 symbols, latest `trade_date` 2026-06-05, low NULLs
  (rsi 4, sma_200 18, bbpos 4, rel_vol 4, macd_hist 11, ret_1m 11). No `close` column →
  "close>sma50>sma200" is derived as `pct_from_sma_50 > 0 AND sma_50 > sma_200`.
- `bollinger_position` scale confirmed **0 = lower band, 1 = upper band** (observed range
  −0.05…1.335, p50 0.43). "near BB lower" = `<= 0.2`; "above BB upper" = `>= 1.0`.
- `penrose_market.company_classification` (latest as_of) — LEFT JOIN on `symbol`: **581/762**
  carry company_name + toyo_keizai_sector (all 581 have both). The other ~181 (mostly non-JP)
  render **code-only** — never dropped.
- Prev trading day exists (6 sessions in last 7 days) → "MACD improving" = today's
  `macd_histogram` > previous session's, via a self-join on the prior `trade_date`.

## Presets — calibrated thresholds (hard filters) and pool sizes
Distribution-tuned so each pool is selective but non-empty; final output is `ORDER BY score DESC
LIMIT p_limit`.

### A · Momentum / Breakout  (long candidates) — pool **24**
`pct_from_sma_50 > 0 AND sma_50 > sma_200 AND rsi_14 BETWEEN 55 AND 75 AND macd_histogram > 0
 AND price_change_1m_pct > 0 AND rel_volume_20d > 1`
(rel_vol>1 is already ~top-16%, p90=1.10; rsi capped at 75 to exclude the overbought tail.)

### B · Reversal / Oversold  (contrarian "pick-up" candidates) — pool **47**
`rsi_14 < 35 AND bollinger_position <= 0.2`
Bounce / MACD-improvement are **scored, not hard-filtered**, so still-falling oversold names remain
visible as watch candidates rather than being excluded.

### C · Overheated / Caution  (short / caution candidates) — pool **17**
`rsi_14 > 70 AND bollinger_position >= 0.85 AND pct_from_sma_200 > 15`
(Overheating is genuinely scarce in this tape now — rsi>75 alone is only 15 names; this combo of
high RSI + near/above BB upper + extension from the 200MA gives 17, the right size.)

## Scoring — transparent weighted sums (0–100, documented; NOT a black box)
Each term is clamped/normalized to 0–100, then a fixed-weight sum. Weights chosen to rank by the
preset's intent; all are in the RPC comments too.

**A (momentum strength):**
`0.30·trend + 0.25·mom3m + 0.20·mom1m + 0.15·volume + 0.10·rsi_quality`
- trend = clamp(pct_from_sma_200,0,50)/50 · 100
- mom3m = clamp(price_change_3m_pct,0,40)/40 · 100  ·  mom1m = clamp(price_change_1m_pct,0,20)/20 · 100
- volume = (clamp(rel_volume_20d,1,3)−1)/2 · 100
- rsi_quality = max(0, 100 − |rsi_14−65|/10·100)   (prefers ~65, not the overbought edge)

**B (oversold depth + stabilization):**
`0.35·oversold_rsi + 0.25·bb_depth + 0.20·bounce + 0.20·macd_improving`
- oversold_rsi = clamp((35−rsi_14)/15,0,1)·100   ·  bb_depth = clamp((0.2−bbpos)/0.2,0,1)·100
- bounce = price_change_1d_pct>0 ? clamp(price_change_1d_pct,0,5)/5·100 : 0
- macd_improving = macd_histogram > prev_macd_histogram ? 100 : 0

**C (overheating extremity):**
`0.30·rsi_excess + 0.30·extension + 0.20·bb_break + 0.20·surge`
- rsi_excess = clamp(rsi_14−70,0,15)/15·100   ·  extension = clamp(pct_from_sma_200−15,0,45)/45·100
- bb_break = clamp(bbpos−0.85,0,0.4)/0.4·100   ·  surge = clamp(price_change_5d_pct,0,15)/15·100

## Interpretation — rule-based one-liner (built in SQL, no AI)
- A: `Uptrend (px>50>200MA, +{p200}% vs 200MA), RSI {rsi}, MACD+, vol {relvol}x; 1m +{ret1m}%`
- B: `RSI {rsi} oversold, BB {bbpos} (lower); {+x% today (bounce) | x% today}{, MACD improving}`
- C: `RSI {rsi} overbought, +{p200}% vs 200MA (extended), BB {bbpos}{ (>upper)}`

## Validation snapshot (top of each preset, 2026-06-05)
- A: 4078 (82.4), 5333 NGK, 8035 東京エレクトロン, TOTO, フジミ, ローツェ … (semicap cluster)
- B: 1419 タマホーム (RSI25, bb0.12, +5.7% bounce, MACD↑), JR西/JR東海/東京地下鉄 (rail defensives)
- C: 5310 東洋炭素 (RSI78, +68% vs200MA, bb1.10), ミネベア (RSI83), 285A キオクシア (+316% vs200MA)

## Guardrails (carried into Part 2/3)
- RPC is **read-only** (sql STABLE, SECURITY DEFINER, pinned search_path); no writes, no AI triggers.
- Browser never queries Brain directly → only via the `brain-query` Edge Function allowlist (JWT);
  new RPC added to `ALLOWED_RPCS` + redeploy is a Yuki step.
- track-app is **Yuki-only (auth-gated)** → full display OK (names, sectors, all metrics). Paid prose
  columns (`feature_text` / `company_profile` / `customers`) are **not** selected; only
  name/sector/(optional tags). Public outputs (Substack/LP) keep the existing paid-raw protection.
- Thresholds + score weights are transparent and documented here + in the RPC.

## v1 status — COMPLETE & LIVE (2026-06-06)
- **RPC applied** in Brain (jviciwafctmmixgjszam) by Yuki via MCP (gate ①). Self-verified by
  direct call (service-role): `momentum` 20 rows (pool 24, top 4078), `reversal` 20 (pool 47,
  top タマホーム), `overheated` 17 (top 東洋炭素); interpretation renders, as_of 2026-06-05.
- **brain-query allowlist registered + redeployed**: `"fn_get_technicals_screener":"penrose_market"`
  added to `ALLOWED_RPCS`; Edge Function brain-query redeployed → **version 24, ACTIVE, verify_jwt
  true**. Endpoint smoke (anon-only) returns HTTP 401 "Invalid token" = live + auth enforced.
- **Frontend** on branch `feat/technicals-screener` (off main): `technicals-screener.html`,
  `js/page-technicals-screener.js`, `getTechnicalsScreener` wrapper, Brain › Screener nav.
  Pushed; PR not opened (gh not authenticated → compare URL handed to Yuki). Yuki merges.
- **3 presets operational**; design goal (technicals × sector context, top-N, rule-based
  interpretation) confirmed against live data.

### TODO (Yuki absent — non-blocking)
- Full JWT-path test (logged-in Yuki session → brain-query → 200 with rows): could not mint a
  user JWT headless; server pieces all verified, so this is a final UI smoke once Yuki signs in.
- Open the PR (gh auth) and merge `feat/technicals-screener` → main.
- Optional next: per-symbol drill-through into /stock.html; a "Yuki watchlist only" filter;
  daily as_of freshness badge.
