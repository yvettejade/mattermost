---
name: js-to-ts-migration
description: >-
  Playbook for migrating leftover Mattermost webapp .js/.jsx files to TypeScript.
  Orchestrates scoping, neighboring-pattern matching, conversion, check-types,
  lint, Jest, and optional smoke checks. Use when converting JS to TS, finishing
  the webapp TypeScript migration, renaming .js/.jsx to .ts/.tsx, or typing
  Redux actions/components still in JavaScript under webapp/.
---

# Webapp JS → TypeScript migration

Mattermost-specific playbook. Convert **one module + its co-located test** at a time. Behavior must stay identical unless fixing a clear type-driven bug.

## Orchestration (do this first)

Copy and track:

```
Migration progress:
- [ ] 0. Load skills / rules
- [ ] 1. Scope file + importers
- [ ] 2. Neighbor pattern
- [ ] 3. Convert (rename + types only)
- [ ] 4. check-types
- [ ] 5. lint
- [ ] 6. unit tests
- [ ] 7. smoke (UI-facing only)
- [ ] 8. PR-sized land
```

### Skills and rules to load

| When | Load |
|------|------|
| Always before editing | `webapp/AGENTS.md`, `webapp/STYLE_GUIDE.md`, `.cursor/skills/webapp-react.mdc` |
| Editing any `.ts`/`.tsx` | `typescript-best-practices` skill (if available) |
| Adding/changing tests | workspace rule `unit-tests.mdc` (RTL via `utils/react_testing_utils`, no new snapshots) |
| Unclear ownership / “how do actions look here?” | `how` skill, or spawn a readonly explore Task (below) |
| User asks for PR review after | `review-bugbot` / `review-security` only if they explicitly request |

Do **not** load server/Go skills for this workflow.

### When to spawn subagents

Use the **Task** tool. Prefer readonly explore for research; do conversion in the parent agent unless the file is huge.

| Step | Spawn? | How |
|------|--------|-----|
| Scope importers + dependents | Yes if >1 obvious entry or unclear blast radius | `subagent_type: explore`, thoroughness `quick` or `medium`. Prompt: find all imports of `<module path>`, list call sites, note hard-coded `.js` extensions. |
| Neighbor pattern | Yes if no obvious sibling `.ts` | `explore`, `quick`. Prompt: find nearest migrated file of same kind (action / component / selector / util) under `webapp/channels/src/` and summarize typing conventions (`ActionFunc`, `@mattermost/types`, etc.). |
| Convert single small/medium file (~≤400 lines) | No | Parent agent converts directly. |
| Convert large leftover (e.g. `suggestion_box.jsx` ~800+) | Optional | `generalPurpose` with a tight prompt: rename, type only, no behavior change; return diff summary + remaining `tsc` errors. Or split across PRs. |
| Parallel independent files | Only if user asked for a batch | One explore for shared conventions, then sequential converts (avoid parallel edits fighting on shared imports). |

Never spawn subagents for `npm run check-types` / lint / jest — run those in the parent via Shell.

## Playbook

### 0. Confirm target

Default demo-quality target if unspecified: `webapp/channels/src/actions/emoji_actions.js` (+ `emoji_actions.test.js`).

Prefer leaf modules first. Defer huge components unless requested.

### 1. Scope

- Identify module + co-located `*.test.js(x)`.
- Map importers (Grep or explore subagent).
- Classify: action | component | selector | util — drives typing template.

### 2. Neighbor pattern

Open a same-kind already-migrated file and match it:

| Kind | Pattern anchors |
|------|-----------------|
| Actions | `ActionFunc` / `ActionFuncAsync` from `types/store`; see `actions/status_actions.ts`, `actions/post_actions.ts` |
| Domain types | `@mattermost/types/...` |
| Components | `.tsx`, functional + hooks; no new `connect` |

### 3. Convert (mechanical)

1. Rename `.js`/`.jsx` → `.ts`/`.tsx` (tsx only if JSX).
2. Rename co-located test the same way.
3. Fix any hard-coded `.js` import paths.
4. Add types where `tsc` requires them; prefer real types over `any`.
5. Use `import type {…}` for type-only imports.
6. **No** API renames, refactors, or behavior changes in the same change.

Action shape example:

```ts
export function loadRecentlyUsedCustomEmojis(): ActionFunc {
    return (dispatch, getState) => { /* unchanged body */ };
}
```

### 4. Validate types

From `webapp/`:

```bash
npm run check-types --workspace=channels
```

Or from `webapp/channels/`: `npm run check-types`.

Fix order: export params/returns → callback implicits → `GlobalState`/selectors → nullish narrowing (logic change only if old code was clearly wrong).

### 5. Lint

```bash
npm run check
# or targeted
npm run fix
```

### 6. Tests

```bash
npm test -- <module_basename>
```

- Pure migration: existing tests green is enough.
- If typing forced a behavior fix: add/adjust unit tests per `unit-tests.mdc`.
- Prefer migrating the test file to `.ts`/`.tsx` in the same PR.

### 7. Smoke (UI-facing only)

If the module feeds visible UI (emoji picker, composer, etc.): one manual path in the running app to catch broken imports after rename.

### 8. Land

- One file (or one small cluster + tests) per PR.
- Diff should be mostly rename + types.
- Commit only when the user asks; message focuses on finishing TS migration for X.

## Done checklist

- [ ] Source and test use `.ts`/`.tsx`
- [ ] `check-types` clean for channels
- [ ] ESLint clean on touched files
- [ ] Targeted Jest passes
- [ ] No intentional behavior change (or tested fix called out)

## Batching order

1. Leaf utils / constants  
2. Actions / selectors  
3. Legacy components  
4. Huge leftovers — multi-PR or background agent, not a single sitting  

## Anti-patterns

- Migrating a whole directory in one PR
- Refactoring while converting
- Inventing new typing style instead of matching neighbors
- Skipping `check-types` because “it’s just a rename”
- Spawning write-capable subagents that also run unrelated refactors
