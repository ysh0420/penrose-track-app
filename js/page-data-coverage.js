// @ts-check
import { mountBrainAuthGate } from "./brain-client.js";
import { getKoyfinWatchlistSnapshotDashboard } from "./brain-queries.js";
import { escapeHTML, skeletonRowHTML } from "./brain-components.js";
import { showError } from "./brain-error.js";

const $ = (id) => document.getElementById(id);

const WATCHLISTS = [
  { key: "japan", label: "Japan", match: (name) => name.includes("japan") || name === "jp" },
  { key: "us_above_1bn", label: "US above $1bn", match: (name) => name.includes("us") && name.includes("above") },
  { key: "us_below_1bn", label: "US below $1bn", match: (name) => name.includes("us") && name.includes("below") },
];

const COUNTRY_SCOPES = ["jp_listed", "global_proxy", "non_japan_exclude", "unknown"];

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

function formatNumber(value) {
  return numberValue(value).toLocaleString("en-US");
}

function formatPct(numerator, denominator) {
  const den = numberValue(denominator);
  if (!den) return "-";
  return `${((numberValue(numerator) / den) * 100).toFixed(0)}%`;
}

function formatDate(value) {
  if (!value) return "-";
  return String(value).slice(0, 10);
}

function watchlistName(row) {
  return String(row?.watchlist_name ?? "").trim().toLowerCase();
}

function findWatchlistRow(rows, key) {
  const def = WATCHLISTS.find((item) => item.key === key);
  return list(rows).find((row) => def?.match(watchlistName(row))) ?? null;
}

function watchlistLabel(name) {
  const normalized = String(name ?? "").trim().toLowerCase();
  const def = WATCHLISTS.find((item) => item.match(normalized));
  return def?.label ?? (name ? String(name) : "Unknown");
}

function hashFromMeta(row) {
  const meta = row?.metadata && typeof row.metadata === "object" ? row.metadata : {};
  return String(meta.snapshot_hash ?? row?.snapshot_hash ?? "").trim();
}

function shortHash(value) {
  const hash = String(value ?? "").trim();
  if (!hash) return "-";
  return hash.length > 14 ? `${hash.slice(0, 12)}...` : hash;
}

function metricHTML(label, value, sub = "") {
  return `
    <div class="dc-metric">
      <div class="label">${escapeHTML(label)}</div>
      <div class="value">${escapeHTML(value)}</div>
      <div class="sub">${escapeHTML(sub)}</div>
    </div>
  `;
}

function pill(label, pct) {
  const n = numberValue(pct, NaN);
  const cls = !Number.isFinite(n) ? "gap" : n >= 90 ? "good" : n > 0 ? "warn" : "gap";
  return `<span class="dc-pill ${cls}">${escapeHTML(label)}</span>`;
}

function declaredCounts(payload) {
  const runCounts = list(payload?.run_counts);
  const counts = {};
  for (const item of WATCHLISTS) {
    const row = findWatchlistRow(runCounts, item.key);
    counts[item.key] = numberValue(row?.declared_row_count);
  }
  return counts;
}

function itemCounts(payload) {
  const rows = list(payload?.item_counts);
  const counts = {};
  for (const item of WATCHLISTS) {
    const row = findWatchlistRow(rows, item.key);
    counts[item.key] = numberValue(row?.items);
  }
  return counts;
}

function snapshotHashes(payload) {
  return list(payload?.latest_snapshot_metadata).map((row) => ({
    watchlist: watchlistLabel(row?.watchlist_name),
    present: Boolean(hashFromMeta(row)),
    hash: hashFromMeta(row),
    imported_at: row?.imported_at ?? "",
  }));
}

function coverageRow(label, rows, fields) {
  const totalRows = list(rows).reduce((sum, row) => sum + numberValue(row?.rows), 0);
  const present = list(rows).reduce((sum, row) => {
    return sum + fields.reduce((fieldSum, field) => fieldSum + numberValue(row?.[field]), 0);
  }, 0);
  const possible = totalRows * fields.length;
  const pct = possible ? (present / possible) * 100 : NaN;
  return { label, present, possible, pct };
}

