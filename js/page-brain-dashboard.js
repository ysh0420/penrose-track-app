// @ts-check
// Information / Data Brain integrated dashboard (Panel 1-6).
// Read-only. Information layer (Brain) only — the live LS/LO book is NOT shown.
// All Brain access is via brain-query allowlisted RPCs (JWT). Each panel loads
// independently so one failure never blanks the others.
//
// Security rules enforced in rendering:
//  - news/disclosures: headline + link only, never body text.
//  - signals: no source_run_ids / score_components; portfolio_decisions
//    (internal actions) are NOT rendered.
//  - research: no Source Run IDs, no synthesis content / key_findings / draft.
//  - Panel 4 is the hypothetical AI Model — labelled, never the live book.

import { mountBrainAuthGate } from "./brain-client.js";
import {
  getSignalDashboard, getLatestNewsBrief, getBrainPortfolioDisclosures,
  getModelPortfolioDashboard, getAgentResearchDashboard, getPublishedReports,
  getMarketPulseDashboard, getClassificationOverview,
} from "./brain-queries.js";
import { escapeHTML } from "./brain-components.js";

const $ = (id) => document.getElementById(id);
const esc = escapeHTML;
const dash = "—";

const isNum = (n) => n !== null && n !== undefined && n !== "" && !Number.isNaN(Number(n));
const fmtDate = (v) => { if (!v) return dash; const d = new Date(v); return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleDateString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit" }); };
const fmtDateTime = (v) => { if (!v) return dash; const d = new Date(v); return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleString("ja-JP", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }); };
const fmtPct = (n, dp = 2) => isNum(n) ? (Number(n) >= 0 ? "+" : "") + (Number(n) * 100).toFixed(dp) + "%" : dash;
const fmtUsdM = (n) => isNum(n) ? "$" + (Number(n) / 1e6).toFixed(1) + "M" : dash;
const fmtNum = (n, dp = 2) => isNum(n) ? Number(n).toLocaleString(undefined, { maximumFractionDigits: dp }) : dash;
const signCls = (n) => isNum(n) ? (Number(n) >= 0 ? "up" : "down") : "";
const arr = (v) => Array.isArray(v) ? v : [];

function setMeta(id, asOf, source) {
  const parts = [];
  if (source) parts.push(esc(source));
  if (asOf) parts.push(`as of <span class="bd-asof">${esc(asOf)}</span>`);
  $(id).innerHTML = parts.join(" · ");
}
const setBody = (id, html) => { $(id).innerHTML = html; };
const loadingBody = (id) => setBody(id, `<div class="muted">Loading…</div>`);
const pendingRpc = (id, label) => setBody(id, `<div class="pending-rpc"><b>Pending Brain RPC.</b> ${esc(label)}<br>This panel activates once the read-only RPC is applied in Brain and added to the brain-query allowlist (Yuki gate ①). See docs/sql/.</div>`);
function errBody(id, e) {
  const msg = String(e?.message || e || "error");
  // an un-allowlisted RPC returns "Unknown rpc_name" — show the calmer pending state
  if (/unknown rpc_name/i.test(msg)) return null; // caller handles pending
  setBody(id, `<div class="bd-err">Load failed: ${esc(msg)} · <span class="refresh-link" data-retry>retry</span></div>`);
  return true;
}

