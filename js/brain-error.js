// @ts-check
// Centralised error rendering for Brain pages. Auth errors short-circuit
// to a "session expired" prompt that asks the user to reload — the
// full-page #brain-login gate (see brain-client.js) takes over from
// there. No prompt()-based fallback; the existing app's full-page auth
// pattern is the only sign-in surface.

import { escapeHTML } from "./brain-components.js";

export function showError({ container, message, onRetry, error }) {
  if (!container) return;

  if (error?.code === "BRAIN_NOT_AUTH" || error?.status === 401) {
    container.innerHTML = `
      <div class="brain-auth-prompt">
        <p>Brain session expired or missing. Reload the page to sign in again.</p>
        <button class="brain-retry-btn" type="button" id="brain-reload-btn">Reload</button>
      </div>
    `;
    const reload = container.querySelector("#brain-reload-btn");
    reload?.addEventListener("click", () => location.reload());
    return;
  }

  const retryBtn = onRetry ? `<button class="brain-retry-btn" type="button">Retry</button>` : "";
  container.innerHTML = `
    <div class="brain-error-state">
      <p>${escapeHTML(message)}</p>
      ${retryBtn}
    </div>
  `;
  if (onRetry) {
    container.querySelector(".brain-retry-btn")?.addEventListener("click", onRetry);
  }
}
