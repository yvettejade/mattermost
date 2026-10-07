# Engineering review — auto-heal `2026-06-01T23-12-44`

**PR:** https://github.com/yvettejade/mattermost/pull/10  
**Branch:** `cursor/fix-channel-header-eslint-ae27`  
**Reviewer:** Agent 2 (Staff Reviewer)  
**Date:** 2026-06-01

## Summary

PR #10 removes a two-line unused `token` constant from `webapp/channels/src/components/channel_header/channel_header_text.tsx`. That constant was left on `master` after demo/test commits (`leak`, `add token`) and causes Web App CI to fail on `npm run check` because `@typescript-eslint/no-unused-vars` is configured as an error. The change is a pure deletion with no behavioral or API impact.

## Root cause

1. Commit `5cbcd322cd` ("leak") added an unused `token` binding to `channel_header.tsx`.
2. Commit `34de4b11b7` ("add token") moved the same constant into `channel_header_text.tsx` and removed it from `channel_header.tsx`.
3. The variable was never read, exported, or referenced in tests. With `vars: "all"` in the shared ESLint config (`webapp/platform/eslint-plugin/configs/.eslintrc.json`), an unused top-level `const` is a hard error.
4. `.github/workflows/webapp-ci.yml` runs `npm run check` (ESLint + stylelint) on every push/PR touching `webapp/**`, so `master` fails lint until this dead code is removed.

The regression is lint/CI-only, not a runtime or unit-test logic failure. The string value (`fOuNdMyLeAkeDaPIkEyrZW5fMTIzNDU=`) appears to be an intentional demo artifact, not production configuration.

## Fix analysis

| Aspect | Assessment |
|--------|------------|
| **Diff scope** | Single file, −2 lines; no imports or component logic touched. |
| **Runtime behavior** | Unchanged — the constant had no consumers. |
| **Blast radius** | Limited to channel header text UI module; no API, schema, or i18n changes. |
| **Test coverage** | Existing `channel_header_text.test.tsx` exercises render paths; none depended on `token`. |
| **Release note** | Correctly `NONE` per PR template. |

**Why the fix is safe:** Removing an unreferenced binding cannot alter control flow, props, or rendering. The component still gates on `hasHeaderText` and delegates to `ChannelHeaderTextPopover` as before. Edge cases (empty header, archived channel, bot DM without description) remain covered by existing tests and are unaffected.

**Verification:** `git diff origin/master...HEAD` shows only the token removal. Compared file snapshots on `origin/master` vs `HEAD` confirm the sole delta. Local `npm run check --workspace=channels` could not be executed in this cloud VM (incomplete `webapp` `npm install`); CI-equivalent failure mode is established by rule config + presence of unused `const` on `master`. Merging this PR aligns the tree with the passing state Agent 1 targeted.

## Risk / follow-ups

- **Default branch:** `master` remains red for webapp lint until PR #10 merges.
- **Git history:** The demo token string remains in prior commits; if this were a real secret, rotation and history scrubbing would be required; here it reads as test scaffolding.
- **Process:** Avoid committing placeholder secrets or unused variables during channel-header experiments; run `npm run check --workspace=channels` before push when touching `webapp/`.
- **CI signal:** No checks were reported on the PR branch at review time; confirm Web App CI after merge.

## Verdict

**SHIP**

Minimal, correct remediation for an ESLint regression introduced by accidental dead code. No further code changes required for this incident; merge to restore `master` webapp lint.
