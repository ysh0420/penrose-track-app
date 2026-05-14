// @ts-check

const NAV_ITEMS = [
  { id: "today", label: "Today", href: "/today.html", group: "Daily" },
  { id: "brain-review", label: "Brain Review", href: "/brain-review.html", group: "Daily" },
  { id: "ideas", label: "Ideas", href: "/ideas.html", group: "Pipeline" },
  { id: "master", label: "Master Portfolio", href: "/master-portfolio.html", group: "Portfolio" },
  { id: "reports", label: "Reports", href: "/reports.html", group: "Research" },
  { id: "companies", label: "Companies", href: "/stock.html", group: "Research" },
  { id: "track", label: "Track Record", href: "/track-record.html", group: "Portfolio" },
  { id: "client", label: "Client View", href: "/client.html", group: "External" },
];

const GROUP_ORDER = ["Daily", "Pipeline", "Portfolio", "Research", "External"];

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}

export function renderPlatformNav(container, activeId) {
  const active = activeId || container?.dataset?.activeNav || "";
  const activeItem = NAV_ITEMS.find((item) => item.id === active);
  const groupedItems = GROUP_ORDER
    .map((group) => ({
      group,
      items: NAV_ITEMS.filter((item) => item.group === group),
    }))
    .filter((entry) => entry.items.length);
  container.innerHTML = `
    <nav class="platform-breadcrumb" aria-label="Breadcrumb">
      <a href="/today.html">Main</a>
      ${activeItem ? `
        <span aria-hidden="true">&gt;</span>
        <span>${escapeHTML(activeItem.group)}</span>
        <span aria-hidden="true">&gt;</span>
        <strong>${escapeHTML(activeItem.label)}</strong>
      ` : ""}
    </nav>
    <nav class="platform-nav" aria-label="Platform navigation">
      ${groupedItems.map((entry) => `
        <div class="platform-nav-section" data-group="${escapeHTML(entry.group)}">
          <span class="platform-nav-section-label">${escapeHTML(entry.group)}</span>
          ${entry.items.map((item) => `
            <a href="${escapeHTML(item.href)}" class="${item.id === active ? "active" : ""}" ${item.id === active ? 'aria-current="page"' : ""}>
              ${escapeHTML(item.label)}
            </a>
          `).join("")}
        </div>
      `).join("")}
    </nav>
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
