# YVETTE-6 — Dashboard (approach plan)

**Based on:** [`ticket_summary.md`](./ticket_summary.md)  
**Linear:** [YVETTE-6](https://linear.app/anysphere/issue/YVETTE-6/dashboard)

---

## Executive summary

Implement a self-contained **Cursor Canvas dashboard** under `.cursor/canvases/` that imports a committed **`stats.json`** and renders four read-only sections (LOC bars, component tile, commit list, TODO/FIXME pair). A sibling **`refresh-stats.sh`** regenerates JSON using shell, `git`, and `rg`/`grep` — no `package.json` changes and no production edits.

This run produced **planning documentation only**. A follow-up implementation pass should load the Cursor Canvas skill/SDK, scaffold the canvas folder, commit initial JSON from the refresh script, and validate rendering in Cursor.

---

## Recommended approach

### 1. Directory layout (proposed)

```
.cursor/canvases/mattermost-codebase-dashboard/
├── README.md
├── refresh-stats.sh
├── stats.json              # generated; committed
└── mattermost-codebase-dashboard.canvas.tsx
```

Names are illustrative; align final filenames with `canvas/SKILL.md` path conventions once the skill is available.

### 2. JSON contract (proposed)

```json
{
  "generatedAt": "2026-06-01T00:00:00Z",
  "locByLanguage": [
    { "language": "Go", "lines": 0 },
    { "language": "TypeScript", "lines": 0 },
    { "language": "SCSS", "lines": 0 }
  ],
  "componentCount": 0,
  "recentCommits": [
    { "sha": "abc1234", "author": "Name", "subject": "commit message" }
  ],
  "todoFixme": {
    "webapp": 0,
    "server": 0
  }
}
```

**LOC policy (recommended defaults to resolve open questions):**

| Language | Roots | Extensions | Notes |
|----------|-------|------------|--------|
| Go | `server/`, `api/` | `.go` | Exclude `vendor/` if present; do not scan `node_modules` |
| TypeScript | `webapp/` | `.ts`, `.tsx` | Exclude `node_modules`, `dist`, build artifacts |
| SCSS | `webapp/` | `.scss` | Same exclusions |

Use **`git ls-files`** when available so ignored/generated paths stay out; fall back to `find` with explicit prune rules.

**Component count:** `find webapp/channels/src/components -type f -name '*.tsx' ! -name '*.test.tsx' ! -name '*.stories.tsx' | wc -l`

**Commits:** `git log master -5 --format='%h|%an|%s'` parsed into array (fail clearly if `master` missing).

**TODO/FIXME:** `rg -o 'TODO|FIXME' webapp/ server/` occurrence count per root (or `rg --count-matches` summed). Document that string literals in tests count unless further filtering is required.

### 3. `refresh-stats.sh`

- `set -euo pipefail`; run from canvas directory or repo root with `ROOT="$(git rev-parse --show-toplevel)"`.
- Write `stats.json` atomically (`mktemp` + `mv`).
- Print summary to stdout for CI/agent logs.
- Idempotent: safe to run before every commit that refreshes marketing stats.

Optional: accept `--check` flag that exits non-zero if JSON would change (for future CI guard); not required by ticket.

### 4. `.canvas.tsx` implementation

1. Read **`canvas/SKILL.md`** and SDK typings before coding.
2. `import stats from './stats.json'` (or skill-prescribed JSON import pattern).
3. **Sections**
   - **LOC:** horizontal bars — max bar width = max(lines); label each language; show numeric labels.
   - **Components:** single prominent number + short caption with path.
   - **Commits:** ordered list (newest first, matching `git log`).
   - **TODO/FIXME:** two-column or two-tile layout labeled `webapp` and `server`.
4. **Theming:** use Canvas SDK theme hook/tokens if exported; otherwise CSS variables documented in SDK (e.g. `var(--canvas-*)`). Avoid hard-coded colors only usable in one theme.
5. **No side effects** at module top level beyond JSON import.

### 5. README (canvas folder)

- **View:** Open the `.canvas.tsx` file in Cursor (Canvas tab / command palette — exact UX per current Cursor docs).
- **Refresh:** `./refresh-stats.sh` from repo root or canvas dir; commit updated `stats.json` when stats should be shared.
- **Assumptions:** LOC roots, TODO counting method, `master` branch requirement.

---

## Phased task list

| Phase | Task | Done when |
|-------|------|-----------|
| P0 | Read `~/.cursor/skills-cursor/canvas/SKILL.md` + SDK `.d.ts` | Component/prop list known |
| P1 | Create `.cursor/canvases/.../` + README + empty/stub JSON | Folder exists, documented |
| P2 | Implement `refresh-stats.sh` + generate real `stats.json` | Script exits 0; JSON validates |
| P3 | Implement `.canvas.tsx` with four sections | Renders in Cursor |
| P4 | Theme pass (light/dark) | Readable in both themes |
| P5 | Type-check verification | Documented command or Cursor clean |
| P6 | Manual acceptance | All acceptance criteria met |
| P7 | PR (optional) | `Resolves YVETTE-6`, release note `NONE` |

---

## Testing and verification

### Refresh script (automated / terminal)

```bash
cd /workspace
.cursor/canvases/mattermost-codebase-dashboard/refresh-stats.sh
test -s .cursor/canvases/mattermost-codebase-dashboard/stats.json
```

Validate JSON with `jq . stats.json` ( `jq` is in the Cloud image per `.cursor/README.md`).

### Canvas render (manual — required for acceptance)

- Open `*.canvas.tsx` in Cursor and confirm four sections populate from JSON.
- Toggle editor/light vs dark theme if supported; confirm contrast.

### Type-check (approach TBD)

Preferred order:

1. Follow any `tsc` or `check` command documented in `canvas/SKILL.md`.
2. If none: add minimal `tsconfig.json` under the canvas folder extending strict React settings and referencing only Canvas SDK types (no webapp `package.json` deps).

### Regression guards

- Grep repo: no changes under `webapp/` or `server/` except accidental — implementation diff should be `.cursor/canvases/**`, `docs/linear-agents/**`, and planning docs only.
- `git diff --name-only` must not list any `package.json`.

### Sample expected magnitudes (sanity check after refresh)

Values drift over time; order-of-magnitude checks from exploration:

- `componentCount` ≈ 1600+
- `todoFixme.webapp` ≈ tens; `todoFixme.server` ≈ hundreds–thousands (occurrence-based)
- Go LOC largest bar; TypeScript second; SCSS smallest of the three

---

## Risks and out-of-scope

| Risk | Mitigation |
|------|------------|
| Canvas SDK/skill missing in CI/Cloud | Vendor skill snippet or link in README; implementer runs on desktop Cursor |
| LOC inflation from tests/generated files | Prefer `git ls-files` + extension filter |
| `master` renamed or shallow clone | Script checks branch exists; document `git fetch` |
| Theme API undocumented | Read SDK; fallback to semantic tokens only |
| Large `stats.json` churn | Commit refresh only when intentionally updating dashboard |

**Out of scope (unchanged):** production `webapp/`/`server/` edits, new dependencies, runtime network/shell in canvas, enterprise repo stats unless explicitly added later.

---

## Open questions

Carry forward from ticket summary; resolve in P0 before P3:

1. Confirm canvas directory and file naming from `canvas/SKILL.md`.
2. Final LOC roots (include `api/` Go? exclude `e2e-tests/` TS?).
3. TODO/FIXME: occurrences vs files; exclude `*_test.go` / `*.test.tsx` or not.
4. Official type-check command for `.canvas.tsx`.
5. Whether `mattermost-core.mdc` will be added to the repo or automation should stop referencing it.

---

## Relation to this automation

| Deliverable | Status |
|-------------|--------|
| `docs/linear-agents/yvette-6/ticket_summary.md` | Committed (Phase 1) |
| `docs/linear-agents/yvette-6/approach_plan.md` | This file (Phase 2) |
| Canvas implementation | **Not in this run** — use phased list above |
