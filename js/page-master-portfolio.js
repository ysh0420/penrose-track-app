// @ts-check
import { mountBrainAuthGate } from "./brain-client.js";
import { escapeHTML } from "./brain-components.js";

const STORAGE_KEY = "penrose.mainPortfolioDraft.v1";
const EVIDENCE_DB_NAME = "penrose-main-portfolio-evidence";
const EVIDENCE_DB_VERSION = 1;
const EVIDENCE_STORE = "files";
const TABS = ["All", "MW", "Citadel", "CFM", "Long Only"];
const EVIDENCE_SUBPORTFOLIOS = ["MW", "Citadel", "CFM"];
let activeTab = "All";
let rows = [];
let evidenceRows = [];
let evidenceDbPromise = null;
let evidenceObjectUrls = [];

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

function selectedSubportfolios() {
  return [...document.querySelectorAll('input[name="mp-venue"]:checked')]
    .map((input) => /** @type {HTMLInputElement} */(input).value);
}

function resetForm() {
  /** @type {HTMLFormElement} */($("main-portfolio-form")).reset();
  /** @type {HTMLSelectElement} */($("mp-side")).value = "Long";
  /** @type {HTMLSelectElement} */($("mp-status")).value = "Candidate";
  /** @type {HTMLSelectElement} */($("mp-source")).value = "Manual";
}

function rowSubportfolios(row) {
  const routed = Array.isArray(row.subportfolios)
    ? row.subportfolios
    : Array.isArray(row.venues)
      ? row.venues
      : [];
  const unique = new Set(routed);
  if (row.side === "Long") unique.add("Long Only");
  return [...unique];
}

function rowMatchesTab(row) {
  if (activeTab === "All") return true;
  return rowSubportfolios(row).includes(activeTab);
}

function tabCount(tab) {
  if (tab === "All") return rows.length;
  return rows.filter((row) => rowSubportfolios(row).includes(tab)).length;
}

function renderTabs() {
  $("mp-account-tabs").innerHTML = TABS.map((tab) => {
    const count = tabCount(tab);
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
    const label = activeTab === "All" ? "No Main Portfolio draft rows yet." : `No ${activeTab} subportfolio rows yet.`;
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
            <th>Subportfolios</th>
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
              <td>${rowSubportfolios(row).map((venue) => pill(venue)).join("") || "-"}</td>
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

function openEvidenceDb() {
  if (!("indexedDB" in window)) {
    return Promise.reject(new Error("IndexedDB is not available in this browser."));
  }
  if (evidenceDbPromise) return evidenceDbPromise;
  evidenceDbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(EVIDENCE_DB_NAME, EVIDENCE_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(EVIDENCE_STORE)) {
        db.createObjectStore(EVIDENCE_STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Failed to open evidence storage."));
  });
  return evidenceDbPromise;
}

function evidenceTx(mode, callback) {
  return openEvidenceDb().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(EVIDENCE_STORE, mode);
    const store = tx.objectStore(EVIDENCE_STORE);
    const request = callback(store);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Evidence storage request failed."));
  }));
}

async function loadEvidence() {
  evidenceRows = /** @type {Array<any>} */(await evidenceTx("readonly", (store) => store.getAll()));
  evidenceRows.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
}

async function saveEvidenceFile(subportfolio, file) {
  const record = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    subportfolio,
    name: file.name || `${subportfolio}-screenshot.png`,
    type: file.type || "application/octet-stream",
    size: file.size || 0,
    createdAt: new Date().toISOString(),
    file,
  };
  await evidenceTx("readwrite", (store) => store.put(record));
}

async function deleteEvidenceFile(id) {
  await evidenceTx("readwrite", (store) => store.delete(id));
}

function formatFileSize(size) {
  const n = Number(size || 0);
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  if (n >= 1024) return `${Math.round(n / 1024)} KB`;
  return `${n} B`;
}

function formatEvidenceDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function resetEvidenceObjectUrls() {
  evidenceObjectUrls.forEach((url) => URL.revokeObjectURL(url));
  evidenceObjectUrls = [];
}

function evidenceUrl(record) {
  const url = URL.createObjectURL(record.file);
  evidenceObjectUrls.push(url);
  return url;
}

function renderEvidenceItem(record) {
  const url = evidenceUrl(record);
  const isImage = String(record.type || "").startsWith("image/");
  return `
    <div class="evidence-row">
      ${isImage
        ? `<img class="evidence-thumb" src="${escapeHTML(url)}" alt="">`
        : `<div class="evidence-thumb">${escapeHTML((record.name || "file").split(".").pop() || "file")}</div>`}
      <div>
        <div class="evidence-name" title="${escapeHTML(record.name || "")}">${escapeHTML(record.name || "Untitled file")}</div>
        <div class="evidence-meta">${escapeHTML(formatFileSize(record.size))} · ${escapeHTML(formatEvidenceDate(record.createdAt))}</div>
      </div>
      <div class="evidence-actions">
        <a href="${escapeHTML(url)}" target="_blank" rel="noopener">Open</a>
        <button type="button" data-evidence-delete="${escapeHTML(record.id)}">Delete</button>
      </div>
    </div>
  `;
}

