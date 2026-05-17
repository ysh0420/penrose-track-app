// @ts-check
import { mountBrainAuthGate } from "./brain-client.js";
import { getAgentResearchDashboard } from "./brain-queries.js";
import {
  escapeHTML,
  formatRelativeTime,
  renderMarkdown,
  skeletonRowHTML,
} from "./brain-components.js";
import { showError } from "./brain-error.js";

const $ = (id) => document.getElementById(id);

function number(value, digits = 0) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "0";
  return n.toLocaleString(undefined, {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
}

function money(value) {
  return `$${number(value, 2)}`;
}

function compactDate(value) {
  return value ? formatRelativeTime(value) : "-";
}

function statusClass(row) {
  if (row?.error_summary || row?.status === "failed") return "error";
  if (row?.promoted_to_synthesis || row?.status === "promoted") return "promoted";
  if (row?.status === "completed") return "queued";
  return "";
}

function pills(values) {
  const list = Array.isArray(values) ? values : [];
  return list.slice(0, 4).map((value) => `<span class="agent-pill">${escapeHTML(value)}</span>`).join("") || "-";
}

function renderMetrics(payload) {
  const counts = payload?.run_counts ?? {};
  const queue = payload?.queue ?? {};
  const cost = payload?.cost_summary ?? {};
  const syntheses = payload?.recent_syntheses ?? [];
  return `
    <div class="agent-grid">
      <div class="agent-metric">
        <div class="label">Compiler Queue</div>
        <div class="value">${number(queue.count ?? counts.compiler_queue_count)}</div>
        <div class="note">${number(counts.total_runs)} source runs in window</div>
      </div>
      <div class="agent-metric">
        <div class="label">Report Candidates</div>
        <div class="value">${number(syntheses.length)}</div>
        <div class="note">${number(counts.promoted_count)} promoted source runs</div>
      </div>
      <div class="agent-metric">
        <div class="label">Actual Cost</div>
        <div class="value">${money(cost.actual_cost_usd ?? counts.actual_cost_usd)}</div>
        <div class="note">${number(cost.total_calls)} ledger entries this month</div>
      </div>
      <div class="agent-metric">
        <div class="label">Credit Units</div>
        <div class="value">${number(cost.credit_units_used ?? counts.credit_units_used, 2)}</div>
        <div class="note">subscriptions separated from metered use</div>
      </div>
    </div>
  `;
}

function renderAgentTable(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return `<div class="platform-empty">No agent activity in this window.</div>`;
  }
  return `
    <table class="agent-table">
      <thead>
        <tr>
          <th>Agent</th>
          <th>Cost Mode</th>
          <th class="num">Runs</th>
          <th class="num">Queued</th>
          <th class="num">Promoted</th>
          <th class="num">Cost</th>
          <th class="num">Queries</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map((row) => `
          <tr>
            <td><strong>${escapeHTML(row.source_agent ?? row.agent_name ?? "-")}</strong></td>
            <td>${escapeHTML(row.subscription_or_credit ?? "-")}</td>
            <td class="num">${number(row.runs ?? row.calls)}</td>
            <td class="num">${number(row.queued)}</td>
            <td class="num">${number(row.promoted ?? row.promoted_count)}</td>
            <td class="num">${money(row.actual_cost_usd)}</td>
            <td class="num">${number(row.search_queries)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function renderRunsTable(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return `<div class="platform-empty">No recent source runs.</div>`;
  }
  return `
    <table class="agent-table">
      <thead>
        <tr>
          <th>When</th>
          <th>Source</th>
          <th>Topic</th>
          <th>Status</th>
          <th class="num">Sources</th>
          <th class="num">Quality</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map((row) => `
          <tr>
            <td>${compactDate(row.created_at ?? row.captured_at)}</td>
            <td><strong>${escapeHTML(row.source_agent ?? "-")}</strong><br><span class="platform-meta">${escapeHTML(row.model ?? row.provider ?? "")}</span></td>
            <td>${escapeHTML(row.topic_title ?? row.title ?? row.topic_key ?? "-")}<br><span class="platform-meta">${pills(row.themes)}</span></td>
            <td><span class="agent-status ${statusClass(row)}">${escapeHTML(row.status ?? "-")}</span></td>
            <td class="num">${number(row.source_count)}</td>
            <td class="num">${number(Number(row.quality_score ?? 0) * 100)}%</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function renderCandidates(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return `<div class="platform-empty">No Codex report candidates in this window.</div>`;
  }
  return rows.map((row, index) => `
    <div class="agent-candidate">
      <div class="agent-candidate-title">${escapeHTML(row.title ?? "Report candidate")}</div>
      <div class="agent-candidate-meta">
        ${escapeHTML(row.status ?? "-")} / ${escapeHTML((row.included_agents ?? []).join(", ") || "-")} / quality ${number(Number(row.quality_score ?? 0) * 100)}% / ${compactDate(row.created_at)}
      </div>
      <ul class="agent-findings">
        ${(row.key_findings ?? []).slice(0, 4).map((item) => `<li>${escapeHTML(item)}</li>`).join("")}
      </ul>
      <button class="platform-button" type="button" data-open-candidate="${index}">Open candidate</button>
    </div>
  `).join("");
}

function openModal(title, bodyHTML) {
  $("brain-modal-title").textContent = title;
  $("brain-modal-body").innerHTML = bodyHTML;
  $("brain-modal").classList.add("open");
}

function closeModal() {
  $("brain-modal").classList.remove("open");
}

function wireModalClose() {
  $("brain-modal-close").addEventListener("click", closeModal);
  $("brain-modal").addEventListener("click", (e) => {
    if (e.target === e.currentTarget) closeModal();
  });
}

function openCandidate(row) {
  const questions = (row.open_questions ?? []).map((item) => `<li>${escapeHTML(item)}</li>`).join("");
  openModal(row.title ?? "Report candidate", `
    <div class="brain-synthesis-meta">
      ${escapeHTML(row.status ?? "-")}
      &nbsp; / Agents: ${escapeHTML((row.included_agents ?? []).join(", ") || "-")}
      &nbsp; / Quality: ${number(Number(row.quality_score ?? 0) * 100)}%
    </div>
    ${questions ? `<h3>Open Questions</h3><ul class="agent-findings">${questions}</ul>` : ""}
    <div class="brain-synthesis-md expanded" style="max-height:none">${renderMarkdown(row.content_md ?? "_No content returned._")}</div>
  `);
}

async function loadDashboard() {
  const root = $("agent-root");
  root.innerHTML = `
    <div class="agent-grid">
      ${Array.from({ length: 4 }).map(() => `<div class="agent-metric">${skeletonRowHTML("80%")}</div>`).join("")}
    </div>
  `;

  let payload;
  try {
    payload = await getAgentResearchDashboard(30, 100);
  } catch (e) {
    showError({ container: root, message: `Agent intake load failed: ${e.message}`, onRetry: loadDashboard, error: e });
    return;
  }

  const runs = payload?.recent_runs ?? [];
  const syntheses = payload?.recent_syntheses ?? [];
  root.innerHTML = `
    ${renderMetrics(payload)}
    <div class="agent-layout">
      <div>
        <section class="agent-card">
          <h3>Agent Activity</h3>
          ${renderAgentTable(payload?.by_agent ?? payload?.cost_summary?.by_agent ?? [])}
        </section>
        <section class="agent-card">
          <h3>Recent Source Runs</h3>
          ${renderRunsTable(runs)}
        </section>
      </div>
      <section class="agent-card">
        <h3>Codex Candidates</h3>
        ${renderCandidates(syntheses)}
      </section>
    </div>
  `;

  root.querySelectorAll("[data-open-candidate]").forEach((button) => {
    button.addEventListener("click", () => {
      const index = Number(/** @type {HTMLElement} */(button).dataset.openCandidate);
      const row = syntheses[index];
      if (row) openCandidate(row);
    });
  });
}

mountBrainAuthGate({
  onAuthed: () => {
    wireModalClose();
    $("agent-refresh").addEventListener("click", loadDashboard);
    loadDashboard();
  },
});
