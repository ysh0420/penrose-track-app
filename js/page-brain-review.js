// @ts-check
import { mountBrainAuthGate } from "./brain-client.js";
import {
  getBrainCompanyNames,
  getBrainPortfolioDisclosures,
  getBrainReviewDashboard,
  recordBrainReviewDecision,
} from "./brain-queries.js";
import { escapeHTML, renderMarkdown, skeletonRowHTML } from "./brain-components.js";
import { showError } from "./brain-error.js";

const $ = (id) => document.getElementById(id);

function list(value) {
  return Array.isArray(value) ? value : [];
}

function todayISO() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function fmtDateTime(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 16);
  return `${d.toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })} JST`;
}

function fmtPct(value) {
  if (value === null || value === undefined || value === "") return "-";
  const n = Number(value);
  if (!Number.isFinite(n)) return "-";
  const pct = Math.abs(n) <= 1 ? n * 100 : n;
  return `${pct > 0 ? "+" : ""}${pct.toFixed(2)}%`;
}

function fmtNum(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "-";
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function fmtLeadPct(value, digits = 2) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "-";
  return `${n > 0 ? "+" : ""}${n.toFixed(digits)}%`;
}

function metric(label, value) {
  return `<div class="platform-metric"><div class="label">${escapeHTML(label)}</div><div class="value">${escapeHTML(value)}</div></div>`;
}

function badge(text, cls = "") {
  return `<span class="review-badge ${escapeHTML(cls)}">${escapeHTML(text)}</span>`;
}

function symbolLabel(symbol, companyNames = {}) {
  const code = String(symbol || "").trim();
  if (!code) return "";
  const name = companyNames[code];
  return name ? `${code} ${name}` : code;
}

function payloadCompanyNames(payload, disclosurePayload) {
  const names = {};
  list(payload?.market_snapshots).forEach((row) => {
    if (row.symbol && row.name) names[String(row.symbol)] = row.name;
  });
  list(payload?.disclosure_items).forEach((row) => {
    if (row.issuer_code && row.issuer_name) names[String(row.issuer_code)] = row.issuer_name;
  });
  list(disclosurePayload?.relevant_disclosures).forEach((row) => {
    if (row.issuer_code && row.issuer_name) names[String(row.issuer_code)] = row.issuer_name;
  });
  list(payload?.signal_candidates).forEach((signal) => {
    const match = String(signal.title || "").match(/^(.+?)\s*->\s*([0-9]{4}[A-Z]?)$/);
    if (match?.[1] && match?.[2]) names[match[2]] = match[1].trim();
  });
  return names;
}

function signalSymbols(payload) {
  return [...new Set(
    list(payload?.signal_candidates)
      .flatMap((signal) => list(signal.related_symbols))
      .map((symbol) => String(symbol || "").trim())
      .filter(Boolean)
  )];
}

