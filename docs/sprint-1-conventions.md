# Sprint 1 — Existing-app Conventions Audit

Captured before any Brain-integration code is written, per Sprint 1 spec
§1 / §17.1 ("Verify first") / §17.6 ("Read full file before edit").

The 5 flagged items the spec asked us to confirm — plus the
`get_intraday_alerts` probe and a handful of additional gotchas surfaced
during the read-through that materially affect §4–§12 of the spec.

---

## 1. Build setup — Static SPA, no build step

**Flagged item: Static SPA / React / Vite / Next?** → **Static SPA**, fully
hand-rolled, no build step.

- `vercel.json`: `framework: null`, `buildCommand: null`, `outputDirectory: null`,
  `cleanUrls: true`. Vercel just serves the repo root verbatim.
- No `package.json`. No `node_modules`. No bundler config.
- Each page is one self-contained `*.html` file with a `<style>` block at
  the top and either an inline `<script type="module">` (the live
  dashboard) or a plain inline `<script>` (the static reporting pages).
- ES module imports come from CDN: `import { createClient } from
  "https://esm.sh/@supabase/supabase-js@2";` — exactly what the spec's
  `brain-client.js` already does.
- Chart.js (used by `track-record.html` and `mw-tops-attribution.html`)
  loads from `cdn.jsdelivr.net`, not bundled.

