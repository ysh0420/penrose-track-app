// @ts-check
// Single source of truth for all Brain RPC calls.
// To change a query, edit only this file.

import { brainQuery } from "./brain-client.js";

/** Active ideas (Main Portfolio) - used by /portfolio. */
export function getActiveIdeas() {
  return brainQuery("fn_get_active_ideas");
}

/** USD100M Penrose Brain model portfolio dashboard payload. */
export async function getModelPortfolioDashboard(portfolioSlug = "penrose-brain-usd100m") {
  return brainQuery("fn_get_model_portfolio_dashboard", {
    p_portfolio_slug: portfolioSlug,
    p_days: 180,
    p_trade_limit: 50,
  });
}

/** Read-only clean V2 daily log dashboard. */
export async function getModelPortfolioV2LogDashboard({ logDate = "", portfolioSlug = "penrose-v2-shadow", pmStatus = "", limit = 250 } = {}) {
  return brainQuery("fn_get_model_portfolio_v2_log_dashboard", {
    p_log_date: logDate || null,
    p_portfolio_slug: portfolioSlug,
    p_pm_status: pmStatus || null,
    p_limit: limit,
  });
}

/** Read-only AI screened model portfolio preview over the Koyfin Japan monitor universe. */
export async function getAiModelPortfolioPreview(date = "", limit = 80) {
  const params = {
    p_limit: limit,
    p_source_key: "koyfin_japan_monitor",
    p_nav_usd: 100000000,
  };
  if (date) params.p_run_date = date;
  return brainQuery("fn_platform_ai_model_portfolio_preview", params);
}

/** Latest Japanese daily news brief and normalized recent news items. */
export async function getLatestNewsBrief(days = 7) {
  return brainQuery("fn_get_latest_news_brief", { p_days: days });
}

/** Brain v0 daily dump review payload. */
export async function getBrainReviewDashboard(date = "", limit = 25) {
  const params = {
    p_run_type: "daily",
    p_limit: limit,
  };
  if (date) params.p_run_date = date;
  return brainQuery("fn_brain_v0_review_dashboard", params);
}

/** Source Health payload for Brain Review. */
export async function getBrainSourceHealth() {
  return brainQuery("fn_brain_v0_source_health");
}

/** Read-only human reviewer queue for Brain Review. */
export async function getResearchReviewerQueue({ status = "open", symbol = "", limit = 50 } = {}) {
  return brainQuery("fn_get_research_reviewer_queue", {
    p_status: status || null,
    p_symbol: symbol || null,
    p_limit: limit,
  });
}

/** Summary-only Koyfin watchlist snapshot and Data Coverage dashboard. */
export async function getKoyfinWatchlistSnapshotDashboard({ asOfDate = "", watchlistName = "", limit = 1 } = {}) {
  return brainQuery("fn_get_koyfin_watchlist_snapshot_dashboard", {
    p_as_of_date: asOfDate || null,
    p_watchlist_name: watchlistName || null,
    p_limit: limit,
  });
}

/** TDnet/EDINET links and portfolio/watchlist-matched disclosures. */
export async function getBrainPortfolioDisclosures(date = "", limit = 100) {
  const params = {
    p_limit: limit,
    p_portfolio_slug: "penrose-brain-usd100m",
  };
  if (date) params.p_run_date = date;
  return brainQuery("fn_brain_v0_portfolio_disclosures", params);
}

/** Mechanical priority tiers for the Koyfin Japan monitor watchlist universe. */
export async function getWatchlistTiers(date = "", limit = 50) {
  const params = {
    p_limit: limit,
    p_source_key: "koyfin_japan_monitor",
  };
  if (date) params.p_run_date = date;
  return brainQuery("fn_platform_watchlist_tiers", params);
}

/** Symbol-to-company-name lookup for Brain review labels. */
export async function getBrainCompanyNames(symbols = []) {
  const unique = [...new Set((symbols || []).map((symbol) => String(symbol || "").trim()).filter(Boolean))];
  if (!unique.length) return {};
  return (await brainQuery("fn_brain_v0_company_names", { p_symbols: unique })) || {};
}

