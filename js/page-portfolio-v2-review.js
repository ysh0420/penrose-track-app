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
  { key: "short_candidate", label: "Short Candidate" },
  { key: "trim_watch", label: "Trim Watch" },
  { key: "maintain", label: "Maintain" },
  { key: "watch_only", label: "Watch Only" },
  { key: "eligible_add", label: "Eligible Add" },
];

const COVERAGE_BACKLOG_DEFS = [
  { key: "missing_us_global_lead_lag", label: "Missing US/global lead-lag" },
  { key: "missing_topix_rs", label: "Missing TOPIX RS" },
  { key: "missing_sector_rs", label: "Missing sector RS" },
  { key: "missing_peer_rs", label: "Missing peer basket RS" },
  { key: "missing_revision_valuation", label: "Missing revision / valuation" },
  { key: "missing_technicals", label: "Missing technical fields" },
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

function stateBadge(value) {
  const state = String(value ?? "unknown");
  return `<span class="pv2-state-badge ${escapeHTML(state)}">${escapeHTML(state)}</span>`;
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

function rowGapText(row) {
  return list(row.data_gaps).join(" | ").toLowerCase();
}

function rowState(row) {
  return String(row.v2_state ?? "").toLowerCase();
}

function rowTechnicalGate(row) {
  return String(row.technical_gate ?? "").toLowerCase();
}

function isShortExposure(row) {
  const weight = numberValue(row.current_weight_shadow ?? row.target_weight_shadow, NaN);
  return rowState(row) === "short_candidate" || String(row.side ?? "").toLowerCase() === "short" || (Number.isFinite(weight) && weight < 0);
}

function coverageFlags(row) {
  const gaps = rowGapText(row);
  const leadLagStatus = String(row.global_lead_lag_status ?? "").toLowerCase();
  const technicalGate = rowTechnicalGate(row);
  const sourceHealth = String(row.source_health ?? "").toLowerCase();
  return {
    high_contradiction: numberValue(row.contradiction_count, 0) > 0,
    queue_open: numberValue(row.reviewer_queue_count, 0) > 0,
    data_gap_count: numberValue(row.data_gap_count, list(row.data_gaps).length),
    missing_us_global_lead_lag:
      leadLagStatus === "" ||
      ["missing", "none", "unknown", "gap"].includes(leadLagStatus) ||
      /lead[-\s]?lag|global|us/.test(gaps),
    missing_topix_rs: /topix/.test(gaps) && /relative|rs/.test(gaps),
    missing_sector_rs: /sector/.test(gaps) && /relative|rs/.test(gaps),
    missing_peer_rs: /peer/.test(gaps) && /relative|rs/.test(gaps),
    missing_revision_valuation: /revision|valuation|estimate|target|rating|guidance/.test(gaps),
    missing_technicals:
      (technicalGate && !["pass", "passed", "healthy", "ok", "clear"].includes(technicalGate)) ||
      /rsi|adx|dma|sma|bollinger|volume|technical/.test(gaps),
    source_health_issue: Boolean(sourceHealth && !["healthy", "fresh", "ok", "green"].includes(sourceHealth)),
  };
}

function hasCoverageGap(row) {
  const flags = row.coverage_flags ?? coverageFlags(row);
  return Boolean(
    flags.missing_us_global_lead_lag ||
      flags.missing_topix_rs ||
      flags.missing_sector_rs ||
      flags.missing_peer_rs ||
      flags.missing_revision_valuation ||
      flags.missing_technicals ||
      flags.source_health_issue ||
      flags.data_gap_count > 0
  );
}

function primaryReason(row) {
  const state = rowState(row);
  const flags = row.coverage_flags ?? coverageFlags(row);
  if (state === "reunderwrite" || flags.high_contradiction) {
    return flags.queue_open ? "Reunderwrite: contradiction + open reviewer queue" : "Reunderwrite: contradiction review required";
  }
  if (state === "exit_review") return "Exit Review: PM decision required";
  if (state === "trim_watch") return "Trim Watch: PM sizing review required";
  if (state === "short_candidate" && hasCoverageGap(row)) return "Short Review: technical/lead-lag coverage incomplete";
  if (flags.missing_us_global_lead_lag) return "No New Long: lead-lag missing + RS incomplete";
  if (flags.missing_sector_rs || flags.missing_peer_rs) return "Source Refresh: sector/peer RS missing";
  if (flags.missing_topix_rs) return "Source Refresh: TOPIX RS missing";
  if (flags.missing_technicals) return "Source Refresh: technical fields missing";
  if (state === "no_new_long") return "No New Long: technical / timing block";
  if (state === "watch_only") return "Watch Only: insufficient structured claims";
  return "Maintain: no immediate PM action";
}

function nextRequiredInput(row) {
  const state = rowState(row);
  const flags = row.coverage_flags ?? coverageFlags(row);
  if (state === "reunderwrite" || flags.high_contradiction) return "PM contradiction review";
  if (state === "exit_review") return "PM exit review";
  if (state === "trim_watch") return "PM trim / sizing review";
  if (state === "short_candidate" && hasCoverageGap(row)) return "short risk source refresh";
  if (flags.missing_us_global_lead_lag) return "US/global lead-lag source pack";
  if (flags.missing_sector_rs || flags.missing_peer_rs) return "sector / peer relative-strength pack";
  if (flags.missing_topix_rs) return "TOPIX relative-strength pack";
  if (flags.missing_technicals) return "technical source refresh";
  if (flags.missing_revision_valuation) return "revision / valuation source pack";
  if (state === "no_new_long") return "timing and source coverage review";
  if (state === "watch_only") return "structured claim coverage";
  return "monitor next V2 log";
}

function priority(row) {
  const state = rowState(row);
  const flags = row.coverage_flags ?? coverageFlags(row);
  if (state === "reunderwrite" || state === "exit_review" || state === "trim_watch" || flags.high_contradiction) {
    return { rank: 1, label: "High", cls: "high" };
  }
  if (state === "short_candidate" || isShortExposure(row)) return { rank: 2, label: "High", cls: "high" };
  if (state === "no_new_long" || flags.missing_us_global_lead_lag || flags.missing_topix_rs || flags.missing_sector_rs || flags.missing_peer_rs || flags.missing_technicals) {
    return { rank: 3, label: "Medium", cls: "medium" };
  }
  return { rank: 4, label: "Lower", cls: "low" };
}

function actionGroup(row) {
  const state = rowState(row);
  const flags = row.coverage_flags ?? coverageFlags(row);
  if (state === "reunderwrite" || state === "exit_review" || state === "trim_watch" || flags.high_contradiction || state === "short_candidate") {
    return "immediate";
  }
  if (state === "no_new_long") return "no_new_long";
  if (hasCoverageGap(row)) return "source_refresh";
  return "monitor";
}

function enrichItems(items) {
  return items.map((row) => {
    const flags = coverageFlags(row);
    const enriched = { ...row, coverage_flags: flags };
    return {
      ...enriched,
      primary_reason: primaryReason(enriched),
      next_required_input: nextRequiredInput(enriched),
      priority: priority(enriched),
      action_group: actionGroup(enriched),
    };
  }).sort((a, b) => {
    const prio = a.priority.rank - b.priority.rank;
    if (prio !== 0) return prio;
    return numberValue(b.data_gap_count, 0) - numberValue(a.data_gap_count, 0);
  });
}

function renderSummary(payload, sourceHealthPayload, items) {
  const log = logPayload(payload);
  const summary = payload?.summary ?? {};
  const sourceHealth = sourceHealthState(sourceHealthPayload);
  const countGroup = (group) => items.filter((row) => row.action_group === group).length;
  const stateCount = (state) => items.filter((row) => row.v2_state === state).length;
  const shortReview = items.filter((row) => rowState(row) === "short_candidate" || (isShortExposure(row) && hasCoverageGap(row))).length;
  const dataGapNames = items.filter((row) => numberValue(row.data_gap_count, list(row.data_gaps).length) > 0).length;

  $("pv2-summary").innerHTML = [
    metricHTML("Immediate PM Review", String(countGroup("immediate")), "decision queue"),
    metricHTML("Source Refresh", String(countGroup("source_refresh")), "coverage inputs"),
    metricHTML("No New Long", String(stateCount("no_new_long")), "do not add"),
    metricHTML("Reunderwrite", String(stateCount("reunderwrite")), "highest priority"),
    metricHTML("Short Review", String(shortReview), "short risk / source gap"),
    metricHTML("Data Gap Count", String(numberValue(summary.data_gap_count, dataGapNames)), `${dataGapNames} names affected`),
    metricHTML("Source Health", titleCase(sourceHealth.label), `${sourceHealth.stale_count} issue${sourceHealth.stale_count === 1 ? "" : "s"}`),
    metricHTML("Active V2 Log", formatDate(log.log_date), log.status ?? "no log yet"),
  ].join("");
}

function actionCardHTML(row) {
  const prio = row.priority ?? priority(row);
  return `
    <article class="pv2-action-card ${escapeHTML(prio.cls)}">
      <div class="pv2-action-top">
        <div>
          <a class="pv2-action-symbol" href="/stock.html?symbol=${encodeURIComponent(row.symbol)}">${escapeHTML(row.symbol)}</a>
          <div class="pv2-action-company">${escapeHTML(row.company_name ?? row.symbol)}</div>
        </div>
        ${stateBadge(row.v2_state)}
      </div>
      <div>${statusPill(`Priority: ${prio.label}`, prio.cls)}</div>
      <div class="pv2-action-reason">${escapeHTML(row.primary_reason)}</div>
      <div class="pv2-action-meta">Action: ${escapeHTML(row.suggested_pm_action ?? "-")}</div>
      <div class="pv2-action-meta">Next input: ${escapeHTML(row.next_required_input)}</div>
      <div class="pv2-action-meta">Queue ${escapeHTML(String(numberValue(row.reviewer_queue_count, 0)))} / gaps ${escapeHTML(String(numberValue(row.data_gap_count, list(row.data_gaps).length)))}</div>
    </article>
  `;
}

function actionColumnHTML(title, rows) {
  return `
    <section class="pv2-action-column">
      <div class="pv2-action-head">
        <h4>${escapeHTML(title)}</h4>
        <span class="pv2-count">${escapeHTML(String(rows.length))}</span>
      </div>
      <div class="pv2-action-list">
        ${rows.length ? rows.slice(0, 6).map(actionCardHTML).join("") : `<div class="pv2-empty">None</div>`}
        ${rows.length > 6 ? `<div class="pv2-meta">+${escapeHTML(String(rows.length - 6))} more in table</div>` : ""}
      </div>
    </section>
  `;
}

function renderTodayActions(items, sourceHealthPayload) {
  const sourceHealth = sourceHealthState(sourceHealthPayload);
  const groups = {
    immediate: items.filter((row) => row.action_group === "immediate"),
    source_refresh: items.filter((row) => row.action_group === "source_refresh"),
    no_new_long: items.filter((row) => row.action_group === "no_new_long"),
    monitor: items.filter((row) => row.action_group === "monitor"),
  };
  const systemRows = sourceHealth.issues.map(([key, row]) => ({
    symbol: "System",
    company_name: titleCase(key),
    v2_state: "source_health",
    primary_reason: `${titleCase(row.latest_status ?? row.latest_success_status ?? "stale")}: source health requires review`,
    suggested_pm_action: "review source pipeline health",
    next_required_input: row.latest_success_at ? `latest success ${formatDate(row.latest_success_at)}` : "source health refresh",
    reviewer_queue_count: 0,
    data_gap_count: numberValue(row.consecutive_failures, 0),
    priority: { rank: 3, label: "Medium", cls: "medium" },
  }));

  $("pv2-today-actions").innerHTML = `
    <div class="pv2-action-board">
      ${actionColumnHTML("Immediate PM Review", groups.immediate)}
      ${actionColumnHTML("Source Refresh Required", groups.source_refresh)}
      ${actionColumnHTML("Do Not Add / No New Long", groups.no_new_long)}
      ${actionColumnHTML("Monitor Only", groups.monitor)}
      ${actionColumnHTML("System / Data Issues", systemRows)}
    </div>
  `;
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

function gapsHTML(row) {
  const gaps = list(row.data_gaps).map((gap) => String(gap));
  if (!gaps.length) return `<span class="pv2-compact-gaps">-</span>`;
  const top = gaps.slice(0, 2).join("; ");
  const more = gaps.length - 2;
  return `
    <details class="pv2-gap-details">
      <summary>${escapeHTML(top)}${more > 0 ? ` <span class="pv2-meta">+${escapeHTML(String(more))} more</span>` : ""}</summary>
      <ul>${gaps.map((gap) => `<li>${escapeHTML(gap)}</li>`).join("")}</ul>
    </details>
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
            <th>Priority</th>
            <th>Primary Reason</th>
            <th>Next Required Input</th>
            <th>Suggested PM Action</th>
            <th>Technical Gate</th>
            <th>US Lead-Lag</th>
            <th class="num">Contr.</th>
            <th class="num">Queue</th>
            <th class="num">Gaps</th>
            <th>Top Gaps</th>
            <th>Source Health</th>
            <th>Signal Freshness</th>
            <th class="num">Target Shadow</th>
          </tr>
        </thead>
        <tbody>
          ${items.map((row) => {
            const prio = row.priority ?? priority(row);
            return `
              <tr class="clickable" data-symbol="${escapeHTML(row.symbol)}">
                <td><strong>${escapeHTML(row.symbol)}</strong></td>
                <td>${escapeHTML(row.company_name ?? "")}</td>
                <td>${stateBadge(row.v2_state)}</td>
                <td>${statusPill(prio.label, prio.cls)}</td>
                <td>${escapeHTML(row.primary_reason)}</td>
                <td>${escapeHTML(row.next_required_input)}</td>
                <td>${escapeHTML(row.suggested_pm_action ?? "-")}</td>
                <td>${escapeHTML(row.technical_gate ?? "-")}</td>
                <td>${escapeHTML(row.global_lead_lag_status ?? "-")}</td>
                <td class="num">${escapeHTML(String(numberValue(row.contradiction_count, 0)))}</td>
                <td class="num">${escapeHTML(String(numberValue(row.reviewer_queue_count, 0)))}</td>
                <td class="num">${escapeHTML(String(numberValue(row.data_gap_count, list(row.data_gaps).length)))}</td>
                <td>${gapsHTML(row)}</td>
                <td>${statusPill(row.source_health ?? "missing", row.source_health === "healthy" ? "good" : "medium")}</td>
                <td>${statusPill(row.signal_freshness ?? "missing", row.signal_freshness === "fresh" ? "good" : "medium")}</td>
                <td class="num">${escapeHTML(formatWeight(row.target_weight_shadow))}</td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;
  $("pv2-holdings").querySelectorAll("tr.clickable").forEach((row) => {
    row.addEventListener("click", (event) => {
      if (event.target instanceof Element && event.target.closest("a, button, details, summary")) return;
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

function renderPmDecisionQueue(items) {
  const rows = items.filter((row) => row.action_group === "immediate");
  $("pv2-pm-decision-queue").innerHTML = rows.length ? `
    <div class="pv2-gap-list">
      ${rows.slice(0, 10).map((row) => `
        <div class="pv2-gap-row">
          <strong><a class="pv2-action-symbol" href="/stock.html?symbol=${encodeURIComponent(row.symbol)}">${escapeHTML(row.symbol)}</a></strong>
          <div>
            ${stateBadge(row.v2_state)}
            <div class="pv2-meta">${escapeHTML(row.primary_reason)}</div>
            <div class="pv2-meta">Next: ${escapeHTML(row.next_required_input)}</div>
          </div>
        </div>
      `).join("")}
    </div>
  ` : `<div class="pv2-empty">No immediate PM decision rows.</div>`;
}

function renderCoverageBacklog(items) {
  const rows = COVERAGE_BACKLOG_DEFS.map((def) => {
    const matching = items.filter((row) => Boolean((row.coverage_flags ?? coverageFlags(row))[def.key]));
    return { ...def, rows: matching };
  }).filter((row) => row.rows.length > 0);

  $("pv2-coverage-backlog").innerHTML = rows.length ? `
    <div class="pv2-gap-list">
      ${rows.map((row) => `
        <div class="pv2-gap-row">
          <strong>${escapeHTML(row.label)}</strong>
          <div>
            ${escapeHTML(row.rows.slice(0, 12).map((item) => item.symbol).join(", "))}
            ${row.rows.length > 12 ? `<span class="pv2-meta"> +${escapeHTML(String(row.rows.length - 12))} more</span>` : ""}
            <div class="pv2-meta">${escapeHTML(String(row.rows.length))} names / source-pack backlog, not PM status changes</div>
          </div>
        </div>
      `).join("")}
    </div>
  ` : `<div class="pv2-empty">No coverage backlog rows returned.</div>`;
}

function renderSystemIssues(items, sourceHealthPayload) {
  const health = sourceHealthState(sourceHealthPayload);
  const itemIssues = items.filter((row) => (row.coverage_flags ?? coverageFlags(row)).source_health_issue);
  const healthRows = health.issues.map(([key, row]) => ({ key, row }));
  $("pv2-system-issues").innerHTML = (healthRows.length || itemIssues.length) ? `
    <div class="pv2-gap-list">
      ${healthRows.map(({ key, row }) => `
        <div class="pv2-gap-row">
          <strong>${escapeHTML(titleCase(key))}</strong>
          <div>${statusPill(row.latest_status ?? row.latest_success_status ?? "stale", "medium")}<div class="pv2-meta">failures ${escapeHTML(String(numberValue(row.consecutive_failures, 0)))}</div></div>
        </div>
      `).join("")}
      ${itemIssues.slice(0, 10).map((row) => `
        <div class="pv2-gap-row">
          <strong>${escapeHTML(row.symbol)}</strong>
          <div>${statusPill(row.source_health ?? "missing", "medium")}<div class="pv2-meta">${escapeHTML(row.primary_reason)}</div></div>
        </div>
      `).join("")}
    </div>
  ` : `<div class="pv2-empty">No stale source-health or system issue rows returned.</div>`;
}

function renderLoading() {
  $("pv2-summary").innerHTML = Array.from({ length: 8 }).map(() => metricHTML("Loading", "-", "")).join("");
  $("pv2-today-actions").innerHTML = `<div class="pv2-empty">${skeletonRowHTML("90%")}</div>`;
  $("pv2-pm-decision-queue").innerHTML = `<div class="pv2-empty">${skeletonRowHTML("80%")}</div>`;
  $("pv2-coverage-backlog").innerHTML = `<div class="pv2-empty">${skeletonRowHTML("80%")}</div>`;
  $("pv2-system-issues").innerHTML = `<div class="pv2-empty">${skeletonRowHTML("80%")}</div>`;
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
  const items = enrichItems(itemsPayload(logPayloadData));
  $("pv2-subtitle").textContent = log.log_date
    ? `Clean V2 log ${formatDate(log.log_date)} / ${items.length} items. V1 model book is legacy archive only.`
    : "Clean V2 log has not started yet. First log date is tomorrow JST once the trusted backend CLI writes it.";
  renderSummary(logPayloadData, sourceHealthPayload, items);
  renderTodayActions(items, sourceHealthPayload);
  renderPmDecisionQueue(items);
  renderCoverageBacklog(items);
  renderSystemIssues(items, sourceHealthPayload);
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
    $("pv2-today-actions").innerHTML = "";
    $("pv2-pm-decision-queue").innerHTML = "";
    $("pv2-coverage-backlog").innerHTML = "";
    $("pv2-system-issues").innerHTML = "";
  });
}

mountBrainAuthGate({
  onAuthed: () => {
    $("pv2-reload").addEventListener("click", loadWithErrorHandling);
    loadWithErrorHandling();
  },
});
