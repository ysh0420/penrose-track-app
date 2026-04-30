# Penrose Japan Track Record — Methodology

**Last updated**: 2026-04-30

## Portfolio

- **Code**: MW_TOPS (internal)
- **Display name**: MW TOPS (PENROSE-JP-LON)
- **Platform**: Marshall Wace TOPS (alpha capture platform)
- **Inception**: 2025-04-30
- **Book size**: USD 30M (target); $22M deployed as of Apr 30 2026
- **Base currency**: USD
- **Benchmark**: TOPIX
- **Strategy**: long_short, Japan equities

## Performance Measurement — Alpha Capture Basis

```
AC = (alpha_vs_TOPIX + absolute_return) / 2
   = absolute_return - TOPIX_return / 2
```

## Sign Convention (CRITICAL)

**Portal red cells = NEGATIVE values.** This applies to:
- % columns (% Chg On Position, % Chg Today, % Chg MTD)
- $ P&L columns (Total PL MTD, Total PL Since Inception)

When transcribing portal data to backups/dashboards, **always store with proper sign**:
- Black/no-color number = positive (store as positive)
- Red number = negative (store as negative, prepend `-`)

**Examples** (Apr 30 2026):
- Fast Retailing (9983) SHORT: avg 70,118 → last 73,590 (price up 4.95%) → Total PL MTD shown as `99,039` in red on portal = **stored as `-99,039`**
- Yamato (9064) SHORT: Total PL Since Inception shown as `29,700` in red = **stored as `-29,700`**
- Nippon Sanso (4091) LONG: Total PL Since Inception shown as `210,876` in red = **stored as `-210,876`**

**Why portal uses this convention**: portal displays absolute value of $ amount and uses color to indicate sign. Without the color, just the number, you'd misread loss as profit.

## NAV Trajectory (Alpha Capture basis)

| Date | Cum AC | NAV $M | Source |
|---|---|---|---|
| 2025-04-30 | 0.00% | 30.000 | Inception |
| 2025-12-30 | +25.65% | 37.695 | Koyfin CSV |
| 2026-01-30 | +30.05% | 39.014 | MW Jan +3.50% |
| 2026-02-27 | +45.01% | 43.501 | MW Feb +11.50% (peak) |
| 2026-03-31 | +34.13% | 40.238 | MW Mar -7.50% |
| 2026-04-30 | +39.96% | 41.989 | MW Apr +4.35% (12-month milestone) |

## Data Sources

### CY2025 (May-Dec 2025)
Koyfin daily CSV export, 217 trading days. Monthly AC computed from cumulative point-to-point.

### CY2026 (Jan-Apr)
MW TOPS platform (PENROSE-JP-LON) monthly Overall Performance reports.

### Daily evolution (Apr 2026)
8 portal snapshots: Apr 10, 14, 17, 23, 24, 27, 28, 30.

## Sign Audit Log

- **2026-04-30**: Comprehensive sign audit. All backup snapshots reviewed and corrected. Apr 27, 28, 30 backups updated to reflect proper negative signs for losing positions (Fast Retailing short -$99K MTD/LTD, Yamato short -$30K LTD, Nippon Sanso LTD -$211K). Earlier backups (Apr 23, 24) verified — no sign changes needed since 9983 short was still in profit (price had moved down) and 9064 had not yet accumulated enough loss.

## Recovery Instructions

1. **HTML files**: Clone `ysh0420/penrose-track-app` → `track-record.html` (public) and `mw-tops-attribution.html` + `mw-tops-transactions.html` (private)
2. **Data**: Restore from `backups/YYYY-MM-DD-snapshot.json` (most recent: Apr 30)
3. **Edge functions**: Recreate from `edge-functions/*.ts`
4. **Sign convention**: Critical — see Sign Convention section above

See `README.md` for full recovery runbook.