function normTitle(value) {
  return String(value ?? "")
    .replace(/[_*`"'“”‘’「」『』【】\[\]()（）]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function titleMatches(a, b) {
  const left = normTitle(a);
  const right = normTitle(b);
  if (!left || !right) return false;
  if (left === right) return true;
  const [shorter, longer] = left.length < right.length ? [left, right] : [right, left];
  return shorter.length >= 24 && longer.includes(shorter);
}

function evidenceMetrics(raw = {}) {
  const parts = [];
  if (raw.relevance_score !== undefined && raw.relevance_score !== null) parts.push(`relevance ${fmtNum(raw.relevance_score)}`);
  if (raw.impact_score !== undefined && raw.impact_score !== null) parts.push(`impact ${fmtNum(raw.impact_score)}`);
  if (raw.is_market_moving !== undefined && raw.is_market_moving !== null) parts.push(`market-moving ${raw.is_market_moving ? "yes" : "no"}`);
  return parts.join(" / ");
}

function collectSignalEvidence(signal, payload) {
  if (signal.signal_type === "global_lead_lag") {
    const leadLagSource = list(payload?.source_items).find((row) => row.source_type === "global_lead_lag");
    const meta = leadLagSource?.raw_metadata || {};
    if (leadLagSource) {
      return [{
        label: "Koyfin local CSV",
        detail: [meta.as_of_date, list(meta.csv_files).join(", ")].filter(Boolean).join(" / "),
        url: leadLagSource.url || meta.source_url || "",
      }];
    }
  }
  const title = normTitle(signal.title);
  const symbols = list(signal.related_symbols).map(String);
  const sources = list(payload?.source_items)
    .filter((row) => titleMatches(row.title, title))
    .map((row) => ({
      label: row.source_name || row.source_type || "source",
      detail: evidenceMetrics(row.raw_metadata || {}),
      url: row.url || "",
    }));
  const disclosures = list(payload?.disclosure_items)
    .filter((row) => normTitle(row.title) === title)
    .filter((row) => !symbols.length || !row.issuer_code || symbols.includes(String(row.issuer_code)))
    .map((row) => ({
      label: row.source || row.filing_type || "disclosure",
      detail: [row.issuer_code, row.filing_type].filter(Boolean).join(" / "),
      url: row.url || "",
    }));
  const seen = new Set();
  return [...sources, ...disclosures].filter((item) => {
    const key = `${item.label}|${item.url}|${item.detail}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 3);
}

function renderSignalEvidence(signal, payload) {
  const items = collectSignalEvidence(signal, payload);
  if (!items.length) return `<div class="platform-meta">Source data: not linked in this run payload.</div>`;
  return `
    <div class="platform-meta">
      Source data:
      ${items.map((item) => {
        const label = item.detail ? `${item.label} (${item.detail})` : item.label;
        return item.url
          ? `<a href="${escapeHTML(item.url)}" target="_blank" rel="noreferrer">${escapeHTML(label)}</a>`
          : escapeHTML(label);
      }).join(" · ")}
    </div>
  `;
}

function setSignalSaving(container, signalId, isSaving) {
  container.querySelectorAll(`[data-signal-id="${CSS.escape(signalId)}"]`).forEach((btn) => {
    /** @type {HTMLButtonElement} */(btn).disabled = isSaving;
  });
}

function setSignalStatus(container, signalId, kind, text) {
  const status = container.querySelector(`[data-status-for="${CSS.escape(signalId)}"]`);
  if (!status) return;
  status.className = `review-save-status ${kind}`;
  status.textContent = text;
}

function markDecision(container, signalId, decision) {
  container.querySelectorAll(`[data-signal-id="${CSS.escape(signalId)}"]`).forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.decision === decision);
  });
}

function wireDecisionButtons(container) {
  container.querySelectorAll("[data-signal-id][data-decision]").forEach((button) => {
    button.addEventListener("click", async () => {
      const signalId = button.dataset.signalId;
      const decision = button.dataset.decision;
      if (!signalId || !decision) return;
      setSignalSaving(container, signalId, true);
      setSignalStatus(container, signalId, "", "Saving...");
      try {
        await recordBrainReviewDecision(signalId, decision);
        markDecision(container, signalId, decision);
        setSignalStatus(container, signalId, "ok", "Saved to Brain.");
      } catch (error) {
        setSignalStatus(container, signalId, "err", `Save failed: ${error?.message ?? error}`);
      } finally {
        setSignalSaving(container, signalId, false);
      }
    });
  });
}

function loading() {
  $("review-metrics").innerHTML = Array.from({ length: 6 })
    .map(() => `<div class="platform-metric">${skeletonRowHTML("65%")}<br><br>${skeletonRowHTML("40%")}</div>`)
    .join("");
  ["review-signals", "review-disclosures", "review-leadlag", "review-markets", "review-ai", "review-summary"].forEach((id) => {
    $(id).innerHTML = `<div class="brain-empty">Loading...</div>`;
  });
}

function renderSummary(payload) {
  if (!payload?.run) {
    return `<div class="brain-empty">No Brain daily run found for this date.</div>`;
  }
  const run = payload.run;
  return `
    <div class="review-summary">${escapeHTML(run.summary || "No summary available.")}</div>
    <div class="platform-subsection">
      <div class="platform-list">
        <div class="platform-item"><div class="platform-meta">Run date</div><div>${escapeHTML(run.run_date)} (${escapeHTML(run.status)})</div></div>
        <div class="platform-item"><div class="platform-meta">Completed (JST)</div><div>${escapeHTML(fmtDateTime(run.completed_at || run.updated_at))}</div></div>
        <div class="platform-item"><div class="platform-meta">Operator</div><div>${escapeHTML(run.operator || "-")}</div></div>
      </div>
    </div>
  `;
}

