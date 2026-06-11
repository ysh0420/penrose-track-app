// @ts-check
// Technicals Screener v2 (Confluence) — candidate SIEVE, not advice. Read-only.
// SEPARATE from v1 (own RPC fn_get_technicals_screener_v2, own page). All Brain
// access via the brain-query allowlist (JWT). Independent of the ② live book.
//
// Implements the Notion report's two core ideas:
//  - Confluence = count of INDEPENDENT categories agreeing (Trend/Momentum/
//    Volume/Structure, one vote each). Primary sort. Shown as a checklist.
//  - Divergence (price vs RSI) — surfaced as a badge.

import { mountBrainAuthGate } from "./brain-client.js";
import { getTechnicalsScreenerV2 } from "./brain-queries.js";
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
      "Long confluence over the whole universe. Categories (1 vote each): Trend (px>50>200MA), " +
      "Momentum (RSI 45–72 / MACD-hist>0 / bullish divergence), Volume (rel-vol>1), Structure " +
      "(bb_breakout_up / golden_cross ≤5d). Ranked confluence DESC, then a momentum tiebreak score.",
  },
  reversal: {
    title: "Reversal / Oversold",
    method:
      "Long confluence on oversold names (RSI<45 or BB-pos<0.3). Momentum vote rewards bullish " +
      "divergence (price down, RSI turning up off a ≤35 trough). Counter-trend names rarely light " +
      "Trend, so 2–3 confluence is a strong reversal setup here. Ranked confluence DESC, then score.",
  },
  overheated: {
    title: "Overheated / Caution",
    method:
      "Short confluence on extended names (RSI>60 or >15% vs 200MA). Categories: Trend (px<50<200MA), " +
      "Momentum (RSI<50 / MACD-hist<0 / bearish divergence — price up but RSI rolled off a high peak), " +
      "Volume, Structure (bb_breakout_down / death_cross ≤5d). An overbought name with only bearish " +
      "divergence = 1–2 confluence = caution, not yet a trade. Ranked confluence DESC, then score.",
  },
};

let activePreset = "momentum";
let activeSide = "auto";

function pendingRpc() {
  $("ts-body").innerHTML =
    `<div class="pending-rpc"><b>Pending Brain RPC.</b> fn_get_technicals_screener_v2 — ` +
    `this v2 screener activates once the read-only RPC is applied in Brain and added to the ` +
    `brain-query allowlist. See docs/sql/technicals_screener_v2_rpc.sql. (v1 is unaffected.)</div>`;
}

function showError(e) {
  const msg = String(e?.message || e || "error");
  if (/unknown rpc_name/i.test(msg)) { pendingRpc(); return; }
  if (/not authenticated/i.test(msg)) { $("ts-body").innerHTML = `<div class="ts-err">Brain session expired — reload to sign in.</div>`; return; }
  $("ts-body").innerHTML = `<div class="ts-err">Load failed: ${esc(msg)} · <span class="refresh-link" id="ts-retry">retry</span></div>`;
  $("ts-retry")?.addEventListener("click", () => load());
}

function confClass(c) {
  const n = Number(c);
  return n >= 4 ? "conf-4" : n === 3 ? "conf-3" : n === 2 ? "conf-2" : "conf-1";
}

function catsCell(cats) {
  const c = cats || {};
  const chip = (label, on) => `<span class="cat-chip ${on ? "on" : ""}" title="${esc(label)}${on ? " ✓" : " —"}">${label[0]}</span>`;
  return `<span class="cats">${chip("Trend", c.trend)}${chip("Momentum", c.momentum)}${chip("Volume", c.volume)}${chip("Structure", c.structure)}</span>`;
}

function divCell(d) {
  if (d === "bearish") return `<span class="div-badge div-bearish">bearish</span>`;
  if (d === "bullish") return `<span class="div-badge div-bullish">bullish</span>`;
  return `<span class="div-none">${dash}</span>`;
}

function renderRows(rows) {
  if (!rows.length) return `<div class="muted" style="padding:.6rem">No names match this preset/side today.</div>`;
  const body = rows.map((r) => {
    const named = r.name && r.name !== "(code only)";
    return `<tr>
      <td class="num muted">${esc(r.rank)}</td>
      <td>${esc(r.symbol)}</td>
      <td>${tvLinkHtml(r.symbol, esc)}</td>
      <td class="${named ? "name" : "codeonly"}">${esc(r.name ?? dash)}</td>
      <td>${r.sector ? `<span class="sector-chip">${esc(r.sector)}</span>` : `<span class="muted">${dash}</span>`}</td>
      <td><span class="conf ${confClass(r.confluence_count)}">${esc(r.confluence_count)}/4</span></td>
      <td>${catsCell(r.categories)}</td>
      <td>${divCell(r.divergence)}</td>
      <td class="num">${fmtNum(r.score, 1)}</td>
      <td class="num">${fmtNum(r.rsi, 0)}</td>
      <td class="num ${signCls(r.pct_from_sma_200)}">${fmtSigned(r.pct_from_sma_200, 0)}%</td>
      <td class="num ${signCls(r.ret_1m)}">${fmtSigned(r.ret_1m, 1)}%</td>
      <td class="num">${fmtNum(r.rel_vol, 2)}×</td>
    </tr>`;
  }).join("");
  return `<table class="bt">
    <thead><tr>
      <th class="num">#</th><th>Code</th><th>TV</th><th>Name</th><th>Sector</th>
      <th>Conf</th><th>T·M·V·S</th><th>Div</th>
      <th class="num">Score</th><th class="num">RSI</th><th class="num">%200MA</th><th class="num">1m</th><th class="num">RelVol</th>
    </tr></thead>
    <tbody>${body}</tbody>
  </table>`;
}

async function load() {
  const cfg = PRESETS[activePreset];
  $("ts-title").textContent = cfg.title;
  $("ts-method").textContent = cfg.method;
  $("ts-meta").innerHTML = "";
  $("ts-body").innerHTML = `<div class="muted" style="padding:.6rem">Loading…</div>`;
  document.querySelectorAll(".ts-tab").forEach((b) => b.classList.toggle("active", b instanceof HTMLElement && b.dataset.preset === activePreset));
  document.querySelectorAll("#side-toggle button").forEach((b) => b.classList.toggle("active", b instanceof HTMLElement && b.dataset.side === activeSide));

  let d;
  try {
    d = await getTechnicalsScreenerV2(activePreset, 20, activeSide);
  } catch (e) {
    showError(e);
    return;
  }
  const rows = arr(d?.rows);
  $("ts-meta").innerHTML =
    `side: <b>${esc(d?.side ?? activeSide)}</b> · ${rows.length} ranked by confluence · as of <span class="ts-asof">${esc(d?.as_of ?? "")}</span>`;
  $("ts-body").innerHTML = renderRows(rows);
}

function wire() {
  $("ts-tabs").addEventListener("click", (e) => {
    const btn = (e.target instanceof Element) ? e.target.closest(".ts-tab") : null;
    if (btn instanceof HTMLElement && btn.dataset.preset) { activePreset = btn.dataset.preset; load(); }
  });
  $("side-toggle").addEventListener("click", (e) => {
    const btn = (e.target instanceof Element) ? e.target.closest("button") : null;
    if (btn instanceof HTMLElement && btn.dataset.side) { activeSide = btn.dataset.side; load(); }
  });
  $("ts-refresh")?.addEventListener("click", (e) => { e.preventDefault(); load(); });
}

mountBrainAuthGate({
  onAuthed: () => { wire(); load(); },
});
