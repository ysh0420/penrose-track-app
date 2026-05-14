// @ts-check

const SECTIONS = [
  { id: "main", label: "Main", href: "/today.html" },
  { id: "brain", label: "Brain", href: "/brain-review.html" },
  { id: "portfolio", label: "Portfolio", href: "/master-portfolio.html" },
  { id: "research", label: "Research", href: "/reports.html" },
  { id: "records", label: "Records", href: "/track-record.html" },
  { id: "external", label: "External", href: "/client.html" },
];

const NAV_ITEMS = [
  { id: "today", label: "Today", href: "/today.html", section: "main" },
  { id: "brain-review", label: "Review", href: "/brain-review.html", section: "brain" },
  { id: "news", label: "News", href: "/news.html", section: "brain" },
  { id: "master", label: "Master", href: "/master-portfolio.html", section: "portfolio" },
  { id: "portfolio", label: "Yuki Book", href: "/portfolio.html", section: "portfolio" },
  { id: "model", label: "Model Book", href: "/model-portfolio.html", section: "portfolio" },
  { id: "ideas", label: "Ideas", href: "/ideas.html", section: "portfolio" },
  { id: "pipeline", label: "Pipeline", href: "/pipeline.html", section: "portfolio" },
  { id: "reports", label: "Reports", href: "/reports.html", section: "research" },
  { id: "research-log", label: "Research Log", href: "/research-log.html", section: "research" },
  { id: "companies", label: "Companies", href: "/stock.html", section: "research" },
  { id: "track", label: "Track Record", href: "/track-record.html", section: "records" },
  { id: "ops", label: "Trading Ops", href: "/index.html", section: "records" },
  { id: "attribution", label: "MW Attribution", href: "/mw-tops-attribution.html", section: "records" },
  { id: "transactions", label: "MW Transactions", href: "/mw-tops-transactions.html", section: "records" },
  { id: "client", label: "Client View", href: "/client.html", section: "external" },
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
