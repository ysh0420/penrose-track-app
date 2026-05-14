// @ts-check
import { mountBrainAuthGate } from "./brain-client.js";
import { escapeHTML } from "./brain-components.js";

const STORAGE_KEY = "penrose.mainPortfolioDraft.v1";
const TABS = ["All", "MW", "Citadel", "CFM"];
let activeTab = "All";
let rows = [];

const $ = (id) => document.getElementById(id);

function loadRows() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    rows = Array.isArray(parsed) ? parsed : [];
  } catch {
    rows = [];
  }
}

function saveRows() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
}

function selectedVenues() {
  return [...document.querySelectorAll('input[name="mp-venue"]:checked')]
    .map((input) => /** @type {HTMLInputElement} */(input).value);
}

function resetForm() {
  /** @type {HTMLFormElement} */($("main-portfolio-form")).reset();
  /** @type {HTMLSelectElement} */($("mp-side")).value = "Long";
  /** @type {HTMLSelectElement} */($("mp-status")).value = "Candidate";
  /** @type {HTMLSelectElement} */($("mp-source")).value = "Manual";
}

function rowMatchesTab(row) {
  if (activeTab === "All") return true;
  return (row.venues || []).includes(activeTab);
}

function renderTabs() {
  $("mp-account-tabs").innerHTML = TABS.map((tab) => {
    const count = tab === "All" ? rows.length : rows.filter((row) => (row.venues || []).includes(tab)).length;
    return `<button type="button" class="${tab === activeTab ? "active" : ""}" data-tab="${escapeHTML(tab)}">${escapeHTML(tab)} (${count})</button>`;
  }).join("");
  $("mp-account-tabs").querySelectorAll("[data-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      activeTab = /** @type {HTMLElement} */(button).dataset.tab || "All";
      render();
    });
  });
}

function renderRows() {
  const filtered = rows.filter(rowMatchesTab);
  if (!filtered.length) {
    const label = activeTab === "All" ? "No Main / Yuki Book draft rows yet." : `No ${activeTab} implementation rows yet.`;
    $("mp-draft-root").innerHTML = `<div class="account-empty">${escapeHTML(label)}</div>`;
    return;
  }

  $("mp-draft-root").innerHTML = `
    <div class="draft-table-wrap">
      <table class="draft-table">
        <thead>
          <tr>
            <th>Symbol</th>
            <th>Company</th>
            <th>Side</th>
            <th class="num">Target %</th>
            <th>Status</th>
            <th>Venues</th>
            <th>Source</th>
            <th>Notes</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${filtered.map((row) => `
            <tr>
              <td><strong>${escapeHTML(row.symbol)}</strong></td>
              <td>${escapeHTML(row.company || "-")}</td>
              <td>${pill(row.side, String(row.side).toLowerCase())}</td>
              <td class="num">${escapeHTML(row.weight || "-")}</td>
              <td>${escapeHTML(row.status || "-")}</td>
              <td>${(row.venues || []).map((venue) => pill(venue)).join("") || "-"}</td>
              <td>${escapeHTML(row.source || "-")}</td>
              <td class="notes">${escapeHTML(row.notes || "")}</td>
              <td>
                <div class="draft-actions">
                  <button type="button" data-action="advance" data-id="${escapeHTML(row.id)}">Advance</button>
                  <button type="button" data-action="delete" data-id="${escapeHTML(row.id)}">Delete</button>
                </div>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;

  $("mp-draft-root").querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = /** @type {HTMLElement} */(button).dataset.id;
      const action = /** @type {HTMLElement} */(button).dataset.action;
      if (!id) return;
      if (action === "delete") {
        rows = rows.filter((row) => row.id !== id);
      } else if (action === "advance") {
        rows = rows.map((row) => row.id === id ? { ...row, status: nextStatus(row.status) } : row);
      }
      saveRows();
      render();
    });
  });
}

function pill(value, cls = "") {
  return `<span class="draft-pill ${escapeHTML(cls)}">${escapeHTML(value || "-")}</span>`;
}

function nextStatus(status) {
  if (status === "Candidate") return "Approved";
  if (status === "Approved") return "Implemented";
  if (status === "Implemented") return "Watch";
  return "Candidate";
}

function render() {
  renderTabs();
  renderRows();
}

function wireForm() {
  $("main-portfolio-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const symbol = /** @type {HTMLInputElement} */($("mp-symbol")).value.trim().toUpperCase();
    if (!symbol) return;
    const row = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      symbol,
      company: /** @type {HTMLInputElement} */($("mp-company")).value.trim(),
      side: /** @type {HTMLSelectElement} */($("mp-side")).value,
      weight: /** @type {HTMLInputElement} */($("mp-weight")).value.trim(),
      status: /** @type {HTMLSelectElement} */($("mp-status")).value,
      source: /** @type {HTMLSelectElement} */($("mp-source")).value,
      venues: selectedVenues(),
      notes: /** @type {HTMLTextAreaElement} */($("mp-notes")).value.trim(),
      createdAt: new Date().toISOString(),
    };
    rows = [row, ...rows];
    saveRows();
    resetForm();
    render();
  });
}

mountBrainAuthGate({
  onAuthed: () => {
    loadRows();
    wireForm();
    render();
  },
});
