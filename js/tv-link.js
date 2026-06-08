// @ts-check
// Shared one-click TradingView (Tokyo) link helper — track-app internal use only.
// Confirmed-live format is hyphen-separated TSE-{symbol}:
//   8035 -> https://www.tradingview.com/symbols/TSE-8035/
// Works for alphanumeric codes too (135A -> TSE-135A). Used by the Technicals
// Screener, Books (LS/LO), and the Brain Dashboard per-symbol rows.

export const tradingViewUrl = (symbol) =>
  `https://www.tradingview.com/symbols/TSE-${encodeURIComponent(String(symbol))}/`;

/**
 * Returns an <a> HTML string for a discreet TradingView link, or "" for an
 * empty/missing symbol. Pass the page's HTML-escaper as `esc`.
 */
export function tvLinkHtml(symbol, esc = (s) => String(s ?? "")) {
  const sym = String(symbol ?? "").trim();
  if (!sym) return "";
  return `<a class="tv-link" href="${esc(tradingViewUrl(sym))}" target="_blank" rel="noopener noreferrer" title="Open ${esc(sym)} on TradingView">TV ↗</a>`;
}
