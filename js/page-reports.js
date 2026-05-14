// @ts-check
import { mountBrainAuthGate } from "./brain-client.js";
import { getResearchLog, getSynthesisForSymbol } from "./brain-queries.js";
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

function firstValue(...values) {
  return values.find((value) => typeof value === "string" && value.trim() && value.trim() !== "?") ?? "";
}

function parseVerdict(md) {
  const match = String(md ?? "").match(/Synthesis \(verdict: ([^)]+)\)/i);
  return match?.[1] ?? "completed";
}

async function loadStaticReports() {
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
      };
    }));
    return reports
      .filter((result) => result.status === "fulfilled" && result.value?.synthesis_md)
      .map((result) => /** @type {PromiseFulfilledResult<any>} */(result).value);
  } catch {
    return [];
  }
}

function parseConvictionRecommendation(md) {
  const match = String(md ?? "").match(/## Conviction recommendation\s+\*\*([^*]+)\*\*/i);
  return match?.[1] ?? null;
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

function reportCardHTML(row, md) {
  const quality = reportQuality(md);
  const missing = quality.missing.slice(0, 4).map((section) => section.label).join(", ");
  const symbol = row.symbol ?? "";
  const name = firstValue(row.company_name_jp, row.name_jp, row.company_name, row.name_en);
  const conviction = row.conviction_recommendation ?? parseConvictionRecommendation(md);
  const verdict = row.verdict ?? parseVerdict(md);
  return `
    <article class="report-card" data-symbol="${escapeHTML(symbol)}">
      <div class="report-title-row">
        <div>
          <h3>${escapeHTML(row.title ?? `${symbol} ${name}`)}</h3>
          <div class="platform-meta">${escapeHTML(formatRelativeTime(row.completed_at ?? row.updated_at ?? row.created_at))} / ${row.static_report ? "saved report" : "research log"} / conviction ${escapeHTML(conviction ?? "-")}</div>
        </div>
        <span class="report-score">${Math.round(quality.score * 100)}%</span>
      </div>
      <div>
        ${verdictBadgeHTML(verdict)}
        <span class="report-status ${quality.statusClass}">${escapeHTML(quality.status)}</span>
      </div>
      <div class="report-missing">${quality.missing.length ? `Missing: ${escapeHTML(missing)}${quality.missing.length > 4 ? "..." : ""}` : "All required sections detected."}</div>
      <button class="platform-button" type="button" data-open-report>Open report</button>
    </article>
  `;
}

function openModal(title, bodyHTML) {
  $("brain-modal-title").textContent = title;
  $("brain-modal-body").innerHTML = bodyHTML;
  $("brain-modal").classList.add("open");
}

function closeModal() {
  $("brain-modal").classList.remove("open");
}

async function openReport(row) {
  const title = `${row.symbol ?? ""} ${row.company_name_jp ?? row.company_name ?? ""}`.trim();
  let md = row.synthesis_md ?? "";
  openModal(title || "Report", `<div class="brain-empty">Loading report...</div>`);
  try {
    if (!md && row.symbol) {
      const payload = await getSynthesisForSymbol(row.symbol);
      const synth = Array.isArray(payload) ? payload[0] : payload;
      md = synth?.synthesis_md ?? "";
      row = { ...row, ...synth };
    }
    const quality = reportQuality(md);
    openModal(title || "Report", `
      <div class="brain-synthesis-meta">
        ${verdictBadgeHTML(row.verdict ?? parseVerdict(md))}
        &nbsp; Quality: ${escapeHTML(quality.status)} (${Math.round(quality.score * 100)}%)
      </div>
      ${quality.missing.length ? `<div class="platform-empty">Missing sections: ${escapeHTML(quality.missing.map((section) => section.label).join(", "))}</div>` : ""}
      <div class="brain-synthesis-md expanded" style="max-height:none">${renderMarkdown(md || "_No synthesis text returned._")}</div>
    `);
  } catch (e) {
    openModal(title || "Report", `<div class="brain-error-state"><p>Failed to load report: ${escapeHTML(e.message)}</p></div>`);
  }
}

async function loadReports() {
  const root = $("reports-root");
  root.innerHTML = `<div class="platform-empty">${skeletonRowHTML("75%")}</div>`;
  const staticRows = await loadStaticReports();
  let rows;
  try {
    rows = await getResearchLog(80, 0) ?? [];
  } catch (e) {
    if (staticRows.length) {
      renderReportRows(staticRows);
    } else {
      showError({ container: root, message: `Reports load failed: ${e.message}`, onRetry: loadReports, error: e });
    }
    return;
  }

  const symbols = [...new Set(rows.map((row) => row.symbol).filter(Boolean))].slice(0, 40);
  if (!symbols.length && !staticRows.length) {
    root.innerHTML = `<div class="platform-empty">No reports found yet. Run source research first, then finalized reports will appear here.</div>`;
    return;
  }

  root.innerHTML = `<div class="platform-empty">Loading latest report text for ${symbols.length} symbols...</div>`;

  const fetched = await Promise.allSettled(symbols.map(async (symbol) => {
    const payload = await getSynthesisForSymbol(symbol);
    const synth = Array.isArray(payload) ? payload[0] : payload;
    const baseRow = rows.find((row) => row.symbol === symbol) ?? { symbol };
    return synth?.synthesis_md ? { ...baseRow, ...synth, symbol } : null;
  }));

  const reportRows = [
    ...staticRows,
    ...fetched
    .filter((result) => result.status === "fulfilled" && result.value?.synthesis_md)
    .map((result) => /** @type {PromiseFulfilledResult<any>} */(result).value),
  ]
    .sort((a, b) => new Date(b.completed_at ?? b.updated_at ?? b.created_at ?? 0).getTime() -
      new Date(a.completed_at ?? a.updated_at ?? a.created_at ?? 0).getTime());

  if (!reportRows.length) {
    root.innerHTML = `<div class="platform-empty">No reports found yet. Run source research first, then finalized reports will appear here.</div>`;
    return;
  }
  renderReportRows(reportRows);
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
    $("reports-refresh").addEventListener("click", loadReports);
    loadReports();
  },
});