function leadLagCoverage(payload) {
  const rows = list(payload?.lead_lag_aggregate_summary);
  const total = rows.reduce((sum, row) => sum + numberValue(row?.sectors), 0);
  const covered = rows.reduce((sum, row) => {
    const signal = String(row?.lead_lag_signal ?? "").toLowerCase();
    if (!signal || signal === "missing" || signal === "unknown") return sum;
    return sum + numberValue(row?.sectors);
  }, 0);
  const pct = total ? (covered / total) * 100 : NaN;
  return { label: "US lead-lag aggregate", present: covered, possible: total, pct };
}

function renderSummary(payload) {
  const declared = declaredCounts(payload);
  const aggregate = declared.japan + declared.us_above_1bn + declared.us_below_1bn;
  const hashes = snapshotHashes(payload);
  const presentHashes = hashes.filter((row) => row.present).length;

  $("dc-summary").innerHTML = [
    metricHTML("Latest Snapshot", formatDate(payload?.as_of_date), "as_of_date"),
    metricHTML("Japan Rows", formatNumber(declared.japan), "declared snapshot count"),
    metricHTML("US Above $1bn", formatNumber(declared.us_above_1bn), "declared snapshot count"),
    metricHTML("US Below $1bn", formatNumber(declared.us_below_1bn), "declared snapshot count"),
    metricHTML("Aggregate Count", formatNumber(aggregate), "all declared rows"),
    metricHTML("Snapshot Hashes", `${presentHashes}/${hashes.length || 3}`, "present"),
  ].join("");
}