function renderEvidenceCard(subportfolio) {
  const items = evidenceRows.filter((row) => row.subportfolio === subportfolio);
  return `
    <div class="evidence-card">
      <div class="evidence-head">
        <h3>${escapeHTML(subportfolio)}</h3>
        <span class="evidence-count">${items.length} files</span>
      </div>
      <input class="evidence-input" id="mp-evidence-${escapeHTML(subportfolio)}" data-evidence-input="${escapeHTML(subportfolio)}" type="file" multiple accept="image/*,.pdf,.csv,.xlsx,.xls,.txt,.md">
      <label class="evidence-drop" for="mp-evidence-${escapeHTML(subportfolio)}" tabindex="0" data-evidence-drop="${escapeHTML(subportfolio)}">
        Drop files here, click to add, or focus and paste a screenshot.
      </label>
      <div class="evidence-list">
        ${items.length ? items.map(renderEvidenceItem).join("") : `<div class="account-empty">No ${escapeHTML(subportfolio)} files yet.</div>`}
      </div>
    </div>
  `;
}

function renderEvidence() {
  const root = $("mp-evidence-root");
  if (!root) return;
  resetEvidenceObjectUrls();
  root.innerHTML = `<div class="evidence-grid">${EVIDENCE_SUBPORTFOLIOS.map(renderEvidenceCard).join("")}</div>`;
  wireEvidence();
}

async function handleEvidenceFiles(subportfolio, fileList) {
  const files = [...(fileList || [])].filter(Boolean);
  if (!files.length) return;
  await Promise.all(files.map((file) => saveEvidenceFile(subportfolio, file)));
  await loadEvidence();
  renderEvidence();
}

function clipboardFiles(event) {
  const items = [...(event.clipboardData?.items || [])];
  return items
    .filter((item) => item.kind === "file")
    .map((item) => item.getAsFile())
    .filter(Boolean);
}

function wireEvidence() {
  const root = $("mp-evidence-root");
  if (!root) return;
  root.querySelectorAll("[data-evidence-input]").forEach((input) => {
    input.addEventListener("change", async () => {
      const el = /** @type {HTMLInputElement} */(input);
      await handleEvidenceFiles(el.dataset.evidenceInput || "MW", el.files);
      el.value = "";
    });
  });
  root.querySelectorAll("[data-evidence-drop]").forEach((drop) => {
    const subportfolio = /** @type {HTMLElement} */(drop).dataset.evidenceDrop || "MW";
    drop.addEventListener("dragover", (event) => {
      event.preventDefault();
      drop.classList.add("dragging");
    });
    drop.addEventListener("dragleave", () => drop.classList.remove("dragging"));
    drop.addEventListener("drop", async (event) => {
      event.preventDefault();
      drop.classList.remove("dragging");
      await handleEvidenceFiles(subportfolio, event.dataTransfer?.files);
    });
    drop.addEventListener("paste", async (event) => {
      const files = clipboardFiles(/** @type {ClipboardEvent} */(event));
      if (!files.length) return;
      event.preventDefault();
      await handleEvidenceFiles(subportfolio, /** @type {any} */(files));
    });
    drop.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      /** @type {HTMLLabelElement} */(drop).click();
    });
  });
  root.querySelectorAll("[data-evidence-delete]").forEach((button) => {
    button.addEventListener("click", async () => {
      const id = /** @type {HTMLElement} */(button).dataset.evidenceDelete;
      if (!id) return;
      await deleteEvidenceFile(id);
      await loadEvidence();
      renderEvidence();
    });
  });
}

function wireForm() {
  $("main-portfolio-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const symbol = /** @type {HTMLInputElement} */($("mp-symbol")).value.trim().toUpperCase();
    if (!symbol) return;
    const routedSubportfolios = selectedSubportfolios();
    const row = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      symbol,
      company: /** @type {HTMLInputElement} */($("mp-company")).value.trim(),
      side: /** @type {HTMLSelectElement} */($("mp-side")).value,
      weight: /** @type {HTMLInputElement} */($("mp-weight")).value.trim(),
      status: /** @type {HTMLSelectElement} */($("mp-status")).value,
      source: /** @type {HTMLSelectElement} */($("mp-source")).value,
      subportfolios: routedSubportfolios,
      venues: routedSubportfolios,
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
  onAuthed: async () => {
    loadRows();
    wireForm();
    render();
    try {
      await loadEvidence();
      renderEvidence();
    } catch (error) {
      const root = $("mp-evidence-root");
      if (root) root.innerHTML = `<div class="account-empty">File intake is unavailable in this browser: ${escapeHTML(error?.message || error)}</div>`;
    }
  },
});