Implication: the spec's `js/brain-client.js`, `js/brain-queries.js`,
`js/brain-components.js`, `js/page-*.js` ES module layout is **viable**
(static `<script type="module" src="…">` doesn't need a bundler), but it
**introduces a new file-organisation convention**. The rest of the repo
keeps every page's logic inlined. Sprint 1 spec §17.4 ("Simple consistent
design — extend existing app's chrome, don't introduce new design
language") is about visual chrome, not file layout, but flagging
explicitly so Yuki can redirect to inlined-per-page if preferred.

---

## 2. Env injection — None (creds hardcoded)

**Flagged item: window.\_\_ENV\_\_ / import.meta.env / /api/config / 他?**
→ **No env injection mechanism exists.** The Track Record Supabase URL
and publishable key are written inline as JS string literals in
`index.html`, lines 387–388:

```js
const SUPA_URL="https://prdjmipmkomhvokwrjid.supabase.co";
const SUPA_ANON="sb_publishable_uV1Dkr9lgu2PBdoeACBAyw_4V_rrWvH";
```

The Vercel env vars added in §0 (`SUPABASE_BRAIN_URL`,
`SUPABASE_BRAIN_ANON_KEY`, `EDGE_FN_BRAIN_QUERY_URL`) are **not consumed
by anything**. There is no Vercel Edge Middleware, no `/api/config`
endpoint, no build-time substitution, no `window.__ENV__` initialiser.

**Spec deviation.** The spec's `brain-client.js` reads
`window.__BRAIN_ENV__?.SUPABASE_BRAIN_URL` etc., expecting an injection
mechanism that doesn't exist.

Two paths to resolve:

- **A. Match existing convention (recommended):** hardcode Brain creds
  inline at the top of `brain-client.js`, same as Track Record does in
  `index.html`. The Brain anon key and URL are public-safe (anon key is
  already designed for browser exposure, RLS is the security boundary).
  Vercel env vars added in §0 become unused — flag for cleanup.
- **B. Introduce a new convention:** add a top-level `env.js` (or one
  per page) that sets `window.__BRAIN_ENV__ = {...}`, generated at deploy
  time by a Vercel build step or a static commit. More moving parts; the
  Track Record creds would also have to migrate for consistency, which
  expands Sprint scope.

Recommend A. Awaiting Yuki confirmation.

---

## 3. Auth pattern — `signInWithPassword` + `signInWithOtp`, full-page gate

**Flagged item: signInWithPassword / magic link / OAuth / 他?** →
**Both** signInWithPassword (primary) and signInWithOtp / magic link
(fallback button), implemented inline in `index.html`.

Pattern (extracted from `index.html` lines 401–421):

```js
async function init() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) showApp(session); else showLogin();
}
function showLogin() { $("login").style.display = "flex"; $("app").style.display = "none"; }
async function showApp(s) { $("login").style.display = "none"; $("app").style.display = "block"; ... }

// On click:
const { data, error } = await supabase.auth.signInWithPassword({ email, password });
// or:
const { error } = await supabase.auth.signInWithOtp({ email });
// Sign out:
await supabase.auth.signOut();
```

The login UI is a full-page `.login-card` shown when no session exists,
swapped with `#app` once authed. No modal, no inline prompt.

**Spec deviation.** The spec's `brain-error.js` exposes `promptSignIn()`
using `window.prompt()` for MVP. That clashes with the existing
full-page login pattern. Sprint 1 spec §13 explicitly says "replace
`promptSignIn` with the app's existing auth UI pattern if one exists".
We have one, so we should use it: each Brain page renders its own
`#brain-login` / `#brain-app` toggle modeled after `index.html`.

Two-session model is unavoidable: Track Record uses Supabase project
`prdjmipmkomhvokwrjid`; Brain uses `jviciwafctmmixgjszam`. Different JWTs,
different storage keys (`brain-auth` for Brain, default for Track Record,
both already isolated by spec's `storageKey: "brain-auth"`). Yuki signs
in to each project independently.

---

## 4. Top nav location — three different patterns, no shared nav

**Flagged item: Top nav location / class name?** → **Three different
patterns** across the four existing pages; no unified cross-page nav.

| Page | `.topbar` content | `.nav-links` block? | Cross-page links |
|---|---|---|---|
| `index.html` (live dashboard) | title + action `<a>`s (Refresh, Run Enrichment, Sign out, user-email span) | No | **None** |
| `track-record.html` (static report) | title + as-of date | No | **None** |
| `mw-tops-attribution.html` (static report) | title + as-of date | Yes (lines 23–26 CSS, line 63 markup) | 3 links: `/track-record.html`, `/mw-tops-attribution.html`, `/mw-tops-transactions.html` |
| `mw-tops-transactions.html` (static report) | title + as-of date | Yes (lines 20–23 CSS, line 58 markup) | Same 3 links |

`index.html`'s `.topbar` only holds *action* anchors (Refresh, Run
Enrichment, Sign out), not page-navigation links. There is no link
*from* `index.html` to any other page or *to* `index.html` from any
static page.

`.nav-links` CSS, in case we extend it:

```css
.nav-links { display: flex; gap: 1rem; flex-wrap: wrap; margin-bottom: 1.5rem; font-size: 10pt; }
.nav-links a { color: var(--navy); text-decoration: none; padding: .4rem .8rem; border: 1px solid var(--line); background: white; border-radius: 3px; }
.nav-links a:hover { background: var(--cream); border-color: var(--gold); }
.nav-links a.active { background: var(--navy); color: white; border-color: var(--navy); }
```

**Spec deviation.** The spec said "modify `index.html` (or whichever has
the top nav): add 4 new nav links". There is no top nav in
`index.html`, and the existing cross-page nav lives only on the
mw-tops-* static pages. Three options:

- **A. Add the 4 Brain links to `index.html`'s `.topbar-actions`.** Feels
  cramped (already 3 action anchors there) and conflates page-nav with
  action buttons.
- **B. Add a `.nav-links` block to `index.html`** below the topbar,
  containing Dashboard / Track Record / Attribution / Transactions /
  Portfolio / Stock / Pipeline / Research. Mirror it across the static
  pages. Touches all four existing files, but produces a coherent app.
- **C. Brain pages standalone, no inbound links from existing pages.**
  Only Brain pages link to each other; users reach `/portfolio.html`
  via direct URL. Lowest blast radius but not really "integrated".

Recommend B (full nav-links across all pages). Awaiting Yuki call.

---

## 5. Existing CSS tokens — TWO conventions in the same repo

