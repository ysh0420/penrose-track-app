// @ts-check
import { mountBrainAuthGate } from "./brain-client.js";

mountBrainAuthGate({
  onAuthed: () => {
    const count = document.getElementById("brain-portfolio-count");
    const grid = document.getElementById("brain-portfolio-grid");
    if (count) count.textContent = "0 ideas";
    if (grid) {
      grid.innerHTML = `
        <div class="brain-empty">
          No Yuki Book positions yet.
          <div style="margin-top:.7rem">
            <a class="platform-button" href="/master-portfolio.html">Open Main Portfolio</a>
          </div>
        </div>
      `;
    }
  },
});
