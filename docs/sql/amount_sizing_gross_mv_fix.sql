-- ============================================================================
-- DRAFT — correct gross_amount / market-value for amount-sized (USD-mn) positions
-- ============================================================================
-- STATUS: DRAFT. NOT APPLIED. Production apply = Yuki gate ①. Review then run manually.
-- Target: prdj (prdjmipmkomhvokwrjid).
--
-- WHY: LS/LO books are sized by AMOUNT (sizing_mode='value'): transactions.quantity
-- holds the USD-mn amount (e.g. 7.5), not shares. So the existing formulas
--   gross_amount = quantity * price   and   market_value = quantity * close_price
-- are meaningless for those rows (USD-mn × ¥price). This migration makes the
-- amount-sized branch meaningful while leaving share-sized rows (sizing_mode
-- 'quantity' — MW_TOPS, PJM_MASTER) BYTE-FOR-BYTE UNCHANGED.
--
-- SAFETY / GUARANTEES:
--   * Non-destructive: only CREATE OR REPLACE FUNCTION / VIEW. No DROP, no data
--     change (the optional backfill in §4 is commented out + guarded).
--   * Branch key = sizing_mode. Share-sized positions take the ELSE branch =
--     the ORIGINAL formula -> MW_TOPS / PJM_MASTER output is unchanged.
--   * MW_TOPS performance_daily / attribution_daily / risk_metrics_daily are
--     SEPARATE tables, not touched here.
--   * current_positions gains one appended column (sizing_basis) — additive;
--     CREATE OR REPLACE VIEW appends columns only, existing order preserved.
--   * current_positions_marked keeps the exact same column list/order/types;
--     only the market_value_local / unrealized_pnl_local expressions branch.
--   * Consistent with the 9 existing LS rows (quantity=$mn) and books.html.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. record_trade — gross_amount branch by sizing_mode (filled orders only).
--    Reproduced verbatim from the live definition with ONE change (see ★).
-- ----------------------------------------------------------------------------
create or replace function public.record_trade(
  p_portfolio_code text, p_action text, p_ticker text, p_exchange text, p_quantity numeric,
  p_price numeric default null, p_trade_date date default current_date, p_currency text default null,
  p_commission numeric default 0, p_rationale text default null, p_decision_id uuid default null,
  p_price_source text default 'pending', p_sizing_mode text default 'quantity',
  p_sizing_input_value numeric default null, p_sizing_reference_price numeric default null,
  p_sizing_reference_source text default null, p_order_type text default 'market',
  p_limit_price numeric default null, p_limit_valid_until date default null
) returns jsonb language plpgsql security definer as $function$
DECLARE
    v_portfolio_id uuid; v_security_id uuid; v_currency text; v_txn_id uuid;
    v_gross numeric; v_net numeric; v_txn_type transaction_type; v_pos_side position_side;
    v_signed_qty numeric; v_exchange_code exchange_code; v_effective_price_source price_source;
    v_order_type order_type; v_order_status order_status; v_price_for_position numeric; v_effective_price numeric;
