# Zeon 4205 - Internal Model-Book Report v2

作成日: 2026-05-17
対象: 日本ゼオン / Zeon Corporation (4205)
用途: Penrose internal model-book decision memo。外部配布用レポートではない。
更新: Koyfin Chrome CSV / screenshot pack を Source Run 化し、財務・資本構成の確認を追加。

## 1. レコメンデーション要約

| 項目 | 内容 |
| --- | --- |
| Penrose action | Maintain core long。現値では追い買いしない |
| 現在株価 | 2,245 JPY |
| 現在ウェイト | 約3.69% |
| 実行価格帯 | 約1,952から1,988 JPY |
| Koyfin 12M平均目標株価 | 2,051.11 JPY |
| Koyfin目標レンジ | Low 1,700 / High 2,500 JPY |
| Koyfin implied return | 平均目標まで -8.64%、Highまで約+11.4%、Lowまで約-24.3% |
| Analyst rating | 平均3.67、Buy表記。Strong Buy 1 / Buy 3 / Hold 4 / Sell 0 / Strong Sell 1 |
| Koyfin Chrome CSV確認 | LTM売上 412.0bn、EBIT 36.4bn、純利益 36.2bn、希薄化EPS 186.58、現金 28.7bn、Debt 16.0bn、Common Equity 377.6bn |
| ポジション示唆 | 4%超へ上がる場合はリスクバンド管理。追加はrevision確認または押し目待ち |

結論は「保有継続、追加なし」。会社側の一次情報で FY2025 実績、FY2026 ガイダンス、COP/SWCNT 投資、株主還元姿勢は確認済み。今回の Koyfin Chrome CSV で、LTM 財務と資本構成も会社IRの数値と概ね整合した。一方、株価はすでに Koyfin 平均目標を上回り、過去1年リターンも大きい。ここからは「良い会社だから追加」ではなく、「revision と technical の確認を待つ」局面。

## 2. 投資結論と市場の誤解

市場がまだ過小評価している可能性があるのは、単年度の決算ビートそのものではなく、COP、光学フィルム、電池材料、SWCNT、資本効率改善が同時に進むことで、素材株としての低い評価が徐々に上がるシナリオである。

ただし現時点では、新規で強く買い上がる局面ではない。株価は過去1年で大きく上昇し、Koyfin の12カ月平均目標株価を上回っている。Sell-side rating は全員強気でも全員弱気でもなく、ユーザーが好む「期待が極端に偏った逆張り」にはまだ該当しない。むしろ、買い方の期待が一部入った後の検証局面と見るべき。

## 3. Koyfin Chrome CSV で追加確認したこと

今回の Chrome capture は2本の manifest から Source Run 化した。Price Target と Income Statement の小パック、Actuals/Consensus・Estimate Trends・Balance Sheet・Cash Flow・Multiples・Enterprise Value・Profitability・Solvency・ROIC の大パックである。

CSVで実際に数値抽出できたのは主に Income Statement と Enterprise Value。Actuals/Consensus、Balance Sheet、Cash Flow、Multiples、Profitability、Solvency、ROIC は CSV ファイル自体は取れたが、値が空の row-label export だったため、screenshot artifact として保存した。

| Koyfin row | 直近確認値 |
| --- | ---: |
| Total Revenues | FY2026 / Current LTM 412.0bn JPY |
| Gross Profit | 121.2bn JPY |
| EBITDA | 55.8bn JPY |
| EBIT | 36.4bn JPY |
| Net Income | 36.2bn JPY |
| Basic EPS | 186.67 JPY |
| Diluted EPS | 186.58 JPY |
| Normalized diluted EPS | 128.42 JPY |
| Cash and short-term investments | 28.7bn JPY |
| Total Debt | 16.0bn JPY |
| Total Common Equity | 377.6bn JPY |

Koyfin の FY2026 / Current LTM ラベルは、Zeon 公式の FY2025 実績、すなわち売上 411.966bn、営業利益 36.377bn、親会社株主帰属純利益 36.226bn、EPS 186.67、希薄化後 EPS 186.58 と整合する。したがって、Koyfin の fiscal label はそのまま投資判断に使わず、会社IRの年度ラベルへ読み替えて扱う。

財務の読みは以下。

- Gross margin は約29.4%、EBIT margin は約8.8%、EBITDA margin は約13.5%、net margin は約8.8%。
- 現金 28.7bn、Debt 16.0bn なので、Koyfin 表示ベースでは約12.7bn のネットキャッシュ。
- Common Equity 377.6bn は会社IRの純資産 378.252bn とほぼ一致する。
- FY2026会社計画の営業利益 38.0bn に対し、LTM EBIT 36.4bn。大きなジャンプを織り込むというより、改善継続の確認が必要。

この追加CSVで「基礎財務が Koyfin 上でも壊れていない」ことは強まったが、追加買いの根拠になるほどの revision evidence ではない。