/* ── Panel 1 · Market Pulse (new RPC, pending until deployed) ───────────── */
async function loadP1() {
  loadingBody("p1-body");
  let d;
  try { d = await getMarketPulseDashboard(12); }
  catch (e) { if (errBody("p1-body", e) === null) pendingRpc("p1-body", "fn_get_market_pulse_dashboard — latest indices, FX, JP industry flows, volume anomalies."); return; }
  const indices = arr(d?.indices), fx = arr(d?.fx), flows = arr(d?.industry_flows), anomalies = arr(d?.volume_anomalies);
  setMeta("p1-meta", d?.as_of, "indices/fx/industry_flows/volume_anomalies");
  const idxRows = indices.slice(0, 8).map((r) => `<tr><td>${esc(r.index_symbol ?? r.symbol)}</td><td class="num">${fmtNum(r.close)}</td><td class="num ${signCls(r.change_pct)}">${fmtPct(r.change_pct, 2)}</td></tr>`).join("");
  const fxRows = fx.slice(0, 6).map((r) => `<tr><td>${esc(r.pair)}</td><td class="num">${fmtNum(r.close, 3)}</td><td class="num ${signCls(r.change_pct)}">${fmtPct(r.change_pct, 2)}</td></tr>`).join("");
  const flowRows = flows.slice(0, 8).map((r) => `<tr><td>${esc(r.industry_code)}</td><td class="num ${signCls(r.price_change_1d)}">${fmtPct(r.price_change_1d, 1)}</td><td class="num">${fmtPct(r.price_change_1m, 1)}</td><td>${esc(r.flow_status ?? r.momentum_stage ?? "")}</td></tr>`).join("");
  const anRows = anomalies.slice(0, 8).map((r) => `<tr><td>${esc(r.symbol)}</td><td>${esc(r.anomaly_type)}</td><td class="num">${fmtNum(r.vol_rel_20d, 1)}×</td></tr>`).join("");
  setBody("p1-body", `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:1rem">
    <div><div class="muted" style="font-size:.66rem;margin-bottom:.2rem">INDICES</div><table class="bt"><tbody>${idxRows || emptyRow(3)}</tbody></table></div>
    <div><div class="muted" style="font-size:.66rem;margin-bottom:.2rem">FX</div><table class="bt"><tbody>${fxRows || emptyRow(3)}</tbody></table></div>
    <div><div class="muted" style="font-size:.66rem;margin-bottom:.2rem">JP INDUSTRY FLOWS (1d / 1m)</div><table class="bt"><tbody>${flowRows || emptyRow(4)}</tbody></table></div>
    <div><div class="muted" style="font-size:.66rem;margin-bottom:.2rem">VOLUME ANOMALIES</div><table class="bt"><tbody>${anRows || emptyRow(3)}</tbody></table></div>
  </div>`);
}

/* ── Panel 2 · Surfacing / Signals ─────────────────────────────────────── */
async function loadP2() {
  loadingBody("p2-body");
  let d;
  try { d = await getSignalDashboard(45, 60, ""); }
  catch (e) { errBody("p2-body", e); return; }
  const signals = arr(d?.signals), byState = arr(d?.by_state);
  setMeta("p2-meta", fmtDateTime(d?.generated_at), "fn_get_signal_dashboard");
  const stateChips = byState.map((s) => `<span class="pill">${esc(s.signal_state ?? s.state ?? "?")}: ${esc(String(s.count ?? s.n ?? ""))}</span>`).join(" ");
  // SECURITY: omit source_run_ids, score_components; do not render portfolio_decisions
  const rows = signals.slice(0, 14).map((s) => {
    const dir = String(s.direction ?? "").toLowerCase();
    const dirCls = dir === "long" ? "up" : dir === "short" ? "down" : "muted";
    return `<tr><td>${esc(s.primary_symbol ?? (arr(s.symbols)[0]) ?? "")}</td>` +
      `<td>${esc((s.company_name ?? "").slice(0, 18))}</td>` +
      `<td class="${dirCls}">${esc(s.direction ?? "")}</td>` +
      `<td>${esc(s.signal_state ?? "")}</td>` +
      `<td class="num">${fmtNum(s.final_score ?? s.confidence_score, 2)}</td>` +
      `<td>${esc((s.signal_family ?? s.source_agent ?? "").slice(0, 16))}</td>` +
      `<td class="num">${fmtDate(s.as_of_date ?? s.generated_at)}</td></tr>`;
  }).join("");
  setBody("p2-body", `<div style="margin-bottom:.4rem">${stateChips || '<span class="muted">no state buckets</span>'}</div>` +
    `<table class="bt"><thead><tr><th>Sym</th><th>Name</th><th>Dir</th><th>State</th><th class="num">Score</th><th>Family</th><th class="num">As of</th></tr></thead><tbody>${rows || emptyRow(7)}</tbody></table>` +
    `<div class="muted" style="font-size:.66rem;margin-top:.35rem">Reviewed research signals. Portfolio-decision candidates omitted by policy.</div>`);
}

