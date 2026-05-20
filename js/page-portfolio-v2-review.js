// @ts-check
import { mountBrainAuthGate } from "./brain-client.js";
import {
  getBrainSourceHealth,
  getModelPortfolioV2LogDashboard,
  getResearchReviewerQueue,
} from "./brain-queries.js";
import { escapeHTML, skeletonRowHTML } from "./brain-components.js";
import { showError } from "./brain-error.js";

const $ = (id) => document.getElementById(id);

const STATE_SECTIONS = [
  { key: "reunderwrite", label: "Reunderwrite" },
  { key: "exit_review", label: "Exit Review" },
  { key: "no_new_long", label: "No New Long" },
  { key: "trim_watch", label: "Trim Watch" },
  { key: "maintain", label: "Maintain" },
  { key: "watch_only", label: "Watch Only" },
  { key: "eligible_add", label: "Eligible Add" },
];

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

function formatWeight(value) {
  return formatPct(value, 2);
}

function formatDate(value) {
  if (!value) return "-";
  return String(value).slice(0, 10);
}

function titleCase(value) {
  return String(value ?? "")
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
}

function metricHTML(label, value, sub = "") {
  return `
    <div class="pv2-metric">
      <div class="label">${escapeHTML(label)}</div>
      <div class="value">${escapeHTML(value)}</div>
      <div class="sub">${escapeHTML(sub)}</div>
    </div>
  `;
}

function statusPill(value, cls = "") {
  return `<span class="pv2-pill ${escapeHTML(cls)}">${escapeHTML(value ?? "-")}</span>`;
}

function daysOld(value) {
  if (!value) return null;
  const t = Date.parse(value);
  if (Number.isNaN(t)) return null;
  return Math.max(0, (Date.now() - t) / 86_400_000);
}

function sourceHealthState(payload) {
  const entries = Object.entries(payload ?? {})
    .filter(([key, value]) => key !== "generated_at" && value && typeof value === "object");
  const issues = entries.filter(([, value]) => {
    const status = String(value.latest_status ?? value.latest_success_status ?? "").toLowerCase();
    const failures = numberValue(value.consecutive_failures, 0);
    const latest = value.latest_success_at ?? value.latest_completed_at;
    const age = daysOld(latest);
    return failures > 0 || ["failed", "failure", "partial_failure", "error"].includes(status) || (age !== null && age > 7);
  });
  return { label: issues.length ? "stale" : "green", stale_count: issues.length, issues, entries };
}

function logPayload(payload) {
  return payload?.log && typeof payload.log === "object" ? payload.log : {};
}

function itemsPayload(payload) {
  return list(payload?.items);
}

function renderSummary(payload, sourceHealthPayload) {
  const log = logPayload(payload);
  const summary = payload?.summary ?? {};
  const items = itemsPayload(payload);
  const sourceHealth = sourceHealthState(sourceHealthPayload);
  const stateCount = (state) => items.filter((row) => row.v2_state === state).length;
  $("pv2-summary").innerHTML = [
    metricHTML("V2 Log Date", formatDate(log.log_date), log.status ?? "no log yet"),
    metricHTML("Open PM Items", String(numberValue(summary.open_items, 0)), "clean V2 log"),
    metricHTML("Reviewer Queue", String(numberValue(summary.reviewer_queue_count, 0)), "linked items"),
    metricHTML("Contradictions", String(numberValue(summary.contradiction_count, 0)), "open / recent"),
    metricHTML("Stale Sources", String(sourceHealth.stale_count), sourceHealth.label),
    metricHTML("No New Long", String(stateCount("no_new_long")), "blocked adds"),
    metricHTML("Reunderwrite", String(stateCount("reunderwrite")), "human review"),
    metricHTML("Exit Review", String(stateCount("exit_review")), "position review"),
    metricHTML("Data Gaps", String(numberValue(summary.data_gap_count, 0)), "names affected"),
  ].join("");
}

function renderStateGroups(items) {
  $("pv2-state-groups").innerHTML = `
    <div class="pv2-state-grid">
      ${STATE_SECTIONS.map((section) => {
        const rows = items.filter((row) => row.v2_state === section.key);
        return `
          <article class="pv2-state">
            <div class="pv2-state-head">
              <h4>${escapeHTML(section.label)}</h4>
              <span class="pv2-count">${escapeHTML(String(rows.length))}</span>
            </div>
            <div class="pv2-holding-list">
              ${rows.length ? rows.slice(0, 8).map((row) => `
                <div class="pv2-holding">
                  <a href="/stock.html?symbol=${encodeURIComponent(row.symbol)}">${escapeHTML(row.symbol)}</a>
                  <span>${escapeHTML(row.company_name ?? row.symbol)}</span>
                  <span class="pv2-weight">${escapeHTML(row.pm_status ?? "open")}</span>
                </div>
              `).join("") : `<div class="pv2-empty">None</div>`}
              ${rows.length > 8 ? `<div class="pv2-meta">+${escapeHTML(String(rows.length - 8))} more</div>` : ""}
            </div>
          </article>
        `;
      }).join("")}
    </div>
  `;
}