## 4. 会社概要と価値ドライバー

Zeon はエラストマー、特殊化学品、高機能材料を持つ素材企業。今回の投資論点は、汎用素材サイクルだけではなく、高機能材料と資本配分の改善にある。

主要ドライバーは以下。

- COP: 新プラントは遅延なし、FY2028上期完成予定。
- SWCNT: 徳山工場で能力を10倍超へ拡張、2026年秋に建設開始、2028年本格稼働予定。
- 光学フィルム、電池材料: 高機能材料側の収益性を支える。
- 株主還元: FY2025年間配当76 JPY、FY2026/FY2027予想配当79 JPY。自己株取得10mn株 / 10.0bn JPY は完了済み。
- ポートフォリオ規律: Toupe株式売却予定に伴う損失見込みなど、保有資産の整理も進む。

## 5. 一次情報確認

FY2025実績は会社資料と TDnet で確認済み。

| 指標 | FY2025実績 |
| --- | ---: |
| 売上高 | 411.966bn JPY |
| 営業利益 | 36.377bn JPY |
| 経常利益 | 40.038bn JPY |
| 親会社株主帰属純利益 | 36.226bn JPY |
| EPS | 186.67 JPY |
| 希薄化後EPS | 186.58 JPY |
| 総資産 | 548.246bn JPY |
| 純資産 | 378.252bn JPY |
| 自己資本比率 | 68.9% |

FY2026会社計画は売上405.0bn JPY、営業利益38.0bn JPY、経常利益37.0bn JPY、純利益36.0bn JPY。前提は USD/JPY 150、EUR/JPY 175、国産ナフサ 63,000 JPY/KL、アジアブタジエン 950 USD/MT。ホルムズ海峡封鎖影響は含まれていない。

Koyfin Chrome CSV は、売上・利益・EPS・資本構成についてこの一次情報との整合確認になった。最終数値は一次資料を優先し、Koyfin は trend / consensus / valuation / market expectation の補助として使う。

## 6. バリュエーションと期待値

Koyfin visual の目標株価レンジでは、現在株価 2,245 JPY は平均目標 2,051.11 JPY を上回る。High target 2,500 JPY までは余地が残るが、平均ベースでは下振れを示している。

したがって、ここからの上昇には以下のいずれかが必要。

- FY2025後に EPS、EBIT、目標株価が上方修正される。
- COP/SWCNT の事業化確度が市場により高く評価される。
- 株主還元や資産整理により、PBR/ROE 改善の見方が強まる。
- 株価が押して、既存 thesis に対する期待値が下がる。

現時点の正しい読みは「既に保有している優位性を維持し、追加判断は外部期待値の更新を待つ」。Koyfin CSV で基礎財務は補強されたが、平均目標を上回る価格でリスクを増やす材料ではない。

## 7. センチメントと逆張り読み

Analyst distribution は Strong Buy 1、Buy 3、Hold 4、Sell 0、Strong Sell 1。これは極端な買い一色でも売り一色でもない。

ユーザーの好む逆張り観点では、all buy に近い場合は期待が入り切っている可能性、all sell に近い場合は悪材料が織り込まれすぎている可能性を見る。Zeon はそのどちらでもなく、mixed-to-constructive である。ただし株価が平均目標を上回ったため、sell-side の平均期待値に対してはすでに先行している。

このため、rating は買いの根拠ではなく、期待値 crowding の警戒材料として使う。

## 8. 海外セクター・リードラグと TradingView テクニカル

今回の v2 でも、海外セクター・リードラグと TradingView テクニカルはまだ決定材料に昇格していない。理由は、Zeon 固有の海外ピア screen、TradingView の RSI / MACD / 20-200DMA / support-resistance pack が未取得だからである。

現時点で使えるのは、Koyfin visual の過去1年株価リターン、現在株価が平均目標株価を上回っていること、そして今回の Koyfin Chrome CSV で LTM 財務が一次資料と整合したことまで。したがって technical read は「entry timing には慎重、fundamental thesis は維持」とする。RSI や moving average を確認するまで、breakout 追随の判断はしない。

## 9. Bear / Base / Bull

| Scenario | 見方 | 株価・行動の目安 |
| --- | --- | --- |
| Bear | FY2026ガイダンスが強すぎ、COP/SWCNT期待も遠い。consensus revision が下向き | Koyfin low target 1,700 JPY方向。weight削減を検討 |
| Base | FY2026は会社計画近辺、株主還元と高機能材料の見方は維持。ただしrevision未確認 | 2,050から2,250 JPY近辺。core long maintain |
| Bull | FY2025後のrevisionが上向き、COP/SWCNTの確度が上がり、資本効率改善も続く | Koyfin high target 2,500 JPY超を狙える。追加はデータ確認後 |

