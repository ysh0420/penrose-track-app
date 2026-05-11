// @ts-check
import { mountBrainAuthGate } from "./brain-client.js";
import { getLatestNewsBrief } from "./brain-queries.js";
import { escapeHTML, renderMarkdown, skeletonRowHTML } from "./brain-components.js";
import { showError } from "./brain-error.js";

function fmtDate(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function unique(values) {
  return [...new Set((values ?? []).filter(Boolean))];
}

function impactClass(item) {
  const v = String(item?.impact_direction ?? item?.sentiment ?? "").toLowerCase();
  if (v === "positive") return "news-positive";
  if (v === "negative") return "news-negative";
  if (v === "mixed") return "news-mixed";
  return "";
}

function metricHTML(label, value) {
  return `<div class="news-metric"><div class="label">${escapeHTML(label)}</div><div class="value">${escapeHTML(value)}</div></div>`;
}

function renderItem(item) {
  const title = item.title_ja || item.title || "";
  const href = item.url ? ` href="${escapeHTML(item.url)}" target="_blank" rel="noopener"` : "";
  const symbols = unique(item.symbols).map((s) => `<span class="news-chip">${escapeHTML(s)}</span>`).join("");
  const themes = unique(item.themes).slice(0, 4).map((t) => `<span class="news-chip">${escapeHTML(t)}</span>`).join("");
  const impact = item.is_market_moving
    ? `<span class="${impactClass(item)}">${escapeHTML(item.impact_direction ?? "market-moving")}</span>`
    : escapeHTML(item.impact_direction ?? "neutral");

  return `
    <div class="news-item">
      <div class="news-meta">${escapeHTML(item.source_name ?? item.source_code ?? "")} · ${fmtDate(item.published_at ?? item.fetched_at)} · ${impact}</div>
      <div>${item.url ? `<a${href}>${escapeHTML(title)}</a>` : escapeHTML(title)}</div>
      <div>${symbols}${themes}</div>
    </div>
  `;
}

function loading() {
  document.getElementById("news-summary").innerHTML = Array.from({ length: 4 })
    .map(() => `<div class="news-metric">${skeletonRowHTML("70%")}<br><br>${skeletonRowHTML("45%")}</div>`)
    .join("");
  document.getElementById("news-brief").innerHTML = `<div class="brain-empty">Loading...</div>`;
  document.getElementById("news-items").innerHTML = `<div class="brain-empty">Loading...</div>`;
}

async function loadNews() {
  const summaryEl = document.getElementById("news-summary");
  const briefEl = document.getElementById("news-brief");
  const itemsEl = document.getElementById("news-items");
  const subtitleEl = document.getElementById("news-subtitle");

  loading();
  let payload;
  try {
    payload = await getLatestNewsBrief(7);
  } catch (e) {
    showError({ container: briefEl, message: `News brief load failed: ${e.message}`, onRetry: loadNews, error: e });
    itemsEl.innerHTML = "";
    summaryEl.innerHTML = "";
    return;
  }

  const brief = payload?.brief ?? null;
  const items = Array.isArray(payload?.recent_items) ? payload.recent_items : [];
  const marketMoving = items.filter((i) => i.is_market_moving).length;
  const sourceCount = unique(items.map((i) => i.source_code)).length;
  const symbolCount = unique(items.flatMap((i) => i.symbols ?? [])).length;

  subtitleEl.textContent = brief
    ? `${brief.title ?? "Penrose News Brief"} · generated ${fmtDate(brief.generated_at)}`
    : "No brief has been generated yet";

  summaryEl.innerHTML = [
    metricHTML("Brief date", brief?.brief_date ?? "-"),
    metricHTML("Items", String(brief?.item_count ?? items.length)),
    metricHTML("Market-moving", String(brief?.market_moving_count ?? marketMoving)),
    metricHTML("Sources / Symbols", `${sourceCount} / ${symbolCount}`),
  ].join("");

  briefEl.innerHTML = brief?.content_md_ja
    ? `<div class="news-brief-md">${renderMarkdown(brief.content_md_ja)}</div>`
    : `<div class="brain-empty">No Japanese brief available yet</div>`;

  const ranked = [...items].sort((a, b) => {
    if (Number(b.is_market_moving) !== Number(a.is_market_moving)) return Number(b.is_market_moving) - Number(a.is_market_moving);
    return new Date(b.published_at ?? b.fetched_at ?? 0).getTime() - new Date(a.published_at ?? a.fetched_at ?? 0).getTime();
  });
  itemsEl.innerHTML = ranked.length
    ? `<div class="news-items">${ranked.slice(0, 80).map(renderItem).join("")}</div>`
    : `<div class="brain-empty">No recent news items</div>`;
}

mountBrainAuthGate({
  onAuthed: () => {
    document.getElementById("news-refresh").addEventListener("click", loadNews);
    loadNews();
  },
});
