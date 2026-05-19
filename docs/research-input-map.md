# Research Input Map

This map defines the role of each Penrose Track surface after retiring the
legacy `Brain > Signals` page.

## Page Ownership

| Surface | Role | Standard |
| --- | --- | --- |
| `brain-review.html` | Raw daily Brain signals and disclosure review inbox | Show Brain daily dump runs, source health, signal candidates, filings, market movers, and collector notes. Nothing here is a portfolio decision. |
| `ideas.html` | Triaged candidate inbox | Names have moved past raw Brain Review, but are not yet accepted Portfolio decisions. |
| `reports.html` | Final reviewed research reports | Show reviewed, DB-backed reports. Do not reintroduce static internal report bodies as public content. |
| `agent-intake.html` | Raw Source Runs intake | Show raw AI, Koyfin, news, market-data, and compiler queue outputs before report promotion. |
| `research-log.html` | Source Runs and evidence audit trail | Keep provider outputs, source-run metadata, and evidence lineage separate from the Reports shelf. |
| `master-portfolio.html` | Accepted decisions and active holdings source book | Portfolio state begins here after an idea has passed review. Subportfolios are generated from this source book. |
| `pipeline.html` | Retired redirect | Keep `/pipeline` and `/pipeline.html` redirecting to Brain Review for old links only. |

## Boundary Rules

- Brain Review is the raw daily signal layer.
- Ideas is the candidate layer after triage.
- Reports is the final reviewed research shelf.
- Agent Intake and Research Log are raw Source Runs and evidence.
- Portfolio is accepted decisions and active holdings.

## Validation

- `platform-nav.js` must not include a `Signals` or `pipeline` nav item.
- `ideas.html` must link the inbox to `/brain-review.html`.
- `pipeline.html` must redirect to `/brain-review.html`.
- No HTML file should reference `page-pipeline.js`.
- Static report leakage checks must continue to pass.