/* ── Panel 3 · Disclosure / News (headlines + links only) ──────────────── */
async function loadP3() {
  loadingBody("p3-body");
  const [news, disc] = await Promise.allSettled([getLatestNewsBrief(7), getBrainPortfolioDisclosures("", 40)]);
  let html = "";
  let asOf = "";
  if (disc.status === "fulfilled") {
    const dd = disc.value;
    asOf = dd?.date || asOf;
    const counts = dd?.source_counts || {};
    const links = dd?.source_links || {};
    const items = arr(dd?.relevant_disclosures);
    const linkBar = ["tdnet", "edinet"].filter((k) => links[k]).map((k) => `<a href="${esc(links[k])}" target="_blank" rel="noopener" class="pill">${k.toUpperCase()} ↗</a>`).join(" ");
    html += `<div class="statrow"><div><div class="k">Disclosures</div><div class="v">${esc(String(counts.total ?? items.length))}</div></div>` +
      `<div><div class="k">TDnet</div><div class="v">${esc(String(counts.tdnet ?? "—"))}</div></div>` +
      `<div><div class="k">EDINET</div><div class="v">${esc(String(counts.edinet ?? "—"))}</div></div></div>` +
      `<div style="margin-bottom:.4rem">${linkBar}</div>`;
    html += items.slice(0, 8).map((r) => `<a class="hl" href="${esc(r.url || "#")}" target="_blank" rel="noopener">${esc(r.title || r.issuer_name || "(disclosure)")}` +
      `<span class="src">${esc(r.issuer_name ?? "")} · ${esc(r.filing_type ?? r.source ?? "")} · ${fmtDateTime(r.filed_at)}</span></a>`).join("");
  } else {
    html += `<div class="bd-err">Disclosures failed: ${esc(String(disc.reason?.message || disc.reason))}</div>`;
  }
  html += `<div class="muted" style="font-size:.66rem;margin:.6rem 0 .25rem">RECENT NEWS (headlines link out)</div>`;
  if (news.status === "fulfilled") {
    const items = arr(news.value?.recent_items);
    if (news.value?.brief?.generated_at) asOf = asOf || fmtDateTime(news.value.brief.generated_at);
    const ranked = [...items].sort((a, b) => Number(b.is_market_moving) - Number(a.is_market_moving));
    html += ranked.slice(0, 8).map((i) => {
      const t = i.title_ja || i.title || "";
      const mm = i.is_market_moving ? ' <span class="pill">market-moving</span>' : "";
      return `<a class="hl" href="${esc(i.url || "#")}" target="_blank" rel="noopener">${esc(t)}${mm}<span class="src">${esc(i.source_name ?? i.source_code ?? "")} · ${fmtDateTime(i.published_at ?? i.fetched_at)}</span></a>`;
    }).join("") || `<div class="muted">No recent news.</div>`;
  } else {
    html += `<div class="bd-err">News failed: ${esc(String(news.reason?.message || news.reason))}</div>`;
  }
  setMeta("p3-meta", asOf, "tdnet/edinet + news_brief");
  setBody("p3-body", html);
}

