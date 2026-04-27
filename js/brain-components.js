// @ts-check
// Pure functions returning HTML strings. Each new Brain page composes
// these fragments and writes them into a container with .innerHTML so
// the rest of the codebase stays in plain ES modules with no runtime.

/** ★★★★☆ visual for conviction score 1-5. */
export function convictionStarsHTML(score) {
  const filled = Math.max(0, Math.min(5, score ?? 0));
  const empty = 5 - filled;
  return `<span class="brain-stars" title="Conviction ${filled}/5">${"★".repeat(filled)}<span class="brain-stars-empty">${"☆".repeat(empty)}</span></span>`;
}

/** Direction badge: long (green) / short (red). */
export function directionBadgeHTML(direction) {
  const cls = direction === "short" ? "brain-badge brain-badge-short" : "brain-badge brain-badge-long";
  const label = direction === "short" ? "SHORT" : "LONG";
  return `<span class="${cls}">${label}</span>`;
}

/** Verdict badge: confirmed / flagged_for_review / rejected / failed / null. */
export function verdictBadgeHTML(verdict) {
  if (!verdict) return `<span class="brain-badge brain-badge-pending">pending</span>`;
  const map = {
    confirmed: { cls: "brain-badge-confirmed", label: "Confirmed", title: "" },
    flagged_for_review: { cls: "brain-badge-flagged", label: "Flagged", title: "Re-examine before sizing" },
    rejected: { cls: "brain-badge-rejected", label: "Rejected", title: "Consider exit" },
    failed: { cls: "brain-badge-failed", label: "Failed", title: "" },
  };
  const m = map[verdict] ?? { cls: "brain-badge-pending", label: verdict, title: "" };
  const titleAttr = m.title ? ` title="${escapeHTML(m.title)}"` : "";
  return `<span class="brain-badge ${m.cls}"${titleAttr}>${m.label}</span>`;
}

/** RSI badge with color-coded threshold (< 30 oversold, > 70 overbought). */
export function rsiBadgeHTML(rsi) {
  if (rsi == null) return `<span class="brain-rsi brain-rsi-neutral">RSI —</span>`;
  let cls = "brain-rsi-neutral";
  if (rsi < 30) cls = "brain-rsi-oversold";
  else if (rsi > 70) cls = "brain-rsi-overbought";
  return `<span class="brain-rsi ${cls}">RSI ${rsi.toFixed(1)}</span>`;
}

/** Theme chips list. */
export function themeChipsHTML(themes) {
  if (!themes || !Array.isArray(themes) || themes.length === 0) return "";
  return themes
    .map((t) => `<span class="brain-chip" title="theme">${escapeHTML(t)}</span>`)
    .join("");
}

/** Skeleton placeholder used during data loading. */
export function skeletonRowHTML(width = "100%") {
  return `<div class="brain-skeleton" style="width:${width}"></div>`;
}

/** Empty state with optional message. */
export function emptyStateHTML(message = "No data") {
  return `<div class="brain-empty">${escapeHTML(message)}</div>`;
}

/** Format JPY billion (e.g. 738.48 → "¥738B"). */
export function formatMcap(billion) {
  if (billion == null) return "—";
  if (billion >= 1000) return `¥${(billion / 1000).toFixed(2)}T`;
  return `¥${billion.toFixed(0)}B`;
}

/** Format percentage with sign and 1 decimal. */
export function formatPct(value) {
  if (value == null) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

/** Format yen amount. */
export function formatYen(value) {
  if (value == null) return "—";
  return `¥${Math.round(value).toLocaleString()}`;
}

/** Relative time ("2h ago", "3d ago"). */
export function formatRelativeTime(isoString) {
  if (!isoString) return "—";
  const then = new Date(isoString).getTime();
  const now = Date.now();
  const sec = Math.floor((now - then) / 1000);
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}

/**
 * Minimal markdown rendering. Escapes HTML, then converts **bold**,
 * # / ## / ### headings, and newlines. The repo doesn't carry a
 * markdown library and Phase R synthesis output is plain enough that
 * this covers it.
 */
export function renderMarkdown(md) {
  return escapeHTML(md ?? "")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/\n/g, "<br>");
}

export function escapeHTML(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
