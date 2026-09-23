# QA Plan: Sidebar mention badge 99+ display cap

## Feature summary

PR #14 (`demo/qa-bugbot-mention-badge` → `master`) introduces a shared formatter for sidebar unread mention badges so large counts do not overflow the sidebar UI.

**Intent (per PR description):** When a channel or the Threads sidebar entry has more than 99 unread mentions, the visible badge text should show `99+` instead of the raw number. Screen-reader and link `aria-label` text should continue to expose the full mention count.

**Implementation scope (3 files):**

- `webapp/channels/src/utils/mention_badge_count.ts` — new `MENTION_BADGE_CAP` constant (99) and `formatMentionBadgeCount()` helper.
- `webapp/channels/src/utils/mention_badge_count.test.ts` — unit tests for the helper.
- `webapp/channels/src/components/sidebar/sidebar_channel/channel_mention_badge.tsx` — replaces raw `{unreadMentions}` with `{formatMentionBadgeCount(unreadMentions)}`.

**Downstream surfaces (via `ChannelMentionBadge`, unchanged in this PR but affected by formatting):**

- Left-hand sidebar channel links (`sidebar_channel_link.tsx`)
- Global Threads link (`global_threads_link.tsx`)
- Drafts link (`drafts_link.tsx`)
- Recaps link (`recaps_link.tsx`)

**Not changed in this PR:** Team sidebar badges (`team_button.tsx` already caps inline with `mentions > 99 ? '99+' : mentions`), channel-switch modal mention text, server mention counting, or desktop notification DOM scraping (`#unreadMentions` / `.badge` offsetHeight behavior).

## Happy path (scenario IDs HP-1, HP-2, ...)

- **HP-1:** A sidebar channel with 1–99 unread mentions displays the exact numeric count in `#unreadMentions`.
- **HP-2:** A sidebar channel with more than 99 unread mentions displays `99+` in the badge (per product spec).
- **HP-3:** The Global Threads sidebar link with more than 99 unread thread mentions displays `99+`.
- **HP-4:** A channel or Threads entry with zero unread mentions renders no mention badge (`ChannelMentionBadge` returns `null`).
- **HP-5:** Opening a channel and marking mentions read drives the badge count down and eventually removes the badge when count reaches 0.

## Edge cases (EC-1, ...)

- **EC-1:** Exactly 99 mentions displays `99` (not `99+`); exactly 100 displays `99+`.
- **EC-2:** Urgent mention styling (`badge urgent` class) and urgent tooltip still apply when the displayed count is capped.
- **EC-3:** Drafts and Recaps sidebar links inherit the same capped display when `unreadCount` exceeds 99.
- **EC-4:** Accessibility: channel link `aria-label` (built in `sidebar_channel_link.getAriaLabel`) still includes the full numeric mention count (e.g. `150 mentions`), not the capped display string.
- **EC-5:** Team sidebar badge behavior remains `99+` at >99 and is unchanged by this PR (regression guard).
- **EC-6:** Badge layout: capped `99+` text fits within sidebar badge CSS (`.badge`, `.badge-max-number` where applicable) without clipping or widening the channel row.
- **EC-7:** Desktop app DOM scraping: badges with capped text still have non-zero `offsetHeight` when visible (sidebar SCSS hides badges via visibility, not `display: none`).
- **EC-8:** Static consistency: `MENTION_BADGE_CAP` (99), JSDoc (“display as 99+”), default `cap` parameter, and actual return value (`cap` vs `cap+`) are aligned in `formatMentionBadgeCount`.

## State transitions (ST-1, ...) — valid states, triggers, expected next state

| ID | Valid states | Trigger | Expected next state |
|----|--------------|---------|---------------------|
| ST-1 | No badge (count = 0) | User receives first @mention in channel | Badge visible with `1` |
| ST-2 | Badge showing N (1 ≤ N ≤ 99) | Additional mentions arrive; count stays ≤ 99 | Badge updates to new exact count |
| ST-3 | Badge showing 98 or 99 | One more mention pushes total to 99 or 100 | At 99: shows `99`; at 100: shows `99+` |
| ST-4 | Badge showing `99+` (count > 99) | User reads some but not all mentions; count still > 99 | Badge still shows `99+` |
| ST-5 | Badge showing `99+` or any N > 0 | User marks channel read / views all mention posts | Badge hidden (count = 0) |
| ST-6 | Threads badge with N > 0 | User marks all threads read (including modal flow) | Threads `#unreadMentions` badge removed |
| ST-7 | Channel badge visible | User mutes channel with unread mentions | Badge behavior follows existing mute rules (no new regression) |