/* ── Panel 4 · AI Model Portfolio (HYPOTHETICAL — not the live book) ─────── */
async function loadP4() {
  loadingBody("p4-body");
  let d;
  try { d = await getModelPortfolioDashboard(); }
  catch (e) { errBody("p4-body", e); return; }
  const nav = d?.latest_nav || {}, run = d?.latest_run || {}, positions = arr(d?.positions);
  setMeta("p4-meta", fmtDate(nav.nav_date || run.run_date), "fn_get_model_portfolio_dashboard");
  const top = [...positions].sort((a, b) => Math.abs(Number(b.weight) || 0) - Math.abs(Number(a.weight) || 0)).slice(0, 8);
  const posRows = top.map((p) => `<tr><td>${esc(p.symbol)}</td><td>${esc((p.company_name || p.company_name_en || "").slice(0, 18))}</td>` +
    `<td>${esc((p.sector || "").slice(0, 12))}</td>` +
    `<td class="num">${fmtPct(p.weight, 1)}</td>` +
    `<td class="num">${fmtUsdM(p.market_value_usd)}</td>` +
    `<td class="num ${signCls(p.unrealized_pnl_usd)}">${fmtUsdM(p.unrealized_pnl_usd)}</td></tr>`).join("");
  setBody("p4-body", `<div class="hypo-banner">AI Model Portfolio — hypothetical, model-driven. NOT the live LS/LO investment book.</div>` +
    `<div class="statrow">` +
    `<div><div class="k">NAV</div><div class="v">${fmtUsdM(nav.nav_usd)}</div></div>` +
    `<div><div class="k">Daily</div><div class="v ${signCls(nav.daily_return)}">${fmtPct(nav.daily_return)}</div></div>` +
    `<div><div class="k">Alpha</div><div class="v ${signCls(nav.alpha_return)}">${fmtPct(nav.alpha_return)}</div></div>` +
    `<div><div class="k">Gross</div><div class="v">${fmtPct(nav.gross_exposure, 0)}</div></div>` +
    `<div><div class="k">Net</div><div class="v">${fmtPct(nav.net_exposure, 0)}</div></div>` +
    `<div><div class="k">Run</div><div class="v" style="font-size:.78rem">${esc(run.status ?? "—")}</div></div></div>` +
    `<table class="bt"><thead><tr><th>Sym</th><th>Name</th><th>Sector</th><th class="num">Wt</th><th class="num">MV</th><th class="num">uPnL</th></tr></thead><tbody>${posRows || emptyRow(6)}</tbody></table>` +
    `<div class="muted" style="font-size:.66rem;margin-top:.35rem">${esc(String(positions.length))} positions · USD100M hypothetical book.</div>`);
}

/* ── Panel 5 · Research (no Source Run IDs / synthesis bodies) ──────────── */
async function loadP5() {
  loadingBody("p5-body");
  const [agentR, reportsR] = await Promise.allSettled([getAgentResearchDashboard(30, 40), getPublishedReports({ limit: 16 })]);
  let html = "";
  let asOf = "";
  if (agentR.status === "fulfilled") {
    const a = agentR.value;
    asOf = fmtDateTime(a?.generated_at) || asOf;
    const cost = a?.cost_summary || {};
    const syn = arr(a?.recent_syntheses), runs = arr(a?.recent_runs);
    html += `<div class="statrow">` +
      `<div><div class="k">Runs</div><div class="v">${esc(String(cost.total_calls ?? runs.length))}</div></div>` +
      `<div><div class="k">Cost</div><div class="v">${fmtUsdM(cost.actual_cost_usd) === dash ? ("$" + fmtNum(cost.actual_cost_usd ?? cost.estimated_cost_usd, 2)) : "$" + fmtNum(cost.actual_cost_usd, 2)}</div></div>` +
      `<div><div class="k">Syntheses</div><div class="v">${esc(String(syn.length))}</div></div></div>`;
    // SECURITY: title/type/quality/published only — no source_run_ids, content, key_findings
    html += `<div class="muted" style="font-size:.66rem;margin:.3rem 0 .2rem">RECENT SYNTHESES</div>`;
    html += syn.slice(0, 6).map((s) => {
      const pub = s.published_report_id ? ' <span class="pill">published</span>' : "";
      return `<div class="hl">${esc((s.topic_title || s.title || "(synthesis)").slice(0, 70))}${pub}` +
        `<span class="src">${esc(s.synthesis_type ?? "")} · ${esc(s.compiler_agent ?? "")} · q${esc(String(s.quality_score ?? "—"))} · ${fmtDateTime(s.created_at)}</span></div>`;
    }).join("") || `<div class="muted">No recent syntheses.</div>`;
  } else {
    html += `<div class="bd-err">Agent dashboard failed: ${esc(String(agentR.reason?.message || agentR.reason))}</div>`;
  }
  if (reportsR.status === "fulfilled") {
    const reports = arr(reportsR.value?.reports || reportsR.value);
    html += `<div class="muted" style="font-size:.66rem;margin:.6rem 0 .2rem">PUBLISHED REPORTS</div>`;
    html += reports.slice(0, 6).map((r) => `<div class="hl">${esc((r.title || r.report_title || "(report)").slice(0, 70))}` +
      `<span class="src">${esc(r.primary_symbol ?? r.symbol ?? "")} · ${esc(r.report_type ?? "")} · ${fmtDate(r.published_at ?? r.created_at)}</span></div>`).join("") || `<div class="muted">No published reports.</div>`;
  }
  setMeta("p5-meta", asOf, "agent_research + published_reports");
  setBody("p5-body", html);
}

