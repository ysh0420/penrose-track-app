// @ts-check
import { mountBrainAuthGate } from "./brain-client.js";
import {
  getResearchLog, getResearchSession, startResearchSession, getSynthesisForSymbol,
} from "./brain-queries.js";
import {
  verdictBadgeHTML, formatRelativeTime, renderMarkdown, escapeHTML,
  skeletonRowHTML,
} from "./brain-components.js";
import { showError } from "./brain-error.js";

const POLL_INTERVAL_MS = 5_000;
const POLL_MAX_MS = 180_000;

function openModal(title, bodyHTML) {
  document.getElementById("brain-modal-title").textContent = title;
  document.getElementById("brain-modal-body").innerHTML = bodyHTML;
  document.getElementById("brain-modal").classList.add("open");
}
function closeModal() {
  document.getElementById("brain-modal").classList.remove("open");
}

function firstValue(...values) {
  return values.find((value) => typeof value === "string" && value.trim() && value.trim() !== "?") ?? "";
}

function parseVerdict(md) {
  const match = String(md ?? "").match(/Synthesis \(verdict: ([^)]+)\)/i);
  return match?.[1] ?? "completed";
}

function parseConvictionRecommendation(md) {
  const match = String(md ?? "").match(/## Conviction recommendation\s+\*\*([^*]+)\*\*/i);
  return match?.[1] ?? null;
}

async function openSessionFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const sessionId = params.get("session");
  if (!sessionId) return;

  openModal("Research", `<div class="brain-empty">Loading session...</div>`);
  try {
    const payload = await getResearchSession(sessionId);
    const session = Array.isArray(payload) ? payload[0] : payload;
    if (!session?.content_md) {
      openModal("Research", `<div class="brain-empty">No synthesis text returned for this session.</div>`);
      return;
    }

    const prompts = session.prompts ?? {};
    const row = {
      symbol: session.symbol,
      company_name_jp: firstValue(prompts.name_jp, session.name_jp, prompts.name_en),
      company_name: firstValue(prompts.name_en, session.name_en),
      verdict: parseVerdict(session.content_md),
      conviction_recommendation: parseConvictionRecommendation(session.content_md),
      created_at: session.created_at,
      completed_at: session.updated_at,
    };
    const title = session.title ?? `${row.symbol ?? ""} ${row.company_name_jp ?? ""}`.trim();
    openModal(title, modalBodyHTML(row, session.content_md));
  } catch (e) {
    openModal("Research", `<div class="brain-error-state"><p>Failed to load session: ${escapeHTML(e.message)}</p></div>`);
  }
}

async function loadLog() {
  const el = document.getElementById("brain-research-log");
  el.innerHTML = `
    <table class="brain-table">
      <thead><tr><th>When</th><th>Symbol</th><th>Name</th><th>Verdict</th><th class="num">Cost</th><th class="num">Latency</th></tr></thead>
      <tbody>${Array.from({ length: 6 }).map(() => `<tr><td colspan="6">${skeletonRowHTML("100%")}</td></tr>`).join("")}</tbody>
    </table>
  `;

  let rows;
  try {
    rows = await getResearchLog(100, 0) ?? [];
  } catch (e) {
    showError({ container: el, message: `Research log load failed: ${e.message}`, onRetry: loadLog, error: e });
    return;
  }

  if (!Array.isArray(rows) || rows.length === 0) {
    el.innerHTML = `<div class="brain-empty">No past sessions</div>`;
    return;
  }

  el.innerHTML = `
    <table class="brain-table">
      <thead>
        <tr>
          <th>When</th>
          <th>Symbol</th>
          <th>Name</th>
          <th>Verdict</th>
          <th class="num">Cost</th>
          <th class="num">Latency</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map((r, i) => {
          const cost = r.cost_usd != null ? `$${Number(r.cost_usd).toFixed(3)}` : "—";
          const latency = r.latency_ms != null ? `${(Number(r.latency_ms) / 1000).toFixed(1)}s` : "—";
          return `
            <tr class="clickable" data-row-index="${i}">
              <td>${formatRelativeTime(r.completed_at ?? r.created_at)}</td>
              <td><strong>${escapeHTML(r.symbol ?? "")}</strong></td>
              <td>${escapeHTML(r.company_name_jp ?? r.company_name ?? "")}</td>
              <td>${verdictBadgeHTML(r.verdict)}</td>
              <td class="num">${cost}</td>
              <td class="num">${latency}</td>
            </tr>
          `;
        }).join("")}
      </tbody>
    </table>
  `;

  el.querySelectorAll("tr.clickable").forEach((tr) => {
    tr.addEventListener("click", () => {
      const idx = Number(/** @type {HTMLElement} */(tr).dataset.rowIndex);
      const row = rows[idx];
      if (!row) return;
      openSessionModal(row);
    });
  });
}