function renderCountryScope(payload) {
  const totals = Object.fromEntries(COUNTRY_SCOPES.map((scope) => [scope, 0]));
  for (const row of list(payload?.country_scope_summary)) {
    const scope = COUNTRY_SCOPES.includes(row?.country_scope) ? row.country_scope : "unknown";
    totals[scope] += numberValue(row?.items);
  }

  $("dc-country-scope").innerHTML = `
    <div class="dc-table-wrap">
      <table class="dc-table compact">
        <thead><tr><th>Scope</th><th class="num">Rows</th></tr></thead>
        <tbody>
          ${COUNTRY_SCOPES.map((scope) => `
            <tr><td>${escapeHTML(scope)}</td><td class="num">${formatNumber(totals[scope])}</td></tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderCoverage(payload) {
  const rows = [
    coverageRow("Technical", payload?.technical_coverage_summary, [
      "rsi_present",
      "sma_pct_50d_present",
      "sma_pct_200d_present",
      "relative_volume_present",
    ]),
    coverageRow("Revision", payload?.revision_coverage_summary, [
      "eps_revision_1w_present",
      "eps_revision_1m_present",
      "eps_revision_3m_present",
    ]),
    coverageRow("Valuation", payload?.valuation_coverage_summary, [
      "pe_ntm_present",
      "ev_sales_ntm_present",
      "ev_ebitda_ntm_present",
      "target_pct_med_present",
    ]),
    coverageRow("Liquidity", payload?.liquidity_coverage_summary, [
      "market_cap_present",
      "average_volume_present",
    ]),
    leadLagCoverage(payload),
  ];

  $("dc-coverage").innerHTML = `
    <div class="dc-table-wrap">
      <table class="dc-table">
        <thead>
          <tr><th>Coverage</th><th class="num">Present</th><th class="num">Possible</th><th class="num">Pct</th><th>Status</th></tr>
        </thead>
        <tbody>
          ${rows.map((row) => `
            <tr>
              <td>${escapeHTML(row.label)}</td>
              <td class="num">${formatNumber(row.present)}</td>
              <td class="num">${formatNumber(row.possible)}</td>
              <td class="num">${escapeHTML(formatPct(row.present, row.possible))}</td>
              <td>${pill(Number.isFinite(row.pct) && row.pct >= 90 ? "covered" : "gap / partial", row.pct)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderReadiness(payload) {
  const declared = declaredCounts(payload);
  const actual = itemCounts(payload);
  const leadLag = leadLagCoverage(payload);
  const fromDbAvailable = declared.japan > 0 && leadLag.possible > 0;
  const latestScreeningRows = actual.japan || declared.japan;

  $("dc-readiness").innerHTML = `
    <div class="dc-gap-list">
      <div class="dc-gap-row"><span>From-db screening available</span>${pill(fromDbAvailable ? "yes" : "no", fromDbAvailable ? 100 : 0)}</div>
      <div class="dc-gap-row"><span>Latest screening row count</span><strong>${formatNumber(latestScreeningRows)}</strong></div>
      <div class="dc-gap-row"><span>Sector RS</span>${pill("known gap", 0)}</div>
      <div class="dc-gap-row"><span>Peer basket RS</span>${pill("known gap", 0)}</div>
      <div class="dc-gap-row"><span>Global lead-lag</span>${pill("partial", leadLag.pct)}</div>
    </div>
  `;
}

function renderHashes(payload) {
  const hashes = snapshotHashes(payload);
  if (!hashes.length) {
    $("dc-hashes").innerHTML = `<div class="dc-empty">No snapshot metadata returned.</div>`;
    return;
  }
  $("dc-hashes").innerHTML = `
    <div class="dc-table-wrap">
      <table class="dc-table compact">
        <thead><tr><th>Watchlist</th><th>Snapshot Hash</th><th>Imported</th></tr></thead>
        <tbody>
          ${hashes.map((row) => `
            <tr>
              <td>${escapeHTML(row.watchlist)}</td>
              <td>${row.present ? pill(shortHash(row.hash), 100) : pill("missing", 0)}</td>
              <td>${escapeHTML(row.imported_at ? String(row.imported_at).slice(0, 19).replace("T", " ") : "-")}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderPayload(payload) {
  $("dc-subtitle").textContent = `Latest DB-backed snapshot: ${formatDate(payload?.as_of_date)}. Summary-only response; raw paid-source rows are not displayed.`;
  if (payload?.as_of_date && !$("dc-date").value) $("dc-date").value = formatDate(payload.as_of_date);
  renderSummary(payload);
  renderCoverage(payload);
  renderCountryScope(payload);
  renderReadiness(payload);
  renderHashes(payload);
}

function renderLoading() {
  $("dc-summary").innerHTML = [
    metricHTML("Latest Snapshot", "...", ""),
    metricHTML("Japan Rows", "...", ""),
    metricHTML("US Above $1bn", "...", ""),
    metricHTML("US Below $1bn", "...", ""),
    metricHTML("Aggregate Count", "...", ""),
    metricHTML("Snapshot Hashes", "...", ""),
  ].join("");
  $("dc-coverage").innerHTML = skeletonRowHTML("100%");
  $("dc-country-scope").innerHTML = skeletonRowHTML("100%");
  $("dc-readiness").innerHTML = skeletonRowHTML("100%");
  $("dc-hashes").innerHTML = skeletonRowHTML("100%");
}

async function loadDashboard({ latest = false } = {}) {
  renderLoading();
  const asOfDate = latest ? "" : $("dc-date")?.value || "";
  try {
    const payload = await getKoyfinWatchlistSnapshotDashboard({ asOfDate, limit: 1 });
    renderPayload(payload || {});
  } catch (error) {
    const retry = () => loadDashboard({ latest });
    showError({ container: $("dc-summary"), message: "Failed to load Data Coverage dashboard.", onRetry: retry, error });
    ["dc-coverage", "dc-country-scope", "dc-readiness", "dc-hashes"].forEach((id) => {
      const el = $(id);
      if (el) el.innerHTML = "";
    });
  }
}

function wireControls() {
  $("dc-load")?.addEventListener("click", () => loadDashboard());
  $("dc-latest")?.addEventListener("click", () => {
    const input = $("dc-date");
    if (input) input.value = "";
    loadDashboard({ latest: true });
  });
}

mountBrainAuthGate({
  onAuthed: async () => {
    wireControls();
    await loadDashboard({ latest: true });
  },
});
