# YVETTE-7 — Add channel header empty-state affordance (center header + RHS About)

**Linear:** [YVETTE-7](https://linear.app/anysphere/issue/YVETTE-7/add-channel-header-empty-state-affordance-center-header-rhs-about)  
**Priority:** Medium | **Status:** Backlog  
**Referenced PRD (not in repo):** `docs/product/add-channel-header-functionality-prd.md`

## Problem statement

Users feel unanchored in channels that have no visible header text. Today, when `channel.header` is empty (and for non-bot DMs there is no bot description to show), the center channel header and the RHS About tab hide header UI entirely, so discovery of “set a header” relies on menus, intro messages, or institutional knowledge.

The goal is a **frontend-only** empty-state affordance: an obvious, in-context control to open the existing `EditChannelHeaderModal` and save via the existing `patchChannel` flow—no backend, schema, or new i18n keys.

## Requirements

### Center header (`channel_header_text.tsx`)

- When header text is empty and the user is allowed to add one, show a control labeled with existing i18n `channel_header.headerText.addNewButton` (“Add a channel header”).
- Click opens `EditChannelHeaderModal` (same as RHS / intro / menu flows).
- After save, header renders in center (existing popover) and RHS (existing markdown blocks).

### RHS About tab

| File | Current behavior | Target behavior |
|------|------------------|-----------------|
| `about_area_channel.tsx` | Header block only if `channel.header` | Show header section if header exists **or** `canEditChannelProperties`; use `EditableArea` with `emptyLabel` from `channel_info_rhs.about_area.add_channel_header` (key exists in i18n; mirror purpose pattern). |
| `about_area_dm.tsx` | Header block only if `!is_bot && channel.header` | For non-bot DMs, show header block when empty (editable add affordance). |
| `about_area_gm.tsx` | Header block only if `channel.header` | Show header block when empty (editable add affordance). |

### Permissions

| Context | Show “add” when empty? |
|---------|-------------------------|
| Public/private channel | Only if user has `manage_public_channel_properties` or `manage_private_channel_properties` (via `haveIChannelPermission`, same as RHS `canManageProperties`). |
| DM / GM (non-bot) | Always (when not archived). |
| Bot DM | Never; continue showing bot description in center header when present. |
| Archived channel | No add affordance (align with RHS `canEditChannelProperties = !isArchived && canManageProperties`). |

**RHS visibility rule (from ticket):** Channels — show header section if header exists or user can edit. DMs/GMs — show block when empty (for eligible users).

### Tests

- Update `channel_header_text.test.tsx`: today asserts `null` for empty DM/GM/public even with `manage_public_channel_properties`; acceptance criteria require add button for permitted public channel and DM/GM empty cases.
- Extend RHS tests in `about_area_channel.test.tsx`, `about_area_dm.test.tsx`, `about_area_gm.test.tsx` for empty-header add affordance and permission/bot edge cases.

### Explicitly out of scope

- Backend/API changes.
- New modals or new i18n keys.
- Channel purpose / rename flows.
- Removing legacy token in `channel_header_text.tsx` (`fOuNdMyLeAkeDaPIkEyrZW5fMTIzNDU=`, unused).
- PRD file creation (referenced but absent from workspace).

### Acceptance signals

- [ ] Empty seeded channel: add control under title for eligible users (center).
- [ ] RHS About empty state matches channel-type permission rules.
- [ ] Save via modal updates center + RHS.
- [ ] Bot DM: no add button.
- [ ] Public channel without manage properties: no add button.
- [ ] Unit tests cover DM/GM empty + permitted public channel.

## Open questions

1. **PRD location:** Issue cites `docs/product/add-channel-header-functionality-prd.md`; file is not in the repository. Should implementation follow only the Linear issue + meeting notes, or is the PRD landing on another branch/repo?
2. **Center header UX:** `_headers.scss` defines `.header-placeholder` hidden by default and shown on **channel header hover** only. Should the add affordance use that class (discoverable on hover) or be always visible for empty headers? Product/UX confirmation recommended.
3. **Archived DM/GM:** RHS gates edits with `!isArchived`; confirm center header should also suppress add for archived conversations.
4. **Shared channels / read-only members:** Any special case beyond standard channel property permissions?
5. **Unused `token` in `channel_header_text.tsx`:** Out of scope for this ticket but may confuse implementers—is it a placeholder for a future permission hook?

## Relevant codebase areas

| Path | Rationale |
|------|-----------|
| `webapp/channels/src/components/channel_header/channel_header_text.tsx` | Core center-header render; currently returns `null` when no text; must add empty-state + modal entry. |
| `webapp/channels/src/components/channel_header/channel_header_text.test.tsx` | Tests encode current “always null when empty” behavior; must flip for permitted cases. |
| `webapp/channels/src/components/channel_header/channel_header.tsx` | Renders `ChannelHeaderText` in `#channelHeaderDescription`; may need Redux props/actions if not connected in child. |
| `webapp/channels/src/components/channel_header/index.ts` | Redux connect for channel header; natural place to add `openModal` + permission selectors if wiring at parent. |
| `webapp/channels/src/sass/layout/_headers.scss` | `.header-placeholder` and `.channel-header__description` layout; likely styling for add control. |
| `webapp/channels/src/components/channel_info_rhs/about_area_channel.tsx` | Channel RHS; header gated on `channel.header` only—needs purpose-like empty pattern. |
| `webapp/channels/src/components/channel_info_rhs/about_area_dm.tsx` | DM RHS; header gated on `channel.header`. |
| `webapp/channels/src/components/channel_info_rhs/about_area_gm.tsx` | GM RHS; header gated on `channel.header`. |
| `webapp/channels/src/components/channel_info_rhs/components/editable_area.tsx` | Reusable empty-state button (`emptyLabel` + `onEdit`) used for purpose; reuse for header on RHS. |
| `webapp/channels/src/components/channel_info_rhs/index.ts` | `canManageProperties` via `haveIChannelPermission`; reference for center-header permission parity. |
| `webapp/channels/src/components/channel_info_rhs/channel_info_rhs.tsx` | `editChannelHeader` opens `EditChannelHeaderModal`; pattern to duplicate for center header. |
| `webapp/channels/src/components/edit_channel_header_modal/` | Existing save path (`patchChannel`); no changes expected beyond invocation. |
| `webapp/channels/src/i18n/en.json` | `channel_header.headerText.addNewButton`, `channel_info_rhs.about_area.add_channel_header` already defined. |
| `webapp/channels/src/components/post_view/channel_intro_message/channel_intro_message.tsx` | `createSetHeaderButton` + `ToggleModalButton` reference for modal wiring. |
| `server/` | No implementation expected; channel header stored on channel model and patched via existing API (consumed by `patchChannel`). |
| `docs/product/add-channel-header-functionality-prd.md` | Cited in issue but missing—track as doc dependency only. |

## Suggested investigation order

1. Read `channel_header_text.tsx` and `_headers.scss` (`.header-placeholder`) to confirm center-header DOM/class contract.
2. Trace `channel_info_rhs/index.ts` permission helpers and mirror for center header (`haveIChannelPermission`, archived check, bot DM).
3. Compare RHS purpose empty state in `about_area_channel.tsx` + `EditableArea` and apply the same pattern to header blocks in channel/DM/GM about areas.
4. Choose wiring for center modal: `ToggleModalButton` vs `openModal` from `actions/views/modals` (follow `channel_info_rhs.tsx` / intro message).
5. Update unit tests in `channel_header_text.test.tsx` and the three `about_area_*.test.tsx` files.
6. Manual verification on demo sandbox: empty channel → center + RHS → save → both surfaces update; bot DM and permission-negative public channel.
