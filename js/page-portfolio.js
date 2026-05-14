// @ts-check
import { mountBrainAuthGate } from "./brain-client.js";

mountBrainAuthGate({
  onAuthed: () => {
    const count = document.getElementById("brain-portfolio-count");
    const grid = document.getElementById("brain-portfolio-grid");
    if (count) count.textContent = "0 rows";
    if (grid) {
      grid.innerHTML = `
        <div class="brain-empty">
          Main Portfolio and Yuki Book are now the same source book.
          <div style="margin-top:.7rem">
            <a class="platform-button" href="/master-portfolio.html">Open Main Portfolio</a>
          </div>
        </div>
      `;
    }
  },
});
