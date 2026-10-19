Implement Jira issue `{jira_key}` against this repository and open a pull request.

## Context

PRD text (from the prior pipeline stage; also present on the Jira issue under
`## PRD`):

```
{prd_text}
```

You have `JIRA_BASE_URL`, `JIRA_EMAIL`, and `JIRA_API_TOKEN` if you need to
re-read the issue. Never echo secrets.

## Goals

1. Read the PRD acceptance criteria and requirements. Prefer the inlined PRD
   above; fall back to Jira if it is missing or says "(read from Jira)".
2. Implement the smallest change that satisfies the requirements. Match existing
   naming, tests, and Mattermost conventions (`server/AGENTS.md`,
   `webapp/AGENTS.md` when touching those trees).
3. Add or update unit tests for new behavior.
4. Open a PR (`auto_create_pr` is enabled). PR title should reference
   `{jira_key}`. PR body must include:
   - Summary of the change
   - Acceptance criteria checklist copied from the PRD
   - Test plan
5. When finished, print a single line `PR_URL: https://github.com/.../pull/N`
   with the opened PR URL.

## Boundaries

- Do not merge the PR.
- Do not expand scope beyond the PRD / ticket.
- If blocked (missing product facts, impossible AC), explain why and stop
  without a fake PR.