/** Persist one Brain signal review decision. */
export async function recordBrainReviewDecision(signalId, decision, note = "") {
  return brainQuery("fn_brain_v0_record_review_decision", {
    p_signal_id: signalId,
    p_decision: decision,
    p_note: note || null,
  });
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

/** Phase R session history for /research-log. */
export function getResearchLog(limit = 100, offset = 0) {
  return brainQuery("fn_get_research_log", {
    p_limit: limit,
    p_offset: offset,
  });
}

/** DB-backed published reports shelf. Report bodies are not returned here. */
export function getPublishedReports({ limit = 80, offset = 0, symbol = "", reportType = "", accessLevel = "internal_only" } = {}) {
  return brainQuery("fn_list_published_reports", {
    p_limit: limit,
    p_offset: offset,
    p_symbol: symbol || null,
    p_report_type: reportType || null,
    p_access_level: accessLevel,
  });
}

/** Fetch one DB-backed report body through brain-query. */
export function getPublishedReportBySlug(reportSlug, reportId = null, accessLevel = "internal_only") {
  return brainQuery("fn_get_published_report", {
    p_report_slug: reportSlug || null,
    p_report_id: reportId || null,
    p_access_level: accessLevel,
  });
}

/** Sanitized report lineage: synthesis, Source Run summaries, artifact counts, and linked signals. */
export function getReportLineage(reportId) {
  return brainQuery("fn_get_report_lineage", { p_report_id: reportId });
}

/** Cost-controlled refresh queue for source/signal/report/portfolio updates. */
export function getResearchRefreshDashboard({ days = 30, limit = 50, status = "", symbol = "" } = {}) {
  const since = new Date(Date.now() - Number(days || 30) * 24 * 60 * 60 * 1000).toISOString();
  return brainQuery("fn_get_research_refresh_dashboard", {
    p_since: since,
    p_limit: limit,
    p_status: status || null,
    p_symbol: symbol || null,
  });
}

/** Structured claim coverage. Values/raw excerpts are not exposed in this dashboard. */
export function getClaimCoverageDashboard({ days = 30, limit = 80, symbol = "" } = {}) {
  const since = new Date(Date.now() - Number(days || 30) * 24 * 60 * 60 * 1000).toISOString();
  return brainQuery("fn_get_claim_coverage_dashboard", {
    p_since: since,
    p_limit: limit,
    p_symbol: symbol || null,
  });
}

/** Published reports that should be refreshed because they are stale, incomplete, or already queued. */
export function getResearchRefreshCandidates(staleDays = 14, limit = 50, symbol = "") {
  return brainQuery("fn_get_research_refresh_candidates", {
    p_stale_days: staleDays,
    p_limit: limit,
    p_symbol: symbol || null,
  });
}

/** Structured contradiction results from deterministic refresh validation. */
export function getResearchContradictionDashboard({ days = 30, limit = 50, symbol = "", status = "" } = {}) {
  const since = new Date(Date.now() - Number(days || 30) * 24 * 60 * 60 * 1000).toISOString();
  return brainQuery("fn_get_research_contradiction_dashboard", {
    p_since: since,
    p_limit: limit,
    p_symbol: symbol || null,
    p_status: status || null,
  });
}

/** Suggested signal updates derived from claim extraction and contradiction scans. */
export function getSignalUpdateCandidatesDashboard({ days = 30, limit = 50, symbol = "", status = "" } = {}) {
  const since = new Date(Date.now() - Number(days || 30) * 24 * 60 * 60 * 1000).toISOString();
  return brainQuery("fn_get_signal_update_candidates", {
    p_symbol: symbol || null,
    p_since: since,
    p_limit: limit,
    p_status: status || null,
  });
}

/** Reviewed research signals and signal-driven portfolio decision candidates. */
export function getSignalDashboard(days = 30, limit = 100, symbol = "") {
  const since = new Date(Date.now() - Number(days || 30) * 24 * 60 * 60 * 1000).toISOString();
  return brainQuery("fn_get_signal_dashboard", {
    p_since: since,
    p_limit: limit,
    p_symbol: symbol || null,
  });
}

/** Multi-agent intake dashboard for Source Runs, compiler queue, and cost. */
export function getAgentResearchDashboard(days = 30, limit = 100) {
  const since = new Date(Date.now() - Number(days || 30) * 24 * 60 * 60 * 1000).toISOString();
  return brainQuery("fn_agent_research_dashboard", {
    p_since: since,
    p_limit: limit,
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

/** Brain health check. */
export function getBrainHealth() {
  return brainQuery("fn_brain_health");
}

/** Existing rich card from public schema (for stock page extras). */
export function getCompanyResearchCard(symbol) {
  return brainQuery("company_research_card", { p_symbol: symbol });
}

/**
 * Market Pulse dashboard (Panel 1): latest indices, FX, JP industry flows, and
 * volume anomalies. RPC fn_get_market_pulse_dashboard (penrose_market) is a
 * DRAFT pending Brain apply + brain-query allowlist registration — until then
 * this throws "Unknown rpc_name" and the panel shows a pending state.
 */
export function getMarketPulseDashboard(limit = 12) {
  return brainQuery("fn_get_market_pulse_dashboard", { p_limit: limit });
}

/**
 * Classification / supply-chain overview (Panel 6): Penrose-derived sector /
 * sub-sector taxonomy, supply-chain tags, and US→JP lead-lag mapping. Excludes
 * do_not_publish_directly rows and paid Koyfin raw. RPC
 * fn_get_classification_overview (penrose_market) is a DRAFT pending Brain apply
 * + allowlist registration.
 */
export function getClassificationOverview(limit = 30) {
  return brainQuery("fn_get_classification_overview", { p_limit: limit });
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
