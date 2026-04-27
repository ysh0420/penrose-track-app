// @ts-check
import { mountBrainAuthGate } from "./brain-client.js";
import { getActiveIdeas } from "./brain-queries.js";
import {
  convictionStarsHTML, directionBadgeHTML, rsiBadgeHTML,
  themeChipsHTML, skeletonRowHTML, formatPct, formatMcap,
  escapeHTML,
} from "./brain-components.js";
import { showError } from "./brain-error.js";

let allIdeas = [];

async function load() {
  const grid = document.getElementById("brain-portfolio-grid");
  // 6 skeleton cards while the RPC fires.
  grid.innerHTML = Array.from({ length: 6 }).map(() => `
    <div class="brain-idea-card" style="cursor:default">
      ${skeletonRowHTML("60%")}<br>
      ${skeletonRowHTML("80%")}<br>
      ${skeletonRowHTML("100%")}
    </div>
  `).join("");

  try {
    allIdeas = await getActiveIdeas() ?? [];
  } catch (e) {
    showError({ container: grid, message: `Failed to load portfolio: ${e.message}`, onRetry: load, error: e });
    return;
  }

  document.getElementById("brain-portfolio-count").textContent = `${allIdeas.length} ideas`;

  const themes = new Set();
  allIdeas.forEach((i) => (i.themes_linked ?? []).forEach((t) => themes.add(t)));
  const themeSelect = /** @type {HTMLSelectElement} */(document.getElementById("brain-theme-filter"));
  // Wipe everything except the leading "All themes" option, then add sorted themes.
  themeSelect.innerHTML = `<option value="all">All themes</option>`;
  [...themes].sort().forEach((t) => {
    const opt = document.createElement("option");
    opt.value = t;
    opt.textContent = t;
    themeSelect.appendChild(opt);
  });

  render();
}

function render() {
  const search = /** @type {HTMLInputElement} */(document.getElementById("brain-search")).value.toLowerCase();
  const direction = /** @type {HTMLSelectElement} */(document.getElementById("brain-direction-filter")).value;
  const minConv = parseInt(/** @type {HTMLInputElement} */(document.getElementById("brain-conviction-min")).value, 10);
  const theme = /** @type {HTMLSelectElement} */(document.getElementById("brain-theme-filter")).value;

  const filtered = allIdeas.filter((i) => {
    if (direction !== "all" && i.direction !== direction) return false;
    if ((i.conviction_score ?? 0) < minConv) return false;
    if (theme !== "all" && !(i.themes_linked ?? []).includes(theme)) return false;
    if (search) {
      const blob = `${i.symbol ?? ""} ${i.company_name_jp ?? ""} ${i.sector ?? ""}`.toLowerCase();
      if (!blob.includes(search)) return false;
    }
    return true;
  });

  const grid = document.getElementById("brain-portfolio-grid");
  if (filtered.length === 0) {
    grid.innerHTML = `<div class="brain-empty">No ideas match these filters</div>`;
    return;
  }

  grid.innerHTML = filtered.map((i) => `
    <a class="brain-idea-card" href="/stock.html?symbol=${encodeURIComponent(i.symbol)}">
      <div class="brain-idea-card-header">
        <span class="brain-idea-card-symbol">${escapeHTML(i.symbol)}</span>
        ${directionBadgeHTML(i.direction)}
      </div>
      <div class="brain-idea-card-name">${escapeHTML(i.company_name_jp ?? i.symbol)}</div>
      <div>${convictionStarsHTML(i.conviction_score)}</div>
      <div class="brain-idea-card-metrics">
        ${rsiBadgeHTML(i.rsi_14)}
        <span>${formatPct(i.price_change_3m_pct)} 3m</span>
        <span>OPM ${formatPct(i.operating_margin)}</span>
        <span>${formatMcap(i.market_cap_billion)}</span>
      </div>
      <div>${themeChipsHTML(i.themes_linked)}</div>
      <p class="brain-idea-card-thesis">${escapeHTML(i.thesis_summary ?? "")}</p>
      <small>${escapeHTML(i.fiscal_period ?? "")}</small>
    </a>
  `).join("");
}

function wireFilters() {
  ["brain-search", "brain-direction-filter", "brain-conviction-min", "brain-theme-filter"].forEach((id) => {
    document.getElementById(id).addEventListener("input", (ev) => {
      if (id === "brain-conviction-min") {
        document.getElementById("brain-conviction-value").textContent =
          /** @type {HTMLInputElement} */(ev.target).value;
      }
      render();
    });
  });
}

mountBrainAuthGate({
  onAuthed: () => {
    wireFilters();
    load();
  },
});
