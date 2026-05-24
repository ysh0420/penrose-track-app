# Weekly Status Skill

## Description

Maintain a weekly operating snapshot for Penrose so current state, gaps, and priorities do not live only in chat.

## When To Use

- At the end of a meaningful work session.
- Weekly before planning next build work.
- Before handing the project to another AI agent.
- When current status in chat diverges from vault files.

## Inputs

- `SYSTEM_REGISTRY.md`.
- `STATUS.md`.
- `TODO.md`.
- Recent commits, PRs, validation output, and Supabase read-only checks.
- User-approved current priorities.

## Steps

1. Read registry, status, and TODO.
2. Identify what changed since the previous snapshot.
3. Confirm current live components and active IDs from safe read-only sources where feasible.
4. Update current snapshot, known gaps, and next priorities.
5. Move TODO items between Now, Next, Later, Blocked, and Do Not Do.
6. Record what was not validated.

## Completion Criteria

- `STATUS.md` reflects current state.
- `TODO.md` reflects current priorities.
- Unvalidated assumptions are named.
- Safety boundaries remain intact.

## Safety Boundaries

- Read-only checks only unless a separate task authorizes changes.
- Do not call AI.
- Do not write trades.
- Do not execute rebalance.
- Do not change portfolio state.
- Do not publish reports.
- Do not expose secrets.

## Expected Artifacts

- Updated `STATUS.md`.
- Updated `TODO.md`.
- Optional dated note under `docs/penrose-vault/notes/`.
