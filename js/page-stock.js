// @ts-check
import { mountBrainAuthGate } from "./brain-client.js";
import {
  getStockHeader, getStockFundamentals, getSynthesisForSymbol,
  getIntradayAlerts, startResearchSession,
  extractFactCheckCompletionsForSymbol,
} from "./brain-queries.js";
import {
  convictionStarsHTML, directionBadgeHTML, rsiBadgeHTML, verdictBadgeHTML,
  themeChipsHTML, formatPct, formatMcap, formatYen, formatRelativeTime,
  renderMarkdown, escapeHTML,
} from "./brain-components.js";
import { showError } from "./brain-error.js";

const symbol = new URLSearchParams(location.search).get("symbol");

const POLL_INTERVAL_MS = 5_000;
const POLL_MAX_MS = 180_000;
let pollTimer = null;

async function loadAll() {
  if (!symbol) {
    document.getElementById("brain-app").innerHTML =
      `<div class="brain-empty">No symbol specified. Go to <a href="/portfolio.html">Portfolio</a> to pick one.</div>`;
    return;
  }

  const [header, fundamentals, synthesis, alerts] = await Promise.allSettled([
    getStockHeader(symbol),
    getStockFundamentals(symbol, 4),
    getSynthesisForSymbol(symbol),
    getIntradayAlerts(null),
  ]);

  renderHeader(header);
  renderMainPortfolioCard(header);
  renderFundamentals(fundamentals);
  renderSynthesis(synthesis);
  renderAlerts(alerts);
}