function renderItems(items) {
  if (!items.length) {
    $("pv2-holdings").innerHTML = `<div class="pv2-empty">No clean V2 log exists yet. The V2 log is scheduled to start from tomorrow JST after the trusted backend CLI creates the first log.</div>`;
    return;
  }
  $("pv2-holdings").innerHTML = `
    <div class="pv2-table-wrap">
      <table class="pv2-table">
        <thead>
          <tr>
            <th>Symbol</th>
            <th>Company</th>
            <th>v2_state</th>
            <th>PM Status</th>
            <th>Suggested PM Action</th>
            <th>Technical Gate</th>
            <th>US Lead-Lag</th>
            <th class="num">Contr.</th>
            <th class="num">Queue</th>
            <th class="num">Gaps</th>
            <th>Source Health</th>
            <th>Signal Freshness</th>
            <th class="num">Target Shadow</th>
          </tr>
        </thead>
        <tbody>
          ${items.map((row) => `
            <tr class="clickable" data-symbol="${escapeHTML(row.symbol)}">
              <td><strong>${escapeHTML(row.symbol)}</strong></td>
              <td>${escapeHTML(row.company_name ?? "")}</td>
              <td><span class="pv2-state-${escapeHTML(row.v2_state ?? "")}">${escapeHTML(row.v2_state ?? "-")}</span></td>
              <td>${statusPill(row.pm_status ?? "open")}</td>
              <td>${escapeHTML(row.suggested_pm_action ?? "-")}</td>
              <td>${escapeHTML(row.technical_gate ?? "-")}</td>
              <td>${escapeHTML(row.global_lead_lag_status ?? "-")}</td>
              <td class="num">${escapeHTML(String(numberValue(row.contradiction_count, 0)))}</td>
              <td class="num">${escapeHTML(String(numberValue(row.reviewer_queue_count, 0)))}</td>
              <td class="num">${escapeHTML(String(numberValue(row.data_gap_count, 0)))}</td>
              <td>${statusPill(row.source_health ?? "missing", row.source_health === "healthy" ? "good" : "medium")}</td>
              <td>${statusPill(row.signal_freshness ?? "missing", row.signal_freshness === "fresh" ? "good" : "medium")}</td>
              <td class="num">${escapeHTML(formatWeight(row.target_weight_shadow))}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
  $("pv2-holdings").querySelectorAll("tr.clickable").forEach((row) => {
    row.addEventListener("click", () => {
      const symbol = row instanceof HTMLElement ? row.dataset.symbol : "";
      if (symbol) location.href = `/stock.html?symbol=${encodeURIComponent(symbol)}`;
    });
  });
}

function renderDataGaps(items) {
  const gapMap = new Map();
  for (const row of items) {
    for (const gap of list(row.data_gaps)) {
      if (!gapMap.has(gap)) gapMap.set(gap, []);
      gapMap.get(gap).push(row);
    }
  }
  const entries = [...gapMap.entries()].sort((a, b) => b[1].length - a[1].length);
  $("pv2-data-gaps").innerHTML = entries.length ? `
    <div class="pv2-gap-list">
      ${entries.map(([gap, rows]) => `
        <div class="pv2-gap-row">
          <strong>${escapeHTML(gap)}</strong>
          <div>
            ${escapeHTML(rows.slice(0, 12).map((row) => row.symbol).join(", "))}
            ${rows.length > 12 ? `<span class="pv2-meta"> +${escapeHTML(String(rows.length - 12))} more</span>` : ""}
            <div class="pv2-meta">${escapeHTML(String(rows.length))} V2 log item${rows.length === 1 ? "" : "s"}</div>
          </div>
        </div>
      `).join("")}
    </div>
  ` : `<div class="pv2-empty">No data gaps returned in the clean V2 log.</div>`;
}

