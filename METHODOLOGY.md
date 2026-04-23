# Penrose Japan Track Record — Methodology

**Last updated**: 2026-04-23

## Portfolio

- **Code**: MW_TOPS (internal)
- **Display name**: MW TOPS (PENROSE-JP-LON)
- **Platform**: Marshall Wace TOPS (alpha capture platform)
- **Inception**: 2025-04-30
- **Book size**: USD 30M (target); $21M deployed as of Apr 23 2026
- **Base currency**: USD
- **Benchmark**: TOPIX
- **Strategy**: long_short, Japan equities
- **Max positions**: typically 8-12
- **Reporting**: monthly AC basis

## Performance Measurement — Alpha Capture Basis

The **alpha capture basis** (AC) is the primary performance metric:

```
AC = (alpha_vs_TOPIX + absolute_return) / 2
   = absolute_return - TOPIX_return / 2
```

### Examples

| Period | Absolute | TOPIX | Alpha | AC |
|---|---|---|---|---|
| Apr 30 2025 → Dec 30 2025 | +38.9% | +26.5% | +12.4pp | +25.65% |
| Apr 30 2025 → Mar 19 2026 | +71.2% | +34.7% | +36.5pp | +53.85% |

### Monthly vs Cumulative

- **Monthly AC**: `(alpha_monthly + absolute_monthly) / 2` — compound these to get cumulative trajectory
- **Cumulative AC (point-to-point)**: `(alpha_cum + absolute_cum) / 2` applied at each period boundary — equivalent to compounding monthly ACs when returns are small

For this portfolio:
- **CY2025 monthly AC returns** are derived from Koyfin daily CSV (point-to-point at each month end)
- **CY2026 monthly AC returns** are MW platform reported figures

### MW Platform Formula (official)

The MW portal calculates **Overall Performance** slightly differently:

```
Overall Performance = (Skill Factor + % Return from Target Fund Size) / 2
```

Where:
- **Skill Factor**: MW proprietary quality-adjusted metric
- **% Return from Target Fund Size**: P&L / Target Fund Size (30M)

For practical purposes, MW's Overall Performance ≈ our AC basis (same average-of-two logic, slightly different components).

## Data Sources

### CY2025 (May-Dec 2025)
- **Source**: Koyfin daily CSV export (`mw_tops_full_tracking.xlsx` Daily Return tab)
- **Method**: 217 daily points → extracted month-end cumulative Portfolio % and TOPIX %
- **Cum AC** at each month end computed via formula above
- **Monthly AC** = change between consecutive month-end Cum AC values
- **Evidence level**: `documented`

### CY2026 (Jan-Apr)
- **Source**: MW TOPS platform (PENROSE-JP-LON) monthly reports
- **Method**: Overall Performance % as-reported by MW
- **NAV trajectory**: compound from Dec 2025 end ($37.695M AC) using monthly AC returns
- **Evidence level**: `partial` (portal snapshots, not fully audited)

### Position Attribution (CY2025 reference)
- **Source**: `mw_tops_full_tracking.xlsx` aggregate tab (10 positions)
- **Period**: Apr 30 2025 → Dec 31 2025 (reframed from original xlsx Mar 19 2026 end)
- **Note**: xlsx shows position-level returns × weights on $165M notional — this reflects 10 trades rotated on $30M book, not simultaneous holdings. Book NAV trajectory (+25.65% AC to Dec 2025) differs from position-aggregate (+53.85% AC)
- **Evidence level**: `partial`

### Current Holdings (live)
- **Source**: MW TOPS portal screenshots (Apr 10, 14, 17, 23 for evolution; Apr 23 for current state)
- **Evidence level**: `partial`
- **Live tracking starts**: 2026-04-23

## Key NAV Trajectory Points

| Date | Cum AC | NAV (AC $M) | Source |
|---|---|---|---|
| 2025-04-30 | 0.00% | 30.000 | Inception (documented) |
| 2025-12-30 | +25.65% | 37.695 | Koyfin CSV month-end |
| 2026-01-30 | +30.05% | 39.014 | MW Jan +3.50% |
| 2026-02-27 | +45.01% | 43.501 | MW Feb +11.50% (peak) |
| 2026-03-31 | +34.13% | 40.238 | MW Mar -7.50% |
| 2026-04-22 | +36.64% | 40.992 | MW Apr MTD +1.87% |

## Evidence Levels

- `documented` — fully verifiable (Koyfin CSV, primary data)
- `partial` — approximate (MW portal snapshots, xlsx aggregates)
- `best_recall` — reconstructed from memory

## Recovery Instructions

If data is lost or system needs rebuilding:

1. **HTML files**: Clone `ysh0420/penrose-track-app` → `track-record.html` (public) and `mw-tops-attribution.html` (private)
2. **Data**: Restore from `backups/YYYY-MM-DD-snapshot.json` (most recent)
3. **Edge functions**: Recreate from `edge-functions/*.ts` source files in this repo
4. **Supabase schema**: Refer to `schema/` folder (migrations 033-043)

See `README.md` for full recovery runbook.

## Methodology Changes Log

- **2026-04-23**: Adopted "alpha actual average basis" officially — (alpha + absolute)/2 formula
- **2026-04-23**: Reframed xlsx data as CY2025 reference only (May-Dec); CY2026 uses MW monthly reports
- **2026-04-23**: Dec 2025 reference point corrected from +53.85% AC (xlsx aggregate) to +25.65% AC (book NAV)
