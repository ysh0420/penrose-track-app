// @ts-check
import { mountBrainAuthGate } from "./brain-client.js";
import { getModelPortfolioDashboard } from "./brain-queries.js";
import { escapeHTML, skeletonRowHTML, themeChipsHTML } from "./brain-components.js";
import { showError } from "./brain-error.js";

let dashboard = null;

const $ = (id) => document.getElementById(id);

function numberValue(value, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

function listValue(value) {
  return Array.isArray(value) ? value : [];
}

function formatUsd(value, decimals = 1) {
  if (value == null) return "—";
  const n = numberValue(value, NaN);
  if (!Number.isFinite(n)) return "—";
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `${sign}$${(abs / 1_000_000_000).toFixed(decimals)}B`;
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(decimals)}M`;
  return `${sign}$${abs.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function formatJpy(value, decimals = 0) {
  if (value == null) return "â€”";
  const n = numberValue(value, NaN);
  if (!Number.isFinite(n)) return "â€”";
  return `JPY ${n.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

function formatPctDecimal(value, decimals = 1) {
  if (value == null) return "—";
  const n = numberValue(value, NaN);
  if (!Number.isFinite(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${(n * 100).toFixed(decimals)}%`;
}

function formatWeight(value) {
  return formatPctDecimal(value, 2);
}

function formatDate(value) {
  if (!value) return "—";
  return String(value).slice(0, 10);
}

function valueClass(value) {
  const n = numberValue(value, 0);
  if (n > 0) return "mp-up";
  if (n < 0) return "mp-down";
  return "mp-flat";
}

function metricHTML(label, value, sub = "", cls = "") {
  return `
    <div class="mp-metric">
      <div class="label">${escapeHTML(label)}</div>
      <div class="value ${cls}">${escapeHTML(value)}</div>
      <div class="sub">${escapeHTML(sub)}</div>
    </div>
  `;
}

function titleCase(value) {
  return String(value ?? "")
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
}

function safeExternalUrl(value) {
  const url = typeof value === "string" ? value.trim() : "";
  return /^https?:\/\//i.test(url) ? url : "";
}

function isKoyfinSource({ provider, url }) {
  const providerText = String(provider ?? "").trim().toLowerCase();
  const urlText = String(url ?? "").trim().toLowerCase();
  return providerText === "koyfin" || urlText.includes("app.koyfin.com");
}

function researchLabel({ name, provider, date }) {
  const cleanName = typeof name === "string" ? name.trim() : "";
  if (cleanName) return cleanName;
  const providerLabel = titleCase(provider);
  const displayDate = date ? formatDate(date) : "";
  if (providerLabel && displayDate !== "—") return `${providerLabel} ${displayDate}`;
  return providerLabel || "Research";
}

function researchAnchorHTML({ symbol, sessionId, url, name, provider, date }) {
  const externalUrl = safeExternalUrl(url);
  const label = researchLabel({ name, provider, date });
  if (externalUrl) {
    return `<a class="mp-research-link" href="${escapeHTML(externalUrl)}" target="_blank" rel="noopener noreferrer">${escapeHTML(label)}</a>`;
  }

  const id = typeof sessionId === "string" ? sessionId.trim() : "";
  if (!id) return "";
  const params = new URLSearchParams();
  if (symbol) params.set("symbol", String(symbol));
  params.set("session", id);
  return `<a class="mp-research-link" href="/research-log.html?${escapeHTML(params.toString())}">${escapeHTML(label)}</a>`;
}

function researchLinkHTML(details) {
  const links = Array.isArray(details.links) ? details.links : [];
  const renderedLinks = links
    .filter((link) => !isKoyfinSource({
      provider: link.provider ?? link.research_provider,
      url: link.url ?? link.provider_url ?? link.research_url,
    }))
    .map((link) => researchAnchorHTML({
      symbol: details.symbol,
      sessionId: link.session_id ?? link.research_session_id,
      url: link.url ?? link.provider_url ?? link.research_url,
      name: link.name ?? link.research_name,
      provider: link.provider ?? link.research_provider,
      date: link.date ?? link.research_date,
    }))
    .filter(Boolean);

  if (renderedLinks.length) return renderedLinks.join("<br>");
  if (isKoyfinSource({ provider: details.provider, url: details.url ?? details.provider_url })) {
    return "—";
  }
  return researchAnchorHTML(details) || "—";
}

function renderLoading() {
  $("mp-summary").innerHTML = Array.from({ length: 6 })
    .map(() => metricHTML("Loading", "—", ""))
    .join("");
  $("mp-chart").innerHTML = `<div class="brain-empty">${skeletonRowHTML("70%")}</div>`;
  $("mp-positions").innerHTML = skeletonTable(7, 8);
  $("mp-trades").innerHTML = skeletonTable(6, 11);
  $("mp-risk").innerHTML = `<div class="brain-empty">${skeletonRowHTML("80%")}</div>`;
  $("mp-deck").innerHTML = `<div class="brain-empty">${skeletonRowHTML("75%")}</div>`;
}

async function load() {
  renderLoading();
  try {
    dashboard = await getModelPortfolioDashboard();
  } catch (e) {
    const error = /** @type {Error} */(e);
    showError({
      container: $("mp-chart"),
      message: `Model portfolio load failed: ${error.message}`,
      onRetry: load,
      error,
    });
    $("mp-summary").innerHTML = "";
    $("mp-positions").innerHTML = "";
    $("mp-trades").innerHTML = "";
    $("mp-risk").innerHTML = "";
    $("mp-deck").innerHTML = "";
    return;
  }
  render();
}

function render() {
  if (!dashboard?.portfolio) {
    $("mp-subtitle").textContent = "No model portfolio payload returned";
    $("mp-summary").innerHTML = "";
    $("mp-chart").innerHTML = `<div class="brain-empty">No model portfolio data. Deploy the penrose_model schema and run the daily job.</div>`;
    $("mp-positions").innerHTML = "";
    $("mp-trades").innerHTML = "";
    $("mp-risk").innerHTML = "";
    $("mp-deck").innerHTML = "";
    return;
  }

  const p = dashboard.portfolio;
  const nav = dashboard.latest_nav ?? {};
  const run = dashboard.latest_run ?? {};
  const positions = listValue(dashboard.positions);
  const trades = listValue(dashboard.trades);
  const series = listValue(dashboard.performance_series);

  $("mp-subtitle").textContent =
    `${p.name ?? p.slug ?? "Model portfolio"} · ${p.benchmark_code ?? "benchmark"} · latest run ${run.status ?? "—"}`;

  renderSummary(nav, positions, trades, series);
  renderChart(series);
  renderPositions(positions);
  renderRisk(dashboard.latest_risk, nav);
  renderDeck(listValue(dashboard.deck_metrics));
  renderTrades(trades);
}

function renderSummary(nav, positions, trades, series) {
  const topPosition = [...positions].sort((a, b) => numberValue(b.weight) - numberValue(a.weight))[0];
  const latestSeries = series[series.length - 1] ?? {};
  $("mp-summary").innerHTML = [
    metricHTML("NAV", formatUsd(nav.nav_usd, 2), `as of ${formatDate(nav.nav_date)}`),
    metricHTML("Daily", formatPctDecimal(nav.daily_return), "USD return", valueClass(nav.daily_return)),
    metricHTML("Since Inception", formatPctDecimal(latestSeries.since_inception_return), "from performance series", valueClass(latestSeries.since_inception_return)),
    metricHTML("Gross", formatPctDecimal(nav.gross_exposure), `cash ${formatPctDecimal(nav.cash_weight)}`),
    metricHTML("Positions", String(positions.length), topPosition ? `top ${topPosition.symbol} ${formatWeight(topPosition.weight)}` : "no active holdings"),
    metricHTML("Trades", String(trades.length), "latest rebalance log"),
  ].join("");
}

function renderChart(series) {
  if (!series.length) {
    $("mp-chart").innerHTML = `<div class="brain-empty">No NAV series yet</div>`;
    return;
  }
  const values = series.map((p) => numberValue(p.nav_usd)).filter((n) => n > 0);
  if (!values.length) {
    $("mp-chart").innerHTML = `<div class="brain-empty">NAV rows have no usable values</div>`;
    return;
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const width = 900;
  const height = 260;
  const padX = 24;
  const padY = 24;
  const points = series.map((p, idx) => {
    const x = padX + (idx / Math.max(1, series.length - 1)) * (width - padX * 2);
    const y = height - padY - ((numberValue(p.nav_usd) - min) / span) * (height - padY * 2);
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });
  const last = series[series.length - 1];
  const first = series[0];
  $("mp-chart").innerHTML = `
    <svg class="mp-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Model portfolio NAV chart">
      <line x1="${padX}" y1="${height - padY}" x2="${width - padX}" y2="${height - padY}" stroke="#e0d8c4"/>
      <line x1="${padX}" y1="${padY}" x2="${padX}" y2="${height - padY}" stroke="#e0d8c4"/>
      <polyline fill="none" stroke="#2563eb" stroke-width="3" points="${points.join(" ")}"/>
      <polyline fill="none" stroke="#c9a84c" stroke-width="1.5" opacity=".55" points="${points.join(" ")}"/>
      <circle cx="${points[points.length - 1].split(",")[0]}" cy="${points[points.length - 1].split(",")[1]}" r="5" fill="#1a2744"/>
      <text x="${padX}" y="18" fill="#8b8680" font-size="12">${escapeHTML(formatUsd(max, 2))}</text>
      <text x="${padX}" y="${height - 6}" fill="#8b8680" font-size="12">${escapeHTML(formatUsd(min, 2))}</text>
    </svg>
    <div class="mp-chart-meta">
      <span>${escapeHTML(formatDate(first.nav_date))} → ${escapeHTML(formatDate(last.nav_date))}</span>
      <span>${escapeHTML(series.length)} NAV points</span>
      <span>latest ${escapeHTML(formatUsd(last.nav_usd, 2))}</span>
    </div>
  `;
}

function renderPositions(rows) {
  if (!rows.length) {
    $("mp-positions").innerHTML = `<div class="brain-empty">No positions yet. The weekly rebalance will populate this after candidate scores exist.</div>`;
    return;
  }
  $("mp-positions").innerHTML = `
    <div class="mp-table-wrap">
      <table class="mp-table">
        <thead>
          <tr>
            <th>Symbol</th>
            <th>Name</th>
            <th class="num">Weight</th>
            <th class="num">Market Value</th>
            <th class="num">Price</th>
            <th>Sector</th>
            <th>Themes</th>
            <th>Research</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((r) => {
            const sym = escapeHTML(r.symbol ?? "");
            return `
              <tr class="clickable" data-symbol="${sym}">
                <td><strong>${sym}</strong></td>
                <td>${escapeHTML(r.company_name_jp ?? r.company_name ?? r.symbol ?? "")}</td>
                <td class="num">${escapeHTML(formatWeight(r.weight))}</td>
                <td class="num">${escapeHTML(formatUsd(r.market_value_usd, 2))}</td>
                <td class="num">${escapeHTML(formatJpy(r.price_jpy))}</td>
                <td>${escapeHTML(r.sector ?? "—")}</td>
                <td>${themeChipsHTML(r.theme_tags)}</td>
                <td>${researchLinkHTML({
                  symbol: r.symbol,
                  sessionId: r.latest_research_session_id,
                  url: r.latest_research_url,
                  name: r.latest_research_name,
                  provider: r.latest_research_provider,
                  date: r.latest_research_date,
                  links: r.latest_research_links,
                })}</td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;
  wireStockRows($("mp-positions"));
}

function renderRisk(risk, nav) {
  if (!risk) {
    $("mp-risk").innerHTML = `<div class="brain-empty">No risk snapshot yet</div>`;
    return;
  }
  const alerts = [
    ...listValue(risk.liquidity_alerts),
    ...listValue(risk.stale_research_alerts),
    ...listValue(risk.ai_disagreement_alerts),
  ];
  $("mp-risk").innerHTML = `
    <div class="mp-risk-list">
      <div class="mp-risk-row"><span>As of</span><strong>${escapeHTML(formatDate(risk.as_of_date))}</strong></div>
      <div class="mp-risk-row"><span>Max name</span><strong>${escapeHTML(formatWeight(risk.max_name_weight))}</strong></div>
      <div class="mp-risk-row"><span>Max sector</span><strong>${escapeHTML(formatWeight(risk.max_sector_weight))}</strong></div>
      <div class="mp-risk-row"><span>Max theme</span><strong>${escapeHTML(formatWeight(risk.max_theme_weight))}</strong></div>
      <div class="mp-risk-row"><span>Cash</span><strong>${escapeHTML(formatWeight(nav?.cash_weight))}</strong></div>
      <div class="mp-risk-row"><span>Alerts</span><strong>${alerts.length}</strong></div>
    </div>
    ${alerts.length ? `<div class="mp-note">${escapeHTML(JSON.stringify(alerts.slice(0, 3)))}</div>` : `<div class="mp-note">No open risk alerts in the latest snapshot.</div>`}
  `;
}

function renderDeck(rows) {
  if (!rows.length) {
    $("mp-deck").innerHTML = `<div class="brain-empty">No deck metrics yet</div>`;
    return;
  }
  $("mp-deck").innerHTML = rows.map((row) => {
    const metrics = row.metrics ?? {};
    const notes = row.slide_notes ?? metrics.slideNotes ?? {};
    return `
      <div class="mp-risk-row"><span>${escapeHTML(row.period_type ?? "period")}</span><strong>${escapeHTML(formatDate(row.period_end))}</strong></div>
      <div class="mp-note">
        ${escapeHTML(notes.headline ?? `Return ${formatPctDecimal(metrics.totalReturn)}`)}
      </div>
    `;
  }).join("");
}

function renderTrades(rows) {
  if (!rows.length) {
    $("mp-trades").innerHTML = `<div class="brain-empty">No rebalance trades yet</div>`;
    return;
  }
  $("mp-trades").innerHTML = `
    <div class="mp-table-wrap">
      <table class="mp-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Symbol</th>
            <th>Name</th>
            <th>Action</th>
            <th class="num">Notional</th>
            <th class="num">Before</th>
            <th class="num">After</th>
            <th>Status</th>
            <th class="num">Exec Px</th>
            <th>Research</th>
            <th>Reason</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((r) => {
            const action = String(r.action ?? "");
            const cls = `mp-action-${action}`;
            const sym = escapeHTML(r.symbol ?? "");
            return `
              <tr class="clickable" data-symbol="${sym}">
                <td>${escapeHTML(formatDate(r.trade_date))}</td>
                <td><strong>${sym}</strong></td>
                <td>${escapeHTML(r.company_name_jp ?? r.company_name ?? r.symbol ?? "")}</td>
                <td class="${escapeHTML(cls)}">${escapeHTML(action.replace(/_/g, " "))}</td>
                <td class="num">${escapeHTML(formatUsd(r.notional_usd, 2))}</td>
                <td class="num">${escapeHTML(formatWeight(r.weight_before))}</td>
                <td class="num">${escapeHTML(formatWeight(r.weight_after))}</td>
                <td>${escapeHTML(String(r.execution_status ?? "—").replace(/_/g, " "))}</td>
                <td class="num">${escapeHTML(formatJpy(r.execution_price_jpy))}</td>
                <td>${researchLinkHTML({
                  symbol: r.symbol,
                  sessionId: r.research_session_id,
                  url: r.research_url,
                  name: r.research_name,
                  provider: r.research_provider,
                  date: r.research_date,
                  links: r.research_links,
                })}</td>
                <td>${escapeHTML(r.reason ?? "")}</td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;
  wireStockRows($("mp-trades"));
}

function wireStockRows(container) {
  container.querySelectorAll("tr.clickable").forEach((row) => {
    row.addEventListener("click", (event) => {
      if (event.target instanceof Element && event.target.closest("a")) return;
      const sym = /** @type {HTMLElement} */(row).dataset.symbol;
      if (sym) location.href = `/stock.html?symbol=${encodeURIComponent(sym)}`;
    });
  });
}

function skeletonTable(rowCount, colCount = 7) {
  return `
    <table class="mp-table">
      <thead><tr><th colspan="${colCount}">${skeletonRowHTML("60%")}</th></tr></thead>
      <tbody>
        ${Array.from({ length: rowCount }).map(() => `<tr><td colspan="${colCount}">${skeletonRowHTML("100%")}</td></tr>`).join("")}
      </tbody>
    </table>
  `;
}

mountBrainAuthGate({
  onAuthed: () => {
    $("mp-refresh").addEventListener("click", load);
    load();
  },
});
