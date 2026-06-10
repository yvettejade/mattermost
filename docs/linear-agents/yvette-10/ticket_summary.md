# YVETTE-10: Add Channel Header Functionality

**Linear:** [YVETTE-10](https://linear.app/anysphere/issue/YVETTE-10/add-channel-header-functionality)  
**Status:** Backlog  
**Priority:** No priority

## Problem statement

When a channel has no header text, users currently have no obvious way to add one from the center channel header or from the channel info RHS About tab. The center header and RHS About areas return `null` or hide the Channel Header section entirely when `channel.header` is empty, even though:

- i18n strings for empty-state affordances already exist (`channel_header.headerText.addNewButton`, `channel_info_rhs.about_area.add_channel_header`).
- `EditChannelHeaderModal` and the channel patch API already support setting headers.
- Upstream Mattermost-style empty-state editing was previously implemented in this fork (commit `ab2e685696`) and later reverted (`b2c538a5b6`).

The goal is to restore empty-state **Add a channel header** affordances in both surfaces, reusing the existing modal flow. No server changes or new API routes.

## Requirements

### Center channel header (`channel_header_text.tsx`)

| Condition | Expected behavior |
|-----------|-------------------|
| Header text present | Show `ChannelHeaderTextPopover` (unchanged) |
| Empty header, DM or GM | Show **Add a channel header** button; click opens `EditChannelHeaderModal` |
| Empty header, public/private channel | Show button only when user has `manage_public_channel_properties` or `manage_private_channel_properties` (via `ChannelPermissionGate`) |
| Bot DM | Show bot description when present; no add button for bots |
| Archived channel (`delete_at !== 0`) | Return `null` (no affordance) |

Implementation detail: new `AddChannelHeaderTextButton` helper dispatches `openModal` with `ModalIdentifiers.EDIT_CHANNEL_HEADER` and `EditChannelHeaderModal`.

### Channel info RHS About tab

**`about_area_channel.tsx`**

- Show Channel Header section when `channel.header` **or** `canEditChannelProperties` is true (mirror purpose section pattern).
- Pass `emptyLabel` to `EditableArea` for empty-state editing.

**`about_area_dm.tsx`**

- Show `ChannelHeader` block for non-bot DMs even when `channel.header` is empty.
- Add `emptyLabel`: **Add a channel header**.

**`about_area_gm.tsx`**

- Always show `ChannelHeader` block (remove `channel.header &&` guard).
- Add the same `emptyLabel`.

`EditableArea` already renders empty-state UI when `content` is falsy and `editable` is true.

### Tests

| File | New/updated expectations |
|------|--------------------------|
| `channel_header_text.test.tsx` | DM/GM without header → add button; public/private with manage permission → add button; no permission → `null`; click → `openModal` with `EditChannelHeaderModal` |
| `about_area_channel.test.tsx` | Editable + empty header → **Add a channel header**, click triggers `editChannelHeader` |
| `about_area_dm.test.tsx` | Empty header → add affordance; bot DM + empty header → no affordance |
| `about_area_gm.test.tsx` | Empty header → add affordance |

### Constraints

- No server changes; no new API routes.
- Reuse existing i18n keys (no new strings).
- Reuse `EditChannelHeaderModal` (no new modals).
- Out of scope: header storage/sync, purpose/rename flows, permissions model changes.

### Acceptance signals

1. Center header shows **Add a channel header** under the channel title when header is empty (for eligible channel types/users).
2. RHS About tab shows empty-state header editing for DM, GM, and editable public/private channels.
3. Clicking add affordance opens `EditChannelHeaderModal`; saving displays header in both places.
4. Focused Jest tests pass for all eight touched files.
5. Archived channels and bot DMs behave per spec above.

## Open questions

1. **Stray token in `channel_header_text.tsx`:** Current file contains `const token = 'fOuNdMyLeAkeDaPIkEyrZW5fMTIzNDU=';` (added in commit `34de4b11b7`). Unrelated to this feature; should be removed during implementation as dead code / possible scan artifact.
2. **Revert rationale:** Commit `b2c538a5b6` ("rm channel holder") reverted the prior restore (`ab2e685696`). No PR description in history; confirm with author whether re-apply is intentional (Linear ticket suggests yes).
3. **`EditableArea` `emptyLabel` typing:** `about_area_channel.tsx` currently omits `emptyLabel` on the header `EditableArea` (TypeScript may rely on optional prop or strictness settings). Implementation should align with purpose section and satisfy `EditableAreaProps`.
4. **Button vs shared `Button`:** Prior restore used raw `<button className='header-placeholder style--none'>`. `webapp/AGENTS.md` prefers `@mattermost/shared/components/button`; upstream Mattermost uses the placeholder class. Match prior restore / upstream styling unless style guide override is required.
5. **Browser verification:** Ticket notes Cloud Docker unavailable; manual demo steps documented but may need local/staging verification.

## Relevant codebase areas

| Path | Rationale |
|------|-----------|
| `webapp/channels/src/components/channel_header/channel_header_text.tsx` | Primary center-header component; currently returns `null` when no header text |
| `webapp/channels/src/components/channel_header/channel_header_text.test.tsx` | Tests assert `null` for empty DM/GM/public; need inversion for add-button cases |
| `webapp/channels/src/components/channel_header/channel_header.tsx` | Renders `ChannelHeaderText` in `#channelHeaderDescription` |
| `webapp/channels/src/sass/layout/_headers.scss` | `.header-placeholder` styles for add-button appearance |
| `webapp/channels/src/components/channel_info_rhs/about_area_channel.tsx` | Public/private RHS; header section gated on `channel.header` only |
| `webapp/channels/src/components/channel_info_rhs/about_area_dm.tsx` | DM RHS; header gated on `!is_bot && channel.header` |
| `webapp/channels/src/components/channel_info_rhs/about_area_gm.tsx` | GM RHS; header gated on `channel.header` |
| `webapp/channels/src/components/channel_info_rhs/components/editable_area.tsx` | Empty-state via `emptyLabel` + `EmptyPlace` button |
| `webapp/channels/src/components/channel_info_rhs/channel_info_rhs.tsx` | Wires `editChannelHeader` → `openModal` + `EditChannelHeaderModal`; computes `canEditChannelProperties` |
| `webapp/channels/src/components/edit_channel_header_modal/` | Existing modal to reuse |
| `webapp/channels/src/components/permissions_gates/channel_permission_gate.tsx` | Permission gating for public/private center-header add button |
| `webapp/channels/src/components/channel_header_menu/menu_items/edit_conversation_header.tsx` | Reference pattern for opening `EditChannelHeaderModal` |
| `webapp/channels/src/i18n/en.json` | Existing keys `channel_header.headerText.addNewButton`, `channel_info_rhs.about_area.add_channel_header` |
| `server/channels/api4/channel.go` | Confirms DM/GM header edits require membership only; no webapp API work needed |

## Suggested investigation order

1. Read current `channel_header_text.tsx` and compare with restore commit `ab2e685696` (known-good implementation diff).
2. Trace `ChannelHeaderText` usage in `channel_header.tsx` and archived/bot DM handling.
3. Review `about_area_*.tsx` guards vs purpose-section pattern in `about_area_channel.tsx`.
4. Confirm `EditableArea` empty-state contract (`emptyLabel`, `editable`, falsy `content`).
5. Review `channel_info_rhs.tsx` for `canEditChannelProperties` and archived-channel behavior (RHS already passes `canEditChannelProperties: false` when archived).
6. Map test changes from restore commit tests (or Linear spec) before coding.
7. Run focused Jest: `channel_header_text.test.tsx`, `about_area_channel.test.tsx`, `about_area_dm.test.tsx`, `about_area_gm.test.tsx`.
8. Optional: ESLint on touched files; manual browser check per ticket demo steps.
