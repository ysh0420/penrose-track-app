# Penrose Japan — Track Record App

Live dashboard for Penrose Japan (MW TOPS PENROSE-JP-LON) performance tracking.

## Live URLs

- **Public** (external sharing): https://penrose-track-app.vercel.app/track-record.html
- **Private** (internal only): https://penrose-track-app.vercel.app/mw-tops-attribution.html

## Repository Structure

```
├── track-record.html              Public dashboard (no names, no MW refs)
├── mw-tops-attribution.html       Private dashboard (full attribution + current holdings)
├── METHODOLOGY.md                 Alpha capture formula, data sources, evidence levels
├── backups/
│   └── YYYY-MM-DD-snapshot.json   Complete DB snapshots (data recovery)
├── edge-functions/
│   └── commit-to-github.ts        Edge function source (infrastructure recovery)
└── README.md                      This file
```

## Workflow

Claude (via Supabase edge function `commit-to-github`) can directly update files in this repo. Yuki provides natural language instructions; Claude:
1. Updates Supabase DB (source of truth)
2. Regenerates HTML with new data
3. Commits to this repo
4. Vercel auto-deploys in ~30s
5. URLs refresh

No manual paste/commit required.

## Data Architecture

```
[Yuki instructions]
        ↓
[Claude]
        ↓
[Supabase DB]  ←─ source of truth (performance_daily, performance_monthly_summary, position_attribution)
        ↓
[Edge function: commit-to-github] ←─ GITHUB_PAT secret
        ↓
[GitHub: ysh0420/penrose-track-app]
        ↓
[Vercel auto-deploy]
        ↓
[Live URLs]
```

## Recovery Runbook

### If HTML files lost (unlikely — git history preserves them)

Rollback via `git checkout <previous-commit> track-record.html`.

### If Supabase project lost

1. Create new Supabase project
2. Restore schema from `schema/` migrations (033-043)
3. Restore data from `backups/LATEST.json`:
   ```sql
   INSERT INTO performance_daily (...) VALUES (...)
   INSERT INTO performance_monthly_summary (...) VALUES (...)
   INSERT INTO position_attribution (...) VALUES (...)
   ```
4. Redeploy edge functions from `edge-functions/` sources
5. Add GITHUB_PAT secret

### If GitHub repo lost

1. Create new repo `ysh0420/penrose-track-app` (same name for Vercel continuity)
2. Push HTML files from Vercel's deployment cache, or regenerate from Supabase via Claude
3. Reconnect to existing Vercel project

### If Vercel project lost

1. Create new Vercel project
2. Import from `ysh0420/penrose-track-app`  
3. Set domain (if custom domain configured)

### If GITHUB_PAT compromised/expired

1. Revoke at https://github.com/settings/personal-access-tokens
2. Generate new fine-grained PAT (contents: write on `ysh0420/penrose-track-app` only, 90 day expiry)
3. Update `GITHUB_PAT` secret in Supabase Edge Functions settings
4. No code change needed

## Key Identifiers

- **Supabase project**: `prdjmipmkomhvokwrjid` (eu-west-1)
- **Portfolio UUID**: `b48c1e44-bb23-4a9e-862b-0dcc18985b3f`
- **Vercel project**: `prj_bsaXLoc3VaN1RtvETBwxLEhuWihp`
- **Vercel team**: `team_6ri8v7uZPDU2Y6QWZrfaMVBL`
- **Edge function URL**: `https://prdjmipmkomhvokwrjid.supabase.co/functions/v1/commit-to-github`

## Backup Schedule

Manual snapshots in `backups/` folder. Automation TBD (planned: pg_cron → edge function → daily `backups/YYYY-MM-DD-auto.json`).

## Methodology

See `METHODOLOGY.md` for:
- Alpha capture formula
- Data source provenance (Koyfin CSV for 2025, MW platform for 2026)
- Evidence level definitions
- Key NAV trajectory points

## History

- **2026-04-23**: V14 public dashboard, V3 private with current holdings + Apr MTD evolution chart. Zero-touch Claude→GitHub deploy pipeline established. Initial backup snapshot.
- **2026-04-22**: V1 dashboard paste-based deploy on penrose-track-app Vercel project.
- **2025-04-30**: MW TOPS PENROSE-JP-LON inception, $30M target book.
