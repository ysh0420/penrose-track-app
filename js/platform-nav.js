// @ts-check

const NAV_ITEMS = [
  { id: "today", label: "Today", href: "/today.html", group: "Daily" },
  { id: "ideas", label: "Ideas", href: "/ideas.html", group: "Pipeline" },
  { id: "master", label: "Master Portfolio", href: "/master-portfolio.html", group: "Portfolio" },
  { id: "reports", label: "Reports", href: "/reports.html", group: "Research" },
  { id: "companies", label: "Companies", href: "/stock.html", group: "Research" },
  { id: "track", label: "Track Record", href: "/track-record.html", group: "Portfolio" },
  { id: "client", label: "Client View", href: "/client.html", group: "External" },
];

const NAV_GUIDE = "Today: daily monitor | Master Portfolio: Yuki intended book | Reports: decision-grade research | Track Record: accounts and validation";

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
  container.innerHTML = `
    <nav class="platform-nav" aria-label="Platform navigation">
      ${NAV_ITEMS.map((item) => `
        <a href="${escapeHTML(item.href)}" class="${item.id === active ? "active" : ""}" data-group="${escapeHTML(item.group)}" ${item.id === active ? 'aria-current="page"' : ""}>
          ${escapeHTML(item.label)}
        </a>
      `).join("")}
    </nav>
    <div class="platform-nav-guide">${escapeHTML(NAV_GUIDE)}</div>
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