BEGIN
    IF p_action NOT IN ('buy','sell','short','cover') THEN RAISE EXCEPTION 'Invalid action: %', p_action; END IF;
    SELECT id INTO v_portfolio_id FROM portfolios WHERE code = p_portfolio_code;
    IF v_portfolio_id IS NULL THEN RAISE EXCEPTION 'Portfolio not found: %', p_portfolio_code; END IF;

    v_exchange_code := p_exchange::exchange_code;
    v_security_id := upsert_security(p_ticker, v_exchange_code);
    v_order_type := p_order_type::order_type;

    IF p_currency IS NOT NULL THEN v_currency := p_currency;
    ELSE v_currency := CASE v_exchange_code
        WHEN 'TSE' THEN 'JPY' WHEN 'NYSE' THEN 'USD' WHEN 'NASDAQ' THEN 'USD' WHEN 'LSE' THEN 'GBP'
        WHEN 'HKEX' THEN 'HKD' WHEN 'SGX' THEN 'SGD' WHEN 'SSE' THEN 'CNY' WHEN 'NSE' THEN 'INR'
        WHEN 'FSE' THEN 'EUR' ELSE 'USD' END;
    END IF;

    v_txn_type := CASE p_action WHEN 'buy' THEN 'buy'::transaction_type WHEN 'sell' THEN 'sell'::transaction_type
        WHEN 'short' THEN 'short_sell'::transaction_type WHEN 'cover' THEN 'cover'::transaction_type END;
    v_pos_side := CASE p_action WHEN 'buy' THEN 'long'::position_side WHEN 'sell' THEN 'long'::position_side
        WHEN 'short' THEN 'short'::position_side WHEN 'cover' THEN 'short'::position_side END;
    v_signed_qty := CASE p_action WHEN 'buy' THEN ABS(p_quantity) WHEN 'sell' THEN -ABS(p_quantity)
        WHEN 'short' THEN -ABS(p_quantity) WHEN 'cover' THEN ABS(p_quantity) END;

    IF v_order_type = 'limit' THEN
        IF p_limit_price IS NULL OR p_limit_price <= 0 THEN RAISE EXCEPTION 'Limit order requires limit_price > 0'; END IF;
        v_order_status := 'pending_limit'::order_status; v_effective_price_source := 'pending'::price_source;
        v_effective_price := NULL; v_gross := NULL; v_net := COALESCE(p_commission,0); v_price_for_position := NULL;
    ELSE
        IF p_price IS NULL THEN
            v_order_status := 'pending_enrichment'::order_status; v_effective_price_source := 'pending'::price_source;
            v_effective_price := NULL; v_gross := NULL; v_net := COALESCE(p_commission,0); v_price_for_position := NULL;
        ELSE
            v_order_status := 'filled'::order_status; v_effective_price_source := p_price_source::price_source;
            v_effective_price := p_price;
            -- ★ amount-sizing: gross is the USD-mn amount itself (quantity); share-sizing unchanged.
            IF p_sizing_mode = 'value' THEN
                v_gross := ABS(p_quantity);
            ELSE
                v_gross := ABS(p_quantity) * p_price;
            END IF;
            v_net := v_gross + COALESCE(p_commission,0);
            v_price_for_position := p_price;
        END IF;
    END IF;

    INSERT INTO transactions (
        portfolio_id, security_id, decision_id, transaction_date, transaction_type,
        quantity, price, gross_amount, commission, net_amount, currency, notes, source,
        price_source, price_enriched_at, sizing_mode, sizing_input_value, sizing_reference_price,
        sizing_reference_source, order_type, order_status, limit_price, limit_valid_until
    ) VALUES (
        v_portfolio_id, v_security_id, p_decision_id, p_trade_date, v_txn_type,
        ABS(p_quantity), v_effective_price, v_gross, COALESCE(p_commission,0), v_net,
        v_currency::currency_code, p_rationale, 'dashboard', v_effective_price_source,
        CASE WHEN v_effective_price IS NOT NULL THEN now() ELSE NULL END,
        p_sizing_mode::sizing_mode, p_sizing_input_value, p_sizing_reference_price, p_sizing_reference_source,
        v_order_type, v_order_status, p_limit_price, p_limit_valid_until
    ) RETURNING id INTO v_txn_id;

    IF v_price_for_position IS NOT NULL AND v_order_status = 'filled' THEN
        PERFORM record_position_snapshot(
            p_portfolio_code := p_portfolio_code, p_ticker := p_ticker, p_exchange := v_exchange_code,
            p_snapshot_date := p_trade_date, p_side := v_pos_side, p_quantity := v_signed_qty,
            p_avg_cost_price := v_price_for_position, p_current_price := v_price_for_position,
            p_currency := v_currency::currency_code, p_notes := p_rationale);
    END IF;

    RETURN jsonb_build_object('ok', true, 'transaction_id', v_txn_id, 'portfolio', p_portfolio_code,
        'action', p_action, 'order_type', p_order_type, 'order_status', v_order_status, 'ticker', p_ticker,
        'exchange', p_exchange, 'quantity', p_quantity, 'price', v_effective_price, 'limit_price', p_limit_price,
        'limit_valid_until', p_limit_valid_until, 'price_source', v_effective_price_source,
        'sizing_mode', p_sizing_mode, 'sizing_input', p_sizing_input_value, 'currency', v_currency,
        'trade_date', p_trade_date, 'gross_amount', v_gross);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$function$;


