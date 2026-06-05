# QA Results — Iteration 1

**PR:** [#14 Sidebar mention badge 99+ display cap](https://github.com/yvettejade/mattermost/pull/14)  
**Branch:** `demo/qa-bugbot-mention-badge`  
**Tester:** Agent 2 (QA Tester)  
**Date:** 2026-06-05  
**Environment:** Cloud VM; `npm install` in `webapp/`; Mattermost server not available (Docker CLI missing; ports 8065/9005 unreachable).

## Summary

| Result | Count |
|--------|-------|
| PASS   | 7     |
| FAIL   | 7     |
| SKIP   | 8     |

**Critical finding:** `formatMentionBadgeCount()` uses default `cap = 50` (not `MENTION_BADGE_CAP` / 99) and returns bare `"50"` instead of `"99+"` for counts above the cap. Sidebar badges therefore show `50` for counts ≥ 51 (e.g. 150 mentions). Accessibility `aria-label` values correctly retain the full numeric count.

## Tests added (iteration 1)

- `webapp/channels/src/utils/mention_badge_count.test.ts` — boundary, default-cap, and `99+` suffix cases.
- `webapp/channels/src/components/sidebar/sidebar_channel/channel_mention_badge.test.tsx` — capped display, urgent+cap, offsetHeight, state transitions.
- `webapp/channels/src/components/sidebar/sidebar_channel/sidebar_channel_link/sidebar_channel_link.test.tsx` — capped badge + full-count aria-label.
- `webapp/channels/src/components/team_sidebar/components/team_button.test.tsx` — team badge `99+` regression guard.

---

## Scenario results

### Happy path

| ID | Result | Evidence |
|----|--------|----------|
| HP-1 | **SKIP** | Manual: Mattermost server unavailable (`curl localhost:8065` → `000`; Docker CLI missing per `cloud-agent-start.sh`). Cannot seed channel with 3 mentions and inspect LHS. |
| HP-2 | **FAIL** | Jest `sidebar_channel_link.test.tsx` and `channel_mention_badge.test.tsx`: `unreadMentions={150}` renders badge text `50`, not `99+`. Error: `Unable to find an element with the text: 99+` (received `50`). |
| HP-3 | **SKIP** | Manual: CRT/Threads sidebar requires running Mattermost with CRT enabled; server unavailable. |
| HP-4 | **PASS** | Jest `channel_mention_badge.test.tsx`: `should render nothing when unreadMentions is 0` — `container.firstChild` is `null`. |
| HP-5 | **SKIP** | Integration: mark-read flow requires live server + WebSocket mention updates; server unavailable. |

### Edge cases

| ID | Result | Evidence |
|----|--------|----------|
| EC-1 | **FAIL** | Jest `mention_badge_count.test.ts` boundary test: `formatMentionBadgeCount(98)` expected `98`, received `50`; `formatMentionBadgeCount(100)` expected `99+`, received `50`. |
| EC-2 | **FAIL** | Jest `channel_mention_badge.test.tsx`: capped urgent badge test cannot find `99+` (renders `50`). Urgent CSS class applies, but capped display string is incorrect — does not meet spec. |
| EC-3 | **SKIP** | Manual: Drafts/Recaps sidebar entries require running app with seeded draft/recap counts > 99; server unavailable. |
| EC-4 | **PASS** | Jest `sidebar_channel_link.test.tsx`: `unreadMentions={150}` → `aria-label` is `channel_label 150 mentions`; does not contain `99+`. |
| EC-5 | **PASS** | Jest `team_button.test.tsx`: `mentions={150}` → badge text `99+`, aria-label includes `150 mentions`. Team sidebar unchanged (regression guard). |
| EC-6 | **SKIP** | Manual: visual layout check at 1280px/1920px requires running webapp; dev server not available. |
| EC-7 | **PASS** | Jest `channel_mention_badge.test.tsx`: `#unreadMentions` `offsetHeight` is `16` (> 0) when badge visible with mocked layout. |
| EC-8 | **FAIL** | Static review of `mention_badge_count.ts`: `MENTION_BADGE_CAP = 99` but `cap: number = 50` default; return is `String(cap)` not `` `${cap}+` ``. JSDoc says "99+" but implementation returns `"50"`. |

### State transitions

| ID | Result | Evidence |
|----|--------|----------|
| ST-1 | **PASS** | Jest `channel_mention_badge.test.tsx`: rerender `0 → 1` shows badge text `1`. |
| ST-2 | **PASS** | Jest `channel_mention_badge.test.tsx`: rerender `3 → 4` updates badge to `4`. |
| ST-3 | **FAIL** | Jest `mention_badge_count.test.ts`: at count 99 expected `99` got `50`; at 100 expected `99+` got `50`. |
| ST-4 | **SKIP** | Manual: decrement-from-120 flow requires live mention state; server unavailable. |
| ST-5 | **PASS** | Jest `channel_mention_badge.test.tsx`: rerender `5 → 0` removes badge (`container.firstChild` null). |
| ST-6 | **SKIP** | Integration: mark-all-threads-read requires CRT + server; server unavailable. |
| ST-7 | **SKIP** | Manual: mute-channel + badge interaction requires running app; server unavailable. |

### Unit test scenarios

| ID | Result | Evidence |
|----|--------|----------|
| UT-1 | **FAIL** | `npm test -- --testPathPatterns=mention_badge_count.test`: **4 failed, 2 passed**. Pass: small count `3`, constant `99`. Fail: default cap, boundaries, `99+` suffix, explicit cap override. |
| UT-2 | **FAIL** | `npm test -- --testPathPatterns=channel_mention_badge`: existing 6 tests pass; 3 new capped-display tests fail (`99+` not found, renders `50`). State-transition and offsetHeight tests pass. |

---

## Commands executed

```bash
# Dependency install
cd /workspace/webapp && npm install

# Targeted Jest (all mention-badge suites)
cd /workspace/webapp/channels && npm test -- \
  --testPathPatterns='mention_badge_count|channel_mention_badge|sidebar_channel_link|team_button' \
  --no-coverage
# Result: 3 failed, 2 passed suites; 8 failed, 40 passed tests

# UT-1 isolated
cd /workspace/webapp/channels && npm test -- --testPathPatterns=mention_badge_count.test --no-coverage
# Result: 4 failed, 2 passed

# ESLint on changed production files
cd /workspace/webapp/channels && npx eslint \
  src/utils/mention_badge_count.ts \
  src/components/sidebar/sidebar_channel/channel_mention_badge.tsx
# Exit 0

# TypeScript (no mention-badge errors)
cd /workspace/webapp/channels && npx tsc --noEmit -p tsconfig.json
# No errors in mention badge files

# Server availability probe
curl -s -o /dev/null -w "%{http_code}" http://localhost:8065/api/v4/system/ping  # 000
curl -s -o /dev/null -w "%{http_code}" http://localhost:9005                      # 000
bash /workspace/.cursor/scripts/cloud-agent-start.sh  # Docker CLI missing
```

## Defect summary (for Agent 1)

1. **Wrong default cap** — `formatMentionBadgeCount(count, cap = 50)` should default to `MENTION_BADGE_CAP` (99).
2. **Missing `+` suffix** — above-cap return is `String(cap)` (`"50"` / `"99"`) instead of `` `${cap}+` ``.
3. **Effective cap is 50** — any count > 50 displays `50` in sidebar badges, breaking HP-2, EC-1, EC-2, ST-3, UT-1, UT-2.

**Not defective:** `aria-label` full-count accessibility (EC-4 PASS), team sidebar `99+` (EC-5 PASS), zero-mention null render (HP-4 PASS), component state transitions for counts ≤ 50 (ST-1, ST-2, ST-5 PASS).

## Manual testing note

Eight manual/integration scenarios were skipped because the Cloud Agent environment lacks Docker and the Mattermost stack was not running. Automated RTL/Jest coverage substitutes for component-level behavior where possible.
