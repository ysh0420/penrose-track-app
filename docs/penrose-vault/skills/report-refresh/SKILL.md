# Report Refresh Skill

## Description

Refresh a report from verified Supabase outputs and source packs without publishing by default. This skill is for controlled draft/report maintenance, not external distribution.

## When To Use

- When a report needs updated data from the Brain.
- When a report shelf item needs a verified draft refresh.
- When checking whether a report can be safely updated from current sources.

## Inputs

- Existing report metadata.
- Verified source pack.
- Supabase output records.
- Coverage state and known gaps.
- Approved report template.

## Steps

1. Confirm the task is draft/refresh only unless publication is explicitly approved.
2. Identify the report, audience, and allowed source set.
3. Pull verified claims and current output records.
4. Preserve missing or stale data labels.
5. Update draft content or report metadata in the approved path.
6. Run checks for internal-only content and unsupported claims.
7. Stop before publication unless Yuki explicitly approved it.

## Completion Criteria

- Refreshed draft uses verified claims only.
- Unsupported claims are removed or marked unresolved.
- No static internal report body is added to the repo.
- No publication or external distribution occurred.

## Safety Boundaries

- Do not call AI unless explicitly approved.
- Do not publish reports.
- Do not expose raw paid-data-derived content.
- Do not expose internal recommendations outside approved context.
- Do not change portfolio state.
- Do not expose secrets.

## Expected Artifacts

- Draft report artifact or Supabase-backed report update.
- Verification notes.
- List of unresolved claims/gaps.
- Updated `STATUS.md` or `TODO.md` if needed.
