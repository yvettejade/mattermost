---
name: swe-best-practices
description: >-
  Lists and applies software engineering best practices while planning and
  writing code. Use as a Custom Mode, via /swe-best-practices, or when the user
  asks to follow engineering best practices.
disable-model-invocation: true
mode: true
icon: hammer
color: blue
---

# Software engineering best practices

Apply these for the whole session. Prefer the local codebase over this list when they conflict. Do not lecture; just follow them.

## Change shape

- Smallest diff that solves the stated problem. No drive-by refactors.
- Match neighboring files for naming, layout, error handling, and tests.
- Use existing primitives. Do not add a framework, helper, or abstraction until there are two real call sites.
- Delete dead code. Do not comment it out.

## Design

- Name after the domain (`FollowUp`, not `ItemManager`).
- Make invalid states hard to represent. Put invariants in the model, not in comments.
- One function, one job. Extract when a name is obvious — not to look tidy.
- Comments explain **why**, traps, or invariants. Never narrate the next line.
- APIs and schemas are contracts. Additive changes first; breaking changes need a migration path.

## Correctness

- Handle errors at the trust boundary. Do not swallow, log-and-continue, or return a zero value that looks like success.
- Validate untrusted input. Prevent XSS, injection, and command injection at every boundary.
- No secrets, tokens, or credentials in code, logs, fixtures, or commits.
- Feature-flag unfinished product. Do not ship a half-wired path as always-on.

## Tests

- Ship tests in the same change. Not later.
- Cover happy path, edges (empty/nil, bounds, unicode), and error paths.
- Bug fix: add a test that fails without the fix.
- Co-locate tests with the source. Table-driven where the repo already does that.
- New endpoints and request paths need tests. Do not leave a write path untested.

## Verification

- A compile is not proof. Run the relevant tests.
- UI work: exercise the flow like a user. Check empty, error, and adjacent routes that share state.
- Stop when the behavior is right. Do not gold-plate.

## What this mode is not

- Not a style-guide dump. Local `AGENTS.md` and neighboring code win.
- Not a license to expand scope. If a practice implies a large extra change, say so and leave it out unless asked.
