// @ts-check
// Single source of truth for all Brain RPC calls.
// To change a query, edit only this file.

import { brainAuth, brainQuery } from "./brain-client.js";

/** Active ideas (Yuki Book) — used by /portfolio. */
export function getActiveIdeas() {
  return brainQuery("fn_get_active_ideas");
}

/** USD100M Penrose Brain model portfolio dashboard payload. */
export async function getModelPortfolioDashboard(portfolioSlug = "penrose-brain-usd100m") {
  const { data, error } = await brainAuth.rpc("fn_get_model_portfolio_dashboard", {
    p_portfolio_slug: portfolioSlug,
    p_days: 180,
    p_trade_limit: 50,
  });
  if (error) throw error;
  return data;
}

/** Slim header data for stock detail page. */
export function getStockHeader(symbol) {
  return brainQuery("fn_get_stock_header", { p_symbol: symbol });
}

/** Multi-quarter fundamentals trend. */
export function getStockFundamentals(symbol, quarters = 8) {
  return brainQuery("fn_get_stock_fundamentals", {
    p_symbol: symbol,
    p_quarters: quarters,
  });
}

/** Price + technicals timeseries. */
export function getStockPriceHistory(symbol, days = 90) {
  return brainQuery("fn_get_stock_price_history", {
    p_symbol: symbol,
    p_days: days,
  });
}

/** Latest Phase R synthesis for a symbol. */
export function getSynthesisForSymbol(symbol) {
  return brainQuery("fn_get_synthesis_for_symbol", { p_symbol: symbol });
}

/** Exact Phase R session payload for /research-log deep links. */
export function getResearchSession(sessionId) {
  return brainQuery("get_research_session", { p_session_id: sessionId });
}

/** Major guidance revisions for /pipeline. */
export function getPipelineRevisions(days = 30) {
  return brainQuery("fn_get_pipeline_revisions", { p_days: days });
}

/** Promotion candidates for /pipeline. */
export function getPromotionCandidates() {
  return brainQuery("fn_get_promotion_candidates");
}

/** Phase R session history for /research-log. */
export function getResearchLog(limit = 100, offset = 0) {
  return brainQuery("fn_get_research_log", {
    p_limit: limit,
    p_offset: offset,
  });
}

/**
 * Recent intraday alerts. The function returns a single bucketed jsonb
 * object, NOT an array — caller drills into hot_signals,
 * fact_check_completions, and new_tier1_filings (each wrapped in
 * { jsonb_agg: [...] | null }).
 */
export function getIntradayAlerts(sinceTimestamp = null) {
  return brainQuery("get_intraday_alerts", { p_since: sinceTimestamp });
}

/**
 * Trigger a new Phase R research session. Edge Function chains
 * start_research_session + trigger-research automatically.
 */
export function startResearchSession(symbol, tier = 2, force = false) {
  return brainQuery("start_research_session", {
    p_symbol: symbol,
    p_tier: tier,
    p_force: force,
  });
}

/** Brain health check. */
export function getBrainHealth() {
  return brainQuery("fn_brain_health");
}

/** Existing rich card from public schema (for stock page extras). */
export function getCompanyResearchCard(symbol) {
  return brainQuery("company_research_card", { p_symbol: symbol });
}

/**
 * Drill into the bucketed `get_intraday_alerts` payload and return only
 * the fact-check completions whose subject_symbol matches `symbol`.
 * Returns [] if no payload, no completions, or no matches.
 */
export function extractFactCheckCompletionsForSymbol(payload, symbol) {
  if (!payload) return [];
  const bucket = payload.fact_check_completions;
  // jsonb_agg can surface as { jsonb_agg: null } or { jsonb_agg: [...] }
  // depending on whether any rows aggregated; tolerate both shapes plus
  // a flat array in case the RPC ever changes.
  const list = Array.isArray(bucket)
    ? bucket
    : Array.isArray(bucket?.jsonb_agg)
      ? bucket.jsonb_agg
      : [];
  return list.filter((c) => c?.subject_symbol === symbol);
}