function renderSignals(payload, companyNames = {}) {
  const signals = list(payload?.signal_candidates);
  if (!signals.length) return `<div class="brain-empty">No signal candidates for this run.</div>`;

  const cards = signals.map((signal) => {
    const decision = signal.review_decision || "";
    const symbols = list(signal.related_symbols).filter(Boolean);
    const pills = [
      badge(signal.urgency || "medium", signal.urgency || ""),
      badge(signal.confidence || "low"),
      signal.promote_to && signal.promote_to !== "none" ? badge(signal.promote_to) : "",
      signal.related_theme ? badge(signal.related_theme) : "",
      ...symbols.slice(0, 5).map((symbol) => badge(symbolLabel(symbol, companyNames))),
    ].filter(Boolean).join("");
    return `
      <article class="review-card">
        <div class="review-meta">${pills}</div>
        <h3>${escapeHTML(signal.title || "Untitled signal")}</h3>
        ${signal.why_it_matters ? `<p>${escapeHTML(signal.why_it_matters)}</p>` : ""}
        ${renderSignalEvidence(signal, payload)}
        ${signal.next_check ? `<div class="platform-meta">Next check: ${escapeHTML(signal.next_check)}</div>` : ""}
        ${signal.review_note ? `<div class="platform-meta">Saved note: ${escapeHTML(signal.review_note)}</div>` : ""}
        <div class="review-actions" aria-label="Review decision">
          ${["Promote", "Follow-up", "Ignore"].map((label) => {
            const value = label.toLowerCase().replace("-", "_");
            return `<button type="button" data-signal-id="${escapeHTML(signal.id)}" data-decision="${escapeHTML(value)}" class="${decision === value ? "active" : ""}">${escapeHTML(label)}</button>`;
          }).join("")}
        </div>
        <div class="review-save-status" data-status-for="${escapeHTML(signal.id)}">${signal.review_updated_at ? `Saved ${escapeHTML(fmtDateTime(signal.review_updated_at))}` : ""}</div>
      </article>
    `;
  }).join("");

  return `<div class="review-card-list">${cards}</div>`;
}

