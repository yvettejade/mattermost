# YVETTE-9 — Approach plan: PMD-4 Export transactions to CSV

## Executive summary

Add a **client-side CSV export** to the Portfolio Management Dashboard **Transactions** tab: a download button, a small pure **CSV builder** utility with unit tests, and an empty-state UX (disabled button + helper text). No backend work.

**Blocker in this repository:** PMD and the Transactions tab are **not present** on `cursor/YVETTE-9-linear-issue-documentation-dc6f` or `origin/master`. Implementation must start by **locating or introducing** the dashboard shell, then layering export on the existing transaction list source of truth.

Recommended split: (1) CSV utility + tests, (2) UI wiring + manual verification, (3) product decisions on filename, filter scope, and escaping—ideally captured in Plan mode per Cursor 101 demo notes.

## Recommended approach

### 0. Preconditions (before UI)

- Confirm where PMD lives (path under `webapp/channels/src/...` or separate demo app).
- Confirm transaction row shape (`date`, `type`, `symbol`, `quantity`, `price`, `total`) matches in-memory/filtered list.
- Resolve **Plan mode** questions:
  - **Filename:** e.g. `transactions-2026-06-03.csv` vs `pmd-transactions-{portfolioId}-2026-06-03.csv`
  - **Scope:** export **filtered** rows shown in the table vs **full** client dataset
  - **Column order:** use ticket order as header: `date,type,symbol,quantity,price,total`

### 1. CSV generation utility (test-first)

Add a colocated pure module (example path once PMD exists):

`webapp/channels/src/components/portfolio_management_dashboard/utils/transactions_csv.ts`

**Suggested API:**

```typescript
export type TransactionCsvRow = {
  date: Date | string; // normalize in formatter
  type: string;
  symbol: string;
  quantity: number | string;
  price: number | string;
  total: number | string;
};

export function escapeCsvField(value: string): string;
export function formatTransactionDate(date: Date | string): string; // YYYY-MM-DD
export function transactionsToCsv(rows: TransactionCsvRow[]): string;
```

**Formatting rules:**

| Field | Rule |
|-------|------|
| `date` | `YYYY-MM-DD` via `date_utils.dateToString` or equivalent; reject/omit invalid dates consistently (document choice in tests) |
| `symbol` | If value contains `,`, `"`, or newline, wrap in double quotes and escape internal `"` as `""` (RFC 4180); ticket minimum is comma in symbol |
| Numeric columns | Prefer plain decimal strings without locale separators (spreadsheet-safe); document precision in tests |
| Header | Single header row matching acceptance column names |
| Empty input | Return header-only CSV **or** throw—UI must not call export when list empty (disabled button); tests should cover both utility behavior and UI guard |

**Tests** (`transactions_csv.test.ts`):

- Happy path: two rows, correct column order and dates
- Symbol `BRK.A, B` (comma) stays one column
- Symbol with quotes
- Empty array → header-only (if utility allows) + UI never invokes when disabled
- Boundary date formatting (UTC vs local) — pick one and lock in tests

### 2. Browser download helper

Small helper (same folder or `download_csv.ts`):

```typescript
export function downloadCsvFile(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], {type: 'text/csv;charset=utf-8'});
  const href = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = href;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(href);
}
```

Pattern aligns with `commercial_support_modal.tsx` (temporary anchor + `download` attribute) but uses a **client-built** blob instead of `fetch`.

### 3. Transactions tab UI

On the Transactions tab component (path TBD):

- Place **Export** control in the tab toolbar/header row next to existing filters or table title, using **same inline styles** as sibling controls (legacy demo components).
- **Enabled:** `onClick` → build rows from chosen scope (filtered vs all) → `transactionsToCsv` → `downloadCsvFile`.
- **Disabled:** `transactions.length === 0` (or filtered list empty); set `disabled` on `<button>`, show helper text nearby (e.g. “No transactions to export”).
- Accessibility: real `<button>`, visible label, `aria-disabled` when disabled; helper text linked via `aria-describedby` if not adjacent.

**Deviations from modern Mattermost STYLE_GUIDE:** Ticket explicitly requests legacy inline styling for PMD; do not refactor the whole dashboard to SCSS modules unless asked.

### 4. Server / docs

- **No** `server/` changes.
- Optional: add a one-line note in PMD README or demo doc once path exists (not required by ticket).

## Phased task list

| Phase | Task | Done when |
|-------|------|-----------|
| **A** | Locate or create PMD Transactions tab + transaction list source | Tab renders with mock or real data in local dev |
| **B** | Product decisions (Plan mode): filename, filtered vs all, escaping breadth | Recorded in PR or ticket comment |
| **C** | Implement `transactionsToCsv` + `escapeCsvField` + date formatter | Unit tests green |
| **D** | Add `downloadCsvFile` and wire Export button | CSV downloads in browser; columns match spec |
| **E** | Empty state: disabled button + helper text | Cannot export with zero rows; helper visible |
| **F** | Manual QA + optional demo recording | Sample CSV opens correctly in Excel/Sheets |

## Testing and verification

### Automated

```bash
cd webapp/channels && npm test -- --testPathPattern=transactions_csv --no-cache
```

Extend pattern if tab component gets shallow tests (button disabled when `transactions.length === 0`).

### Manual (after PMD runs)

1. Load Transactions tab with multiple rows including a symbol with a comma.
2. Click Export; confirm file downloads and opens with six columns.
3. Verify dates are `YYYY-MM-DD`.
4. Clear or use empty fixture; confirm Export disabled and helper text shown.

### Cloud / local dev

Per `.cursor/AGENTS.md`: `cd webapp && make run` (and server if PMD is embedded in main app). PMD may use a dedicated route or feature flag—confirm when dashboard exists.

## Risks and out-of-scope

| Item | Notes |
|------|--------|
| **Missing PMD** | Highest risk; export cannot ship without tab and data model |
| **Timezone on dates** | Local midnight vs UTC can shift `YYYY-MM-DD`; tests must encode chosen behavior |
| **Filtered vs all** | Wrong choice confuses users; must be explicit in Plan |
| **i18n** | Mattermost norm is `en.json`; PMD demo may use inline English—align with course materials |
| **PDF / server export** | Out of scope per ticket |
| **Compliance export** | Admin `message_export_settings` CSV is unrelated; do not reuse server pipeline |

## Open questions

(Carry forward from `ticket_summary.md` until answered in Plan mode or standup.)

1. Repository/branch that contains Portfolio Management Dashboard.
2. Export **filtered** vs **all** transactions.
3. Download **filename** pattern.
4. Full RFC 4180 escaping for all fields vs symbol-only comma escaping.
5. Numeric formatting for `quantity`, `price`, `total`.
6. Whether PMD should follow Mattermost i18n for button and helper strings.
