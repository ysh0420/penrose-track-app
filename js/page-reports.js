// @ts-check
import { mountBrainAuthGate } from "./brain-client.js";
import {
  getClaimCoverageDashboard,
  getPublishedReports,
  getPublishedReportBySlug,
  getReportLineage,
  getResearchContradictionDashboard,
  getResearchRefreshCandidates,
  getResearchRefreshDashboard,
  getSignalUpdateCandidatesDashboard,
} from "./brain-queries.js";
import {
  escapeHTML,
  formatRelativeTime,
  renderMarkdown,
  skeletonRowHTML,
  verdictBadgeHTML,
} from "./brain-components.js";
import { showError } from "./brain-error.js";

const REQUIRED_SECTIONS = [
  { key: "front", label: "レコメンデーション要約", patterns: ["レコメンデーション要約", "Front-Page Recommendation"] },
  { key: "debate", label: "投資結論と市場の誤解", patterns: ["投資結論", "市場の誤解", "Investment Conclusion"] },
  { key: "koyfin", label: "Koyfin業績予想・リビジョン", patterns: ["Koyfin", "業績予想", "リビジョン", "Estimates"] },
  { key: "valuation", label: "バリュエーション", patterns: ["バリュエーション", "目標株価", "Valuation", "Target Price"] },
  { key: "technicals", label: "TradingViewテクニカル", patterns: ["TradingView", "テクニカル", "RSI", "MACD"] },
  { key: "leadLag", label: "海外セクターリードラグ", patterns: ["海外", "lead-lag", "リードラグ", "global", "sector"] },
  { key: "scenario", label: "Bear/Base/Bull", patterns: ["Bear", "Base", "Bull", "シナリオ"] },
  { key: "committee", label: "7人の投資家委員会", patterns: ["7人", "Seven-Analyst", "Value", "Momentum"] },
  { key: "crossCheck", label: "ソース横断チェック", patterns: ["ソース横断", "Fact Adjudication", "Manus", "Perplexity", "Grok"] },
  { key: "penrose", label: "Penrose View", patterns: ["Penrose View", "ポートフォリオアクション", "Strategy Fit"] },
  { key: "gaps", label: "残るデータギャップ", patterns: ["データギャップ", "Remaining Data Gaps", "要確認"] },
];

const $ = (id) => document.getElementById(id);
const STATIC_REPORTS_URL = "/data/research-reports.json";

function number(value, digits = 0) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "0";
  return n.toLocaleString(undefined, {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
}

function firstValue(...values) {
  return values.find((value) => typeof value === "string" && value.trim() && value.trim() !== "?") ?? "";
}

function parseVerdict(md) {
  const match = String(md ?? "").match(/Synthesis \(verdict: ([^)]+)\)/i);
  return match?.[1] ?? "completed";
}