async function openSessionModal(row) {
  const title = `${row.symbol ?? ""} ${row.company_name_jp ?? row.company_name ?? ""} — ${row.fiscal_period ?? ""}`.trim();
  // Some fn_get_research_log shapes return synthesis_md inline; others
  // only return metadata and require a follow-up fetch. Render
  // whatever we have first, then top up if needed.
  if (row.synthesis_md) {
    openModal(title, modalBodyHTML(row, row.synthesis_md));
    return;
  }
  openModal(title, `<div class="brain-empty">Loading synthesis…</div>`);
  try {
    const s = await getSynthesisForSymbol(row.symbol);
    const synth = Array.isArray(s) ? s[0] : s;
    if (!synth?.synthesis_md) {
      openModal(title, modalBodyHTML(row, "_No synthesis text returned._"));
      return;
    }
    openModal(title, modalBodyHTML({ ...row, ...synth }, synth.synthesis_md));
  } catch (e) {
    openModal(title, `<div class="brain-error-state"><p>Failed to load synthesis: ${escapeHTML(e.message)}</p></div>`);
  }
}

function modalBodyHTML(row, md) {
  const cost = row.cost_usd != null ? `$${Number(row.cost_usd).toFixed(3)}` : "—";
  return `
    <div class="brain-synthesis-meta">
      ${verdictBadgeHTML(row.verdict)}
      &nbsp;· Conviction rec: ${escapeHTML(row.conviction_recommendation ?? "—")}
      &nbsp;· Cost: ${cost}
      &nbsp;· Run ${formatRelativeTime(row.completed_at ?? row.created_at)}
    </div>
    <div class="brain-synthesis-md expanded" style="max-height:none">${renderMarkdown(md)}</div>
  `;
}

function wireModalClose() {
  document.getElementById("brain-modal-close").addEventListener("click", closeModal);
  document.getElementById("brain-modal").addEventListener("click", (e) => {
    if (e.target === e.currentTarget) closeModal();
  });
}

function wireNewResearch() {
  const form = document.getElementById("brain-new-research");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const symbolInput = /** @type {HTMLInputElement} */(document.getElementById("brain-new-symbol"));
    const tierSelect = /** @type {HTMLSelectElement} */(document.getElementById("brain-new-tier"));
    const symbol = symbolInput.value.trim();
    const tier = parseInt(tierSelect.value, 10);
    if (!symbol) return;

    openModal(`${symbol} — running…`, `<div class="brain-empty">Starting session…</div>`);

    let sessionId;
    try {
      const res = await startResearchSession(symbol, tier, false);
      sessionId = res?.session_id ?? (Array.isArray(res) ? res[0]?.session_id : null);
      if (!sessionId) throw new Error("No session_id returned");
    } catch (err) {
      openModal(`${symbol} — failed`, `<div class="brain-error-state"><p>Failed to start session: ${escapeHTML(err.message)}</p></div>`);
      return;
    }

    pollAndShow(symbol, sessionId, tier);
  });
}

function pollAndShow(symbol, sessionId, tier) {
  const startTs = Date.now();
  document.getElementById("brain-modal-body").innerHTML =
    `<div class="brain-empty">Running cross-validation… <span id="brain-poll-elapsed">0s</span></div>
     <div class="brain-synthesis-meta">session: <code>${escapeHTML(sessionId)}</code> · tier ${tier}</div>`;

  const timer = setInterval(async () => {
    const elapsed = Math.floor((Date.now() - startTs) / 1000);
    const elapsedEl = document.getElementById("brain-poll-elapsed");
    if (elapsedEl) elapsedEl.textContent = `${elapsed}s`;

    if (Date.now() - startTs > POLL_MAX_MS) {
      clearInterval(timer);
      document.getElementById("brain-modal-body").innerHTML =
        `<div class="brain-error-state"><p>Timed out after 3 minutes. Refresh the log to check status — the session may still be running.</p></div>`;
      loadLog();
      return;
    }

    try {
      const s = await getSynthesisForSymbol(symbol);
      const synth = Array.isArray(s) ? s[0] : s;
      if (synth?.completed_at && new Date(synth.completed_at).getTime() > startTs) {
        clearInterval(timer);
        document.getElementById("brain-modal-title").textContent =
          `${symbol} ${synth.company_name_jp ?? ""} — ${synth.fiscal_period ?? ""}`.trim();
        document.getElementById("brain-modal-body").innerHTML =
          modalBodyHTML(synth, synth.synthesis_md ?? "");
        loadLog();
      }
    } catch (e) {
      console.warn("[brain-research-log] poll error:", e);
    }
  }, POLL_INTERVAL_MS);
}

mountBrainAuthGate({
  onAuthed: () => {
    wireModalClose();
    wireNewResearch();
    loadLog();
    openSessionFromUrl();
  },
});
