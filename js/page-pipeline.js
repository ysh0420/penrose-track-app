// @ts-check
import { mountBrainAuthGate } from "./brain-client.js";
import {
  getPipelineRevisions, getPromotionCandidates, getActiveIdeas,
} from "./brain-queries.js";
import {
  convictionStarsHTML, themeChipsHTML, formatPct, formatYen, escapeHTML,
  formatRelativeTime, skeletonRowHTML,
} from "./brain-components.js";
import { showError } from "./brain-error.js";

// Yuki edge tooltips per Sprint 1 §14: major_downward = potential
// cycle-inversion candidate; major_upward = potential first reversal
// trigger after a downward streak. Streak detection across history is
// Sprint 2 — Sprint 1 just labels each row uniformly.
const SIGNIFICANCE_HINT = {
  major_downward: "Cycle-inversion candidate? (Yuki edge)",
  major_upward: "First reversal trigger?",
};

async function loadEdinetSignals() {
  const el = document.getElementById("brain-edinet-signals");
  el.innerHTML = skeletonTable(4);

  let raw;
  try {
    raw = await getActiveIdeas() ?? [];
  } catch (e) {
    showError({ container: el, message: `EDINET signals load failed: ${e.message}`, onRetry: loadEdinetSignals, error: e });
    return;
  }

  // Auto-detected EDINET activist signals are flagged server-side as
  // idea_type='event_driven'; Yuki-curated names are single_stock /
  // pair / thematic. Keep only the auto bucket here, sorted newest
  // first by first_noted_date.
  const rows = raw
    .filter((i) => i.idea_type === "event_driven")
    .sort((a, b) => {
      const ta = a.first_noted_date ? new Date(a.first_noted_date).getTime() : 0;
      const tb = b.first_noted_date ? new Date(b.first_noted_date).getTime() : 0;
      return tb - ta;
    });

  if (rows.length === 0) {
    el.innerHTML = `<div class="brain-empty">No active EDINET signals</div>`;
    return;
  }

  el.innerHTML = `
    <table class="brain-table">
      <thead>
        <tr>
          <th>Symbol</th>
          <th>Name</th>
          <th>First noted</th>
          <th>Source</th>
          <th>Themes</th>
          <th>Conv</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map((r) => {
          const sym = escapeHTML(r.symbol ?? "");
          const fullSource = r.source ?? "";
          const truncSource = fullSource.length > 60 ? fullSource.slice(0, 57) + "…" : fullSource;
          const sourceTitle = fullSource.length > 60 ? ` title="${escapeHTML(fullSource)}"` : "";
          return `
            <tr class="clickable" data-symbol="${sym}">
              <td><strong>${sym}</strong></td>
              <td>${escapeHTML(r.company_name_jp ?? r.company_name ?? "")}</td>
              <td>${formatRelativeTime(r.first_noted_date)}</td>
              <td><span${sourceTitle}>${escapeHTML(truncSource)}</span></td>
              <td>${themeChipsHTML(r.themes_linked)}</td>
              <td>${convictionStarsHTML(r.conviction_score)}</td>
            </tr>
          `;
        }).join("")}
      </tbody>
    </table>
  `;
  wireRowClicks(el);
}

async function loadRevisions() {
  const el = document.getElementById("brain-revisions");
  el.innerHTML = skeletonTable(6);

  let rows;
  try {
    rows = await getPipelineRevisions(30) ?? [];
  } catch (e) {
    showError({ container: el, message: `Revisions load failed: ${e.message}`, onRetry: loadRevisions, error: e });
    return;
  }

  if (!Array.isArray(rows) || rows.length === 0) {
    el.innerHTML = `<div class="brain-empty">No major revisions in the last 30 days</div>`;
    return;
  }

  el.innerHTML = `
    <table class="brain-table">
      <thead>
        <tr>
          <th>Symbol</th>
          <th>Name</th>
          <th>Fiscal Period</th>
          <th class="num">Old OP</th>
          <th class="num">New OP</th>
          <th class="num">Δ %</th>
          <th>Significance</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map((r) => {
          const sig = r.significance ?? "";
          const cls = sig === "major_downward" ? "brain-significance-major-downward"
                    : sig === "major_upward" ? "brain-significance-major-upward"
                    : "";
          const hint = SIGNIFICANCE_HINT[sig];
          const titleAttr = hint ? ` title="${escapeHTML(hint)}"` : "";
          const sym = escapeHTML(r.symbol ?? "");
          return `
            <tr class="clickable ${cls}" data-symbol="${sym}"${titleAttr}>
              <td><strong>${sym}</strong></td>
              <td>${escapeHTML(r.company_name_jp ?? r.company_name ?? "")}</td>
              <td>${escapeHTML(r.fiscal_period ?? "")}</td>
              <td class="num">${formatYen(r.op_forecast_old)}</td>
              <td class="num">${formatYen(r.op_forecast_new)}</td>
              <td class="num">${formatPct(r.op_forecast_change_pct)}</td>
              <td>${escapeHTML(sig)}</td>
            </tr>
          `;
        }).join("")}
      </tbody>
    </table>
  `;
  wireRowClicks(el);
}

async function loadPromotions() {
  const el = document.getElementById("brain-promotions");
  el.innerHTML = skeletonTable(4);

  let rows;
  try {
    rows = await getPromotionCandidates() ?? [];
  } catch (e) {
    showError({ container: el, message: `Promotions load failed: ${e.message}`, onRetry: loadPromotions, error: e });
    return;
  }

  if (!Array.isArray(rows) || rows.length === 0) {
    el.innerHTML = `<div class="brain-empty">No promotion candidates</div>`;
    return;
  }

  el.innerHTML = `
    <table class="brain-table">
      <thead>
        <tr>
          <th>Symbol</th>
          <th>Name</th>
          <th>Themes</th>
          <th>Conviction</th>
          <th>Watchlist State</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map((r) => {
          const sym = escapeHTML(r.symbol ?? "");
          return `
            <tr class="clickable" data-symbol="${sym}">
              <td><strong>${sym}</strong></td>
              <td>${escapeHTML(r.company_name_jp ?? r.company_name ?? "")}</td>
              <td>${themeChipsHTML(r.themes_linked)}</td>
              <td>${convictionStarsHTML(r.conviction_score)}</td>
              <td>${escapeHTML(r.watchlist_state ?? "")}</td>
            </tr>
          `;
        }).join("")}
      </tbody>
    </table>
  `;
  wireRowClicks(el);
}

function wireRowClicks(container) {
  container.querySelectorAll("tr.clickable").forEach((row) => {
    row.addEventListener("click", () => {
      const sym = /** @type {HTMLElement} */(row).dataset.symbol;
      if (sym) location.href = `/stock.html?symbol=${encodeURIComponent(sym)}`;
    });
  });
}

function skeletonTable(rowCount) {
  return `
    <table class="brain-table">
      <thead><tr><th colspan="7">${skeletonRowHTML("60%")}</th></tr></thead>
      <tbody>
        ${Array.from({ length: rowCount }).map(() => `
          <tr><td colspan="7">${skeletonRowHTML("100%")}</td></tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

mountBrainAuthGate({
  onAuthed: () => {
    loadEdinetSignals();
    loadRevisions();
    loadPromotions();
  },
});
