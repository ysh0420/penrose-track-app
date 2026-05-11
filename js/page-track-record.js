// @ts-check

const DATA_URL = "/data/mw-portfolio-history.json";

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}

function formatNumber(value, decimals = 0) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "-";
  return Number(value).toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function formatPct(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "-";
  return `${Number(value).toFixed(2)}%`;
}

function signedClass(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n === 0) return "";
  return n > 0 ? "positive" : "negative";
}

function metric(label, value, detail = "", valueClass = "") {
  return `
    <div class="platform-metric">
      <div class="label">${escapeHTML(label)}</div>
      <div class="value ${valueClass}">${escapeHTML(value)}</div>
      ${detail ? `<div class="platform-meta">${escapeHTML(detail)}</div>` : ""}
    </div>
  `;
}

function row(label, cells) {
  return `
    <tr>
      <th>${escapeHTML(label)}</th>
      ${cells.map((cell) => `<td class="${cell.className || ""}">${escapeHTML(cell.value)}</td>`).join("")}
    </tr>
  `;
}

function renderHistory(account) {
  return `
    <div class="platform-table-wrap">
      <table class="platform-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Account</th>
            <th>Current Fund Size</th>
            <th>Target Fund Size</th>
            <th>MTD Net</th>
            <th>MTD Gross</th>
            <th>Overall</th>
            <th>Total P&L Net</th>
            <th>Net Exposure</th>
            <th>TPX MTD</th>
          </tr>
        </thead>
        <tbody>
          ${account.records.map((record) => `
            <tr>
              <td>${escapeHTML(record.asOfDate)}</td>
              <td>${escapeHTML(account.accountCode)}</td>
              <td class="num">${formatNumber(record.summary.currentFundSize)}</td>
              <td class="num">${formatNumber(record.summary.targetFundSize)}</td>
              <td class="num ${signedClass(record.summary.mtdFundReturnNetPct)}">${formatPct(record.summary.mtdFundReturnNetPct)}</td>
              <td class="num ${signedClass(record.summary.mtdFundReturnGrossPct)}">${formatPct(record.summary.mtdFundReturnGrossPct)}</td>
              <td class="num ${signedClass(record.summary.overallPerformancePct)}">${formatPct(record.summary.overallPerformancePct)}</td>
              <td class="num ${signedClass(record.summary.totalPnlNet)}">${formatNumber(record.summary.totalPnlNet)}</td>
              <td class="num ${signedClass(record.summary.netMarketExposurePct)}">${formatPct(record.summary.netMarketExposurePct)}</td>
              <td class="num ${signedClass(record.comparativePerformance.mtdIndexReturnPct)}">${formatPct(record.comparativePerformance.mtdIndexReturnPct)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderBreakdown(record) {
  const open = record.openPortfolio;
  const closed = record.closedPositions;
  const stats = record.fundsStatistics;
  return `
    <div class="track-grid">
      <div>
        <h3>Open Portfolio</h3>
        <div class="platform-table-wrap">
          <table class="platform-table compact">
            <thead><tr><th></th><th>Exposure</th><th>P&L</th></tr></thead>
            <tbody>
              ${row("Longs", [
                { value: formatNumber(open.longs.exposure), className: "num" },
                { value: formatNumber(open.longs.pnl), className: `num ${signedClass(open.longs.pnl)}` },
              ])}
              ${row("Shorts", [
                { value: formatNumber(open.shorts.exposure), className: `num ${signedClass(open.shorts.exposure)}` },
                { value: formatNumber(open.shorts.pnl), className: `num ${signedClass(open.shorts.pnl)}` },
              ])}
              ${row("Total", [
                { value: formatNumber(open.total.exposure), className: `num ${signedClass(open.total.exposure)}` },
                { value: formatNumber(open.total.pnl), className: `num ${signedClass(open.total.pnl)}` },
              ])}
            </tbody>
          </table>
        </div>
      </div>
      <div>
        <h3>Closed Positions</h3>
        <div class="platform-table-wrap">
          <table class="platform-table compact">
            <thead><tr><th></th><th>Capital Employed</th><th>P&L</th></tr></thead>
            <tbody>
              ${row("Longs", [
                { value: formatNumber(closed.longs.capitalEmployed), className: "num" },
                { value: formatNumber(closed.longs.pnl), className: `num ${signedClass(closed.longs.pnl)}` },
              ])}
              ${row("Shorts", [
                { value: formatNumber(closed.shorts.capitalEmployed), className: "num" },
                { value: formatNumber(closed.shorts.pnl), className: `num ${signedClass(closed.shorts.pnl)}` },
              ])}
              ${row("Total", [
                { value: formatNumber(closed.total.capitalEmployed), className: "num" },
                { value: formatNumber(closed.total.pnl), className: `num ${signedClass(closed.total.pnl)}` },
              ])}
            </tbody>
          </table>
        </div>
      </div>
      <div>
        <h3>Funds Statistics</h3>
        <div class="platform-table-wrap">
          <table class="platform-table compact">
            <thead><tr><th></th><th>Longs</th><th>Shorts</th><th>Total</th></tr></thead>
            <tbody>
              ${row("Average Fund Size", [
                { value: formatNumber(stats.longs.averageFundSize), className: "num" },
                { value: formatNumber(stats.shorts.averageFundSize), className: "num" },
                { value: formatNumber(stats.total.averageFundSize), className: "num" },
              ])}
              ${row("Capital Employed", [
                { value: formatNumber(stats.longs.totalCapitalEmployed), className: "num" },
                { value: formatNumber(stats.shorts.totalCapitalEmployed), className: "num" },
                { value: formatNumber(stats.total.totalCapitalEmployed), className: "num" },
              ])}
              ${row("Turnover", [
                { value: formatNumber(stats.longs.turnover), className: "num" },
                { value: formatNumber(stats.shorts.turnover), className: "num" },
                { value: formatNumber(stats.total.turnover), className: "num" },
              ])}
              ${row("Transaction Cost", [
                { value: formatNumber(stats.longs.transactionCost), className: "num" },
                { value: formatNumber(stats.shorts.transactionCost), className: "num" },
                { value: formatNumber(stats.total.transactionCost), className: "num" },
              ])}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

function renderPositions(record) {
  return `
    <div class="platform-table-wrap">
      <table class="platform-table">
        <thead>
          <tr>
            <th>Ticker</th>
            <th>Security</th>
            <th>L/S</th>
            <th>Position</th>
            <th>Avg In</th>
            <th>Last</th>
            <th>Period End</th>
            <th>% Pos</th>
            <th>% Today</th>
            <th>% MTD</th>
            <th>P&L MTD</th>
            <th>P&L Since Inception</th>
          </tr>
        </thead>
        <tbody>
          ${record.positions.map((p) => `
            <tr>
              <td><a href="/stock.html?symbol=${encodeURIComponent(p.symbol)}">${escapeHTML(p.ticker)}</a></td>
              <td>${escapeHTML(p.security)}</td>
              <td>${escapeHTML(p.side)}</td>
              <td class="num">${formatNumber(p.position)}</td>
              <td class="num">${formatNumber(p.averageInPrice, 1)}</td>
              <td class="num">${formatNumber(p.lastPrice, 1)}</td>
              <td class="num">${formatNumber(p.periodEndPrice, 1)}</td>
              <td class="num ${signedClass(p.changeOnPositionPct)}">${formatPct(p.changeOnPositionPct)}</td>
              <td class="num ${signedClass(p.changeTodayPct)}">${formatPct(p.changeTodayPct)}</td>
              <td class="num ${signedClass(p.changeMtdPct)}">${formatPct(p.changeMtdPct)}</td>
              <td class="num ${signedClass(p.totalPnlMtd)}">${formatNumber(p.totalPnlMtd)}</td>
              <td class="num ${signedClass(p.totalPnlSinceInception)}">${formatNumber(p.totalPnlSinceInception)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function render(data) {
  const root = document.getElementById("track-record-root");
  if (!root) return;
  const account = data.accounts?.[0];
  const latest = account?.records?.[0];
  if (!account || !latest) {
    root.innerHTML = `<div class="platform-empty">No account history loaded.</div>`;
    return;
  }

  root.innerHTML = `
    <div class="platform-meta">${escapeHTML(account.displayName)} / ${escapeHTML(latest.asOfDate)} / ${escapeHTML(latest.sourceLabel)}</div>
    <div class="platform-metrics">
      ${metric("MTD Fund Return Net", formatPct(latest.summary.mtdFundReturnNetPct), "MW account", signedClass(latest.summary.mtdFundReturnNetPct))}
      ${metric("Overall Performance", formatPct(latest.summary.overallPerformancePct), "Skill factor included", signedClass(latest.summary.overallPerformancePct))}
      ${metric("Total P&L Net", formatNumber(latest.summary.totalPnlNet), account.baseCurrency, signedClass(latest.summary.totalPnlNet))}
      ${metric("Current Fund Size", formatNumber(latest.summary.currentFundSize), `Target ${formatNumber(latest.summary.targetFundSize)}`)}
      ${metric("Net Market Exposure", formatPct(latest.summary.netMarketExposurePct), "Open portfolio", signedClass(latest.summary.netMarketExposurePct))}
      ${metric("Long Ideas Return", formatPct(latest.summary.returnOnLongIdeasPct), "MTD", signedClass(latest.summary.returnOnLongIdeasPct))}
      ${metric("Short Ideas Return", formatPct(latest.summary.returnOnShortIdeasPct), "MTD", signedClass(latest.summary.returnOnShortIdeasPct))}
      ${metric("TPX MTD", formatPct(latest.comparativePerformance.mtdIndexReturnPct), `Today ${formatPct(latest.comparativePerformance.todayIndexReturnPct)}`, signedClass(latest.comparativePerformance.mtdIndexReturnPct))}
    </div>

    <section class="platform-subsection">
      <h3>MW NAV History</h3>
      ${renderHistory(account)}
    </section>

    <section class="platform-subsection">
      <h3>Account Breakdown</h3>
      ${renderBreakdown(latest)}
    </section>

    <section class="platform-subsection">
      <h3>Positions Detailed</h3>
      ${renderPositions(latest)}
    </section>

    <section class="platform-subsection">
      <h3>Source Notes</h3>
      <div class="platform-list">
        <div class="platform-item">
          <div class="platform-meta">${escapeHTML(latest.sourceNote)}</div>
          ${(latest.alerts || []).map((alert) => `<span class="platform-pill">${escapeHTML(alert)}</span>`).join("")}
        </div>
      </div>
    </section>
  `;
}

async function loadTrackRecord() {
  const root = document.getElementById("track-record-root");
  try {
    const res = await fetch(DATA_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    render(await res.json());
  } catch (error) {
    if (root) {
      root.innerHTML = `<div class="platform-empty">MW history could not be loaded: ${escapeHTML(error instanceof Error ? error.message : String(error))}</div>`;
    }
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", loadTrackRecord);
} else {
  loadTrackRecord();
}
