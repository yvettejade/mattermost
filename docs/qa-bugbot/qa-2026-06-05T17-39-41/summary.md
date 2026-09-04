# QA Summary — Sidebar mention badge 99+ display cap

**PR:** [#14](https://github.com/yvettejade/mattermost/pull/14) (`demo/qa-bugbot-mention-badge` → `master`)  
**Run ID:** `qa-2026-06-05T17-39-41`  
**Iterations:** 2  
**Date:** 2026-06-05

## Verdict: PASS

All 18 executable scenarios passed in iteration 2 (0 failures). The iteration-1 defects in `formatMentionBadgeCount` were fixed and verified by **67/67** targeted Jest tests across 8 suites.

## Feature under test

Sidebar unread mention badges cap visible text at `99+` when a channel or Threads entry has more than 99 unread mentions, while `aria-label` values continue to expose the full numeric count for accessibility.

**Changed surfaces:** `mention_badge_count.ts`, `channel_mention_badge.tsx`, and downstream consumers (channel links, Global Threads, Drafts, Recaps).

## Scenarios exercised (final iteration)

| Type | Total planned | Pass | Fail | Skip |
|------|---------------|------|------|------|
| Happy path (HP) | 5 | 4 | 0 | 1 |
| Edge cases (EC) | 8 | 7 | 0 | 1 |
| State transitions (ST) | 7 | 5 | 0 | 2 |
| Unit tests (UT) | 2 | 2 | 0 | 0 |
| **Total** | **22** | **18** | **0** | **4** |

### Passed scenarios (18)

- **HP:** HP-1, HP-2, HP-3, HP-4
- **EC:** EC-1, EC-2, EC-3, EC-4, EC-5, EC-7, EC-8
- **ST:** ST-1, ST-2, ST-3, ST-4, ST-5
- **UT:** UT-1, UT-2

### Skipped scenarios (4) — environment limitation

| ID | Reason |
|----|--------|
| HP-5 | Integration: mark-read flow requires live Mattermost + WebSocket |
| EC-6 | Manual: visual layout at 1280px/1920px requires running webapp |
| ST-6 | Integration: mark-all-threads-read requires CRT + live server |
| ST-7 | Manual: mute-channel + badge interaction requires running app |

Docker CLI was unavailable in the Cloud Agent VM; `localhost:8065` was unreachable. Skipped scenarios were partially covered by RTL/Jest substitutes where noted in iteration-2 results.

## Failures fixed per iteration

### Iteration 1 — 7 failures

| Scenario | Symptom | Root cause |
|----------|---------|------------|
| HP-2 | Badge showed `50` for 150 mentions | Wrong default cap (`cap = 50`) |
| EC-1 | Boundaries 98/99/100 all returned `50` | Same |
| EC-2 | Urgent capped badge rendered `50`, not `99+` | Same + missing `+` suffix |
| EC-8 | Static review: constant/JSDoc said 99+ but code returned `"50"` | `String(cap)` instead of `` `${cap}+` `` |
| ST-3 | 99 → `50`, 100 → `50` | Same |
| UT-1 | 4/6 formatter tests failed | Same |
| UT-2 | 3 capped-display component tests failed | Same |

**Agent 3 fix:** Default `cap` now uses `MENTION_BADGE_CAP` (99); above-cap return is `` `${cap}+` ``. Post-fix re-run: 48/48 targeted tests pass.

### Iteration 2 — 0 failures

All previously failing scenarios verified. Additional unit coverage added for HP-3 (Threads), EC-3 (Drafts/Recaps), and ST-4 (120 → 101 still `99+`). Full targeted suite: **67/67** pass.

## Test artifacts added

- `mention_badge_count.test.ts`
- `channel_mention_badge.test.tsx`
- `sidebar_channel_link.test.tsx`
- `team_button.test.tsx`
- `global_threads_link.test.tsx`
- `recaps_link.test.tsx`
- `drafts_link.test.tsx`

## Remaining risks / manual follow-ups

1. **Live integration flows (HP-5, ST-6):** Mark-read and mark-all-threads-read decrement behavior not exercised against a running server or WebSocket updates.
2. **Visual layout (EC-6):** Capped `99+` badge fit at 1280px and 1920px sidebar widths not visually confirmed.
3. **Mute interaction (ST-7):** Mute-channel + badge behavior relies on existing rules; no regression test in this run.
4. **Urgent tooltip hover (EC-2):** DOM class verified; hover tooltip text not manually inspected.
5. **Out of scope (unchanged):** Team switcher inline cap, channel-switch modal mention text, server mention counting, i18n.

## Recommendation

**Approve for merge** from a QA perspective. Automated coverage is strong for formatter logic, component rendering, accessibility labels, and downstream sidebar surfaces. A human reviewer with a local Mattermost stack should spot-check HP-5 and EC-6 before release if visual/integration confidence is required.