## Out of scope

- Server-side or WebSocket mention count computation (`mention_count`, `mention_count_root`).
- Team switcher badge formatting (separate inline logic in `team_button.tsx`).
- Channel switch / quick-switch modal mention display (`switch_channel_provider.tsx`).
- Push/desktop notification numeric payloads.
- Internationalization changes (no `en.json` edits in this PR).
- Collapsed-reply-threads feature-flag matrix beyond Threads link badge display.
- Visual redesign of badge colors, fonts, or urgent-indicator semantics.

## Scenario table

| ID | Type | Preconditions | Steps | Expected | Modality |
|----|------|---------------|-------|----------|----------|
| HP-1 | Happy path | Channel with 3 unread @mentions | Load Mattermost; locate channel in LHS sidebar | `#unreadMentions` text is `3` | manual |
| HP-2 | Happy path | Channel with >99 unread mentions (seed via API or bulk posts) | Open app; inspect channel badge | Badge shows `99+` | manual |
| HP-3 | Happy path | CRT enabled; Threads aggregate mentions > 99 | Inspect `#sidebarItem_threads` badge | `#unreadMentions` shows `99+` | manual |
| HP-4 | Happy path | Channel with 0 unread mentions | View channel in sidebar | No `.badge` / `#unreadMentions` for that channel | unit |
| HP-5 | Happy path | Channel with unread mentions | Open channel; scroll/read mention posts or use mark-read | Badge count decreases; disappears at 0 | integration |
| EC-1 | Edge case | Controllable mention count at boundary | Set counts to 98, 99, 100 sequentially | `98`, `99`, then `99+` respectively | unit |
| EC-2 | Edge case | Channel with urgent mention and count > 99 | Hover badge; inspect DOM classes | `badge urgent` present; urgent tooltip on hover | manual |
| EC-3 | Edge case | Drafts or Recaps unread count > 99 | Open sidebar Drafts/Recaps entry | Capped `99+` display via `ChannelMentionBadge` | manual |
| EC-4 | Edge case | Channel with 150 mentions | Inspect channel link `aria-label` (accessibility tree) | Label includes `150 mentions` (full count), not `99+` | manual |
| EC-5 | Edge case | Team with >99 mentions across channels | Inspect team button badge | Still `99+` (unchanged `team_button.tsx` behavior) | manual |
| EC-6 | Edge case | Channel with 999+ mentions | Visual check at 1280px and 1920px widths | Badge text does not overflow or break sidebar layout | manual |
| EC-7 | Edge case | Channel with capped badge visible | In desktop app or DOM inspection, read `#unreadMentions` offsetHeight | `offsetHeight > 0` while badge visible | integration |
| EC-8 | Edge case | PR branch checked out | Review `mention_badge_count.ts`: `MENTION_BADGE_CAP`, default `cap`, return format | Constant, default param, JSDoc, and return value (`99+` at >99) are consistent | static |
| ST-1 | State transition | User in channel with 0 mentions | Post message @mentioning user | Badge appears showing `1` | integration |
| ST-2 | State transition | Badge shows exact count ≤ 99 | Add another @mention | Badge increments by 1 | integration |
| ST-3 | State transition | Badge at 98 | Add 1 then 2 more mentions | `99` then `99+` | unit |
| ST-4 | State transition | Badge shows `99+` (count 120) | Read posts until count is 101 | Badge still `99+` | manual |
| ST-5 | State transition | Badge visible | Mark channel read | Badge removed | integration |
| ST-6 | State transition | Threads badge visible | Mark all threads read | Threads badge gone | integration |
| ST-7 | State transition | Unread mentions in channel | Mute channel from sidebar menu | No regression in mute + badge interaction | manual |
| UT-1 | Unit | None | Run `formatMentionBadgeCount` tests in `mention_badge_count.test.ts` | Small count unchanged; `MENTION_BADGE_CAP === 99`; add/verify cap-boundary and `99+` cases | unit |
| UT-2 | Unit | None | Run `channel_mention_badge.test.tsx` | Existing render, urgent, and tooltip tests pass; add case for capped display if missing | unit |
