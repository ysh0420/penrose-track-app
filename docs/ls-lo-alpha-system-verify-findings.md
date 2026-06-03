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

## 4. Part 1 確定 — J-Quants 正式ソース方針 (Yuki決定 2026-06-03)

価格は **J-Quants を正式ソース**とし、prdj が J-Quants から直接取得する（Brain転記は不採用）。
理由: 実bookの証跡性・自己完結、9銘柄ソース一貫、将来の銘柄追加・日次更新も J-Quants で回す。
→ **9銘柄全て（2802/7912含む）を J-Quants から取得** → `market_data_daily` に source='jquants' で upsert。

### 4.1 J-Quants 認証の所在 (確認済・値は非記録)
- 正式 v2 認証モジュール: `penrose-research-engine/scripts/ingest/jquants/auth.ts`
- v2 は **恒久 API キーを `x-api-key` ヘッダで渡す方式**（旧 email/password→refreshToken→idToken は不要）。
- 必要 env: **`JQUANTS_API_KEY` のみ**。`penrose-research-engine/.env` に設定済を **キー名と長さのみで確認**（値は非取得）:
  `JQUANTS_API_KEY`(43字, x-api-key用), `JQUANTS_EMAIL`(22字), `JQUANTS_PASSWORD`(16字)。EMAIL/PASSWORD は v1 レガシーで v2 クライアントは読まない。
- penrose-track-app には .env の JQUANTS キーなし → **実行は engine（キー＋v2ライブラリ所在）= Option A 確定**。
- ⚠️ **prdj 書込 config ギャップ**: engine/.env の書込先は `SUPABASE_URL` + `SUPABASE_SERVICE_KEY` の1組のみで **Brain 向け**。engine から prdj に upsert するには prdj の URL + service key を engine .env に追加要（例 `TRACK_SUPABASE_URL` / `TRACK_SUPABASE_SERVICE_KEY`）。または prdj 書込のみ MCP(service_role) 経由で実施。
- ⚠️ セキュリティ: `penrose-secrets-backup/.env.bak-before-bom-fix` に JQUANTS の **平文認証情報**が存在。本ドキュメント・コミット・メモリには値を一切記録しない。.env もコミット禁止（.gitignore 済を要確認）。

### 4.2 取得 API・コード形式 (確認済)
- 既存 v2 ライブラリ流用可: `penrose-research-engine/scripts/ingest/jquants/{client,prices,constants,types,upsert}.ts`。
- エンドポイント: `GET https://api.jquants.com/v2/equities/bars/daily?code=XXXXX&from=YYYYMMDD&to=YYYYMMDD`（ページング `data`）。`fetchSingleCodeRange(code, from, to)` がそのまま使える。
- **コード変換: API は4桁/5桁レガシー両方を受理**（`prices.ts` 明記）→ 9銘柄の4桁コードはそのまま送信可。新形式(234A)も4桁でそのまま。返却 `Code` は5桁(4桁+'0', 例 2802→"28020")なので、**取込時に末尾'0'を除いて 4桁→security_id にマップ**。
- v2 フィールド(短縮名): `Date, Code, O,H,L,C, Vo(volume), Va, AdjFactor, AdjO/H/L/C(AdjC=調整後close), AdjVo`。
  → market_data_daily マップ: O→open_price, H→high_price, L→low_price, C→close_price, AdjC→adj_close_price, Vo→volume, currency='JPY', exchange='TSE', source='jquants', trade_date=Date, vwap=(H+L+C)/3。
- レート制限: 200ms間隔(~5req/s)、429/5xx は 30→60→120→240→480s backoff(最大5)。

### 4.3 動的銘柄取得の修正点 (確認済)
- 既存 `fetch-market-data` の `discoverTickers` は `get_active_security_universe` RPC（**prdjに存在しない**）→ fallback `positions` テーブル（**0行**）→ pending_trades の順。**現状9銘柄を拾えない**（market_data_daily に 6332/AAPL しか無い理由）。
- **動的探索は `current_positions` ビュー（9 distinct security を返す）を使う**。これで LO・銘柄追加に自動追随。

### 4.4 dry-run（live コール未実施・取得予定の見積）
| 項目 | 値 |
|---|---|
| 取得銘柄 | 9（current_positions 動的取得: 2802,4043,4613,4661,4975,5016,6055,7912,9064 / 全TSE/JPY） |
| 期間 | 2025-04-30 〜 最新営業日（Brain実績で 4/30〜6/02 = **265 営業日**、6/03は未ingestの可能性） |
| API 呼出 | 銘柄ごと range 1コール × 9 ＋ ページング（範囲265日なら各1〜数ページ）≒ **9〜30 リクエスト** |
| 認証コール | **0**（v2 は x-api-key ヘッダのみ、token交換なし） |
| 取得行数(見込) | 9 × ~265 ≒ **約2,385 行** を market_data_daily に upsert(冪等, UNIQUE(security_id,trade_date,source)) |
| 増分コスト | **0**（J-Quants v2 はサブスク定額、Brainで稼働中。9銘柄追加の従量課金なし）。負荷=レート制限内で軽微 |
| 既存データ影響 | source='jquants' で投入 → 既存 yahoo_finance 行(6332/AAPL)と別キー、不変。MW_TOPS/PJM の performance_daily は別テーブルで無影響 |

### 4.5 live 実行アーキの選択肢 (Yuki 判断)
- **Option A（engine実行・最速）**: `penrose-research-engine` に取込スクリプト追加（JQUANTS_API_KEY と v2ライブラリと既存 approval-contract パターンが揃っている）。`fetchSingleCodeRange` で9銘柄を 4/30〜取得→prdj market_data_daily に upsert（prdj URL + `SUPABASE_SERVICE_KEY` を engine .env に要設定）。既存 `run_jquants_historical_fetch.ts` + approval-contract を踏襲。J-Quants認証は engine 内に留まる。
- **Option B（prdj自己完結・②方針に最も整合）**: prdj edge secrets に `JQUANTS_API_KEY` を追加し、prdj `fetch-market-data` に J-Quants ソース経路を追加＋`discoverTickers` を current_positions ベースに修正。daily-orchestrator で日次更新もprdj内で完結。v2クライアントを Deno へ移植、認証が2プロジェクトに広がる。

いずれも dry-run既定→`--live`/承認で実行。DB書込は service_role（`SUPABASE_SERVICE_KEY`）。

## 5. 未決ゲート (Yuki 判断待ち → green-light後に Part 1 実装)
1. **live実行アーキ**: Option A（engine実行・最速で alpha 即出る）か Option B（prdj自己完結・恒常運用向き）か。
2. （Option B の場合）prdj edge secrets への `JQUANTS_API_KEY` 追加可否。
3. dry-run 見積（§4.4: 9銘柄×265日≒2,385行, 増分コスト0）承認 → live 取得 → upsert。

green-light後、Part 1 実装コミット → Part 2/3 migration draft → Part 4 表示、の順で進める。