/* ── Panel 6 · Classification / Supply-Chain (new RPC, pending) ─────────── */
async function loadP6() {
  loadingBody("p6-body");
  let d;
  try { d = await getClassificationOverview(30); }
  catch (e) { if (errBody("p6-body", e) === null) pendingRpc("p6-body", "fn_get_classification_overview — Penrose sector/sub-sector taxonomy, supply-chain tags, US→JP lead-lag (excludes do_not_publish + Koyfin paid raw)."); return; }
  setMeta("p6-meta", d?.as_of, "company_classification + us_jp_industry_mapping");
  const sectors = arr(d?.sector_counts), tags = arr(d?.supply_chain_tags), leadlag = arr(d?.us_jp_lead_lag);
  const secRows = sectors.slice(0, 12).map((s) => `<tr><td>${esc(s.sector ?? s.toyo_keizai_sector)}</td><td class="num">${esc(String(s.count ?? s.n ?? ""))}</td></tr>`).join("");
  const tagChips = tags.slice(0, 24).map((t) => `<span>${esc((t.tag ?? t) + (t.count ? " " + t.count : ""))}</span>`).join("");
  const llRows = leadlag.slice(0, 10).map((m) => `<tr><td>${esc(m.us_industry)}</td><td>→ ${esc(m.jp_industry)}</td><td class="num">${esc(String(m.learned_median_lag_days ?? m.expected_lag_days ?? "—"))}d</td><td>${esc(m.status ?? "")}</td></tr>`).join("");
  setBody("p6-body", `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:1rem">
    <div><div class="muted" style="font-size:.66rem;margin-bottom:.2rem">SECTORS (coverage)</div><table class="bt"><tbody>${secRows || emptyRow(2)}</tbody></table></div>
    <div><div class="muted" style="font-size:.66rem;margin-bottom:.2rem">US → JP LEAD-LAG (median lag)</div><table class="bt"><tbody>${llRows || emptyRow(4)}</tbody></table></div>
  </div><div class="muted" style="font-size:.66rem;margin:.6rem 0 .2rem">SUPPLY-CHAIN TAGS</div><div class="chips">${tagChips || '<span class="muted">—</span>'}</div>`);
}

function emptyRow(cols) { return `<tr><td colspan="${cols}" class="muted">No data.</td></tr>`; }

function loadAll() {
  // independent — one panel failing never blanks the rest
  loadP1(); loadP2(); loadP3(); loadP4(); loadP5(); loadP6();
}

// delegated retry for transient panel errors
document.addEventListener("click", (e) => {
  const t = /** @type {HTMLElement} */(e.target);
  if (t && t.matches?.("[data-retry]")) loadAll();
});

mountBrainAuthGate({
  onAuthed: () => {
    const r = $("bd-refresh");
    if (r && !r.dataset.wired) { r.dataset.wired = "1"; r.addEventListener("click", (e) => { e.preventDefault(); loadAll(); }); }
    loadAll();
  },
});
