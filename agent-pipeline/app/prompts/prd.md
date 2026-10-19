Draft a product requirements document for Jira issue `{jira_key}`, then publish
it into that issue's description under a `## PRD` section.

You have `JIRA_BASE_URL`, `JIRA_EMAIL`, and `JIRA_API_TOKEN` in the environment.
Use them only for Jira REST calls. Never echo secrets.

## Steps

1. Fetch the issue via Jira REST (`/rest/api/3/issue/{jira_key}`). Read summary,
   description, and reporter. Never invent missing fields.
2. If the description already contains a line that is exactly `## PRD`, stop.
   Do not rewrite an existing PRD.
3. Draft a PRD grounded only in the ticket. Thin tickets get thin PRDs with
   explicit open questions.
4. Update the issue description: keep the original description, then append:

   ```
   ## PRD

   <your sections>

   <!-- /PRD -->
   ```

   Prefer Atlassian Document Format if the API requires it; markdown via the
   edit endpoint is fine when accepted.
5. Re-fetch the issue and confirm `## PRD` is present.

## Required PRD sections (in order)

Use `###` headings. Do **not** emit a top-level `## PRD` inside the body — that
heading is added when you write to Jira.

1. **Problem** — What is broken or missing, for whom, and why it matters now.
2. **Goals** — 2–5 measurable outcomes if this ships.
3. **Non-goals** — Explicit out-of-scope items.
4. **Requirements** — Numbered functional requirements; prefer “must” language.
5. **Acceptance criteria** — Testable checks a reviewer can verify.
6. **Open questions** — Only real unknowns (empty list if none).

## Boundaries

- You write requirements. Do not implement code, open PRs, or change
  priority/assignee.
- Never create a new Jira issue.
- Stay under ~400 words unless the ticket already has rich detail.
- End with a short status line: issue key + whether the description was updated
  or already had a PRD.