**Flagged item: CSS custom-property names?** → **Two prefixes co-exist.**

| Tokens | Used by |
|---|---|
| `--penrose-navy`, `--penrose-gold`, `--penrose-cream`, `--penrose-sumi`, `--penrose-line`, `--penrose-muted`, `--green`, `--red`, `--amber` | `index.html` only |
| `--navy`, `--gold`, `--cream`, `--sumi`, `--line`, `--muted`, `--green`, `--red` (+ `--alert`, `--alert-border` in attribution) | `track-record.html`, `mw-tops-attribution.html`, `mw-tops-transactions.html` |

The hex values are identical — only the names differ. No CSS file
exists; every page defines its own `:root` block inside `<style>`.

**Spec deviation.** The spec's `brain-pages.css` references
`var(--navy, #1a2744)` and `var(--gold, #c9a84c)`. That works on the
static pages but fails to inherit the right token on a Brain page that
might want to share styles with `index.html`. Two paths:

- **A. Brain pages use `--navy` / `--gold`** and define their own
  `:root` block (matches the static-pages convention; Brain pages are
  spiritually static-reporting pages with live data, not the
  trading-action dashboard `index.html` is). `brain-pages.css` works
  unchanged. Cleanest.
- **B. Use double-fallback:** `var(--navy, var(--penrose-navy, #1a2744))`.
  Works on every page; uglier; meaningful only if Brain pages embed
  inside `index.html`, which we are not doing.

Recommend A. The Brain pages' `:root` definition will match
`track-record.html` exactly:

```css
:root { --navy: #1a2744; --gold: #c9a84c; --cream: #f7f5f0; --sumi: #2a2a2a;
        --line: #e0d8c4; --muted: #8b8680; --green: #2e7d32; --red: #b71c1c; }
```

Plus the additive Brain-only tokens the spec defines (`--brain-emerald`,
`--brain-rose`, etc.).

Also: spec's `brain-pages.css` is itself a deviation from the
"all-styles-inlined-per-page" pattern. If we ship `brain-pages.css` as
a real file, it's the first external CSS file in the repo. Acceptable
because four new pages would otherwise duplicate ~150 lines of CSS each
— but flagging.

---

## 6. `get_intraday_alerts(NULL::timestamptz)` probe

Spec asked us to confirm the function accepts `NULL` as `p_since`.
Confirmed — but the **return shape is not what the spec assumed**.

Probe (run via Supabase MCP against project `jviciwafctmmixgjszam`):

```sql
SELECT * FROM get_intraday_alerts(NULL::timestamptz) LIMIT 3;
```

Returns **a single row whose only column is a jsonb object**:

```json
{
  "since":         "2026-04-27T02:52:36.548384+00:00",
  "alert_type":    "intraday",
  "generated_at":  "2026-04-27T10:52:36.548384+00:00",
  "has_actionable": true,
  "hot_signals":           { "jsonb_agg": null },
  "new_tier1_filings":     { "jsonb_agg": null },
  "fact_check_completions":{ "jsonb_agg": [
    { "source_count": 11,
      "subject_label": "Research session — 4042 東ソー (Tier 2, 2026-04-27)",
      "subject_symbol": "4042",
      "confirmed_count": 0,
      "latest_check_at": "2026-04-27T05:41:42.338849+00:00",
      "sources_queried": ["claude", "grok", "perplexity"],
      "consensus_verdict": "split_disagreement",
      "contradicted_count": 0 } ] }
}
```

The `NULL` default looks like ~8h ago (since `2026-04-27T02:52:36` was
returned at `10:52:36`), not the "last 24h" the spec mentioned. Minor.

**Spec deviation.** The spec's `page-stock.js` assumes
`getIntradayAlerts(null)` returns an array of alerts with fields
`{ symbol, alert_type, summary, created_at | fired_at }` and filters
client-side by `a.symbol === symbol`. Reality is a single bucketed
object whose nearest match is `fact_check_completions[].subject_symbol`.
The "Recent Alerts" sidebar on the stock page therefore needs:

- Read `data.fact_check_completions` (which can be `null` when no
  completions; the actual jsonb_agg key is preserved oddly — `null`
  surfaces as `{ jsonb_agg: null }` in the probe, suggesting we should
  treat `?.fact_check_completions?.jsonb_agg ?? data.fact_check_completions`
  defensively).
- Filter by `subject_symbol === symbol`.
- Render `consensus_verdict`, `latest_check_at`, `subject_label`,
  `sources_queried` — not `summary` / `message`.

Worth either:

- Updating `page-stock.js` to the actual shape (preferred — minimal,
  fits the data we have), or
- Adding a server-side helper RPC `fn_get_alerts_for_symbol(p_symbol)`
  that returns a flatter array (Sprint 2-sized).

---

## 7. Other observations not in the §1 flag list, but spec-affecting

### 7a. Repo has a corrupt filename on `main`
`git ls-tree HEAD` shows both `mw-tops-attribution.html` and
`: mw-tops-attribution.html` (leading colon-space). The latter is an
illegal filename on NTFS — fresh clones on Windows fail with `error:
invalid path`. Worked around in this checkout via
`core.protectNTFS=false` + `git sparse-checkout` excluding the bad path.
Unrelated to Sprint 1, but should be cleaned up on `main` (one-line
`git rm`).

### 7b. Track Record uses the **new** publishable key format
`SUPA_ANON="sb_publishable_uV1Dkr9lgu2PBdoeACBAyw_4V_rrWvH"` in
`index.html`. The Brain spec ships the **legacy anon JWT**. This is fine
because they're two independent Supabase projects, but it's worth
noting that Sprint 2's "migrate Brain to publishable" item (§18) is
about consistency, not capability.

### 7c. No `package.json`, no test runner, no CI hooks
There's no place to put unit tests for the Brain modules, and no CI
running. Sprint 1's acceptance tests (§15) are entirely manual /
in-browser — fine, but means the only safety net is Yuki's manual pass
before merge. No need to add tooling for Sprint 1; flagging for Sprint 2
if appetite exists.

### 7d. `cleanUrls: true` means `/portfolio` resolves to `/portfolio.html`
Brain page links can omit the `.html` suffix. The spec uses
`href="stock.html?symbol=…"` which works as-is, but
`href="/stock?symbol=…"` is the more idiomatic form for this app.
Either is fine; flagging.

### 7e. Edge function `commit-to-github.ts` exists in repo
`edge-functions/commit-to-github.ts` is tracked in `main`. Worth
reading before declaring Sprint 1 PR-ready; it might suggest the existing
app already has a Vercel/Supabase function deploy step we should hook
into for the Brain proxy. Not blocking §1 verification but flagging.

---

## Summary — what Yuki needs to decide before §4–§12 implementation

| # | Item | Recommended path | Awaiting? |
|---|---|---|---|
| 1 | File layout: external `js/*.js` modules vs. inlined per-page | External (4 pages × ~150 LoC dedup is real) | Confirm |
| 2 | Brain creds: hardcode inline vs. introduce `__BRAIN_ENV__` | Hardcode inline (matches existing) | Confirm |
| 3 | Auth UI: full-page gate (per `index.html`) vs. spec's `prompt()` | Full-page gate | Confirm |
| 4 | Cross-page nav: `index.html` topbar vs. add `.nav-links` to all | `.nav-links` to all four existing + four new | Confirm |
| 5 | CSS tokens: `--navy/--gold` vs. `--penrose-*` vs. fallback | `--navy/--gold` (matches static pages) | Confirm |
| 6 | Intraday alerts: rewrite to actual jsonb shape vs. server RPC | Rewrite client (minimal); server RPC = Sprint 2 | Confirm |

Once Yuki confirms the six rows above, §4–§12 implementation can
proceed; until then, no Brain pages will be written.
