# Article Brief Skill

## Description

Prepare a Claude-ready article brief using verified claims, source packs, and explicit do-not-use rules.

## When To Use

- Before Claude drafts an article.
- When converting Brain research into public or client-facing writing.
- When a writing task needs boundaries around claims, tone, and source usage.

## Inputs

- `writing/CLAUDE_ARTICLE_BRIEF_TEMPLATE.md`.
- `writing/VERIFIED_CLAIMS_GUIDE.md`.
- `writing/DO_NOT_USE_RULES.md`.
- Verified source pack.
- Audience and distribution context.

## Steps

1. Confirm the audience and whether the output is public, client-specific, or internal.
2. Select only verified claims from the source pack.
3. Add missing-data caveats where needed.
4. Add banned claims and do-not-use content.
5. Provide structure, tone, and citation expectations.
6. Require Claude to avoid unsupported additions.

## Completion Criteria

- Brief is complete enough for writing without chat memory.
- Every allowed claim has an evidence basis.
- Do-not-use rules are explicit.
- No internal recommendation, portfolio action, or raw paid-data-derived content leaks into public writing.

## Safety Boundaries

- Do not call AI unless the task explicitly asks to run writing.
- Do not publish the article.
- Do not fabricate claims.
- Do not expose secrets.
- Do not expose internal recommendation, Source Run IDs, or portfolio action.

## Expected Artifacts

- Completed Claude article brief markdown.
- Linked source pack.
- Claim limitations and missing-data section.
