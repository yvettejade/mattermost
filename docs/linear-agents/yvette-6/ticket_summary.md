# YVETTE-6 — Dashboard (ticket summary)

**Linear:** [YVETTE-6 Dashboard](https://linear.app/anysphere/issue/YVETTE-6/dashboard)  
**Status (trigger):** Todo · **Labels:** Cursor · **Assignee:** Unassigned  
**Branch context:** `cursor/YVETTE-6-linear-issue-documentation-5c76` (documentation-only automation run; implementation not requested in this run)

---

## Problem statement

Deliver a **read-only Cursor Canvas** (`.canvas.tsx`) that visualizes a small set of **pre-computed** statistics about the Mattermost monorepo. The canvas is a developer-facing artifact (not production UI): it should open in Cursor and show four dashboard sections backed by committed JSON, with a shell script to refresh that JSON offline.

The ticket explicitly references the **Cursor Canvas skill** for authoring conventions, file placement, SDK components, and theme behavior. All runtime stats must come from JSON committed next to the canvas; the canvas must **not** shell out or perform network I/O at render time.

---

## Requirements

### Stats (minimum four sections)

| Section | Data | Presentation |
|--------|------|----------------|
| Lines of code by language | Go, TypeScript, SCSS | Horizontal bar chart |
| Component count | `*.tsx` under `webapp/channels/src/components/`, excluding `*.test.tsx` and `*.stories.tsx` | Large numeric tile |
| Recent commits | Last 5 commits on `master` (short SHA, author, subject) | List |
| TODO / FIXME | Counts across `webapp/` and `server/` | Two values side by side |

### Engineering constraints

- Pre-compute stats into a **JSON file** colocated with the canvas; canvas reads JSON only at render.
- Provide **`refresh-stats.sh`** (or equivalent) to regenerate JSON without errors.
- Place artifacts under a path recommended by the Canvas skill (ticket suggests e.g. `.cursor/canvases/`).
- **No edits** to production code under `webapp/` or `server/`.
- **No new dependencies** in any `package.json`.
- **Theme-aware** UI if the Canvas runtime exposes theme tokens (light + dark).

### Acceptance signals

- Opening the canvas in Cursor renders all four sections using committed JSON.
- Running the refresh script succeeds and updates JSON.
- Canvas TypeScript **type-checks cleanly** (per ticket; mechanism TBD — see open questions).
- Short **README** in the canvas folder: how to open the canvas and re-run refresh.

### Explicitly out of scope

- Production changes in `webapp/` or `server/`
- New npm/go module dependencies
- Network calls or subprocesses during canvas render

---

## Open questions

1. **Canvas skill availability in Cloud** — The ticket and [docs-canvas skill](https://github.com/cursor/plugins/blob/main/docs-canvas/skills/docs-canvas/SKILL.md) point to `~/.cursor/skills-cursor/canvas/SKILL.md` and `canvas/sdk/*.d.ts` for layout, path conventions, and theme APIs. That path is **not present** on this Cloud Agent VM. Implementation must read the skill/SDK from a developer machine or vendor a copy into the repo (without adding `package.json` deps).

2. **Canonical canvas directory** — Ticket suggests `.cursor/canvases/`; no such directory exists yet. Confirm against `canvas/SKILL.md` file-path rules before landing files.

3. **LOC scope and definition**
   - **Directories:** Should Go LOC include only `server/` (and sibling `enterprise/` if present), or the entire repo? TypeScript/SCSS likely `webapp/` only, but `api/` and `e2e-tests/` also contain TS.
   - **TypeScript:** Count `.ts` and `.tsx` together, or `.tsx` only? Ticket label says "TypeScript" — combined count is the usual interpretation.
   - **Tooling:** `cloc` is not installed in the Cloud image; refresh script may use `find` + `wc -l`, `git ls-files` + `wc`, or require optional `cloc` install in the script environment (not a `package.json` dependency).

4. **TODO/FIXME semantics** — Count **occurrences** (matches per line) vs **files containing** at least one marker? Sample repo scan (occurrence sum via `rg`): ~55 in `webapp/`, ~1573 in `server/` — server count is high; confirm whether to exclude generated/vendor paths.

5. **Type-checking workflow** — No existing `.canvas.tsx` or canvas `tsconfig` in the repo. Unclear whether Cursor validates in-editor only, or whether a standalone `tsc` project should be added under `.cursor/canvases/` (still without new `package.json` deps).

6. **`mattermost-core.mdc`** — Automation references `.cursor/rules/mattermost-core.mdc`; **not found** in this repository (only `.agents/skills/mattermost-implementation-patterns/SKILL.mdc` exists). Use root `AGENTS.md`, `server/AGENTS.md`, `webapp/AGENTS.md`, and `.cursor/AGENTS.md` instead unless the rule is added later.

7. **Default branch** — Ticket specifies `master`; repo uses `master` as default (`origin/HEAD` → `master`). No ambiguity today.

---

## Relevant codebase areas (path → rationale)

| Path | Rationale |
|------|-----------|
| `.cursor/` | Existing Cloud Agent configuration; natural home for `.cursor/canvases/` per ticket hint. No production impact. |
| `webapp/channels/src/components/` | Target tree for React **component count** (~1641 `*.tsx` files excluding test/stories suffixes at exploration time). |
| `webapp/` | TypeScript (`.ts`/`.tsx`) and SCSS sources for LOC and **TODO/FIXME** webapp half. |
| `server/` | Primary Go codebase for LOC and **TODO/FIXME** server half. |
| `api/` | Additional Go services; clarify inclusion in Go LOC if refresh script scans repo-wide Go. |
| `e2e-tests/` | TypeScript tests and Playwright docs; usually excluded from product LOC but may contain TODOs. |
| `AGENTS.md`, `server/AGENTS.md`, `webapp/AGENTS.md` | Repo conventions for agents; PR template expectations when implementation lands. |
| `.github/PULL_REQUEST_TEMPLATE.md` | Required PR structure if a follow-up PR is opened. |
| `docs/linear-agents/yvette-6/` | This automation’s planning artifacts (ticket summary + approach plan). |

**Not present (expected to be created):**

- `.cursor/canvases/<name>/` — canvas `.canvas.tsx`, `stats.json`, `refresh-stats.sh`, `README.md`
- Top-level `docs/` for product documentation (only `docs/linear-agents/` is introduced here)

**Exploration snapshots (inform implementation; not committed as stats):**

- Component count methodology: `find webapp/channels/src/components -name '*.tsx' ! -name '*.test.tsx' ! -name '*.stories.tsx' | wc -l` → **1641**
- Approximate line counts (naive `find` + `wc -l`, includes tests): Go under `server/` ~794k; `.ts` ~176k; `.tsx` ~198k; `.scss` ~58k under `webapp/`
- Sample `master` log: `git log master -5 --format='%h|%an|%s'`

---

## Suggested investigation order

1. **Obtain Canvas skill + SDK** — Read `~/.cursor/skills-cursor/canvas/SKILL.md` and `sdk/index.d.ts` for file layout, allowed imports, bar/list/stat components, and theme hooks (`useTheme` or equivalent).
2. **Scaffold directory** — Create `.cursor/canvases/mattermost-dashboard/` (name TBD) with README stub.
3. **Define JSON schema** — Stable keys for `locByLanguage`, `componentCount`, `recentCommits[]`, `todoFixme: { webapp, server }`, plus `generatedAt` metadata.
4. **Implement `refresh-stats.sh`** — Deterministic LOC/TODO/commit/component commands; document assumptions; run once to commit initial `stats.json`.
5. **Build `.canvas.tsx`** — Import JSON; render four sections with SDK primitives; theme-aware styling.
6. **Verify acceptance** — Open canvas in Cursor; re-run refresh; confirm type-check path documented in README.
7. **Optional PR** — Separate automation or manual PR with `Resolves YVETTE-6` per workspace `link-linear` rule (out of scope for this documentation-only run).
