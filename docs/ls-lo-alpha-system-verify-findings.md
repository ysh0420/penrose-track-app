# LS/LO alpha測定システム — verify-findings (Part 1 着手前ゲート)

STATUS: VERIFY-FINDINGS. 実装コード未着手。Yuki review → green-light まで停止。
Target: prdj Supabase `prdjmipmkomhvokwrjid` (penrose-track) + Brain `jviciwafctmmixgjszam` (penrose-brain) + penrose-track-app
Apply/deploy: Yuki (migrationゲート①、価格 dry-run→live、deploy)

仕様: BUILD BRIEF — LS/LO alpha測定システム 完全実装仕様。優先順 1→2→3→4。

---

## 1. ライブ調査の確定事実 (prdj / Brain を直接probe)

### 1.1 LS book 保有9銘柄 (prdj `current_positions_marked`)
portfolio_id = `db8e33c2-a6a1-47d9-aa3e-ace0d3f78972` (code=LS)。全て TSE / JPY、value-sized。

| ticker | security_id | side | quantity(USD-mn) | avg_cost_price(entry, JPY) | current_price |
|--------|-------------|------|------|-----------|---------------|
| 2802 | 8446bdd6-fa3b-41de-acb9-8a6526a50af3 | long | 7.500 | 5303.00 | **null** |
| 4043 | 8d0e370e-8a99-4b19-bcdd-af3c8e9a10a9 | long | 2.200 | 5183.50 | **null** |
| 4613 | 76f7c431-7499-4330-9db2-a81dfd8e77c5 | short | -1.200 | 2363.50 | **null** |
| 4661 | 4307597c-841c-4c71-b505-529e0edf2a72 | short | -8.000 | 2175.50 | **null** |
| 4975 | c88abe07-f30b-4b20-9588-69593fbb463e | long | 1.000 | 7355.00 | **null** |
| 5016 | abed43a2-fe9b-48f7-a183-e845432f85c0 | short | -1.900 | 3633.00 | **null** |
| 6055 | 9b9f8236-e85d-4789-af28-7cbe3cd0f07a | long | 1.100 | 2013.00 | **null** |
| 7912 | 803821a1-0db4-408e-86d5-c212a0a22b36 | long | 3.100 | 2648.25 | **null** |
| 9064 | f1378e5b-4c99-422d-bab5-fe8f4e893052 | short | -2.000 | 1802.75 | **null** |

`current_price` 全null = 個別銘柄の日次価格ギャップ（仕様の最大ギャップ）を確認。
LO book = 空（保有0）。

### 1.2 ★アーキ上の決定的事実: `latest_prices` は **VIEW**
```sql
-- public.latest_prices definition (prdj)
SELECT DISTINCT ON (security_id) security_id, ticker, exchange,
       trade_date AS as_of_date, close_price, vwap, currency, source, fetched_at
FROM market_data_daily
ORDER BY security_id, trade_date DESC, fetched_at DESC;
```
帰結:
- 価格の書込先は **`market_data_daily` 1テーブルのみ**。`latest_prices` は最新行を自動派生。
- `current_positions_marked` は `latest_prices.close_price` を mark に使う（migration済の value-sized分岐）。
- → market_data_daily に各銘柄の最新closeが1行入れば、view 連鎖で current_price / MV / 含み損益が自動で実値に変わる。**Part 1 に DDL不要**（table も view も既存）。

### 1.3 `market_data_daily` スキーマ・制約・現状 (prdj, BASE TABLE)
列: id(uuid pk), security_id(uuid, NN), ticker(text, NN), exchange(exchange_code, NN), trade_date(date, NN),
open_price, high_price, low_price, close_price, adj_close_price, volume(bigint), vwap, currency(currency_code),
source(text, **NN**), source_raw(jsonb), fetched_at(tz, default now()), is_stale(bool, default false)。
- UNIQUE(security_id, trade_date, source) → **upsert キー**（idempotent backfill 可）。
- 現状 **10行のみ**: 6332 / AAPL、いずれも source=`yahoo_finance`、2026-04-16〜04-22。
  → **9銘柄とは security_id も source も衝突なし**。新規 source=`jquants` で投入すれば既存行は不変。

### 1.4 enum 値
- `exchange_code`: TSE, NSE, FSE, SSE, NYSE, NASDAQ, LSE, HKEX, SGX, OTHER (9銘柄は全て TSE)
- `currency_code`: USD, JPY, GBP, EUR, CHF, HKD, SGD, AUD, CAD (9銘柄は全て JPY)