-- ----------------------------------------------------------------------------
-- 2. current_positions — append sizing_basis (value iff all filled txns value-sized).
--    Existing columns + order preserved; sizing_basis appended last (additive).
-- ----------------------------------------------------------------------------
create or replace view public.current_positions as
 WITH filled_txns AS (
   SELECT t.portfolio_id, t.security_id, t.transaction_type, t.quantity, t.price, t.transaction_date, t.sizing_mode,
     CASE t.transaction_type::text
       WHEN 'buy' THEN abs(t.quantity) WHEN 'sell' THEN -abs(t.quantity)
       WHEN 'short_sell' THEN -abs(t.quantity) WHEN 'cover' THEN abs(t.quantity) ELSE 0::numeric END AS signed_qty
   FROM transactions t
   WHERE t.is_void = false AND t.order_status = 'filled'::order_status
     AND (t.transaction_type::text = ANY (ARRAY['buy','sell','short_sell','cover']))
 ), agg AS (
   SELECT ft.portfolio_id, ft.security_id,
     sum(ft.signed_qty) AS quantity,
     sum(ft.quantity * ft.price) FILTER (WHERE ft.transaction_type::text = 'buy') AS buy_notional,
     sum(ft.quantity) FILTER (WHERE ft.transaction_type::text = 'buy') AS buy_qty,
     sum(ft.quantity * ft.price) FILTER (WHERE ft.transaction_type::text = 'short_sell') AS short_notional,
     sum(ft.quantity) FILTER (WHERE ft.transaction_type::text = 'short_sell') AS short_qty,
     min(ft.transaction_date) AS first_trade_date, max(ft.transaction_date) AS last_trade_date,
     count(*) AS trade_count,
     bool_and(coalesce(ft.sizing_mode::text,'quantity') = 'value') AS all_value_sized
   FROM filled_txns ft GROUP BY ft.portfolio_id, ft.security_id
 )
 SELECT agg.portfolio_id, agg.security_id, s.ticker, s.exchange, s.currency AS position_currency,
   agg.quantity,
   CASE WHEN agg.quantity > 0 THEN 'long'::position_side WHEN agg.quantity < 0 THEN 'short'::position_side
        ELSE 'flat'::position_side END AS side,
   CASE WHEN agg.quantity > 0 AND agg.buy_qty > 0 THEN agg.buy_notional / agg.buy_qty
        WHEN agg.quantity < 0 AND agg.short_qty > 0 THEN agg.short_notional / agg.short_qty
        ELSE NULL::numeric END AS avg_cost_price,
   agg.buy_qty, agg.short_qty, agg.first_trade_date, agg.last_trade_date, agg.trade_count,
   CASE WHEN agg.all_value_sized THEN 'value' ELSE 'quantity' END AS sizing_basis   -- ★ appended
 FROM agg JOIN securities s ON s.id = agg.security_id
 WHERE agg.quantity <> 0::numeric;


-- ----------------------------------------------------------------------------
-- 3. current_positions_marked — branch MV / unrealized PnL by sizing_basis.
--    Same column list/order/types; only the two expressions change.
--    sizing_basis='quantity' -> ORIGINAL formulas (MW_TOPS / PJM_MASTER unchanged).
-- ----------------------------------------------------------------------------
create or replace view public.current_positions_marked as
 SELECT cp.portfolio_id, cp.security_id, cp.ticker, cp.exchange, cp.position_currency,
   cp.quantity, cp.side, cp.avg_cost_price, cp.first_trade_date, cp.last_trade_date, cp.trade_count,
   lp.close_price AS current_price, lp.as_of_date AS price_date,
   CASE
     WHEN cp.sizing_basis = 'value'
       -- amount marked-to-market: amount × (mark/entry); falls back to amount (×1) when unmarked
       THEN cp.quantity * COALESCE(lp.close_price / NULLIF(cp.avg_cost_price, 0), 1)
     ELSE cp.quantity * lp.close_price                         -- shares × price (ORIGINAL)
   END AS market_value_local,
   CASE
     WHEN cp.avg_cost_price IS NOT NULL AND lp.close_price IS NOT NULL THEN
       CASE
         WHEN cp.sizing_basis = 'value'
           THEN cp.quantity * (lp.close_price / NULLIF(cp.avg_cost_price, 0) - 1)   -- amount × return
         ELSE (lp.close_price - cp.avg_cost_price) * cp.quantity                    -- ORIGINAL
       END
     ELSE NULL::numeric
   END AS unrealized_pnl_local,
   CASE
     WHEN cp.avg_cost_price IS NOT NULL AND cp.avg_cost_price > 0::numeric
       THEN (lp.close_price - cp.avg_cost_price) / cp.avg_cost_price *
            CASE WHEN cp.side = 'long'::position_side THEN 1 ELSE '-1'::integer END::numeric
     ELSE NULL::numeric
   END AS unrealized_pnl_pct                                   -- UNCHANGED (return %; valid for both)
 FROM current_positions cp
   LEFT JOIN latest_prices lp ON lp.security_id = cp.security_id;

commit;


-- ----------------------------------------------------------------------------
-- 4. OPTIONAL backfill (DISABLED) — the 9 existing LS rows have gross_amount = NULL.
--    The view fix already renders them correctly (books.html uses quantity/entry),
--    so this is cosmetic. Enable only if Yuki wants stored gross populated.
--    DRY-RUN preview first:
-- select count(*) as value_rows_missing_gross
--   from transactions where sizing_mode='value' and order_status='filled' and gross_amount is null;
--
-- begin;
--   update transactions
--      set gross_amount = abs(quantity),
--          net_amount   = abs(quantity) + coalesce(commission,0)
--    where sizing_mode='value' and order_status='filled' and gross_amount is null;
--   -- review, then commit; or rollback;
-- rollback;
