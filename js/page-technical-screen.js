// @ts-check
// Technical Screen (① information layer) — a candidate SIEVE, not advice.
// Read-only. All Brain access via the brain-query allowlisted RPC
// get_technical_panel (JWT); the browser never reads penrose_market tables
// directly. Independent of the ② live LS/LO book.
//
// Four buckets (High Conviction / Superior Long / Superior Short /
// Alpha-only Short). Each returns names with a technical strength percentile,
// RSI(14), a rule-based timing read (CONSTRUCTIVE / EXTENDED / NEUTRAL), and
// the beta-adjusted alpha risk_adj from the nightly alpha screen. No AI.

import { mountBrainAuthGate } from "./brain-client.js";
import { getTechnicalPanel } from "./brain-queries.js";
import { escapeHTML } from "./brain-components.js";
import { tvLinkHtml } from "./tv-link.js";

const $ = (id) => document.getElementById(id);
const esc = escapeHTML;
const dash = "—";
const isNum = (n) => n !== null && n !== undefined && n !== "" && !Number.isNaN(Number(n));
const arr = (v) => Array.isArray(v) ? v : [];
const fmtNum = (n, dp = 1) => isNum(n) ? Number(n).toLocaleString(undefined, { maximumFractionDigits: dp, minimumFractionDigits: dp }) : dash;
const fmtSigned = (n, dp = 2) => isNum(n) ? (Number(n) >= 0 ? "+" : "") + Number(n).toFixed(dp) : dash;
const signCls = (n) => isNum(n) ? (Number(n) >= 0 ? "up" : "down") : "";

const BUCKETS = {
  high_conviction: {
    title: "High Conviction",
    method:
      "Names where the technical strength screen and the beta-adjusted alpha screen (vs TOPIX) " +
      "agree on side. Highest-conviction candidate entries; CONSTRUCTIVE timing preferred over EXTENDED.",
  },
  superior_long: {
    title: "Superior Long",
    method:
      "Long candidates: high technical strength percentile with supportive RSI and positive " +
      "risk-adjusted alpha. Timing badge flags CONSTRUCTIVE (room to run) vs EXTENDED (overbought).",
  },
  superior_short: {
    title: "Superior Short",
    method:
      "Short candidates: weak/extended technicals with negative risk-adjusted alpha. EXTENDED timing " +
      "marks names stretched above trend; NEUTRAL marks names still basing.",
  },
  alpha_only_short: {
    title: "Alpha-only Short",
    method:
      "Negative risk-adjusted alpha where the technical picture is not yet confirming (NEUTRAL timing). " +
      "Watch candidates — alpha-flagged but waiting on technical breakdown.",
  },
};

const TIMING = {
  CONSTRUCTIVE: "timing-constructive",
  EXTENDED: "timing-extended",
  NEUTRAL: "timing-neutral",
};

let activeBucket = "high_conviction";

function pendingRpc() {
  $("ts-body").innerHTML =
    `<div class="pending-rpc"><b>Pending Brain RPC.</b> get_technical_panel — ` +
    `this panel activates once the read-only RPC is applied in Brain and added to the ` +
    `brain-query allowlist (Yuki gate ①). See docs/sql/technical_panel_rpc.sql.</div>`;
}

function showError(e) {
  const msg = String(e?.message || e || "error");
  if (/unknown rpc_name/i.test(msg)) { pendingRpc(); return; }
  if (/not authenticated/i.test(msg)) { $("ts-body").innerHTML = `<div class="ts-err">Brain session expired — reload to sign in.</div>`; return; }
  $("ts-body").innerHTML = `<div class="ts-err">Load failed: ${esc(msg)} · <span class="refresh-link" id="ts-retry">retry</span></div>`;
  $("ts-retry")?.addEventListener("click", () => load(activeBucket));
}

function timingCell(timing) {
  const key = String(timing ?? "").toUpperCase();
  const cls = TIMING[key];
  if (!cls) return `<span class="muted">${dash}</span>`;
  return `<span class="timing-badge ${cls}">${esc(key)}</span>`;
}

function renderRows(rows) {
  if (!rows.length) {
    return `<div class="muted" style="padding:.6rem">No names match this bucket today.</div>`;
  }
  const body = rows.map((r, i) => {
    const named = r.company_name && r.company_name !== "(code only)";
    return `<tr>
      <td class="num muted">${esc(r.rank ?? i + 1)}</td>
      <td>${esc(r.symbol)}</td>
      <td>${tvLinkHtml(r.symbol, esc)}</td>
      <td class="${named ? "name" : "codeonly"}">${esc(r.company_name ?? dash)}</td>
      <td>${r.sector ? `<span class="sector-chip">${esc(r.sector)}</span>` : `<span class="muted">${dash}</span>`}</td>
      <td class="num"><span class="score-pill">${fmtNum(r.strength_pct, 0)}</span></td>
      <td class="num">${fmtNum(r.rsi_14, 0)}</td>
      <td>${timingCell(r.timing)}</td>
      <td class="num ${signCls(r.alpha_risk_adj)}">${fmtSigned(r.alpha_risk_adj, 2)}</td>
    </tr>`;
  }).join("");
  return `<table class="bt">
    <thead><tr>
      <th class="num">#</th><th>Code</th><th>TV</th><th>Name</th><th>Sector</th>
      <th class="num">Strength</th><th class="num">RSI</th><th>Timing</th><th class="num">Alpha r/r</th>
    </tr></thead>
    <tbody>${body}</tbody>
  </table>`;
}

async function load(bucket) {
  activeBucket = bucket;
  const cfg = BUCKETS[bucket] ?? BUCKETS.high_conviction;
  $("ts-title").textContent = cfg.title;
  $("ts-method").textContent = cfg.method;
  $("ts-meta").innerHTML = "";
  $("ts-body").innerHTML = `<div class="muted" style="padding:.6rem">Loading…</div>`;
  // reflect active tab
  document.querySelectorAll(".ts-tab").forEach((b) =>
    b.classList.toggle("active", b instanceof HTMLElement && b.dataset.bucket === bucket));

  let d;
  try {
    d = await getTechnicalPanel(bucket, 25);
  } catch (e) {
    showError(e);
    return;
  }
  const rows = arr(d?.rows);
  $("ts-meta").innerHTML =
    `${rows.length} names · technicals_daily × alpha_screen_daily · as of <span class="ts-asof">${esc(d?.as_of ?? "")}</span>`;
  $("ts-body").innerHTML = renderRows(rows);
}

function wireTabs() {
  $("ts-tabs").addEventListener("click", (e) => {
    const btn = (e.target instanceof Element) ? e.target.closest(".ts-tab") : null;
    if (btn instanceof HTMLElement && btn.dataset.bucket) load(btn.dataset.bucket);
  });
  $("ts-refresh")?.addEventListener("click", (e) => { e.preventDefault(); load(activeBucket); });
}

mountBrainAuthGate({
  onAuthed: () => {
    wireTabs();
    load(activeBucket);
  },
});
