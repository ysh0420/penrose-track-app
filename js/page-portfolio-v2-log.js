// @ts-check
import { mountBrainAuthGate } from "./brain-client.js";
import { getModelPortfolioV2LogDashboard } from "./brain-queries.js";
import { escapeHTML, skeletonRowHTML } from "./brain-components.js";
import { showError } from "./brain-error.js";

const $ = (id) => document.getElementById(id);

const STATES = ["reunderwrite", "exit_review", "no_new_long", "trim_watch", "maintain", "watch_only", "eligible_add"];

function list(value) {
  return Array.isArray(value) ? value : [];
}

function numberValue(value, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

function formatPct(value, decimals = 1) {
  if (value === null || value === undefined || value === "") return "-";
  const n = numberValue(value, NaN);
  if (!Number.isFinite(n)) return "-";
  return `${n > 0 ? "+" : ""}${(n * 100).toFixed(decimals)}%`;
}

function formatDate(value) {
  if (!value) return "-";
  return String(value).slice(0, 10);
}

function titleCase(value) {
  return String(value ?? "")
    .replace(/[_-]+/g, " ")
    .replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
}

function metricHTML(label, value, sub = "") {
  return `
    <div class="log-metric">
      <div class="label">${escapeHTML(label)}</div>
      <div class="value">${escapeHTML(value)}</div>
      <div class="sub">${escapeHTML(sub)}</div>
    </div>
  `;
}

function statusPill(value, cls = "") {
  return `<span class="log-pill ${escapeHTML(cls)}">${escapeHTML(value ?? "-")}</span>`;
}

function logPayload(payload) {
  return payload?.log && typeof payload.log === "object" ? payload.log : {};
}

function itemsPayload(payload) {
  return list(payload?.items);
}

function renderSummary(payload) {
  const log = logPayload(payload);
  const summary = payload?.summary ?? {};
  $("log-summary").innerHTML = [
    metricHTML("Log Date", formatDate(log.log_date), log.status ?? "no log yet"),
    metricHTML("Total Items", String(numberValue(summary.total_items, 0)), log.portfolio_slug ?? "penrose-v2-shadow"),
    metricHTML("Open PM Items", String(numberValue(summary.open_items, 0)), "review queue"),
    metricHTML("Data Gaps", String(numberValue(summary.data_gap_count, 0)), "names affected"),
    metricHTML("Reviewer Queue", String(numberValue(summary.reviewer_queue_count, 0)), "linked items"),
    metricHTML("Contradictions", String(numberValue(summary.contradiction_count, 0)), "open / recent"),
  ].join("");
}

function renderStateGroups(items) {
  $("log-state-groups").innerHTML = `
    <div class="log-state-grid">
      ${STATES.map((state) => {
        const rows = items.filter((row) => row.v2_state === state);
        return `
          <article class="log-state">
            <div class="log-state-head">
              <h4>${escapeHTML(titleCase(state))}</h4>
              <span class="log-count">${escapeHTML(String(rows.length))}</span>
            </div>
            <div class="log-meta">${escapeHTML(rows.slice(0, 8).map((row) => row.symbol).join(", ") || "None")}</div>
          </article>
        `;
      }).join("")}
    </div>
  `;
}

function renderItems(items) {
  if (!items.length) {
    $("log-items").innerHTML = `<div class="log-empty">No clean V2 log exists yet. The first log starts from tomorrow JST after the trusted backend CLI writes it.</div>`;
    return;
  }
  $("log-items").innerHTML = `
    <div class="log-table-wrap">
      <table class="log-table">
        <thead>
          <tr>
            <th>Symbol</th>
            <th>Company</th>
            <th>V2 State</th>
            <th>PM Status</th>
            <th>Suggested Action</th>
            <th>Technical Gate</th>
            <th>US Lead-Lag</th>
            <th class="num">Queue</th>
            <th class="num">Gaps</th>
            <th class="num">Target Shadow</th>
            <th class="num">1D</th>
            <th class="num">5D</th>
            <th class="num">20D</th>
            <th class="num">60D</th>
            <th>Outcome</th>
          </tr>
        </thead>
        <tbody>
          ${items.map((row) => `
            <tr class="clickable" data-symbol="${escapeHTML(row.symbol)}">
              <td><strong>${escapeHTML(row.symbol)}</strong></td>
              <td>${escapeHTML(row.company_name ?? "")}</td>
              <td>${escapeHTML(row.v2_state ?? "-")}</td>
              <td>${statusPill(row.pm_status ?? "open")}</td>
              <td>${escapeHTML(row.suggested_pm_action ?? "-")}</td>
              <td>${escapeHTML(row.technical_gate ?? "-")}</td>
              <td>${escapeHTML(row.global_lead_lag_status ?? "-")}</td>
              <td class="num">${escapeHTML(String(numberValue(row.reviewer_queue_count, 0)))}</td>
              <td class="num">${escapeHTML(String(numberValue(row.data_gap_count, 0)))}</td>
              <td class="num">${escapeHTML(formatPct(row.target_weight_shadow, 2))}</td>
              <td class="num">${escapeHTML(formatPct(row.actual_return_1d))}</td>
              <td class="num">${escapeHTML(formatPct(row.actual_return_5d))}</td>
              <td class="num">${escapeHTML(formatPct(row.actual_return_20d))}</td>
              <td class="num">${escapeHTML(formatPct(row.actual_return_60d))}</td>
              <td>${escapeHTML(row.outcome_bucket ?? "unresolved")}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
  $("log-items").querySelectorAll("tr.clickable").forEach((row) => {
    row.addEventListener("click", () => {
      const symbol = row instanceof HTMLElement ? row.dataset.symbol : "";
      if (symbol) location.href = `/stock.html?symbol=${encodeURIComponent(symbol)}`;
    });
  });
}

function renderGroup(containerId, rows, keyName) {
  $(containerId).innerHTML = rows.length ? `
    <div class="log-table-wrap">
      <table class="log-table">
        <thead><tr><th>Bucket</th><th class="num">Count</th></tr></thead>
        <tbody>
          ${rows.map((row) => `
            <tr><td>${escapeHTML(titleCase(row?.[keyName] ?? "unknown"))}</td><td class="num">${escapeHTML(String(numberValue(row?.count, 0)))}</td></tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  ` : `<div class="log-empty">No rows returned.</div>`;
}

function renderDataGaps(items) {
  const rows = items.filter((item) => numberValue(item.data_gap_count, 0) > 0);
  $("log-data-gaps").innerHTML = rows.length ? `
    <div class="log-table-wrap">
      <table class="log-table">
        <thead><tr><th>Symbol</th><th>Data Gaps</th></tr></thead>
        <tbody>
          ${rows.map((row) => `<tr><td><strong>${escapeHTML(row.symbol)}</strong></td><td>${escapeHTML(list(row.data_gaps).join("; "))}</td></tr>`).join("")}
        </tbody>
      </table>
    </div>
  ` : `<div class="log-empty">No data gaps returned in the clean V2 log.</div>`;
}

function renderLoading() {
  $("log-summary").innerHTML = Array.from({ length: 6 }).map(() => metricHTML("Loading", "-", "")).join("");
  $("log-state-groups").innerHTML = `<div class="log-empty">${skeletonRowHTML("75%")}</div>`;
  $("log-items").innerHTML = `<div class="log-empty">${skeletonRowHTML("100%")}</div>`;
  $("log-pm-status").innerHTML = "";
  $("log-data-gaps").innerHTML = "";
  $("log-coverage").innerHTML = "";
}

async function load() {
  renderLoading();
  const payload = await getModelPortfolioV2LogDashboard({ limit: 250 });
  const log = logPayload(payload);
  const items = itemsPayload(payload);
  $("log-subtitle").textContent = log.log_date
    ? `Clean V2 log ${formatDate(log.log_date)} / ${items.length} items.`
    : "No clean V2 log returned yet.";
  renderSummary(payload);
  renderStateGroups(items);
  renderItems(items);
  renderGroup("log-pm-status", list(payload?.by_pm_status), "pm_status");
  renderDataGaps(items);
  $("log-coverage").innerHTML = `
    <div class="log-meta">Technical: ${escapeHTML(list(payload?.by_technical_gate).map((row) => `${titleCase(row.technical_gate)} ${row.count}`).join(" / ") || "No rows")}</div>
    <div class="log-meta">Lead-Lag: ${escapeHTML(list(payload?.by_global_lead_lag_status).map((row) => `${titleCase(row.global_lead_lag_status)} ${row.count}`).join(" / ") || "No rows")}</div>
  `;
}

function loadWithErrorHandling() {
  load().catch((error) => {
    showError({
      container: $("log-items"),
      message: `Portfolio V2 log load failed: ${error?.message ?? error}`,
      onRetry: loadWithErrorHandling,
      error,
    });
    $("log-summary").innerHTML = "";
    $("log-state-groups").innerHTML = "";
  });
}

mountBrainAuthGate({
  onAuthed: () => {
    $("log-reload").addEventListener("click", loadWithErrorHandling);
    loadWithErrorHandling();
  },
});