function parseConvictionRecommendation(md) {
  const match = String(md ?? "").match(/## Conviction recommendation\s+\*\*([^*]+)\*\*/i);
  return match?.[1] ?? null;
}

async function loadStaticReports() {
  // Legacy fallback only. Internal reports should live in Supabase, not in
  // public static markdown files. This returns [] when the manifest is empty.
  try {
    const manifestRes = await fetch(STATIC_REPORTS_URL, { cache: "no-store" });
    if (!manifestRes.ok) return [];
    const manifest = await manifestRes.json();
    if (!Array.isArray(manifest)) return [];
    const reports = await Promise.allSettled(manifest.map(async (row) => {
      if (!row?.markdown_url) return null;
      const mdRes = await fetch(row.markdown_url, { cache: "no-store" });
      if (!mdRes.ok) return null;
      return {
        ...row,
        synthesis_md: await mdRes.text(),
        completed_at: row.completed_at ?? row.updated_at ?? row.created_at,
        legacy_static_report: true,
      };
    }));
    return reports
      .filter((result) => result.status === "fulfilled" && result.value?.synthesis_md)
      .map((result) => /** @type {PromiseFulfilledResult<any>} */(result).value);
  } catch {
    return [];
  }
}

function reportQuality(md) {
  const text = String(md ?? "");
  const found = REQUIRED_SECTIONS.filter((section) =>
    section.patterns.some((pattern) => text.toLowerCase().includes(pattern.toLowerCase()))
  );
  const missing = REQUIRED_SECTIONS.filter((section) => !found.includes(section));
  const score = found.length / REQUIRED_SECTIONS.length;
  const hasKoyfin = found.some((section) => section.key === "koyfin");
  const hasTechnicals = found.some((section) => section.key === "technicals");
  const hasLeadLag = found.some((section) => section.key === "leadLag");
  let status = "Draft with gaps";
  let statusClass = "draft";
  if (score >= 0.9 && hasKoyfin && hasTechnicals && hasLeadLag) {
    status = "Decision-grade";
    statusClass = "decision";
  } else if (score >= 0.72 && hasKoyfin && hasTechnicals) {
    status = "Client-candidate after review";
    statusClass = "candidate";
  }
  return { missing, score, status, statusClass };
}

function dbReportQuality(row) {
  const hasSourceCoverage = Number(row.source_count ?? 0) >= 3;
  const hasInternalApproval = row.publication_gate_status === "approved_internal" || row.publication_gate_status === "approved_public_redacted";
  const hasSignal = Array.isArray(row.primary_signal_ids) && row.primary_signal_ids.length > 0;
  const score = [hasSourceCoverage, hasInternalApproval, hasSignal].filter(Boolean).length / 3;
  let status = "DB-backed report";
  let statusClass = "candidate";
  if (hasSourceCoverage && hasInternalApproval) {
    status = hasSignal ? "Signal-linked report" : "Published report";
    statusClass = "decision";
  }
  return { missing: [], score, status, statusClass };
}

function qualityFor(row, md) {
  return md ? reportQuality(md) : dbReportQuality(row);
}

function reportCardHTML(row, md) {
  const quality = qualityFor(row, md);
  const missing = quality.missing.slice(0, 4).map((section) => section.label).join(", ");
  const symbol = firstValue(row.symbol, Array.isArray(row.symbols) ? row.symbols[0] : "");
  const name = firstValue(row.company_name_jp, row.name_jp, row.company_name, row.name_en, row.title);
  const conviction = row.conviction_recommendation ?? parseConvictionRecommendation(md) ?? row.portfolio_action;
  const verdict = row.verdict ?? row.signal_state ?? parseVerdict(md);
  const sourceLabel = row.db_report ? "Supabase report" : row.legacy_static_report ? "legacy static" : row.static_report ? "saved report" : "report";
  const access = row.access_level ? ` / ${row.access_level}` : "";
  const sourceCount = Number(row.source_count ?? 0) > 0 ? ` / sources ${Number(row.source_count)}` : "";
  return `
    <article class="report-card" data-symbol="${escapeHTML(symbol)}">
      <div class="report-title-row">
        <div>
          <h3>${escapeHTML(row.title ?? `${symbol} ${name}`)}</h3>
          <div class="platform-meta">${escapeHTML(formatRelativeTime(row.published_at ?? row.completed_at ?? row.updated_at ?? row.created_at))} / ${escapeHTML(sourceLabel)}${escapeHTML(access)}${escapeHTML(sourceCount)} / conviction ${escapeHTML(conviction ?? "-")}</div>
        </div>
        <span class="report-score">${Math.round(quality.score * 100)}%</span>
      </div>
      <div>
        ${verdictBadgeHTML(verdict)}
        <span class="report-status ${quality.statusClass}">${escapeHTML(quality.status)}</span>
      </div>
      <div class="report-missing">${quality.missing.length ? `Missing: ${escapeHTML(missing)}${quality.missing.length > 4 ? "..." : ""}` : dbLineageSummary(row)}</div>
      <button class="platform-button" type="button" data-open-report>Open report</button>
    </article>
  `;
}

function dbLineageSummary(row) {
  if (row.db_report) {
    const signals = Array.isArray(row.primary_signal_ids) ? row.primary_signal_ids.length : 0;
    const signalText = signals ? `${signals} linked signal${signals === 1 ? "" : "s"}` : "No linked signal yet";
    return `DB-backed. ${escapeHTML(signalText)}. Raw Source Runs stay separated from the report shelf.`;
  }
  return "All required sections detected.";
}

const REFRESH_STATUS_LABELS = {
  queued: "Queued",
  running: "Running",
  skipped: "Skipped",
  retry: "Retry",
  failed: "Failed",
  completed: "Completed",
  other: "Other",
};

function refreshStatusBucket(status) {
  const normalized = String(status ?? "").trim().toLowerCase().replace(/-/g, "_");
  if (normalized === "queued") return "queued";
  if (["started", "running", "in_progress", "claimed"].includes(normalized)) return "running";
  if (["skipped", "cancelled", "canceled"].includes(normalized)) return "skipped";
  if (["requeued", "requeue", "retry", "retry_scheduled"].includes(normalized)) return "retry";
  if (["failed", "failure", "error"].includes(normalized)) return "failed";
  if (["completed", "complete", "success", "done"].includes(normalized)) return "completed";
  return "other";
}

function countByStatus(rows, status) {
  return (rows ?? []).reduce((sum, row) => (
    refreshStatusBucket(row.status) === status ? sum + Number(row.count ?? 0) : sum
  ), 0);
}

function countBySeverity(rows, severity) {
  const match = (rows ?? []).find((row) => row.severity === severity);
  return Number(match?.count ?? 0);
}

function countByAction(rows, action) {
  const match = (rows ?? []).find((row) => row.suggested_action === action);
  return Number(match?.count ?? 0);
}

function sumField(rows, field) {
  return (rows ?? []).reduce((sum, row) => sum + Number(row?.[field] ?? 0), 0);
}

function refreshStatusHTML(status) {
  const raw = String(status ?? "").trim();
  const bucket = refreshStatusBucket(raw);
  const label = REFRESH_STATUS_LABELS[bucket] || "Other";
  const title = raw && raw.toLowerCase() !== label.toLowerCase() ? ` title="Raw status: ${escapeHTML(raw)}"` : "";
  return `<span class="refresh-status ${escapeHTML(bucket)}"${title}>${escapeHTML(label)}</span>`;
}

function listText(values, fallback = "-") {
  const list = Array.isArray(values) ? values.filter(Boolean) : [];
  return list.length ? list.slice(0, 4).join(", ") : fallback;
}

function renderRefreshJobs(rows) {
  const jobs = Array.isArray(rows) ? rows : [];
  if (!jobs.length) return `<div class="platform-empty">No refresh jobs in this window.</div>`;
  return `
    <div class="platform-table-wrap">
      <table class="platform-table compact">
        <thead>
          <tr>
            <th>Company</th>
            <th>Status</th>
            <th class="num">Priority</th>
            <th>Sources</th>
            <th>Due</th>
          </tr>
        </thead>
        <tbody>
          ${jobs.slice(0, 8).map((job) => `
            <tr>
              <td><strong>${escapeHTML(job.symbol ?? "-")}</strong><br><span class="platform-meta">${escapeHTML(job.company_name ?? job.job_key ?? "-")}</span></td>
              <td>${refreshStatusHTML(job.status)}</td>
              <td class="num">${number(job.priority)}</td>
              <td>${escapeHTML(listText(job.required_sources))}</td>
              <td>${escapeHTML(formatRelativeTime(job.due_at ?? job.next_attempt_at ?? job.created_at))}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderRefreshCandidates(rows) {
  const candidates = Array.isArray(rows) ? rows : [];
  if (!candidates.length) return `<div class="platform-empty">No stale or incomplete report candidates.</div>`;
  return `
    <div class="platform-table-wrap">
      <table class="platform-table compact">
        <thead>
          <tr>
            <th>Report</th>
            <th>Reason</th>
            <th class="num">Open</th>
            <th>Signal</th>
          </tr>
        </thead>
        <tbody>
          ${candidates.slice(0, 8).map((row) => `
            <tr>
              <td><strong>${escapeHTML(row.symbol ?? "-")}</strong><br><span class="platform-meta">${escapeHTML(row.title ?? row.report_slug ?? "-")}</span></td>
              <td><div class="refresh-reason">${escapeHTML(row.refresh_reason ?? "-")}${row.data_gaps?.length ? ` / gaps: ${escapeHTML(listText(row.data_gaps))}` : ""}</div></td>
              <td class="num">${number(row.open_job_count)}</td>
              <td>${escapeHTML(row.signal_state ?? row.report_signal_state ?? "-")}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderClaimCoverage(payload) {
  const rows = Array.isArray(payload?.symbols) ? payload.symbols : [];
  if (!rows.length) return `<div class="platform-empty">No structured claims extracted in this window.</div>`;
  return `
    <div class="platform-table-wrap">
      <table class="platform-table compact">
        <thead>
          <tr>
            <th>Company</th>
            <th class="num">Claims</th>
            <th>Coverage</th>
            <th>Latest</th>
          </tr>
        </thead>
        <tbody>
          ${rows.slice(0, 8).map((row) => `
            <tr>
              <td><strong>${escapeHTML(row.symbol ?? "-")}</strong><br><span class="platform-meta">${escapeHTML(row.company_name ?? "-")}</span></td>
              <td class="num">${number(row.claim_count)}</td>
              <td>${escapeHTML(listText(row.source_priorities))}<br><span class="platform-meta">${escapeHTML(listText(row.claim_types))}</span></td>
              <td>${escapeHTML(formatRelativeTime(row.latest_extracted_at ?? row.latest_as_of_date))}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderContradictions(rows) {
  const contradictions = Array.isArray(rows) ? rows : [];
  if (!contradictions.length) return `<div class="platform-empty">No open contradictions in this window.</div>`;
  return `
    <div class="platform-table-wrap">
      <table class="platform-table compact">
        <thead>
          <tr>
            <th>Contradiction</th>
            <th>Severity</th>
            <th>Sources</th>
            <th>Portfolio</th>
          </tr>
        </thead>
        <tbody>
          ${contradictions.slice(0, 8).map((row) => `
            <tr>
              <td><strong>${escapeHTML(row.symbol ?? "-")}</strong> ${escapeHTML(row.claim_label ?? row.claim_key ?? "-")}<br><span class="platform-meta">${escapeHTML(row.comparison_scope ?? "-")} / ${escapeHTML(row.contradiction_type ?? "-")}</span></td>
              <td>${refreshStatusHTML(row.severity)}</td>
              <td>${escapeHTML(row.old_source_type ?? "-")} -> ${escapeHTML(row.new_source_type ?? "-")}<br><span class="platform-meta">${escapeHTML(row.primary_source_precedence ? `primary: ${row.primary_source ?? "-"}` : "no primary override")} / claims ${escapeHTML(String(row.source_claim_count ?? 0))}</span></td>
              <td><div class="refresh-reason">${escapeHTML(row.portfolio_implication ?? row.recommendation ?? "-")}</div></td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderSignalUpdates(payload) {
  const candidates = Array.isArray(payload?.candidates) ? payload.candidates : [];
  if (!candidates.length) return `<div class="platform-empty">No signal update candidates in this window.</div>`;
  return `
    <div class="platform-table-wrap">
      <table class="platform-table compact">
        <thead>
          <tr>
            <th>Signal</th>
            <th>Suggested</th>
            <th class="num">Conf.</th>
            <th>Portfolio</th>
          </tr>
        </thead>
        <tbody>
          ${candidates.slice(0, 8).map((row) => `
            <tr>
              <td><strong>${escapeHTML(row.symbol ?? "-")}</strong><br><span class="platform-meta">${escapeHTML(row.change_type ?? "-")} / contradictions ${escapeHTML(String(row.contradiction_count ?? 0))}</span></td>
              <td>${refreshStatusHTML(row.suggested_action)}</td>
              <td class="num">${number(row.confidence_delta, 2)}</td>
              <td><div class="refresh-reason">${escapeHTML(row.portfolio_review_required ? "Review required before portfolio change" : "Portfolio decision can remain unchanged")}<br>${escapeHTML(row.reason ?? "")}</div></td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderRefreshQueue(dashboard, candidatePayload, contradictionPayload, claimPayload, signalUpdatePayload) {
  const byStatus = dashboard?.by_status ?? [];
  const jobs = dashboard?.jobs ?? [];
  const candidates = candidatePayload?.candidates ?? [];
  const bySeverity = contradictionPayload?.by_severity ?? [];
  const contradictions = contradictionPayload?.contradictions ?? [];
  const claimSymbols = claimPayload?.symbols ?? [];
  const updateActions = signalUpdatePayload?.by_action ?? [];
  const signalUpdates = signalUpdatePayload?.candidates ?? [];
  const openJobs = jobs.filter((job) => ["queued", "running", "retry", "other"].includes(refreshStatusBucket(job.status)));
  const highRiskContradictions = countBySeverity(bySeverity, "critical") + countBySeverity(bySeverity, "high");
  const reviewActions =
    countByAction(updateActions, "reunderwrite") +
    countByAction(updateActions, "watch") +
    countByAction(updateActions, "trim") +
    countByAction(updateActions, "exit") +
    countByAction(updateActions, "no_new_long");
  $("refresh-root").innerHTML = `
    <div class="refresh-grid">
      <div class="refresh-metric"><div class="label">Queued</div><div class="value">${number(countByStatus(byStatus, "queued"))}</div></div>
      <div class="refresh-metric"><div class="label">Running</div><div class="value">${number(countByStatus(byStatus, "running"))}</div></div>
      <div class="refresh-metric"><div class="label">Skipped</div><div class="value">${number(countByStatus(byStatus, "skipped"))}</div></div>
      <div class="refresh-metric"><div class="label">Retry</div><div class="value">${number(countByStatus(byStatus, "retry"))}</div></div>
      <div class="refresh-metric"><div class="label">Failed</div><div class="value">${number(countByStatus(byStatus, "failed"))}</div></div>
      <div class="refresh-metric"><div class="label">Completed</div><div class="value">${number(countByStatus(byStatus, "completed"))}</div></div>
      <div class="refresh-metric"><div class="label">Other</div><div class="value">${number(countByStatus(byStatus, "other"))}</div></div>
      <div class="refresh-metric"><div class="label">Structured Claims</div><div class="value">${number(sumField(claimSymbols, "claim_count"))}</div></div>
      <div class="refresh-metric"><div class="label">High Contradictions</div><div class="value">${number(highRiskContradictions)}</div></div>
      <div class="refresh-metric"><div class="label">Review Actions</div><div class="value">${number(reviewActions || signalUpdates.filter((row) => row.portfolio_review_required).length)}</div></div>
    </div>
    <div class="refresh-layout">
      <div class="refresh-card">
        <h4>Open Refresh Jobs</h4>
        ${renderRefreshJobs(openJobs.length ? openJobs : jobs)}
      </div>
      <div class="refresh-card">
        <h4>Refresh Candidates</h4>
        ${renderRefreshCandidates(candidates)}
      </div>
      <div class="refresh-card">
        <h4>Contradictions</h4>
        ${renderContradictions(contradictions)}
      </div>
      <div class="refresh-card">
        <h4>Claim Coverage</h4>
        ${renderClaimCoverage(claimPayload)}
      </div>
      <div class="refresh-card">
        <h4>Signal Update Candidates</h4>
        ${renderSignalUpdates(signalUpdatePayload)}
      </div>
    </div>
  `;
}

async function loadRefreshQueue() {
  const root = $("refresh-root");
  if (!root) return;
  root.innerHTML = `
    <div class="refresh-grid">
      ${Array.from({ length: 6 }).map(() => `<div class="refresh-metric">${skeletonRowHTML("75%")}</div>`).join("")}
    </div>
  `;
  try {
    const [dashboard, candidates, contradictions, claims, signalUpdates] = await Promise.all([
      getResearchRefreshDashboard({ days: 30, limit: 50 }),
      getResearchRefreshCandidates(14, 50),
      getResearchContradictionDashboard({ days: 30, limit: 50 }),
      getClaimCoverageDashboard({ days: 30, limit: 80 }),
      getSignalUpdateCandidatesDashboard({ days: 30, limit: 50 }),
    ]);
    renderRefreshQueue(dashboard, candidates, contradictions, claims, signalUpdates);
  } catch (e) {
    showError({ container: root, message: `Refresh queue load failed: ${e.message}`, onRetry: loadRefreshQueue, error: e });
  }
}

function openModal(title, bodyHTML) {
  $("brain-modal-title").textContent = title;
  $("brain-modal-body").innerHTML = bodyHTML;
  $("brain-modal").classList.add("open");
}

function closeModal() {
  $("brain-modal").classList.remove("open");
}

function lineageHTML(payload) {
  const lineage = payload?.lineage ?? payload ?? {};
  const runs = Array.isArray(lineage.source_runs) ? lineage.source_runs : [];
  const signals = Array.isArray(lineage.signals) ? lineage.signals : [];
  if (!runs.length && !signals.length) return "";
  return `
    <section class="platform-section" style="margin-top:1rem">
      <h3>Source Lineage</h3>
      <div class="platform-list">
        <div class="platform-item">Source runs: ${escapeHTML(String(runs.length))} / linked signals: ${escapeHTML(String(signals.length))}</div>
        ${signals.slice(0, 5).map((signal) => `
          <div class="platform-item">
            <strong>${escapeHTML(signal.signal_state ?? "Signal")}</strong>
            ${escapeHTML(signal.signal_id ?? "")} / score ${escapeHTML(String(signal.final_score ?? "-"))}
          </div>
        `).join("")}
        ${runs.slice(0, 8).map((run) => `
          <div class="platform-item">
            <strong>${escapeHTML(run.source_agent ?? "source")}</strong>
            ${escapeHTML(run.run_type ?? "")} / ${escapeHTML(run.title ?? run.run_id ?? "")}
            <div class="platform-meta">${escapeHTML(run.subscription_or_credit ?? "unknown")} / artifacts ${escapeHTML(String(run.artifact_counts?.artifact_count ?? 0))} / review ${escapeHTML(run.needs_human_review ? "needed" : "not flagged")}</div>
          </div>
        `).join("")}
      </div>
    </section>
  `;
}

async function openReport(row) {
  const title = `${firstValue(row.symbol, Array.isArray(row.symbols) ? row.symbols[0] : "")} ${firstValue(row.company_name_jp, row.company_name, row.title)}`.trim();
  let md = row.synthesis_md ?? "";
  let lineage = null;
  openModal(title || "Report", `<div class="brain-empty">Loading report...</div>`);
  try {
    if (row.db_report) {
      const payload = await getPublishedReportBySlug(row.report_slug ?? "", row.report_id ?? null, "internal_only");
      const report = payload?.report ?? payload;
      if (!report || payload?.error) throw new Error(payload?.error ?? "Report not found");
      md = report.content_md ?? "";
      row = { ...row, ...report, synthesis_md: md };
      if (report.report_id) {
        lineage = await getReportLineage(report.report_id).catch(() => null);
      }
    }

    const quality = qualityFor(row, md);
    openModal(title || row.title || "Report", `
      <div class="brain-synthesis-meta">
        ${verdictBadgeHTML(row.verdict ?? row.signal_state ?? parseVerdict(md))}
        &nbsp; Quality: ${escapeHTML(quality.status)} (${Math.round(quality.score * 100)}%)
        ${row.access_level ? `&nbsp; / Access: ${escapeHTML(row.access_level)}` : ""}
        ${row.source_count ? `&nbsp; / Sources: ${escapeHTML(String(row.source_count))}` : ""}
      </div>
      ${quality.missing.length ? `<div class="platform-empty">Missing sections: ${escapeHTML(quality.missing.map((section) => section.label).join(", "))}</div>` : ""}
      <div class="brain-synthesis-md expanded" style="max-height:none">${renderMarkdown(md || "_No report text returned._")}</div>
      ${lineageHTML(lineage)}
    `);
  } catch (e) {
    openModal(title || "Report", `<div class="brain-error-state"><p>Failed to load report: ${escapeHTML(e.message)}</p></div>`);
  }
}

async function loadDbReports() {
  const payload = await getPublishedReports({ limit: 100, offset: 0, accessLevel: "internal_only" });
  const rows = Array.isArray(payload?.reports) ? payload.reports : [];
  return rows.map((row) => ({
    ...row,
    db_report: true,
    completed_at: row.published_at ?? row.updated_at ?? row.created_at,
  }));
}

async function loadReports() {
  const root = $("reports-root");
  root.innerHTML = `<div class="platform-empty">${skeletonRowHTML("75%")}</div>`;

  let dbError = null;
  try {
    const dbRows = await loadDbReports();
    if (dbRows.length) {
      renderReportRows(dbRows);
      return;
    }
  } catch (e) {
    dbError = e;
  }

  const staticRows = await loadStaticReports();
  if (staticRows.length) {
    renderReportRows(staticRows);
    return;
  }

  if (dbError) {
    showError({ container: root, message: `Reports load failed: ${dbError.message}`, onRetry: loadReports, error: dbError });
    return;
  }

  root.innerHTML = `<div class="platform-empty">No published reports found yet. Publish reviewed reports to Supabase through fn_publish_research_report; raw Source Runs remain on the Source Runs page.</div>`;
}

function renderReportRows(reportRows) {
  const root = $("reports-root");
  root.innerHTML = `<div class="report-grid">${reportRows.map((row) => reportCardHTML(row, row.synthesis_md ?? "")).join("")}</div>`;
  root.querySelectorAll("[data-open-report]").forEach((button, index) => {
    button.addEventListener("click", () => {
      const row = reportRows[index];
      if (row) openReport(row);
    });
  });
}

function wireModalClose() {
  $("brain-modal-close").addEventListener("click", closeModal);
  $("brain-modal").addEventListener("click", (e) => {
    if (e.target === e.currentTarget) closeModal();
  });
}

mountBrainAuthGate({
  onAuthed: () => {
    wireModalClose();
    $("reports-refresh").addEventListener("click", () => {
      loadReports();
      loadRefreshQueue();
    });
    loadRefreshQueue();
    loadReports();
  },
});