## 10. 7人の投資家委員会

| Lens | 判定 |
| --- | --- |
| Value | 平均目標株価を上回っており、単純な割安ではない |
| Quality | 高機能材料、COP、SWCNT、自己資本比率は支えになる |
| Momentum | 株価は強いが、追随には revision / technical 確認が必要 |
| Event | COP/SWCNT、自己株取得後の資本政策、資産整理がイベント |
| Risk | FY2026前提、原料、輸出数量、capex、commercialization が主要リスク |
| Governance / capital allocation | 配当・自己株取得・資産整理はプラス |
| Skeptic | Analyst mix は極端ではなく、平均目標超えは期待先行の警戒材料 |

委員会結論は5対2で「Maintain」。強い追加買いではなく、既存ポジションの検証継続が妥当。

## 11. Catalysts

1. FY2025後の consensus revision 確認: EPS、EBIT、目標株価が上がるか。
2. Koyfin target / rating / estimates table の再取得: CSV または安定スクリーンショットで revision を確認する。
3. COP新プラント: FY2028上期完成予定が維持されるか。
4. SWCNT能力増強: 2026年秋着工、2028年本格稼働に向けた顧客・収益化証拠。
5. 株主還元: 配当79 JPY予想と自己株取得後の追加資本政策。
6. 資産整理: Toupe株式売却など、資本効率改善の継続。

## 12. Risks / Thesis Breaks

- FY2026ガイダンスが実際には強すぎ、エラストマー、原料、輸出数量の悪化で未達リスクが高まる。
- COP の稼働時期、capex、採算が会社説明より悪化する。
- SWCNT が能力増強先行で、顧客採用や売上寄与が見えない。
- 資産売却や還元が一過性で、ROE改善につながらない。
- FY2025ビート後にも consensus revision が出ず、株価だけが先行する。
- 株価上昇でポジションが4%を超え、銘柄固有リスクが大きくなる。

## 13. Source Cross-Check

一次確認済み。

- Zeon IR FY2025決算資料
- TDnet FY2025決算短信
- Zeon FY2025 results presentation
- Zeon SWCNT capacity expansion release
- Zeon IR calendar

補助ソース。

- Perplexity Word deep dive
- Koyfin PNG financial / target / ratings screenshots
- Koyfin Chrome CSV / screenshot pack
- 旧Koyfin financial model pack
- Penrose model-book position data

Source Run / synthesis tracking。

- Perplexity Source Run: `e3d0e119-f6fe-4daf-bb90-6a834e8af3a9`
- Koyfin PNG Source Run: `b7a2e36b-74aa-484a-8651-f12e7d82f882`
- Codex primary-source verification Source Run: `00704163-b893-4780-8175-d5ad3a5dfda3`
- User target/rating visual Source Run: `305b56ea-d38f-4a72-b5f0-ed51e60a38ac`
- Koyfin Chrome CSV Source Run: `4531f1a9-f510-4dca-b92d-fc9f82dc46cf`
- Koyfin Chrome synthesis: `fc87d9be-15b8-4ef4-9552-4a7e019b70e5`

矛盾・留保。

- Perplexity の将来Q1 FY2026決算日 claim は、2026-05-17時点の公式IR calendarで未確認。日付カタリストとしては使わない。
- Koyfin target、NTM EPS、FY2027からFY2030の consensus net income は、画像または一部 visual 由来。CSV/tableで再取得できたら更新する。
- Koyfin の Actuals/Consensus、Multiples、Profitability、Solvency、ROIC CSV は今回値が空だった。スクリーンショットは保存済みだが、数値としては未昇格。
- EDINET mirror では Zeon の最新行を確認できなかった。FY2026/03有価証券報告書の捕捉後に更新する。

## 14. Penrose View

Penrose View は「core long maintain」。現在の weight 約3.69% は許容範囲内。4%を超える場合は、thesis-driven add ではなく risk-band management として扱う。

追加条件は明確にする。

- 株価押し目で平均目標株価や基礎バリュエーションに対する余裕が戻る。
- FY2025後の Koyfin / consensus revision が明確に上方へ動く。
- COP/SWCNT で一次情報または信頼できる市場データが追加される。
- TradingView technicals が過熱ではなく、entry timing を支持する。

この条件がない限り、次のアクションは「保有、監視、revision/technical/EDINET更新待ち」。

## 15. 残るデータギャップ

- Koyfin CSV/table: target average/high/low の履歴、EPS GAAP NTM、EBIT NTM、EV/EBITDA NTM、P/E NTM、1M/3M/6M revisions、analyst count。
- TradingView technical pack: RSI、20/50/100/200DMA、volume confirmation、support/resistance。
- 海外ピア / sector lead-lag: chemicals、specialty materials、battery materials、optical film peers。
- EDINET annual securities report。
- COP/SWCNT の顧客・収益化データ。
