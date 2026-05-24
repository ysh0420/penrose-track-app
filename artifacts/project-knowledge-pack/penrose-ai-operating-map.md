# Penrose AI Operating Map

## Startup Order

1. Read the system registry.
2. Check current state snapshot.
3. Check source-of-truth map.
4. Identify safety boundaries before acting.
5. Update files after meaningful progress.

## Agent Roles

| Agent | Best Use | Boundaries |
| --- | --- | --- |
| Codex | Code, docs, repo edits, local validation, safe smoke checks | No AI execution, trades, rebalance, portfolio state changes, report publication, or secrets. |
| ChatGPT Project | Cross-session planning and operating map | Not data SSOT. Must defer to Supabase/GitHub for current facts. |
| Claude | Article/report drafting from verified claim packs | No unsupported claims, no internal-only leakage, no publication by default. |

## Operating Principles

- Put current state in files, not conversation memory.
- Keep data in Supabase and code in GitHub.
- Treat Track App as view layer.
- Treat V2 as diagnostic only.
- Preserve missing data as missing.
- Verify before writes.
- Use small read-only checks before larger workflow changes.

## Default Workflow

1. Define the task scope.
2. Check whether it is safe, reversible, and in scope.
3. Read the relevant vault files and source-of-truth records.
4. Make focused changes.
5. Run validation.
6. Update status/TODO when current state changes.
7. Report what changed, validation, gaps, risk, and exact next action.
