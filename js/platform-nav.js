// @ts-check

const NAV_ITEMS = [
  { id: "today", label: "Today", href: "/today.html" },
  { id: "ideas", label: "Ideas", href: "/ideas.html" },
  { id: "master", label: "Master Portfolio", href: "/master-portfolio.html" },
  { id: "track", label: "Track Record", href: "/track-record.html" },
  { id: "research", label: "Research", href: "/research-log.html" },
  { id: "companies", label: "Companies", href: "/stock.html" },
  { id: "client", label: "Client View", href: "/client.html" },
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

export function renderPlatformNav(container, activeId) {
  const active = activeId || container?.dataset?.activeNav || "";
  container.innerHTML = `
    <nav class="platform-nav" aria-label="Platform navigation">
      ${NAV_ITEMS.map((item) => `
        <a href="${escapeHTML(item.href)}" class="${item.id === active ? "active" : ""}">
          ${escapeHTML(item.label)}
        </a>
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