### 1.5 Brain `penrose_market.price_daily` カバレッジ (②独立・中立データ)
列: symbol(text), trade_date, open, high, low, close, adjusted_close, volume, dollar_volume, source。
- source は **`jquants` のみ**、全体 205,221行、2025-04-17〜2026-06-02。
- symbol 形式 = **プレーン4桁**（5桁JQ形式や `.T` 接尾辞ではない）。
- 9銘柄中 **7銘柄が収録** (4043/4613/4661/4975/5016/6055/9064): 各 inception(4/30)以降 **265行**、4/30〜6/02、**null close ゼロ**。最新closeも entry と整合（4043:5186↔5183.5, 4613:2367↔2363.5, 4975:7380↔7355, 6055:2007↔2013, 9064:1800↔1802.75 等）。
- **2802・7912 は一切未収録**（fuzzy `%2802%`/`%7912%` でもヒット0）= Brain の762ユニバース外。

### 1.6 TOPIX benchmark (Part 3 用、HUB確認の再確認は実装時)
仕様記載: `benchmark_values`(benchmark_id→`benchmarks.code='TOPIX'`), value_date 2025-04-23〜2026-06-03、price return + total return(配当込)。
`benchmarks.code` enum: TOPIX, NIKKEI225, MSCI_JAPAN。→ alpha比較は **total return(配当込)** を使用（Part 3 実装時に列名を確定）。

---

## 2. Part 1 実装設計 (確定)

書込先: **`market_data_daily` のみ**、upsert ON CONFLICT (security_id, trade_date, source)。
対象期間: inception 4/30 〜 最新営業日 (現状 Brain 最新は 6/02; 6/03 closeは未ingest)。
設計方針: **保有銘柄を動的に取得**（current_positions の保有 security から ticker を引く）。当面9銘柄、将来 LO 含む全保有に自動拡張。

データソース 2系統:
- **A. Brain → prdj 転記 (7銘柄, ②独立・中立)**: `penrose_market.price_daily`(jquants) の OHLC/adjusted_close/volume を symbol→security_id でマップし、`market_data_daily` に source=`jquants`(or `brain_jquants`) で upsert。**J-Quants認証・コスト不要**。7 × 265 = **約1,855行**。
- **B. J-Quants 直接取得 (2802, 7912 のみ)**: Brain未収録。J-Quants `/prices/daily_quotes` を 4/30〜で取得。TSE 4桁 + 新形式(234A) 両対応のコード正規化。**コスト/認証発生 → dry-run既定→Yuki承認でlive**。

> 注: A は中立データの内部転記だが、prdj(実投資DB)への書込のため、仕様 Done「dry-run→Yuki live」に従い live 実行は Yuki ゲート。

成果物（実装フェーズ）:
- `scripts/ingest-ls-lo-prices.mjs`（dynamic保有取得 / dry-run既定 `--live` でlive / SUPABASE_SERVICE_KEY 使用 / Brain+J-Quants 両系統）。
- 即時 backfill は MCP(service_role) 経由でも実行可（Yuki承認後）。

MW_TOPS/PJM 無影響: market_data_daily は performance_daily と別テーブル。本Partはそこに触れない。

---

## 3. Part 2-4 設計サマリ（Part 1 green-light後に着手）
- **Part 2**: LS/LO 日次NAV/return → `performance_daily`。MV=quantity×(close/entry)・short符号反転（current_positions_marked準拠）。NAV=initial_nav+Σunrealized_pnl。close_based_return=NAV_t/NAV_{t-1}-1。`calculation_method='daily_marked'`（既存 monthly_ac_compound / backfilled_nav_only と区別）, nav_basis='absolute', entry_mode=live_tracked/backfilled_compiled。過去日は確定後不変。LS initial 60M / LO 100M。draft→Yuki適用①。
- **Part 3**: view `portfolio_alpha_daily`(portfolio_id, date, book_return, topix_return, daily_alpha, cum_alpha) = performance_daily × benchmark_values(TOPIX total return) join。日次alpha=book return−TOPIX return、累積=inception起点。read-only, service_role。draft→Yuki適用①。
- **Part 4**: `books.html` alphaセクション（since-inception book/TOPIX/累積alpha, 直近MTD alpha, 可能なら累積チャート）。deploy=Yuki。

---

## 4. 未決ゲート (Yuki 判断待ち)
1. **2802・7912 の取得元**: J-Quants live取得（コスト/認証、dry-run→承認）でよいか。それとも別ソース（既知の手入力close等）か。
2. **7銘柄 Brain→prdj 転記の live 実行**: 承認方法 — (a) 今すぐ MCP(service_role) で idempotent upsert 実行、(b) `scripts/` にスクリプトを置き Yuki が live 実行。
3. **source ラベル**: market_data_daily.source を `jquants`（Brainと同一）か `brain_jquants`（転記由来を明示）か。

green-light後、Part 1 実装コミット → Part 2/3 migration draft → Part 4 表示、の順で進める。
