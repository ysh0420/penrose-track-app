// @ts-check

const SECTIONS = [
  { id: "main", label: "Main", href: "/today.html" },
  { id: "brain", label: "Brain", href: "/brain-review.html" },
  { id: "portfolio", label: "Portfolio", href: "/master-portfolio.html" },
];

// Research section removed from nav (Reports / Research Log / Agent Intake /
// Companies). The backing RPCs are preserved; research-log.html and stock.html
// stay on disk because they are still deep-link / drill-down targets
// (today, model-portfolio, portfolio-v2, track-record) — they are simply no
// longer surfaced in the nav.
//
// Screener consolidation: "Screener" is now the single live Technical Screen
// page (get_technical_panel). v1 was deleted; v2 (Confluence draft) is archived
// under archive/screener-v2/ pending a decision to fold its features in.
const NAV_ITEMS = [
  { id: "today", label: "Today", href: "/today.html", section: "main" },
  { id: "news", label: "News", href: "/news.html", section: "main" },
  { id: "brain-dashboard", label: "Dashboard", href: "/brain-dashboard.html", section: "brain" },
  { id: "brain-review", label: "Review", href: "/brain-review.html", section: "brain" },
  { id: "data-coverage", label: "Data Coverage", href: "/data-coverage.html", section: "brain" },
  { id: "technical-screen", label: "Screener", href: "/technical-screen.html", section: "brain" },
  { id: "master", label: "Main Portfolio", href: "/master-portfolio.html", section: "portfolio" },
  { id: "books", label: "Books", href: "/books.html", section: "portfolio" },
  { id: "model-v2", label: "V2 Review", href: "/portfolio-v2-review.html", section: "portfolio" },
  { id: "model-v2-log", label: "V2 Daily Log", href: "/portfolio-v2-log.html", section: "portfolio" },
  { id: "model", label: "Legacy Archive", href: "/model-portfolio.html", section: "portfolio" },
  { id: "track", label: "MW", href: "/track-record.html", section: "portfolio" },
  { id: "long-only", label: "Long Only", href: "/long-only.html", section: "portfolio" },
];

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}

function sectionById(sectionId) {
  return SECTIONS.find((section) => section.id === sectionId) || SECTIONS[0];
}

function itemById(itemId) {
  return NAV_ITEMS.find((item) => item.id === itemId) || NAV_ITEMS[0];
}

function renderLink(href, label, cls = "", current = false) {
  return `<a href="${escapeHTML(href)}" class="${escapeHTML(cls)}" ${current ? 'aria-current="page"' : ""}>${escapeHTML(label)}</a>`;
}

export function renderPlatformNav(container, activeId) {
  const active = activeId || container?.dataset?.activeNav || "today";
  const activeItem = itemById(active);
  const activeSection = sectionById(activeItem.section);
  const sectionItems = NAV_ITEMS.filter((item) => item.section === activeSection.id);

  container.innerHTML = `
    <div class="platform-nav-shell">
      <nav class="platform-breadcrumb" aria-label="Breadcrumb">
        ${renderLink("/today.html", "Main")}
        ${activeSection.id !== "main" ? `
          <span aria-hidden="true">&gt;</span>
          ${renderLink(activeSection.href, activeSection.label)}
        ` : ""}
        <span aria-hidden="true">&gt;</span>
        <strong>${escapeHTML(activeItem.label)}</strong>
      </nav>

      <nav class="platform-primary-nav" aria-label="Primary navigation">
        ${SECTIONS.map((section) => renderLink(
          section.href,
          section.label,
          section.id === activeSection.id ? "active" : "",
          false
        )).join("")}
      </nav>

      <nav class="platform-secondary-nav" aria-label="${escapeHTML(activeSection.label)} navigation">
        <span class="platform-secondary-label">${escapeHTML(activeSection.label)}</span>
        ${sectionItems.map((item) => renderLink(
          item.href,
          item.label,
          item.id === activeItem.id ? "active" : "",
          item.id === activeItem.id
        )).join("")}
      </nav>
    </div>
  `;
}

function autoRender() {
  document.querySelectorAll("[data-platform-nav]").forEach((container) => {
    renderPlatformNav(/** @type {HTMLElement} */(container), /** @type {HTMLElement} */(container).dataset.activeNav);
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", autoRender);
} else {
  autoRender();
}
