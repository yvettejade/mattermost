# YVETTE-8 — Add channel header empty-state affordance (header + RHS About)

**Linear:** [YVETTE-8](https://linear.app/anysphere/issue/YVETTE-8/add-channel-header-empty-state-affordance-header-rhs-about)  
**Branch context:** `cursor/YVETTE-8-linear-issue-documentation-fd2e`  
**Referenced PRD (not in repo):** `docs/product-requirements/add-channel-header-functionality.md`

## Problem statement

Users often do not discover that Mattermost channels support a **channel header** (topic-style text shown under the channel title in the center header and in the RHS **About** panel). Today, when no header is set, the UI renders **nothing** in those surfaces—there is no affordance to add one.

The product goal is a **frontend-only** discovery improvement: show an **“Add a channel header”** call-to-action in the center channel header and in RHS About for eligible channel types, wired to the existing **`EditChannelHeaderModal`** (no new modals, APIs, or i18n keys).

## Requirements

### In scope

| Area | Behavior |
|------|----------|
| **Center header** (`channel_header_text.tsx`) | Empty header → button using existing i18n `channel_header.headerText.addNewButton` → opens `EditChannelHeaderModal`. Non-empty → keep `ChannelHeaderTextPopover`. |
| **Permissions (center + public/private RHS)** | Public/private: show add only with **manage channel properties**. DM/GM: always show add when empty. Bot DM: never show add; show bot description when present (existing behavior). |
| **RHS About — channel** (`about_area_channel.tsx`) | Show Channel Header section if header exists **or** `canEditChannelProperties`; use `emptyLabel` i18n `channel_info_rhs.about_area.add_channel_header` (mirror purpose block). |
| **RHS About — DM/GM** (`about_area_dm.tsx`, `about_area_gm.tsx`) | Show header block when empty (not only when `channel.header` is set); wire `editChannelHeader` via `EditableArea` empty state. |
| **Tests** | Extend `channel_header_text.test.tsx` (DM/GM empty → button; public/private with/without permission). Update RHS About tests as needed. |

### Out of scope

- Backend/API, storage, or sync changes
- New modals or new i18n keys
- Channel purpose, rename, or other About flows

### Acceptance signals

- Permitted user on empty public/private channel sees add CTA in **center header** and **RHS About**; saving updates both.
- User **without** manage-channel-properties permission sees **no** add CTA on public/private.
- Empty DM/GM shows add CTA; save works.
- Bot DM: bot description when present; **no** add CTA.
- Existing non-empty header behavior unchanged (popover + markdown display).
- Unit tests pass.
- Manual QA: `#demo-channel` (no header) → verify empty states → add header → verify both locations.

## Open questions

1. **PRD missing from tree** — Issue cites `docs/product-requirements/add-channel-header-functionality.md`; that path is not present in this workspace. Confirm UX copy, visual design (button vs link), and archived-channel behavior against PRD or design mocks.
2. **Archived channels** — `channel_header_text.test.tsx` expects `null` when `delete_at !== 0` and header is empty. Should empty-state add be suppressed for archived channels in center header and RHS? (RHS already uses `canEditChannelProperties = !isArchived && canManageProperties` in `channel_info_rhs.tsx`.)
3. **Center-header permission wiring** — `ChannelHeaderText` is a presentational child of `channel_header.tsx`; `channel_header/index.ts` does not currently pass `canManageProperties`. Prefer connecting `channel_header_text` (e.g. `useSelector` + `haveIChannelPermission`) vs extending parent props?
4. **Suspicious unused constant** — `channel_header_text.tsx` contains an unused `token` string (`fOuNdMyLeAkeDaPIkEyrZW5fMTIzNDU=`). Treat as accidental/leak-test artifact and remove during implementation? (Security review.)
5. **DM/GM RHS heading** — Public/private About uses a “Channel Header” heading; DM/GM blocks currently omit that heading when header exists. Should empty-state DM/GM match channel layout (heading + `EditableArea`) or only add empty affordance without heading?
6. **Shared channels / read-only** — Any extra gating beyond standard `MANAGE_*_CHANNEL_PROPERTIES` for shared or remote-hosted channels?

## Relevant codebase areas

| Path | Rationale |
|------|-----------|
| `webapp/channels/src/components/channel_header/channel_header_text.tsx` | Core change: today returns `null` when `!hasHeaderText`; must render add button + modal for permitted empty states. |
| `webapp/channels/src/components/channel_header/channel_header_text.test.tsx` | Tests explicitly expect `null` for empty DM/GM/public—even with `manage_public_channel_properties`; all must be inverted/extended per ticket. |
| `webapp/channels/src/components/channel_header/channel_header_text_popover.tsx` | Unchanged for non-empty header; uses markdown popover. |
| `webapp/channels/src/components/channel_header/channel_header.tsx` | Renders `<ChannelHeaderText>` inside `#channelHeaderDescription`; may need props or stays unchanged if child self-connects. |
| `webapp/channels/src/components/channel_header/index.ts` | Redux map for channel header; candidate place to pass `teamId` / permission if not wired inside `channel_header_text`. |
| `webapp/channels/src/components/edit_channel_header_modal/` | Existing modal; opened elsewhere via `openModal` + `ModalIdentifiers.EDIT_CHANNEL_HEADER` or `ToggleModalButton`. |
| `webapp/channels/src/components/channel_header_menu/menu_items/edit_conversation_header.tsx` | Reference pattern: `dispatch(openModal({ dialogType: EditChannelHeaderModal, dialogProps: {channel} }))`. |
| `webapp/channels/src/components/post_view/channel_intro_message/channel_intro_message.tsx` | `createSetHeaderButton` uses `ToggleModalButton` + `EditChannelHeaderModal` for intro empty state. |
| `webapp/channels/src/components/channel_info_rhs/about_area_channel.tsx` | Header section gated on `channel.header` only (lines 125–146); purpose already uses `(purpose \|\| canEditChannelProperties)` + `emptyLabel`. |
| `webapp/channels/src/components/channel_info_rhs/about_area_dm.tsx` | Header block gated on `!is_bot && channel.header`; needs empty editable state for non-bot DMs. |
| `webapp/channels/src/components/channel_info_rhs/about_area_gm.tsx` | Header block gated on `channel.header` only. |
| `webapp/channels/src/components/channel_info_rhs/components/editable_area.tsx` | Shared empty-state control (`EmptyPlace` + `emptyLabel`); channel header section missing `emptyLabel` today. |
| `webapp/channels/src/components/channel_info_rhs/channel_info_rhs.tsx` | Defines `editChannelHeader` → `EditChannelHeaderModal`; `canEditChannelProperties` derived from `canManageProperties` + archive. |
| `webapp/channels/src/components/channel_info_rhs/index.ts` | `haveIChannelPermission` for `MANAGE_PUBLIC/PRIVATE_CHANNEL_PROPERTIES`. |
| `webapp/channels/src/components/channel_info_rhs/about_area_*.test.tsx` | Need cases for empty header + add label clicks. |
| `webapp/channels/src/i18n/en.json` | Keys already exist: `channel_header.headerText.addNewButton`, `channel_info_rhs.about_area.add_channel_header`. |
| `server/channels/api4/channel.go` | Channel update persists `Header` field; no server work expected (confirm only). |

## Suggested investigation order

1. Read existing modal open patterns (`edit_conversation_header.tsx`, `channel_intro_message.tsx` `ToggleModalButton`) and pick one consistent approach for center-header add button.
2. Implement permission matrix in `channel_header_text.tsx` (channel type, bot DM, archive, `haveIChannelPermission`) and remove dead `token` if confirmed spurious.
3. Mirror **purpose** empty-state pattern in `about_area_channel.tsx` for header (`(header \|\| canEditChannelProperties)` + `emptyLabel`).
4. Update `about_area_dm.tsx` / `about_area_gm.tsx` to always show editable header block for eligible users (non-bot DM).
5. Update unit tests in `channel_header_text.test.tsx` and RHS About test files; run targeted Jest suites.
6. Manual QA on `#demo-channel` per ticket (header + RHS sync after save).
