// @ts-check
import { mountBrainAuthGate } from "./brain-client.js";
import { getModelPortfolioV2EvaluationDashboard } from "./brain-queries.js";
import { escapeHTML, skeletonRowHTML } from "./brain-components.js";
import { showError } from "./brain-error.js";

const $ = (id) => document.getElementById(id);

const BUCKETS = [
  { key: "avoided_bad_add", label: "Avoided Bad Adds" },
  { key: "missed_opportunity", label: "Missed Opportunities" },
  { key: "false_block", label: "False Blocks" },
  { key: "good_block", label: "Good Blocks" },
  { key: "correct_exit_review", label: "Correct Exit Review" },
  { key: "unresolved_data_gap", label: "Data Gaps" },
  { key: "neutral", label: "Neutral" },
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

function normalizeSymbol(value) {
  return String(value ?? "").trim().replace(/\.T$/i, "").toUpperCase();
}

function metricHTML(label, value, sub = "") {
  return `
    <div class="eval-metric">
      <div class="label">${escapeHTML(label)}</div>
      <div class="value">${escapeHTML(value)}</div>
      <div class="sub">${escapeHTML(sub)}</div>
    </div>
  `;
}

function statusPill(value, cls = "") {
  return `<span class="eval-pill ${escapeHTML(cls)}">${escapeHTML(value ?? "-")}</span>`;
}

function bucketClass(bucket) {
  const raw = String(bucket ?? "").toLowerCase();
  if (["avoided_bad_add", "good_block", "correct_exit_review"].includes(raw)) return "good";
  if (["false_block", "missed_opportunity"].includes(raw)) return "high";
  if (raw.includes("gap")) return "medium";
  return "";
}

function runPayload(payload) {
  return payload?.run && typeof payload.run === "object" ? payload.run : {};
}

function itemsPayload(payload) {
  return list(payload?.items);
}

function countForBucket(payload, key) {
  const summary = payload?.summary ?? {};
  const direct = summary[`${key}_count`];
  if (direct !== undefined) return numberValue(direct, 0);
  const row = list(payload?.by_bucket).find((item) => item?.evaluation_bucket === key);
  return numberValue(row?.count, 0);
}

function renderSummary(payload) {
  const run = runPayload(payload);
  const summary = payload?.summary ?? {};
  $("eval-summary").innerHTML = [
    metricHTML("Run Date", formatDate(run.run_date), run.status ?? "latest"),
    metricHTML("Items", String(numberValue(summary.total_items ?? run.item_count, 0)), "evaluated names"),
    metricHTML("Avoided Bad Adds", String(countForBucket(payload, "avoided_bad_add")), "blocked names that later fell"),
    metricHTML("Missed Opportunities", String(countForBucket(payload, "missed_opportunity")), "names to inspect"),
    metricHTML("False Blocks", String(countForBucket(payload, "false_block")), "v2 was too cautious"),
    metricHTML("Data Gaps", String(numberValue(summary.data_gap_count, 0)), "missing evidence"),
  ].join("");
}

function renderBuckets(payload) {
  $("eval-buckets").innerHTML = `
    <div class="eval-bucket-grid">
      ${BUCKETS.map((bucket) => {
        const count = countForBucket(payload, bucket.key);
        const row = list(payload?.by_bucket).find((item) => item?.evaluation_bucket === bucket.key) ?? {};
        return `
          <article class="eval-bucket">
            <div class="eval-bucket-head">
              <h4>${escapeHTML(bucket.label)}</h4>
              <span class="eval-count">${escapeHTML(String(count))}</span>
            </div>
            <div class="eval-meta">
              1D ${escapeHTML(formatPct(row.avg_return_1d))} /
              5D ${escapeHTML(formatPct(row.avg_return_5d))} /
              20D ${escapeHTML(formatPct(row.avg_return_20d))}
            </div>
          </article>
        `;
      }).join("")}
    </div>
  `;
}

function renderGroupTable(containerId, rows, keyName, labelName) {
  if (!rows.length) {
    $(containerId).innerHTML = `<div class="eval-empty">No rows returned.</div>`;
    return;
  }
  $(containerId).innerHTML = `
    <div class="eval-table-wrap">
      <table class="eval-table">
        <thead>
          <tr>
            <th>${escapeHTML(labelName)}</th>
            <th class="num">Count</th>
            <th class="num">1D</th>
            <th class="num">5D</th>
            <th class="num">20D</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((row) => `
            <tr>
              <td>${escapeHTML(titleCase(row?.[keyName] ?? "unknown"))}</td>
              <td class="num">${escapeHTML(String(numberValue(row?.count, 0)))}</td>
              <td class="num">${escapeHTML(formatPct(row?.avg_return_1d))}</td>
              <td class="num">${escapeHTML(formatPct(row?.avg_return_5d))}</td>
              <td class="num">${escapeHTML(formatPct(row?.avg_return_20d))}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderItems(payload) {
  const items = itemsPayload(payload);
  if (!items.length) {
    $("eval-items").innerHTML = `<div class="eval-empty">No evaluation run is available yet. Run the trusted backend evaluation CLI to create one.</div>`;
    return;
  }
  $("eval-items").innerHTML = `
    <div class="eval-table-wrap">
      <table class="eval-table">
        <thead>
          <tr>
            <th>Symbol</th>
            <th>Company</th>
            <th class="num">Current</th>
            <th>V2 State</th>
            <th>Bucket</th>
            <th>Technical Gate</th>
            <th>US Lead-Lag</th>
            <th class="num">Contr.</th>
            <th class="num">Queue</th>
            <th class="num">Gaps</th>
            <th class="num">1D</th>
            <th class="num">5D</th>
            <th class="num">20D</th>
          </tr>
        </thead>
        <tbody>
          ${items.map((row) => `
            <tr class="clickable" data-symbol="${escapeHTML(normalizeSymbol(row.symbol))}">
              <td><strong>${escapeHTML(row.symbol)}</strong></td>
              <td>${escapeHTML(row.company_name ?? "")}</td>
              <td class="num">${escapeHTML(formatWeight(row.current_weight))}</td>
              <td>${escapeHTML(row.v2_state ?? "-")}</td>
              <td>${statusPill(row.evaluation_bucket, bucketClass(row.evaluation_bucket))}</td>
              <td>${escapeHTML(row.technical_gate ?? "-")}</td>
              <td>${escapeHTML(row.global_lead_lag_status ?? "-")}</td>
              <td class="num">${escapeHTML(String(numberValue(row.contradiction_count, 0)))}</td>
              <td class="num">${escapeHTML(String(numberValue(row.reviewer_queue_count, 0)))}</td>
              <td class="num">${escapeHTML(String(numberValue(row.data_gap_count, 0)))}</td>
              <td class="num">${escapeHTML(formatPct(row.actual_return_1d))}</td>
              <td class="num">${escapeHTML(formatPct(row.actual_return_5d))}</td>
              <td class="num">${escapeHTML(formatPct(row.actual_return_20d))}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
  $("eval-items").querySelectorAll("tr.clickable").forEach((row) => {
    row.addEventListener("click", () => {
      const symbol = row instanceof HTMLElement ? row.dataset.symbol : "";
      if (symbol) location.href = `/stock.html?symbol=${encodeURIComponent(symbol)}`;
    });
  });
}

function renderCompactRows(containerId, rows, emptyText) {
  if (!rows.length) {
    $(containerId).innerHTML = `<div class="eval-empty">${escapeHTML(emptyText)}</div>`;
    return;
  }
  $(containerId).innerHTML = `
    <div class="eval-table-wrap">
      <table class="eval-table">
        <thead>
          <tr>
            <th>Symbol</th>
            <th>Company</th>
            <th>V2 State</th>
            <th>Bucket</th>
            <th>Reason</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((row) => `
            <tr>
              <td><strong>${escapeHTML(row.symbol ?? "")}</strong></td>
              <td>${escapeHTML(row.company_name ?? "")}</td>
              <td>${escapeHTML(row.v2_state ?? "-")}</td>
              <td>${statusPill(row.evaluation_bucket ?? row.metadata?.disagreement_type ?? "-", bucketClass(row.evaluation_bucket))}</td>
              <td>${escapeHTML(row.metadata?.disagreement_type ?? row.suggested_pm_action ?? "")}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderLoading() {
  $("eval-summary").innerHTML = Array.from({ length: 6 }).map(() => metricHTML("Loading", "-", "")).join("");
  $("eval-buckets").innerHTML = `<div class="eval-empty">${skeletonRowHTML("80%")}</div>`;
  $("eval-items").innerHTML = `<div class="eval-empty">${skeletonRowHTML("100%")}</div>`;
  $("eval-by-state").innerHTML = `<div class="eval-empty">${skeletonRowHTML("65%")}</div>`;
  $("eval-by-technical").innerHTML = `<div class="eval-empty">${skeletonRowHTML("65%")}</div>`;
  $("eval-by-leadlag").innerHTML = `<div class="eval-empty">${skeletonRowHTML("65%")}</div>`;
  $("eval-disagreements").innerHTML = "";
  $("eval-human-review").innerHTML = "";
}

async function load() {
  renderLoading();
  const payload = await getModelPortfolioV2EvaluationDashboard({ limit: 200 });
  const run = runPayload(payload);
  $("eval-subtitle").textContent = run?.run_date
    ? `Latest evaluation run ${formatDate(run.run_date)} / ${numberValue(run.item_count, 0)} items.`
    : "No evaluation run returned yet.";
  renderSummary(payload);
  renderBuckets(payload);
  renderItems(payload);
  renderGroupTable("eval-by-state", list(payload?.by_state), "v2_state", "V2 State");
  renderGroupTable("eval-by-technical", list(payload?.by_technical_gate), "technical_gate", "Technical Gate");
  renderGroupTable("eval-by-leadlag", list(payload?.by_global_lead_lag_status), "global_lead_lag_status", "US Lead-Lag");
  renderCompactRows("eval-disagreements", list(payload?.disagreements), "No material v1/v2 disagreements returned.");
  renderCompactRows("eval-human-review", list(payload?.human_review), "No human-review rows returned.");
}

function loadWithErrorHandling() {
  load().catch((error) => {
    showError({
      container: $("eval-items"),
      message: `Portfolio V2 evaluation load failed: ${error?.message ?? error}`,
      onRetry: loadWithErrorHandling,
      error,
    });
    $("eval-summary").innerHTML = "";
    $("eval-buckets").innerHTML = "";
  });
}

mountBrainAuthGate({
  onAuthed: () => {
    $("eval-reload").addEventListener("click", loadWithErrorHandling);
    loadWithErrorHandling();
  },
});
