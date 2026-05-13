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

/** Read-only AI screened model portfolio preview over the Koyfin Japan monitor universe. */
export async function getAiModelPortfolioPreview(date = "", limit = 80) {
  const params = {
    p_limit: limit,
    p_source_key: "koyfin_japan_monitor",
    p_nav_usd: 100000000,
  };
  if (date) params.p_run_date = date;
  const { data, error } = await brainAuth.rpc("fn_platform_ai_model_portfolio_preview", params);
  if (error) throw error;
  return data;
}

/** Latest Japanese daily news brief and normalized recent news items. */
export async function getLatestNewsBrief(days = 7) {
  const { data, error } = await brainAuth.rpc("fn_get_latest_news_brief", { p_days: days });
  if (error) throw error;
  return data;
}

/** Brain v0 daily dump review payload. */
export async function getBrainReviewDashboard(date = "", limit = 25) {
  const params = {
    p_run_type: "daily",
    p_limit: limit,
  };
  if (date) params.p_run_date = date;
  const { data, error } = await brainAuth.rpc("fn_brain_v0_review_dashboard", params);
  if (error) throw error;
  return data;
}

/** TDnet/EDINET links and portfolio/watchlist-matched disclosures. */
export async function getBrainPortfolioDisclosures(date = "", limit = 100) {
  const params = {
    p_limit: limit,
    p_portfolio_slug: "penrose-brain-usd100m",
  };
  if (date) params.p_run_date = date;
  const { data, error } = await brainAuth.rpc("fn_brain_v0_portfolio_disclosures", params);
  if (error) throw error;
  return data;
}

/** Mechanical priority tiers for the Koyfin Japan monitor watchlist universe. */
export async function getWatchlistTiers(date = "", limit = 50) {
  const params = {
    p_limit: limit,
    p_source_key: "koyfin_japan_monitor",
  };
  if (date) params.p_run_date = date;
  const { data, error } = await brainAuth.rpc("fn_platform_watchlist_tiers", params);
  if (error) throw error;
  return data;
}

/** Symbol-to-company-name lookup for Brain review labels. */
export async function getBrainCompanyNames(symbols = []) {
  const unique = [...new Set((symbols || []).map((symbol) => String(symbol || "").trim()).filter(Boolean))];
  if (!unique.length) return {};
  const { data, error } = await brainAuth.rpc("fn_brain_v0_company_names", { p_symbols: unique });
  if (error) throw error;
  return data || {};
}

/** Persist one Brain signal review decision. */
export async function recordBrainReviewDecision(signalId, decision, note = "") {
  const { data, error } = await brainAuth.rpc("fn_brain_v0_record_review_decision", {
    p_signal_id: signalId,
    p_decision: decision,
    p_note: note || null,
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