function renderSourceHealth(payload) {
  const health = sourceHealthState(payload);
  const entries = health.entries;
  if (!entries.length) {
    $("pv2-source-health").innerHTML = `<div class="pv2-empty">No source health payload returned.</div>`;
    return;
  }
  $("pv2-source-health").innerHTML = `
    <div class="pv2-gap-list">
      ${entries.map(([key, row]) => {
        const failures = numberValue(row.consecutive_failures, 0);
        const cls = failures > 0 ? "high" : "good";
        const detail = [
          `latest ${formatDate(row.latest_success_at ?? row.latest_completed_at)}`,
          `failures ${failures}`,
          row.checkpoint_date ? `checkpoint ${formatDate(row.checkpoint_date)}` : "",
          row.signal_candidates_count != null ? `signals ${row.signal_candidates_count}` : "",
        ].filter(Boolean).join(" / ");
        return `
          <div class="pv2-gap-row">
            <strong>${escapeHTML(titleCase(key))}</strong>
            <div>${statusPill(row.latest_status ?? row.latest_success_status ?? "unknown", cls)}<div class="pv2-meta">${escapeHTML(detail)}</div></div>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

function renderReviewerQueue(payload) {
  const rows = list(payload?.items).slice(0, 12);
  $("pv2-reviewer-queue").innerHTML = rows.length ? `
    <div class="pv2-gap-list">
      ${rows.map((row) => `
        <div class="pv2-gap-row">
          <strong>${escapeHTML(row.symbol ?? "-")}</strong>
          <div>${statusPill(row.queue_type ?? "review", row.priority >= 85 ? "high" : "medium")}<div class="pv2-meta">${escapeHTML(row.reason ?? row.suggested_action ?? "")}</div></div>
        </div>
      `).join("")}
    </div>
  ` : `<div class="pv2-empty">No open reviewer queue rows returned.</div>`;
}

function renderCoverage(payload) {
  const tech = list(payload?.by_technical_gate);
  const lead = list(payload?.by_global_lead_lag_status);
  $("pv2-coverage").innerHTML = `
    <div class="pv2-gap-list">
      <div class="pv2-gap-row"><strong>Technical</strong><div>${escapeHTML(tech.map((row) => `${titleCase(row.technical_gate)} ${row.count}`).join(" / ") || "No rows")}</div></div>
      <div class="pv2-gap-row"><strong>Lead-Lag</strong><div>${escapeHTML(lead.map((row) => `${titleCase(row.global_lead_lag_status)} ${row.count}`).join(" / ") || "No rows")}</div></div>
    </div>
  `;
}

function renderLoading() {
  $("pv2-summary").innerHTML = Array.from({ length: 9 }).map(() => metricHTML("Loading", "-", "")).join("");
  $("pv2-state-groups").innerHTML = `<div class="pv2-empty">${skeletonRowHTML("70%")}</div>`;
  $("pv2-holdings").innerHTML = `<div class="pv2-empty">${skeletonRowHTML("100%")}</div>`;
  $("pv2-data-gaps").innerHTML = `<div class="pv2-empty">${skeletonRowHTML("80%")}</div>`;
  $("pv2-source-health").innerHTML = `<div class="pv2-empty">${skeletonRowHTML("75%")}</div>`;
  $("pv2-reviewer-queue").innerHTML = "";
  $("pv2-coverage").innerHTML = "";
}

async function load() {
  renderLoading();
  const [logPayloadData, sourceHealthPayload, reviewerPayload] = await Promise.all([
    getModelPortfolioV2LogDashboard({ limit: 250 }),
    getBrainSourceHealth(),
    getResearchReviewerQueue({ status: "open", limit: 50 }),
  ]);
  const log = logPayload(logPayloadData);
  const items = itemsPayload(logPayloadData);
  $("pv2-subtitle").textContent = log.log_date
    ? `Clean V2 log ${formatDate(log.log_date)} / ${items.length} items. V1 model book is legacy archive only.`
    : "Clean V2 log has not started yet. First log date is tomorrow JST once the trusted backend CLI writes it.";
  renderSummary(logPayloadData, sourceHealthPayload);
  renderStateGroups(items);
  renderItems(items);
  renderDataGaps(items);
  renderSourceHealth(sourceHealthPayload);
  renderReviewerQueue(reviewerPayload);
  renderCoverage(logPayloadData);
}

function loadWithErrorHandling() {
  load().catch((error) => {
    showError({
      container: $("pv2-holdings"),
      message: `Portfolio V2 review load failed: ${error?.message ?? error}`,
      onRetry: loadWithErrorHandling,
      error,
    });
    $("pv2-state-groups").innerHTML = "";
    $("pv2-summary").innerHTML = "";
  });
}

mountBrainAuthGate({
  onAuthed: () => {
    $("pv2-reload").addEventListener("click", loadWithErrorHandling);
    loadWithErrorHandling();
  },
});
