// @ts-check
import { mountBrainAuthGate } from "./brain-client.js";
import { escapeHTML } from "./brain-components.js";

const STORAGE_KEY = "penrose.mainPortfolioDraft.v1";

function loadRows() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function render() {
  const root = document.getElementById("long-only-root");
  if (!root) return;
  const rows = loadRows().filter((row) => row.side === "Long");
  if (!rows.length) {
    root.innerHTML = `<div class="platform-empty">No Long rows in Main Portfolio yet.</div>`;
    return;
  }

  root.innerHTML = `
    <div class="lo-table-wrap">
      <table class="lo-table">
        <thead>
          <tr>
            <th>Symbol</th>
            <th>Company</th>
            <th class="num">Target %</th>
            <th>Status</th>
            <th>Source</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((row) => `
            <tr>
              <td><strong>${escapeHTML(row.symbol)}</strong></td>
              <td>${escapeHTML(row.company || "-")}</td>
              <td class="num">${escapeHTML(row.weight || "-")}</td>
              <td>${escapeHTML(row.status || "-")}</td>
              <td>${escapeHTML(row.source || "-")}</td>
              <td class="notes">${escapeHTML(row.notes || "")}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

mountBrainAuthGate({
  onAuthed: render,
});
