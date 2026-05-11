// @ts-check
import { mountBrainAuthGate } from "./brain-client.js";
import { getLatestNewsBrief, getModelPortfolioDashboard, getResearchLog } from "./brain-queries.js";
import { escapeHTML, renderMarkdown, skeletonRowHTML } from "./brain-components.js";
import { showError } from "./brain-error.js";

const $ = (id) => document.getElementById(id);

function list(value) {
  return Array.isArray(value) ? value : [];
}

function fmtDate(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 16);
  return d.toLocaleString("ja-JP", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function fmtUsd(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "-";
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function fmtPct(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "-";
  return `${n > 0 ? "+" : ""}${(n * 100).toFixed(2)}%`;
}

function metric(label, value) {
  return `<div class="platform-metric"><div class="label">${escapeHTML(label)}</div><div class="value">${escapeHTML(value)}</div></div>`;
}

function item(meta, body, href = "") {
  const link = href ? `<a href="${escapeHTML(href)}">${body}</a>` : body;
  return `<div class="platform-item"><div class="platform-meta">${escapeHTML(meta)}</div><div>${link}</div></div>`;
}

function loading() {
  $("today-metrics").innerHTML = Array.from({ length: 4 })
    .map(() => `<div class="platform-metric">${skeletonRowHTML("65%")}<br><br>${skeletonRowHTML("40%")}</div>`)
    .join("");
  ["today-actions", "today-news", "today-research", "today-validation"].forEach((id) => {
    $(id).innerHTML = `<div class="brain-empty">Loading...</div>`;
  });
}

function normalizeResearchLog(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.rows)) return payload.rows;
  if (Array.isArray(payload?.sessions)) return payload.sessions;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

async function loadToday() {
  loading();
  const [newsResult, modelResult, researchResult] = await Promise.allSettled([
    getLatestNewsBrief(7),
    getModelPortfolioDashboard(),
    getResearchLog(12, 0),
  ]);

  const news = newsResult.status === "fulfilled" ? newsResult.value : null;
  const model = modelResult.status === "fulfilled" ? modelResult.value : null;
  const researchRows = researchResult.status === "fulfilled" ? normalizeResearchLog(researchResult.value) : [];
  const newsItems = list(news?.recent_items);
  const marketMoving = newsItems.filter((i) => i.is_market_moving);
  const nav = model?.latest_nav ?? {};
  const positions = list(model?.positions);
  const trades = list(model?.trades);

  $("today-metrics").innerHTML = [
    metric("Model NAV", fmtUsd(nav.nav_usd)),
    metric("Model Daily", fmtPct(nav.daily_return)),
    metric("Positions", String(positions.length || "-")),
    metric("Market-moving News", String(news?.brief?.market_moving_count ?? marketMoving.length ?? 0)),
  ].join("");

  const actions = [];
  if (marketMoving.length) {
    actions.push(...marketMoving.slice(0, 5).map((n) => item(
      `${n.source_name ?? n.source_code ?? "news"} · ${fmtDate(n.published_at ?? n.fetched_at)}`,
      escapeHTML(n.title_ja || n.title || "Untitled news"),
      n.symbols?.[0] ? `/stock.html?symbol=${encodeURIComponent(n.symbols[0])}` : ""
    )));
  }
  if (trades.length) {
    actions.push(...trades.slice(0, 4).map((t) => item(
      `Model Book · ${t.execution_status ?? "trade"}`,
      `${escapeHTML(t.symbol ?? "")} ${escapeHTML(String(t.action ?? "").replace(/_/g, " "))}`,
      "/model-portfolio.html"
    )));
  }
  $("today-actions").innerHTML = actions.length
    ? `<div class="platform-list">${actions.join("")}</div>`
    : `<div class="brain-empty">No urgent action items surfaced from current feeds.</div>`;

  $("today-news").innerHTML = news?.brief?.content_md_ja
    ? `<div class="news-brief-md">${renderMarkdown(news.brief.content_md_ja)}</div>`
    : newsResult.status === "rejected"
      ? ""
      : `<div class="brain-empty">No Japanese daily brief available.</div>`;

  if (newsResult.status === "rejected") {
    showError({ container: $("today-news"), message: `News load failed: ${newsResult.reason?.message ?? newsResult.reason}`, onRetry: loadToday, error: newsResult.reason });
  }

  $("today-research").innerHTML = researchRows.length
    ? `<div class="platform-list">${researchRows.slice(0, 8).map((r) => {
        const symbol = r.subject_symbol ?? r.symbol ?? "";
        const title = r.title ?? r.company_name_jp ?? r.company_name ?? symbol ?? "Research";
        const session = r.id ?? r.session_id ?? "";
        const href = session ? `/research-log.html?${new URLSearchParams({ symbol, session }).toString()}` : "/research-log.html";
        return item(`${symbol || "research"} · ${fmtDate(r.updated_at ?? r.created_at ?? r.finalized_at)}`, escapeHTML(title), href);
      }).join("")}</div>`
    : `<div class="brain-empty">No recent research rows returned.</div>`;

  $("today-validation").innerHTML = model
    ? `<div class="platform-list">
        ${item(`NAV date · ${nav.nav_date ?? "-"}`, `Validation book NAV ${escapeHTML(fmtUsd(nav.nav_usd))}, daily ${escapeHTML(fmtPct(nav.daily_return))}`, "/model-portfolio.html")}
        ${item("Exposure", `Gross ${escapeHTML(fmtPct(nav.gross_exposure))}, net ${escapeHTML(fmtPct(nav.net_exposure))}, cash ${escapeHTML(fmtPct(nav.cash_weight))}`, "/model-portfolio.html")}
        ${item("Top position", positions[0] ? `${escapeHTML(positions[0].symbol)} ${escapeHTML(fmtPct(positions[0].weight))}` : "No positions", "/model-portfolio.html")}
      </div>`
    : modelResult.status === "rejected"
      ? ""
      : `<div class="brain-empty">No validation-book payload returned.</div>`;

  if (modelResult.status === "rejected") {
    showError({ container: $("today-validation"), message: `Model book load failed: ${modelResult.reason?.message ?? modelResult.reason}`, onRetry: loadToday, error: modelResult.reason });
  }
}

mountBrainAuthGate({
  onAuthed: () => {
    $("today-refresh").addEventListener("click", loadToday);
    loadToday();
  },
});
