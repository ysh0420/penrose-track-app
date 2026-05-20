// @ts-check
import { mountBrainAuthGate } from "./brain-client.js";
import {
  getBrainSourceHealth,
  getClaimCoverageDashboard,
  getModelPortfolioDashboard,
  getResearchContradictionDashboard,
  getResearchReviewerQueue,
  getSignalUpdateCandidatesDashboard,
  getStockHeader,
} from "./brain-queries.js";
import { escapeHTML, skeletonRowHTML } from "./brain-components.js";
import { showError } from "./brain-error.js";

const $ = (id) => document.getElementById(id);

const STATE_SECTIONS = [
  { key: "reunderwrite", label: "Reunderwrite" },
  { key: "exit_review", label: "Exit Review" },
  { key: "trim_watch", label: "Trim Watch" },
  { key: "no_new_long", label: "No New Long" },
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

function formatUsd(value, decimals = 1) {
  if (value === null || value === undefined || value === "") return "-";
  const n = numberValue(value, NaN);
  if (!Number.isFinite(n)) return "-";
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `${sign}$${(abs / 1_000_000_000).toFixed(decimals)}B`;
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(decimals)}M`;
  return `${sign}$${abs.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
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

function normalizeSymbol(value) {
  return String(value ?? "").trim().replace(/\.T$/i, "").toUpperCase();
}

function titleCase(value) {
  return String(value ?? "")
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
}

function bySymbol(rows) {
  const out = new Map();
  for (const row of list(rows)) {
    const symbol = normalizeSymbol(row?.symbol ?? row?.primary_symbol);
    if (!symbol) continue;
    if (!out.has(symbol)) out.set(symbol, []);
    out.get(symbol).push(row);
  }
  return out;
}

function arrayFromPayload(payload, keys) {
  if (Array.isArray(payload)) return payload;
  for (const key of keys) {
    if (Array.isArray(payload?.[key])) return payload[key];
  }
  return [];
}

function reviewerQueueRows(payload) {
  if (Array.isArray(payload?.groups)) {
    return payload.groups.flatMap((group) => list(group.children).map((child) => ({
      ...child,
      symbol: child.symbol ?? group.symbol,
      company_name: child.company_name ?? group.company_name,
      status: child.status ?? group.status,
    })));
  }
  return arrayFromPayload(payload, ["rows", "items", "queue", "reviewer_queue"]);
}

function unwrapSettled(result) {
  if (result.status !== "fulfilled") return null;
  const value = result.value;
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function daysOld(value) {
  if (!value) return null;
  const t = Date.parse(value);
  if (Number.isNaN(t)) return null;
  return Math.max(0, (Date.now() - t) / 86_400_000);
}

function latestDate(values) {
  const dates = values
    .filter(Boolean)
    .map((value) => {
      const t = Date.parse(String(value));
      return Number.isNaN(t) ? null : { value, t };
    })
    .filter(Boolean)
    .sort((a, b) => b.t - a.t);
  return dates[0]?.value ?? null;
}

function freshnessLabel(value) {
  const age = daysOld(value);
  if (age === null) return { label: "missing", stale: true };
  if (age <= 14) return { label: "fresh", stale: false };
  if (age <= 45) return { label: "current", stale: false };
  if (age <= 90) return { label: "aging", stale: true };
  return { label: "stale", stale: true };
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
  return `<span class="pv2-pill ${escapeHTML(cls)}">${escapeHTML(value)}</span>`;
}

function severityClass(value, priority = 0) {
  const raw = String(value ?? "").toLowerCase();
  if (raw === "critical" || raw === "high" || Number(priority) >= 85) return "high";
  if (raw === "medium" || Number(priority) >= 65) return "medium";
  return "";
}

function actionText(state, side) {
  if (state === "reunderwrite") return "Reunderwrite";
  if (state === "exit_review") return side === "short" ? "Review Cover / Exit" : "Exit Review";
  if (state === "trim_watch") return "Trim Watch";
  if (state === "no_new_long") return "No New Long";
  if (state === "eligible_add") return "Eligible Add";
  if (state === "watch_only") return "Watch Only";
  return side === "short" ? "Maintain Short Review" : "Maintain";
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
  return {
    label: issues.length ? "stale" : "green",
    stale_count: issues.length,
    issues,
    entries,
  };
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

function evaluateTechnical(header) {
  const rsi = numberValue(header?.rsi_14, NaN);
  const pct50 = numberValue(header?.pct_from_sma_50, NaN);
  const pct200 = numberValue(header?.pct_from_sma_200, NaN);
  const boll = numberValue(header?.bollinger_position, NaN);
  const p5 = numberValue(header?.price_change_5d_pct, NaN);
  const p3m = numberValue(header?.price_change_3m_pct, NaN);
  const hasRsi = Number.isFinite(rsi);
  const hasMa = Number.isFinite(pct50) && Number.isFinite(pct200);
  if (!hasRsi && !hasMa) return { gate: "missing_technicals", missing: true };
  if (hasRsi && rsi > 75 && (!Number.isFinite(boll) || boll >= 0.85)) return { gate: "overbought_no_chase", missing: false };
  if (hasMa && pct50 < 0 && pct200 < 0) return { gate: "below_50dma_and_200dma", missing: false };
  if (hasRsi && rsi < 40 && (!Number.isFinite(p5) || p5 <= 0)) return { gate: "weak_no_reversal", missing: false };
  if (hasMa && pct50 > 8 && hasRsi && rsi >= 55 && Number.isFinite(p5) && p5 < 0) return { gate: "extended_rolling_over", missing: false };
  if (hasMa && pct50 > 0 && pct200 > 0 && hasRsi && rsi >= 45 && rsi <= 70) return { gate: "constructive", missing: false };
  if (!hasMa && hasRsi && rsi >= 45 && rsi <= 70 && (!Number.isFinite(p3m) || p3m >= 0)) {
    return { gate: "constructive_partial", missing: true };
  }
  return { gate: hasMa ? "neutral" : "partial_technicals", missing: !hasMa };
}

function claimCoverageFor(row) {
  const count = numberValue(row?.claim_count, 0);
  const claimTypes = list(row?.claim_types).map((item) => String(item).toLowerCase());
  const sourcePriorities = list(row?.source_priorities).map((item) => String(item).toLowerCase());
  const combined = [...claimTypes, ...sourcePriorities].join(" ");
  const hasLeadLag =
    combined.includes("global_lead_lag") ||
    combined.includes("lead_lag") ||
    combined.includes("lead-lag") ||
    combined.includes("market_data") ||
    combined.includes("technical_indicator");
  return {
    claim_count: count,
    has_lead_lag: hasLeadLag,
    latest: row?.latest_extracted_at ?? row?.latest_as_of_date ?? null,
  };
}

function activeContradictions(rows) {
  return list(rows).filter((row) => {
    const status = String(row?.status ?? "open").toLowerCase();
    return ["open", "review", "in_review"].includes(status);
  });
}

function severeContradictions(rows) {
  return activeContradictions(rows).filter((row) => ["critical", "high"].includes(String(row?.severity ?? "").toLowerCase()));
}

function reviewState({ side, technical, leadLag, sourceHealth, freshness, severeCount, queueRows, signalRows, dataGaps }) {
  const signalText = JSON.stringify(signalRows ?? []).toLowerCase();
  const queueText = JSON.stringify(queueRows ?? []).toLowerCase();
  if (severeCount > 0 || signalText.includes("reunderwrite") || queueText.includes("contradiction_review")) return "reunderwrite";
  if (signalText.includes("exit")) return "exit_review";
  if (signalText.includes("trim")) return "trim_watch";
  if (side === "short") {
    if (["constructive", "constructive_partial"].includes(technical.gate)) return "exit_review";
    return dataGaps.length ? "watch_only" : "maintain";
  }
  if (sourceHealth.label !== "green") return "no_new_long";
  if (["overbought_no_chase", "below_50dma_and_200dma", "weak_no_reversal", "extended_rolling_over", "missing_technicals"].includes(technical.gate)) {
    return "no_new_long";
  }
  if (leadLag === "negative") return "trim_watch";
  if (leadLag === "missing") return "no_new_long";
  if (leadLag === "positive" && !freshness.stale && ["constructive", "constructive_partial"].includes(technical.gate) && !dataGaps.length) {
    return "eligible_add";
  }
  return "maintain";
}

function buildRows({ dashboard, sourceHealthPayload, reviewerPayload, contradictionPayload, signalPayload, claimPayload, headers }) {
  const sourceHealth = sourceHealthState(sourceHealthPayload);
  const positions = list(dashboard?.positions).sort((a, b) => Math.abs(numberValue(b.weight)) - Math.abs(numberValue(a.weight)));
  const queueRows = reviewerQueueRows(reviewerPayload);
  const contradictionRows = arrayFromPayload(contradictionPayload, ["contradictions", "rows", "items"]);
  const signalRows = arrayFromPayload(signalPayload, ["candidates", "rows", "items"]);
  const claimRows = arrayFromPayload(claimPayload, ["symbols", "rows", "items"]);
  const queueBySymbol = bySymbol(queueRows);
  const contradictionBySymbol = bySymbol(contradictionRows);
  const signalBySymbol = bySymbol(signalRows);
  const claimBySymbol = bySymbol(claimRows);
  const headerBySymbol = new Map(headers.map((row) => [normalizeSymbol(row?.symbol), row]).filter(([symbol]) => symbol));

  return positions.map((position) => {
    const symbol = normalizeSymbol(position.symbol);
    const side = numberValue(position.weight, 0) < 0 ? "short" : "long";
    const symbolQueue = queueBySymbol.get(symbol) ?? [];
    const symbolContradictions = contradictionBySymbol.get(symbol) ?? [];
    const symbolSignals = signalBySymbol.get(symbol) ?? [];
    const claim = claimCoverageFor((claimBySymbol.get(symbol) ?? [])[0] ?? null);
    const technical = evaluateTechnical(headerBySymbol.get(symbol));
    const leadLag = claim.has_lead_lag ? "confirmed" : "missing";
    const severe = severeContradictions(symbolContradictions);
    const latestSignalDate = latestDate([
      position.latest_research_date,
      claim.latest,
      ...symbolSignals.map((row) => row.latest_detected_at ?? row.created_at ?? row.updated_at),
    ]);
    const freshness = freshnessLabel(latestSignalDate);
    const gaps = [];
    if (!claim.has_lead_lag) gaps.push("US/global lead-lag");
    if (claim.claim_count <= 0) gaps.push("source claims");
    if (technical.missing) gaps.push("technical source");
    if (freshness.stale) gaps.push("signal freshness");
    if (sourceHealth.label !== "green") gaps.push("source health");
    const state = reviewState({
      side,
      technical,
      leadLag: claim.has_lead_lag ? "positive" : "missing",
      sourceHealth,
      freshness,
      severeCount: severe.length,
      queueRows: symbolQueue,
      signalRows: symbolSignals,
      dataGaps: gaps,
    });
    return {
      symbol,
      company: position.company_name_jp ?? position.company_name ?? symbol,
      current_weight: numberValue(position.weight, 0),
      side,
      v2_state: state,
      suggested_pm_action: actionText(state, side),
      technical_gate: technical.gate,
      global_lead_lag_status: leadLag,
      contradiction_count: activeContradictions(symbolContradictions).length,
      high_critical_contradiction_count: severe.length,
      reviewer_queue_count: symbolQueue.length,
      data_gaps: gaps,
      source_health: sourceHealth.label,
      signal_freshness: freshness.label,
    };
  });
}

function renderSummary(dashboard, rows, sourceHealthPayload) {
  const nav = dashboard?.latest_nav ?? {};
  const sourceHealth = sourceHealthState(sourceHealthPayload);
  const count = (state) => rows.filter((row) => row.v2_state === state).length;
  const dataGapCount = rows.filter((row) => row.data_gaps.length).length;
  const openQueue = rows.reduce((sum, row) => sum + row.reviewer_queue_count, 0);
  const highContradictions = rows.reduce((sum, row) => sum + row.high_critical_contradiction_count, 0);
  $("pv2-summary").innerHTML = [
    metricHTML("NAV", formatUsd(nav.nav_usd, 2), `as of ${formatDate(nav.nav_date)}`),
    metricHTML("Gross / Net", `${formatPct(nav.gross_exposure)} / ${formatPct(nav.net_exposure)}`, `cash ${formatPct(nav.cash_weight)}`),
    metricHTML("Reviewer Queue", String(openQueue), "open items in holdings"),
    metricHTML("High Contradictions", String(highContradictions), "open high/critical"),
    metricHTML("Stale Sources", String(sourceHealth.stale_count), sourceHealth.label),
    metricHTML("No New Long", String(count("no_new_long")), "blocked adds"),
    metricHTML("Reunderwrite", String(count("reunderwrite")), "human review"),
    metricHTML("Exit Review", String(count("exit_review")), "position review"),
    metricHTML("Data Gaps", String(dataGapCount), "holdings affected"),
  ].join("");
}

function renderStateGroups(rows) {
  $("pv2-state-groups").innerHTML = `
    <div class="pv2-state-grid">
      ${STATE_SECTIONS.map((section) => {
        const items = rows.filter((row) => row.v2_state === section.key);
        return `
          <article class="pv2-state">
            <div class="pv2-state-head">
              <h4>${escapeHTML(section.label)}</h4>
              <span class="pv2-count">${escapeHTML(String(items.length))}</span>
            </div>
            <div class="pv2-holding-list">
              ${items.length ? items.slice(0, 8).map((row) => `
                <div class="pv2-holding">
                  <a href="/stock.html?symbol=${encodeURIComponent(row.symbol)}">${escapeHTML(row.symbol)}</a>
                  <span>${escapeHTML(row.company)}</span>
                  <span class="pv2-weight">${escapeHTML(formatWeight(row.current_weight))}</span>
                </div>
              `).join("") : `<div class="pv2-empty">None</div>`}
              ${items.length > 8 ? `<div class="pv2-meta">+${escapeHTML(String(items.length - 8))} more</div>` : ""}
            </div>
          </article>
        `;
      }).join("")}
    </div>
  `;
}

function renderHoldings(rows) {
  if (!rows.length) {
    $("pv2-holdings").innerHTML = `<div class="pv2-empty">No current positions returned.</div>`;
    return;
  }
  $("pv2-holdings").innerHTML = `
    <div class="pv2-table-wrap">
      <table class="pv2-table">
        <thead>
          <tr>
            <th>Symbol</th>
            <th>Company</th>
            <th class="num">Current Weight</th>
            <th>v2_state</th>
            <th>Suggested PM Action</th>
            <th>Technical Gate</th>
            <th>US Lead-Lag</th>
            <th class="num">Contr.</th>
            <th class="num">Queue</th>
            <th class="num">Gaps</th>
            <th>Source Health</th>
            <th>Signal Freshness</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((row) => `
            <tr class="clickable" data-symbol="${escapeHTML(row.symbol)}">
              <td><strong>${escapeHTML(row.symbol)}</strong></td>
              <td>${escapeHTML(row.company)}</td>
              <td class="num">${escapeHTML(formatWeight(row.current_weight))}</td>
              <td><span class="pv2-state-${escapeHTML(row.v2_state)}">${escapeHTML(row.v2_state)}</span></td>
              <td>${escapeHTML(row.suggested_pm_action)}</td>
              <td>${escapeHTML(row.technical_gate)}</td>
              <td>${escapeHTML(row.global_lead_lag_status)}</td>
              <td class="num">${escapeHTML(String(row.contradiction_count))}</td>
              <td class="num">${escapeHTML(String(row.reviewer_queue_count))}</td>
              <td class="num">${escapeHTML(String(row.data_gaps.length))}</td>
              <td>${statusPill(row.source_health, row.source_health === "green" ? "good" : "high")}</td>
              <td>${statusPill(row.signal_freshness, row.signal_freshness === "fresh" || row.signal_freshness === "current" ? "good" : "medium")}</td>
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

function renderDataGaps(rows) {
  const gapMap = new Map();
  for (const row of rows) {
    for (const gap of row.data_gaps) {
      if (!gapMap.has(gap)) gapMap.set(gap, []);
      gapMap.get(gap).push(row);
    }
  }
  const entries = [...gapMap.entries()].sort((a, b) => b[1].length - a[1].length);
  $("pv2-data-gaps").innerHTML = entries.length ? `
    <div class="pv2-gap-list">
      ${entries.map(([gap, items]) => `
        <div class="pv2-gap-row">
          <strong>${escapeHTML(gap)}</strong>
          <div>
            ${escapeHTML(items.slice(0, 12).map((row) => row.symbol).join(", "))}
            ${items.length > 12 ? `<span class="pv2-meta"> +${escapeHTML(String(items.length - 12))} more</span>` : ""}
            <div class="pv2-meta">${escapeHTML(String(items.length))} holding${items.length === 1 ? "" : "s"}</div>
          </div>
        </div>
      `).join("")}
    </div>
  ` : `<div class="pv2-empty">No data gaps detected from current read-only inputs.</div>`;
}

function renderLegacy(dashboard) {
  const run = dashboard?.latest_run ?? {};
  const risk = dashboard?.latest_risk ?? {};
  const trades = list(dashboard?.trades);
  $("pv2-legacy").innerHTML = `
    <div>Latest legacy model run: ${escapeHTML(run.status ?? "-")} / ${escapeHTML(run.run_type ?? "-")} / ${escapeHTML(formatDate(run.run_date ?? run.started_at))}</div>
    <div>Risk snapshot: max name ${escapeHTML(formatWeight(risk.max_name_weight))}, max sector ${escapeHTML(formatWeight(risk.max_sector_weight))}, max theme ${escapeHTML(formatWeight(risk.max_theme_weight))}</div>
    <div>Legacy trade-log rows available: ${escapeHTML(String(trades.length))}. Use the legacy/debug page only for historical validation context.</div>
  `;
}

function renderLoading() {
  $("pv2-summary").innerHTML = Array.from({ length: 9 }).map(() => metricHTML("Loading", "-", "")).join("");
  $("pv2-state-groups").innerHTML = `<div class="pv2-empty">${skeletonRowHTML("70%")}</div>`;
  $("pv2-holdings").innerHTML = `<div class="pv2-empty">${skeletonRowHTML("100%")}</div>`;
  $("pv2-data-gaps").innerHTML = `<div class="pv2-empty">${skeletonRowHTML("80%")}</div>`;
  $("pv2-source-health").innerHTML = `<div class="pv2-empty">${skeletonRowHTML("75%")}</div>`;
  $("pv2-legacy").innerHTML = "";
}

async function load() {
  renderLoading();
  const [dashboard, sourceHealthPayload, reviewerPayload, contradictionPayload, signalPayload, claimPayload] =
    await Promise.all([
      getModelPortfolioDashboard(),
      getBrainSourceHealth(),
      getResearchReviewerQueue({ status: "open", limit: 100 }),
      getResearchContradictionDashboard({ days: 180, limit: 200, status: "open" }),
      getSignalUpdateCandidatesDashboard({ days: 180, limit: 200, status: "open" }),
      getClaimCoverageDashboard({ days: 180, limit: 200 }),
    ]);
  const positions = list(dashboard?.positions);
  const headerResults = await Promise.allSettled(
    positions.map((position) => getStockHeader(normalizeSymbol(position.symbol)))
  );
  const headers = headerResults.map(unwrapSettled).filter(Boolean);
  const rows = buildRows({ dashboard, sourceHealthPayload, reviewerPayload, contradictionPayload, signalPayload, claimPayload, headers });
  const run = dashboard?.latest_run ?? {};
  $("pv2-subtitle").textContent = `Latest model run ${run.status ?? "-"} / ${formatDate(run.run_date ?? run.started_at)}. Current holdings ${rows.length}.`;
  renderSummary(dashboard, rows, sourceHealthPayload);
  renderStateGroups(rows);
  renderHoldings(rows);
  renderDataGaps(rows);
  renderSourceHealth(sourceHealthPayload);
  renderLegacy(dashboard);
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
