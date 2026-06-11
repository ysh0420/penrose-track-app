# Technicals Screener v2 (Confluence) — verify-findings (Part 1)

STATUS: Part 1 (confluence + divergence calibration) DONE, validated read-only against Brain
(`jviciwafctmmixgjszam`) on as_of **2026-06-05**. This is the spec for the Part 2 RPC
`fn_get_technicals_screener_v2`. **v1 is preserved**: v2 is a SEPARATE RPC, separate branch,
separate page/tab. v1's `fn_get_technicals_screener` and its page are NOT touched.

This implements the two core ideas of Yuki's Notion report "Technicals Screener & TradingView
Strategy — Reference v1.0": **confluence counting** (how many *independent* categories agree, not a
weighted blend) and **divergence detection**. Layer ① candidate sieve, NOT investment advice;
independent of the ② live LS/LO book.

## Idea 1 — Confluence = count of INDEPENDENT categories (0–4)
The report's rule: only DIFFERENT categories count. RSI+Stoch+MACD is NOT 3 confluence (all
momentum). True confluence = trend + momentum + structure + volume = 4 independent lenses.
4 categories, each casts **one** 0/1 vote (multiple indicators inside a category still = 1 vote).
`confluence_count` (0–4) is the PRIMARY rank; v1-style weighted score is the tiebreak within a tier.

### Category votes (oriented by p_side)
LONG (long setup):
- **trend**: `pct_from_sma_50 > 0 AND sma_50 > sma_200` (close > 50MA > 200MA)
- **momentum**: `rsi_14 BETWEEN 45 AND 72` OR `macd_histogram > 0` OR `bullish_divergence`
- **volume**: `rel_volume_20d > 1` (strong if > 1.5)
- **structure**: a `bb_breakout_up` or `golden_cross` pattern in the last 5 sessions
SHORT (short setup):
- **trend**: `pct_from_sma_50 < 0 AND sma_50 < sma_200` (close < 50MA < 200MA)
- **momentum**: `rsi_14 < 50` OR `macd_histogram < 0` OR `bearish_divergence`
- **volume**: `rel_volume_20d > 1`
- **structure**: a `bb_breakout_down` or `death_cross` pattern in the last 5 sessions

`technical_patterns` (Brain) supplies structure: available types are bb_breakout_up (11k),
bb_breakout_down (5k), death_cross, golden_cross, plus rsi_* (treated as momentum, not structure).
No chart-geometry patterns exist, so structure = BB-breakout / MA-cross, per the data.

## Idea 2 — Divergence (the report's "most powerful RSI signal"), simple version
Price vs RSI direction mismatch, measured against the **recent peak/trough over a 7-session
window** (more faithful than a fixed 5-day lag, and it catches Yuki's cited 8035 case):
- **bearish_divergence** = `price_change_5d_pct > 2` AND `(max(rsi_14) over last 7) − rsi_14 ≥ 8`
  AND that recent RSI peak ≥ 65  → price up but RSI rolled off a high peak.
- **bullish_divergence** = `price_change_5d_pct < −2` AND `rsi_14 − (min rsi_14 over last 7) ≥ 8`
  AND that recent RSI trough ≤ 35 → price down but RSI turning up off a low.
Divergence is ONE confluence input (into the momentum vote) AND surfaced as a row badge.
Perfect swing detection is not attempted (the report itself says divergence needs confirmation).

**Validation (8035, the cited example)**: RSI peaked 80.4 then fell to 66.7 (drop 13.7) while price
rose +13.4% over 5d → **bearish_divergence = true** ✓. Names that are merely overbought without a
fade (285A RSI 79.7 at its peak, 5310, 6479) correctly return false. Totals on 6/05: 21 bearish,
17 bullish — selective, not over-firing.

## Calibrated pools (confluence_count distribution, 2026-06-05)
- **momentum (long, whole universe)**: cc4 = **18**, cc3 = 50, cc2 = 256 → `ORDER BY confluence
  DESC, score DESC LIMIT 20` yields the 18 four-confluence names + top 2 threes (15–25 ✓).
- **reversal (long, base `rsi_14<45 OR bollinger_position<0.3`)**: cc3 = 2, cc2 = 36 (cc≥2 = 38)
  → top 20 well-formed. Counter-trend names rarely reach 4 (trend vote is off) — expected.
- **overheated (short, base `rsi_14>60 OR pct_from_sma_200>15`)**: cc3 = 1, cc2 = 16 (cc≥2 = 17)
  → top ~17–20. High-confluence shorts are scarce — matches the report (short setups need
  confirmation; an overbought name with only bearish divergence = 1 confluence = caution, not a trade).

`confluence_count` meaningfully separates conviction: strong uptrends light all 4; counter-trend /
exhaustion setups light 1–2 until trend + structure + volume confirm.

## Scoring (tiebreak only) — transparent, per-preset (same weights as v1)
Within an equal `confluence_count` tier, order by the v1 preset-matched weighted sum (momentum /
reversal / overheated formulas — see `technicals-screener-verify-findings.md`). Primary sort is
always `confluence_count DESC`, then `score DESC`. A small divergence emphasis is exposed as a
badge rather than baked opaquely into the score.

## Presets → side + base universe (p_side overridable)
| preset | default side | base universe filter | confluence oriented |
|---|---|---|---|
| momentum | long | (none; confluence selects) | long |
| reversal | long | `rsi_14<45 OR bollinger_position<0.3` | long |
| overheated | short | `rsi_14>60 OR pct_from_sma_200>15` | short |

## Validation snapshot — momentum top (all confluence 4, T/M/V/S = 1111)
4047 関東電化工業 (84.9), 5310 東洋炭素, 4078 Sakai Chemical, 8035 東京エレクトロン, 5332 TOTO,
6323 ローツェ, 6227 AIメカテック, 9824 Senshu Electric, 9831 ヤマダ, 2730 エディオン,
6055 ジャパンマテリアル, 8173 Joshin … (semiconductor materials/equipment cluster). Names resolve
via company_classification → koyfin_returns COALESCE (v1 fallback, 761/762).

## Guardrails
- Read-only RPC (sql STABLE, SECURITY DEFINER, pinned search_path); no writes, no AI triggers.
- Browser → brain-query allowlist only; new RPC name `fn_get_technicals_screener_v2` added + Edge
  redeploy is a post-apply step (Claude Code after Yuki applies the RPC).
- ① info layer; ② live book independent (no holdings). "Technical screen, not investment advice".
- confluence rules + divergence + thresholds are rule-based and documented here + in the RPC.
- track-app is Yuki-only → names/sectors/metrics shown; koyfin names stay in-app (no public output).
- **v1 untouched** (separate RPC/page/branch).
