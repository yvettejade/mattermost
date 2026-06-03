# YVETTE-9 — PMD-4: Export transactions to CSV

**Linear:** [YVETTE-9](https://linear.app/anysphere/issue/YVETTE-9/pmd-4-export-transactions-to-csv)  
**Title:** PMD-4 — Export transactions to CSV  
**Priority:** High | **Status:** Backlog | **Assignee:** Unassigned  
**Team / project / labels:** No project; no labels  
**Demo context:** Cursor 101 Plan → Build centerpiece; Plan mode should clarify filename pattern, column order, and filtered vs all transactions.

## Problem statement

The Portfolio Management Dashboard (PMD) **Transactions** tab needs a **client-side CSV export** so users can download transaction history for spreadsheets. Today there is no export control on that tab (or the tab/dashboard is not present in this repository snapshot).

The change is **frontend-only**: generate a `.csv` in the browser and trigger a download. No PDF export and no server-side export endpoint.

## Requirements

### Functional

| Requirement | Detail |
|-------------|--------|
| Export control | Button on the **Transactions** tab triggers download of a `.csv` file |
| Columns | `date`, `type`, `symbol`, `quantity`, `price`, `total` (order per product decision; ticket lists this set) |
| Date format | `YYYY-MM-DD` for spreadsheet compatibility |
| CSV escaping | Quote/escape **symbol** values when they contain commas |
| Empty state | If there are **no** transactions, export button is **disabled** with helper text explaining why |
| UI consistency | Match existing tab layout and **legacy inline styling** patterns (ticket calls out legacy components, not new design system) |
| Tests | Unit tests for the **CSV generation utility** (pure function), not necessarily full E2E |

### Acceptance signals

- [ ] Export button on Transactions tab downloads `.csv`
- [ ] CSV header row and data rows include the six columns with correct formatting
- [ ] Dates are `YYYY-MM-DD`
- [ ] Symbols with commas do not break column alignment (proper escaping)
- [ ] Zero transactions → disabled button + helper text
- [ ] Visual placement matches sibling tab controls (legacy inline styles)
- [ ] Jest (or repo-standard) unit tests pass for CSV utility

### Out of scope

- PDF export
- Server-side export API, background jobs, or new Go handlers in `server/`

## Open questions

1. **Missing PMD in workspace** — Searches across `master`, `origin/yvette/mattermost-demo`, and current branch found **no** Portfolio Management Dashboard, Transactions tab, transaction types, or `PMD-4` paths under `webapp/` or `server/`. Is the dashboard on another branch/repo, or must this ticket **introduce** the demo app shell first?
2. **Export scope** — Demo notes ask whether export uses **filtered** (visible) transactions vs **all** transactions in the dataset. Default behavior must be confirmed before implementation.
3. **Filename pattern** — Demo notes ask for a naming convention (e.g. `transactions-YYYY-MM-DD.csv` vs including portfolio id). Not specified in acceptance criteria.
4. **Column order** — Acceptance list order is `date, type, symbol, quantity, price, total`; confirm this is canonical header order vs locale-specific ordering.
5. **Escaping rules** — Ticket explicitly calls out comma in **symbol** only. Should other fields (e.g. `type` with commas) use RFC 4180-style quoting for all fields, or minimal escaping per ticket wording?
6. **Number formatting** — Are `quantity`, `price`, and `total` raw decimals, fixed precision, or locale-formatted strings in CSV?
7. **Legacy styling location** — Without PMD components in tree, which file(s) define “existing tab layout and inline styling” for the Transactions tab?
8. **i18n** — Mattermost `webapp` convention is translatable UI strings (`en.json` + `FormattedMessage`). Ticket does not mention i18n; confirm whether PMD demo is English-only inline text or should follow Mattermost i18n for export label and empty-state helper.

## Relevant codebase areas

| Path | Rationale |
|------|-----------|
| *(not found)* `webapp/**/portfolio*` / `**/pmd*` / `**/transactions_tab*` | **Target surface for this ticket** — expected home for Transactions tab UI and export button; absent in current workspace. |
| `docs/linear-agents/yvette-9/` | Agent documentation for this Linear issue (this file and approach plan). |
| `docs/linear-agents/yvette-7/`, `docs/linear-agents/yvette-8/` (remote branches) | Prior YVETTE automation docs pattern for structure and depth; unrelated feature domain. |
| `webapp/channels/src/components/commercial_support_modal/commercial_support_modal.tsx` | Reference **browser download** pattern: `Blob` + `URL.createObjectURL` + temporary `<a download>` (server fetch today; PMD would use client-generated `text/csv` blob). |
| `webapp/channels/src/utils/date_utils.ts` | Existing `dateToString` → `YYYY-MM-DD` for date-only fields; reuse or mirror for transaction dates. |
| `webapp/channels/src/components/admin_console/billing/billing_history.tsx` | Unrelated “Transactions” label in admin billing UI; **not** PMD — listed only to avoid mistaken implementation target. |
| `webapp/channels/src/components/admin_console/message_export_settings.tsx` | Admin compliance export format includes CSV option; **server-driven** export, out of scope but shows product familiarity with CSV exports. |
| `webapp/STYLE_GUIDE.md`, `webapp/AGENTS.md` | Modern Mattermost webapp standards (functional components, SCSS co-location, testing). Ticket asks for **legacy inline** PMD styles — may intentionally diverge from STYLE_GUIDE for demo code. |
| `webapp/channels/jest.config.js` | Jest entry for colocated `*.test.ts(x)` next to CSV utility and tab component. |
| `server/` (general) | No expected changes; channel/store patterns irrelevant unless PMD later adds APIs (explicitly out of scope). |
| `.cursor/AGENTS.md` | Cloud Agent runbook (webapp `make run`, targeted Jest) for verification when PMD exists locally. |

## Suggested investigation order

1. **Locate or scaffold PMD** — Confirm with team which branch contains Portfolio Management Dashboard and Transactions tab; if greenfield, identify intended directory under `webapp/` (or separate demo package) before wiring export.
2. **Trace transaction data** — Find type/interface for a transaction row and whether the tab applies client-side filters; resolve filtered-vs-all export (open question #2).
3. **Inspect Transactions tab markup** — Document inline styles and sibling controls (tabs, tables) to place export button and empty-state helper consistently.
4. **Design CSV utility API** — Pure function: input `Transaction[]`, output CSV string or `Blob`; header row; `YYYY-MM-DD` dates; escaping; unit-test matrix (empty, commas in symbol, edge dates).
5. **Wire UI** — Enable export on non-empty list; `disabled` + helper copy when empty; trigger download with chosen filename pattern.
6. **Verify** — Run CSV utility unit tests; manual check opened file in Excel/Sheets; optional screen recording on Transactions tab once PMD runs in dev.