function renderDisclosures(payload) {
  const rows = list(payload?.relevant_disclosures);
  const counts = payload?.source_counts || {};
  const links = payload?.source_links || {};
  const universe = payload?.universe || {};
  const header = `
    <div class="platform-actions">
      ${links.tdnet ? `<a class="platform-button" href="${escapeHTML(links.tdnet)}" target="_blank" rel="noreferrer">TDnet all ${escapeHTML(String(counts.tdnet ?? "-"))}</a>` : ""}
      ${links.edinet ? `<a class="platform-button" href="${escapeHTML(links.edinet)}" target="_blank" rel="noreferrer">EDINET ${escapeHTML(String(counts.edinet ?? "-"))}</a>` : ""}
    </div>
    <div class="platform-subtitle">
      Full-day source count: ${escapeHTML(String(counts.total ?? "-"))}.
      Portfolio symbols: ${escapeHTML(String(list(universe.portfolio_symbols).length))};
      watchlist symbols: ${escapeHTML(String(list(universe.watchlist_symbols).length))}.
    </div>
  `;
  if (!rows.length) {
    return `${header}<div class="brain-empty">No portfolio/watchlist disclosures for this date.</div>`;
  }
  return `
    ${header}
    <div class="platform-table-wrap">
      <table class="platform-table review-table">
        <thead><tr><th>Time (JST)</th><th>List</th><th>Code</th><th>Issuer</th><th>Title</th><th>Source</th></tr></thead>
        <tbody>
          ${rows.map((row) => `
            <tr>
              <td>${escapeHTML(fmtDateTime(row.filed_at))}</td>
              <td>${escapeHTML(row.list_bucket || "-")}</td>
              <td class="symbol-cell">${escapeHTML(row.issuer_code || "-")}</td>
              <td>${escapeHTML(row.issuer_name || "-")}</td>
              <td class="title-cell">${row.url ? `<a href="${escapeHTML(row.url)}" target="_blank" rel="noreferrer">${escapeHTML(row.title || "Disclosure")}</a>` : escapeHTML(row.title || "Disclosure")}</td>
              <td>${escapeHTML(row.source || row.filing_type || "-")}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function pctValue(row) {
  const pct = Number(row?.change_pct);
  return Number.isFinite(pct) ? pct : null;
}

function renderMarketTable(title, rows) {
  if (!rows.length) return "";
  return `
    <div class="platform-subsection">
      <h3>${escapeHTML(title)}</h3>
      <div class="platform-table-wrap">
        <table class="platform-table compact">
          <thead><tr><th>Symbol</th><th>Name</th><th>Type</th><th class="num">Price</th><th class="num">1D Move</th></tr></thead>
          <tbody>
            ${rows.map((row) => {
              const pct = pctValue(row);
              const cls = pct !== null && pct < 0 ? "negative" : pct !== null && pct > 0 ? "positive" : "";
              return `
                <tr>
                  <td class="symbol-cell">${escapeHTML(row.symbol || "-")}</td>
                  <td>${escapeHTML(row.name || row.asset_type || "-")}</td>
                  <td>${escapeHTML(row.asset_type || "-")}</td>
                  <td class="num">${escapeHTML(fmtNum(row.price))}</td>
                  <td class="num ${cls}">${escapeHTML(fmtPct(row.change_pct))}</td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderMarkets(markets) {
  const rows = list(markets);
  if (!rows.length) return `<div class="brain-empty">No market snapshots returned for this run.</div>`;
  const movers = rows.filter((row) => pctValue(row) !== null);
  const gainers = movers
    .filter((row) => (pctValue(row) ?? 0) > 0)
    .sort((a, b) => (pctValue(b) ?? 0) - (pctValue(a) ?? 0))
    .slice(0, 10);
  const decliners = movers
    .filter((row) => (pctValue(row) ?? 0) < 0)
    .sort((a, b) => (pctValue(a) ?? 0) - (pctValue(b) ?? 0))
    .slice(0, 10);
  const tables = [
    renderMarketTable("Top Gainers", gainers),
    renderMarketTable("Top Decliners", decliners),
  ].filter(Boolean).join("");
  if (tables) return tables;
  return `
    <div class="platform-table-wrap">
      <table class="platform-table compact">
        <thead><tr><th>Symbol</th><th>Name</th><th>Type</th><th class="num">Price</th><th class="num">1D Move</th></tr></thead>
        <tbody>
          ${rows.map((row) => {
            const pct = Number(row.change_pct);
            const cls = Number.isFinite(pct) && pct < 0 ? "negative" : Number.isFinite(pct) && pct > 0 ? "positive" : "";
            return `
              <tr>
                <td class="symbol-cell">${escapeHTML(row.symbol || "-")}</td>
                <td>${escapeHTML(row.name || row.asset_type || "-")}</td>
                <td>${escapeHTML(row.asset_type || "-")}</td>
                <td class="num">${escapeHTML(fmtNum(row.price))}</td>
                <td class="num ${cls}">${escapeHTML(fmtPct(row.change_pct))}</td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderLeadLagRows(title, rows) {
  if (!rows.length) return "";
  return `
    <div class="platform-subsection">
      <h3>${escapeHTML(title)}</h3>
      <div class="platform-table-wrap">
        <table class="platform-table compact">
          <thead><tr><th>Bucket</th><th>Sector</th><th class="num">Names</th><th class="num">Avg 1D</th><th class="num">Breadth +</th><th class="num">Rel Vol</th></tr></thead>
          <tbody>
            ${rows.map((row) => {
              const move = Number(row.avgOneDayPct);
              const cls = Number.isFinite(move) && move < 0 ? "negative" : Number.isFinite(move) && move > 0 ? "positive" : "";
              return `
                <tr>
                  <td>${escapeHTML(row.bucket || "-")}</td>
                  <td>${escapeHTML(row.sector || "-")}</td>
                  <td class="num">${escapeHTML(String(row.count ?? "-"))}</td>
                  <td class="num ${cls}">${escapeHTML(fmtLeadPct(row.avgOneDayPct))}</td>
                  <td class="num">${escapeHTML(fmtLeadPct(row.positiveBreadthPct, 0))}</td>
                  <td class="num">${escapeHTML(fmtNum(row.avgRelVolume))}</td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderLeadLag(payload) {
  const source = list(payload?.source_items).find((row) => row.source_type === "global_lead_lag");
  const meta = source?.raw_metadata || {};
  const strength = list(meta.strength).slice(0, 5);
  const weakness = list(meta.weakness).slice(0, 5);
  if (!source && !strength.length && !weakness.length) {
    return `<div class="brain-empty">No Koyfin US lead-lag input in this run.</div>`;
  }
  const files = list(meta.csv_files).join(", ");
  const sourceUrl = source?.url || meta.source_url || "";
  return `
    <div class="platform-subtitle">
      ${meta.as_of_date ? `Koyfin CSV date: ${escapeHTML(meta.as_of_date)}. ` : ""}
      ${meta.row_count ? `Rows: ${escapeHTML(String(meta.row_count))}. ` : ""}
      ${files ? `Files: ${escapeHTML(files)}.` : ""}
      ${sourceUrl ? ` Source: <a href="${escapeHTML(sourceUrl)}" target="_blank" rel="noreferrer">Koyfin watchlist</a>.` : ""}
    </div>
    ${renderLeadLagRows("US Strength", strength)}
    ${renderLeadLagRows("US Weakness", weakness)}
  `;
}

function renderAI(enrichments) {
  const rows = list(enrichments);
  if (!rows.length) return `<div class="brain-empty">No AI collector notes for this run.</div>`;
  return `<div class="platform-list">
    ${rows.map((row) => `
      <div class="platform-item">
        <div class="platform-meta">${escapeHTML(row.provider || "ai")} / ${escapeHTML(row.task_type || "task")} / ${escapeHTML(row.confidence || "low")}</div>
        <div class="review-summary">${renderMarkdown(row.output_summary || row.caveats || "No summary.")}</div>
      </div>
    `).join("")}
  </div>`;
}

async function loadReview() {
  loading();
  const date = /** @type {HTMLInputElement} */($("review-date")).value;
  try {
    const [payload, disclosurePayload] = await Promise.all([
      getBrainReviewDashboard(date, 100),
      getBrainPortfolioDisclosures(date, 100),
    ]);
    const companyNames = {
      ...payloadCompanyNames(payload, disclosurePayload),
      ...(await getBrainCompanyNames(signalSymbols(payload))),
    };
    const counts = payload?.counts || {};
    $("review-metrics").innerHTML = [
      metric("Run Date", payload?.run?.run_date || date || "-"),
      metric("Market Rows", String(counts.market_snapshots ?? 0)),
      metric("Disclosure Sample", String(counts.disclosure_items ?? 0)),
      metric("Signals", String(counts.signal_candidates ?? 0)),
      metric("AI Notes", String(counts.ai_enrichments ?? 0)),
      metric("Saved Decisions", String(counts.review_decisions ?? 0)),
    ].join("");
    $("review-summary").innerHTML = renderSummary(payload);
    $("review-signals").innerHTML = renderSignals(payload, companyNames);
    $("review-disclosures").innerHTML = renderDisclosures(disclosurePayload);
    $("review-leadlag").innerHTML = renderLeadLag(payload);
    $("review-markets").innerHTML = renderMarkets(payload?.market_snapshots);
    $("review-ai").innerHTML = renderAI(payload?.ai_enrichments);
    wireDecisionButtons($("review-signals"));
  } catch (error) {
    showError({
      container: $("review-summary"),
      message: `Brain review load failed: ${error?.message ?? error}`,
      onRetry: loadReview,
      error,
    });
    ["review-signals", "review-disclosures", "review-leadlag", "review-markets", "review-ai"].forEach((id) => {
      $(id).innerHTML = `<div class="brain-empty">Waiting for a successful Brain review load.</div>`;
    });
  }
}

mountBrainAuthGate({
  onAuthed: () => {
    const params = new URLSearchParams(window.location.search);
    /** @type {HTMLInputElement} */($("review-date")).value = params.get("date") || todayISO();
    $("review-load").addEventListener("click", loadReview);
    $("review-today").addEventListener("click", () => {
      /** @type {HTMLInputElement} */($("review-date")).value = todayISO();
      loadReview();
    });
    loadReview();
  },
});
