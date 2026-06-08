// @ts-check
// Technicals Screener (① information layer) — a candidate SIEVE, not advice.
// Read-only. All Brain access via the brain-query allowlisted RPC
// fn_get_technicals_screener (JWT). Independent of the ② live LS/LO book.
//
// Three intent presets (momentum / reversal / overheated); each returns the
// top-N by a transparent weighted-sum score with a rule-based one-line
// interpretation and company name/sector context. Thresholds + score weights
// are shown in the method note under each table (no black box, no AI).

import { mountBrainAuthGate } from "./brain-client.js";
import { getTechnicalsScreener } from "./brain-queries.js";
import { escapeHTML } from "./brain-components.js";
import { tvLinkHtml } from "./tv-link.js";

const $ = (id) => document.getElementById(id);
const esc = escapeHTML;
const dash = "—";
const isNum = (n) => n !== null && n !== undefined && n !== "" && !Number.isNaN(Number(n));
const arr = (v) => Array.isArray(v) ? v : [];
const fmtNum = (n, dp = 1) => isNum(n) ? Number(n).toLocaleString(undefined, { maximumFractionDigits: dp, minimumFractionDigits: dp }) : dash;
const fmtSigned = (n, dp = 1) => isNum(n) ? (Number(n) >= 0 ? "+" : "") + Number(n).toFixed(dp) : dash;
const signCls = (n) => isNum(n) ? (Number(n) >= 0 ? "up" : "down") : "";

const PRESETS = {
  momentum: {
    title: "Momentum / Breakout",
    method:
      "Filter: px > 50MA > 200MA, RSI 55–75, MACD-hist > 0, 1m return > 0, rel-vol > 1× (pool ≈ 24). " +
      "Score (0–100) = 0.30·trend(%vs200MA) + 0.25·3m + 0.20·1m + 0.15·rel-vol + 0.10·RSI-quality(~65).",
  },
  reversal: {
    title: "Reversal / Oversold",
    method:
      "Filter: RSI < 35 and Bollinger-position ≤ 0.2 (near lower band; pool ≈ 47). " +
      "Score = 0.35·oversold(RSI) + 0.25·BB-depth + 0.20·today's bounce + 0.20·MACD-improving. " +
      "Bounce / MACD-improvement are scored, not required, so still-falling oversold names stay visible.",
  },
  overheated: {
    title: "Overheated / Caution",
    method:
      "Filter: RSI > 70, Bollinger-position ≥ 0.85, > 15% above 200MA (pool ≈ 17). " +
      "Score = 0.30·RSI-excess + 0.30·extension(%vs200MA) + 0.20·BB-break(>upper) + 0.20·5d surge.",
  },
};

let activePreset = "momentum";

function pendingRpc() {
  $("ts-body").innerHTML =
    `<div class="pending-rpc"><b>Pending Brain RPC.</b> fn_get_technicals_screener — ` +
    `this screener activates once the read-only RPC is applied in Brain and added to the ` +
    `brain-query allowlist (Yuki gate ①). See docs/sql/technicals_screener_rpc.sql.</div>`;
}

function showError(e) {
  const msg = String(e?.message || e || "error");
  if (/unknown rpc_name/i.test(msg)) { pendingRpc(); return; }
  if (/not authenticated/i.test(msg)) { $("ts-body").innerHTML = `<div class="ts-err">Brain session expired — reload to sign in.</div>`; return; }
  $("ts-body").innerHTML = `<div class="ts-err">Load failed: ${esc(msg)} · <span class="refresh-link" id="ts-retry">retry</span></div>`;
  $("ts-retry")?.addEventListener("click", () => load(activePreset));
}

function renderRows(rows) {
  if (!rows.length) {
    return `<div class="muted" style="padding:.6rem">No names match this preset today.</div>`;
  }
  const body = rows.map((r) => {
    const named = r.name && r.name !== "(code only)";
    return `<tr>
      <td class="num muted">${esc(r.rank)}</td>
      <td>${esc(r.symbol)}</td>
      <td>${tvLinkHtml(r.symbol, esc)}</td>
      <td class="${named ? "name" : "codeonly"}">${esc(r.name ?? dash)}</td>
      <td>${r.sector ? `<span class="sector-chip">${esc(r.sector)}</span>` : `<span class="muted">${dash}</span>`}</td>
      <td class="num"><span class="score-pill">${fmtNum(r.score, 1)}</span></td>
      <td class="num">${fmtNum(r.rsi, 0)}</td>
      <td class="num ${signCls(r.pct_from_sma_200)}">${fmtSigned(r.pct_from_sma_200, 0)}%</td>
      <td class="num ${signCls(r.ret_1m)}">${fmtSigned(r.ret_1m, 1)}%</td>
      <td class="num ${signCls(r.ret_3m)}">${fmtSigned(r.ret_3m, 1)}%</td>
      <td class="num">${fmtNum(r.rel_vol, 2)}×</td>
      <td class="num ${signCls(r.macd_hist)}">${fmtNum(r.macd_hist, 2)}</td>
      <td class="num">${fmtNum(r.bb_pos, 2)}</td>
      <td class="interp">${esc(r.interpretation ?? "")}</td>
    </tr>`;
  }).join("");
  return `<table class="bt">
    <thead><tr>
      <th class="num">#</th><th>Code</th><th>TV</th><th>Name</th><th>Sector</th>
      <th class="num">Score</th><th class="num">RSI</th><th class="num">%200MA</th>
      <th class="num">1m</th><th class="num">3m</th><th class="num">RelVol</th>
      <th class="num">MACDh</th><th class="num">BB</th><th>Interpretation</th>
    </tr></thead>
    <tbody>${body}</tbody>
  </table>`;
}

async function load(preset) {
  activePreset = preset;
  const cfg = PRESETS[preset];
  $("ts-title").textContent = cfg.title;
  $("ts-method").textContent = cfg.method;
  $("ts-meta").innerHTML = "";
  $("ts-body").innerHTML = `<div class="muted" style="padding:.6rem">Loading…</div>`;
  // reflect active tab
  document.querySelectorAll(".ts-tab").forEach((b) =>
    b.classList.toggle("active", b instanceof HTMLElement && b.dataset.preset === preset));

  let d;
  try {
    d = await getTechnicalsScreener(preset, 20);
  } catch (e) {
    showError(e);
    return;
  }
  const rows = arr(d?.rows);
  $("ts-meta").innerHTML =
    `${rows.length} of pool · technicals_daily · as of <span class="ts-asof">${esc(d?.as_of ?? "")}</span>`;
  $("ts-body").innerHTML = renderRows(rows);
}

function wireTabs() {
  $("ts-tabs").addEventListener("click", (e) => {
    const btn = (e.target instanceof Element) ? e.target.closest(".ts-tab") : null;
    if (btn instanceof HTMLElement && btn.dataset.preset) load(btn.dataset.preset);
  });
  $("ts-refresh")?.addEventListener("click", (e) => { e.preventDefault(); load(activePreset); });
}

mountBrainAuthGate({
  onAuthed: () => {
    wireTabs();
    load(activePreset);
  },
});
