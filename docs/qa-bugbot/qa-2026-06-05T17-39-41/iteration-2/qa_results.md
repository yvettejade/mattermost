# QA Results — Iteration 2

**PR:** [#14 Sidebar mention badge 99+ display cap](https://github.com/yvettejade/mattermost/pull/14)  
**Branch:** `demo/qa-bugbot-mention-badge`  
**Tester:** Agent 2 (QA Tester)  
**Date:** 2026-06-05  
**Environment:** Cloud VM; `npm install --ignore-scripts` + platform workspace build; Mattermost server unavailable (Docker CLI missing; port 8065 unreachable).

## Summary

| Result | Count |
|--------|-------|
| PASS   | 18    |
| FAIL   | 0     |
| SKIP   | 4     |

**Iteration 2 verdict:** Agent 3 fix verified. `formatMentionBadgeCount` now defaults to `MENTION_BADGE_CAP` (99) and returns `` `${cap}+` `` above the cap. All targeted Jest suites pass (**67/67** tests). No production-code changes in this iteration.

## Tests added (iteration 2)

- `webapp/channels/src/components/sidebar/sidebar_channel/channel_mention_badge.test.tsx` — ST-4 capped display persists when count drops 120 → 101.
- `webapp/channels/src/components/threading/global_threads_link/global_threads_link.test.tsx` — HP-3 Threads sidebar `99+` badge.
- `webapp/channels/src/components/recaps_link/recaps_link.test.tsx` — EC-3 Recaps capped badge.
- `webapp/channels/src/components/drafts/drafts_link/drafts_link.test.tsx` — EC-3 Drafts scheduled-post badge capped at `99+`.

---

## Scenario results

### Happy path

| ID | Result | Evidence |
|----|--------|----------|
| HP-1 | **PASS** | Jest `channel_mention_badge.test.tsx`: `should render badge when unreadMentions > 0` — badge text `3`. Substitutes manual LHS inspection. |
| HP-2 | **PASS** | Jest `channel_mention_badge.test.tsx` + `sidebar_channel_link.test.tsx`: `unreadMentions={150}` renders `99+`, not raw count. |
| HP-3 | **PASS** | Jest `global_threads_link.test.tsx`: CRT enabled, `total_unread_mentions: 150` → `#sidebarItem_threads` badge shows `99+`. |
| HP-4 | **PASS** | Jest `channel_mention_badge.test.tsx`: `unreadMentions={0}` → `container.firstChild` is `null`. |
| HP-5 | **SKIP** | Integration: mark-read flow requires live Mattermost + WebSocket (`curl localhost:8065` → `000`; Docker CLI missing). |

### Edge cases

| ID | Result | Evidence |
|----|--------|----------|
| EC-1 | **PASS** | Jest `mention_badge_count.test.ts` + `channel_mention_badge.test.tsx`: `98` → `98`, `99` → `99`, `100` → `99+`. |
| EC-2 | **PASS** | Jest `channel_mention_badge.test.tsx`: `should keep urgent class when capped count is displayed` — `.badge.urgent` with text `99+`. |
| EC-3 | **PASS** | Jest `recaps_link.test.tsx` (`count: 150` → `99+`) and `drafts_link.test.tsx` (120 scheduled posts → `99+`). |
| EC-4 | **PASS** | Jest `sidebar_channel_link.test.tsx`: `unreadMentions={150}` → accessible name includes `150 mentions`, not `99+`. |
| EC-5 | **PASS** | Jest `team_button.test.tsx`: `mentions={150}` → badge `99+`, aria-label includes `150 mentions`. |
| EC-6 | **SKIP** | Manual: visual layout at 1280px/1920px requires running webapp against live sidebar; server unavailable. |
| EC-7 | **PASS** | Jest `channel_mention_badge.test.tsx`: `#unreadMentions` `offsetHeight` is `16` (> 0) with mocked layout. |
| EC-8 | **PASS** | Static review `mention_badge_count.ts`: `MENTION_BADGE_CAP = 99`, default `cap = MENTION_BADGE_CAP`, return `` `${cap}+` ``; Jest boundary tests confirm behavior. |

### State transitions

| ID | Result | Evidence |
|----|--------|----------|
| ST-1 | **PASS** | Jest `channel_mention_badge.test.tsx`: rerender `0 → 1` shows badge `1`. |
| ST-2 | **PASS** | Jest `channel_mention_badge.test.tsx`: rerender `3 → 4` updates badge to `4`. |
| ST-3 | **PASS** | Jest `mention_badge_count.test.ts` + `channel_mention_badge.test.tsx`: `99` then `100` → `99+`. |
| ST-4 | **PASS** | Jest `channel_mention_badge.test.tsx`: rerender `120 → 101` keeps `99+`. |
| ST-5 | **PASS** | Jest `channel_mention_badge.test.tsx`: rerender `5 → 0` removes badge. |
| ST-6 | **SKIP** | Integration: mark-all-threads-read requires CRT + live server; server unavailable. |
| ST-7 | **SKIP** | Manual: mute-channel + badge interaction requires running app; server unavailable. |

### Unit test scenarios

| ID | Result | Evidence |
|----|--------|----------|
| UT-1 | **PASS** | `npm test -- --testPathPatterns=mention_badge_count.test`: **6 passed, 0 failed**. |
| UT-2 | **PASS** | `npm test -- --testPathPatterns=channel_mention_badge`: **14 passed, 0 failed** (includes capped display, urgent+cap, transitions, offsetHeight). |

---

## Commands executed

```bash
# Dependencies (skip native postinstall scripts that fail on gifsicle)
cd /workspace/webapp && npm install --ignore-scripts

# Build platform packages required for Jest module resolution
cd /workspace/webapp && npm run build --workspace platform/types \
  --workspace platform/client --workspace platform/shared --workspace platform/components

# Targeted Jest (all mention-badge suites)
cd /workspace/webapp/channels && npm test -- \
  --testPathPatterns='mention_badge_count|channel_mention_badge|sidebar_channel_link|team_button|global_threads_link|recaps_link|drafts_link' \
  --no-coverage
# Result: 8 passed suites; 67 passed tests

# UT-1 isolated
cd /workspace/webapp/channels && npm test -- --testPathPatterns=mention_badge_count.test --no-coverage
# Result: 6 passed

# UT-2 isolated
cd /workspace/webapp/channels && npm test -- --testPathPatterns=channel_mention_badge --no-coverage
# Result: 14 passed

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
bash /workspace/.cursor/scripts/cloud-agent-start.sh  # Docker CLI missing
```

## Regression vs iteration 1

| Scenario | Iteration 1 | Iteration 2 |
|----------|-------------|-------------|
| HP-2 | FAIL (`50`) | PASS (`99+`) |
| EC-1 | FAIL | PASS |
| EC-2 | FAIL | PASS |
| EC-3 | SKIP | PASS (unit) |
| EC-8 | FAIL | PASS |
| HP-3 | SKIP | PASS (unit) |
| ST-3 | FAIL | PASS |
| ST-4 | SKIP | PASS (unit) |
| UT-1 | FAIL (4/6) | PASS (6/6) |
| UT-2 | FAIL (3 capped tests) | PASS (14/14) |

## Manual testing note

Four manual/integration scenarios remain skipped because the Cloud Agent environment lacks Docker and the Mattermost stack was not running. Automated RTL/Jest coverage now substitutes for HP-3, EC-3, and ST-4 in addition to core formatter and component behavior.

## Defect summary

No open defects identified in iteration 2. Prior iteration-1 defects (wrong default cap, missing `+` suffix) are resolved and verified by automated tests.