function unwrap(res) {
  // Brain RPCs sometimes return a single-row array, sometimes a scalar
  // jsonb, depending on whether the function uses RETURNS TABLE or
  // RETURNS jsonb. Tolerate both.
  if (res.status === "rejected") return null;
  const v = res.value;
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

function renderHeader(res) {
  const el = document.getElementById("brain-stock-header");
  if (res.status === "rejected") {
    showError({ container: el, message: `Header load failed: ${res.reason?.message ?? res.reason}`, error: res.reason, onRetry: loadAll });
    return;
  }
  const h = unwrap(res);
  if (!h) {
    el.innerHTML = `<h1>${escapeHTML(symbol)}</h1><div class="brain-empty">No company profile found</div>`;
    return;
  }
  const dayCls = (h.price_change_1d_pct ?? 0) > 0 ? "brain-up" : "brain-down";
  el.innerHTML = `
    <h1>${escapeHTML(h.company_name_jp ?? h.company_name ?? symbol)}<span class="brain-symbol-suffix">${escapeHTML(symbol)}</span></h1>
    <div class="brain-stock-metrics">
      <span class="brain-price">${formatYen(h.price_close)}</span>
      <span class="${dayCls}">${formatPct(h.price_change_1d_pct)}</span>
      ${rsiBadgeHTML(h.rsi_14)}
      <span>3M ${formatPct(h.price_change_3m_pct)}</span>
      <span>${formatMcap(h.market_cap_billion)}</span>
      <span>OPM ${formatPct(h.operating_margin)} (${escapeHTML(h.fiscal_period ?? "")})</span>
    </div>
  `;
}

function renderMainPortfolioCard(res) {
  const el = document.getElementById("brain-yuki-book");
  const h = unwrap(res);
  // active_idea_id signals the symbol is in Main Portfolio; missing means not in book.
  if (!h?.active_idea_id) {
    el.innerHTML = `
      <div>
        <h2>Main Portfolio</h2>
        <p style="margin:.6em 0;color:var(--muted,#8b8680)">Not in Main Portfolio.</p>
        <button class="brain-rerun-btn" id="brain-add-research" type="button">Run research</button>
      </div>
    `;
    document.getElementById("brain-add-research").addEventListener("click", triggerResearch);
    return;
  }
  el.innerHTML = `
    <h2>Main Portfolio</h2>
    <div style="margin:.4em 0">
      ${directionBadgeHTML(h.direction)}
      <span class="brain-stage">${escapeHTML(h.stage ?? "")}</span>
      ${convictionStarsHTML(h.conviction_score)}
    </div>
    <div style="margin:.4em 0">${themeChipsHTML(h.themes_linked)}</div>
    <p style="margin-top:.6em;font-size:10pt;line-height:1.5">${escapeHTML(h.thesis_summary ?? "")}</p>
  `;
}

function renderFundamentals(res) {
  const el = document.getElementById("brain-fund-content");
  if (res.status === "rejected") {
    showError({ container: el, message: `Fundamentals load failed: ${res.reason?.message ?? res.reason}`, error: res.reason });
    return;
  }
  const rows = res.value ?? [];
  if (!Array.isArray(rows) || rows.length === 0) {
    el.innerHTML = `<div class="brain-empty">No fundamentals data</div>`;
    return;
  }
  el.innerHTML = `
    <table class="brain-table">
      <thead><tr><th>Period</th><th class="num">Revenue</th><th class="num">OP</th><th class="num">OPM</th><th class="num">OPM YoY Δ</th><th class="num">NI</th></tr></thead>
      <tbody>
        ${rows.map((r) => `
          <tr>
            <td>${escapeHTML(r.fiscal_period ?? "")}</td>
            <td class="num">${formatYen(r.revenue)}</td>
            <td class="num">${formatYen(r.operating_profit)}</td>
            <td class="num">${formatPct(r.operating_margin)}</td>
            <td class="num">${formatPct(r.opm_yoy_change)}</td>
            <td class="num">${formatYen(r.net_income)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

let lastSynthesisLoadAt = Date.now();

function renderSynthesis(res) {
  const el = document.getElementById("brain-synthesis-panel");
  const s = unwrap(res);
  if (!s) {
    el.innerHTML = `
      <div class="brain-synthesis-header">
        <h2>Phase R Research</h2>
        <button class="brain-rerun-btn" id="brain-rerun" type="button">Run research</button>
      </div>
      <div class="brain-empty">No synthesis yet</div>
      <span class="brain-rerun-status" id="brain-rerun-status"></span>
    `;
    document.getElementById("brain-rerun").addEventListener("click", triggerResearch);
    return;
  }
  const md = s.synthesis_md ?? "";
  const cost = s.cost_usd != null ? `$${Number(s.cost_usd).toFixed(3)}` : "—";
  el.innerHTML = `
    <div class="brain-synthesis-header">
      <h2>Phase R Research</h2>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        ${verdictBadgeHTML(s.verdict)}
        <button class="brain-rerun-btn" id="brain-rerun" type="button">Re-research</button>
        <span class="brain-rerun-status" id="brain-rerun-status"></span>
      </div>
    </div>
    <div class="brain-synthesis-meta">
      Run ${formatRelativeTime(s.completed_at)} ·
      Conviction rec: ${escapeHTML(s.conviction_recommendation ?? "—")} ·
      Cost: ${cost}
    </div>
    <div class="brain-synthesis-md" id="brain-synthesis-content">${renderMarkdown(md)}</div>
    <a class="brain-synthesis-toggle" id="brain-synthesis-toggle">Expand ↓</a>
  `;
  document.getElementById("brain-rerun").addEventListener("click", triggerResearch);
  document.getElementById("brain-synthesis-toggle").addEventListener("click", () => {
    const c = document.getElementById("brain-synthesis-content");
    const t = document.getElementById("brain-synthesis-toggle");
    c.classList.toggle("expanded");
    t.textContent = c.classList.contains("expanded") ? "Collapse ↑" : "Expand ↓";
  });
}

function renderAlerts(res) {
  const el = document.getElementById("brain-alerts-content");
  if (res.status === "rejected") {
    el.innerHTML = `<div class="brain-empty">Alerts unavailable</div>`;
    return;
  }
  // get_intraday_alerts returns either a single jsonb object or, on
  // some Postgres versions, a single-row array wrapping it. Unwrap.
  const payload = Array.isArray(res.value) ? res.value[0] : res.value;
  const completions = extractFactCheckCompletionsForSymbol(payload, symbol);
  if (completions.length === 0) {
    el.innerHTML = `<div class="brain-empty">No recent fact-check completions</div>`;
    return;
  }
  el.innerHTML = completions.slice(0, 10).map((c) => `
    <div class="brain-alert">
      <strong>${escapeHTML(c.consensus_verdict ?? "—")}</strong>
      <span class="brain-alert-meta"> · ${formatRelativeTime(c.latest_check_at)} · ${(c.sources_queried ?? []).length} sources</span>
      <p>${escapeHTML(c.subject_label ?? "")}</p>
      <div class="brain-alert-meta">
        ${c.confirmed_count ?? 0} confirmed · ${c.contradicted_count ?? 0} contradicted · ${c.source_count ?? 0} citations
      </div>
    </div>
  `).join("");
}

async function triggerResearch() {
  const status = document.getElementById("brain-rerun-status");
  const rerun = document.getElementById("brain-rerun");
  const add = document.getElementById("brain-add-research");
  // Disable whichever button exists.
  if (rerun) /** @type {HTMLButtonElement} */(rerun).disabled = true;
  if (add) /** @type {HTMLButtonElement} */(add).disabled = true;
  if (status) status.textContent = "Starting session…";

  try {
    const res = await startResearchSession(symbol, 2, true);
    const sessionId = res?.session_id ?? (Array.isArray(res) ? res[0]?.session_id : null);
    if (!sessionId) throw new Error("No session_id returned from start_research_session");
    if (status) status.textContent = "Running cross-validation (~90s)…";
    pollForSynthesis(sessionId);
  } catch (e) {
    if (status) status.textContent = `Error: ${e.message}`;
    if (rerun) /** @type {HTMLButtonElement} */(rerun).disabled = false;
    if (add) /** @type {HTMLButtonElement} */(add).disabled = false;
  }
}

function pollForSynthesis(sessionId) {
  const startTs = Date.now();
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(async () => {
    const status = document.getElementById("brain-rerun-status");
    if (Date.now() - startTs > POLL_MAX_MS) {
      clearInterval(pollTimer);
      if (status) status.textContent = "Timed out — check Research log";
      const rerun = document.getElementById("brain-rerun");
      if (rerun) /** @type {HTMLButtonElement} */(rerun).disabled = false;
      return;
    }
    try {
      const synth = await getSynthesisForSymbol(symbol);
      const s = Array.isArray(synth) ? synth[0] : synth;
      if (s?.completed_at && new Date(s.completed_at).getTime() > startTs) {
        clearInterval(pollTimer);
        if (status) status.textContent = "Done";
        renderSynthesis({ status: "fulfilled", value: s });
        // Main Portfolio card may have been promoted from "not in book" to in
        // book by this run — refresh the header column too.
        try {
          const header = await getStockHeader(symbol);
          renderMainPortfolioCard({ status: "fulfilled", value: header });
        } catch { /* non-fatal */ }
      } else {
        const elapsed = Math.floor((Date.now() - startTs) / 1000);
        if (status) status.textContent = `Running… ${elapsed}s`;
      }
    } catch (e) {
      // Swallow transient poll errors; the retry loop covers them.
      console.warn("[brain-stock] poll error:", e);
    }
  }, POLL_INTERVAL_MS);
}

mountBrainAuthGate({ onAuthed: loadAll });
