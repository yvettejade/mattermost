# YVETTE-8 — Approach plan

**Linear:** [YVETTE-8](https://linear.app/anysphere/issue/YVETTE-8/add-channel-header-empty-state-affordance-header-rhs-about)  
**Ticket summary:** [`ticket_summary.md`](./ticket_summary.md)

## Executive summary

Implement **empty-state discovery** for channel headers in two UI surfaces—the **center channel header** and the **RHS About** panel—by reusing existing i18n strings and the **`EditChannelHeaderModal`**. No backend or new strings. Work is confined to a handful of `webapp/channels` components plus unit tests. The center header component (`channel_header_text.tsx`) currently renders nothing when the header is blank; RHS About hides the header section entirely unless `channel.header` is already set (except purpose already shows an empty affordance for editors).

## Recommended approach

### Center header (`channel_header_text.tsx`)

1. **Derive display text** (unchanged): bot DM → `bot_description`; else → `channel.header`.
2. **If text is non-empty** → render `ChannelHeaderTextPopover` (unchanged).
3. **If text is empty**:
   - **Bot DM** → return `null` (no add CTA).
   - **Archived channel** (`channel.delete_at !== 0`) → return `null` (preserve existing test/behavior).
   - **Public/private** → show add control only when `haveIChannelPermission` for `MANAGE_PUBLIC_CHANNEL_PROPERTIES` or `MANAGE_PRIVATE_CHANNEL_PROPERTIES` (use `teamId` prop + channel type).
   - **DM / GM** → always show add control (members can set conversation header).
4. **Add control**: `FormattedMessage` / `formatMessage` for `channel_header.headerText.addNewButton`; use `@mattermost/shared` `Button` or existing header link styling per `webapp/STYLE_GUIDE.md`. On click: `dispatch(openModal({ modalId: ModalIdentifiers.EDIT_CHANNEL_HEADER, dialogType: EditChannelHeaderModal, dialogProps: {channel} }))`—same as `edit_conversation_header.tsx`.
5. **Connect Redux** inside `channel_header_text.tsx` via `useDispatch` + `useSelector` (popover already uses `useSelector`) rather than bloating `channel_header/index.ts`, unless parent already needs permission for other features.
6. **Remove** the unused `token` constant (likely accidental; not referenced anywhere).

### RHS About

**Channel (`about_area_channel.tsx`)** — Align with purpose block:

- Change condition from `{channel.header && (` to `{(channel.header || canEditChannelProperties) && (`.
- Add `emptyLabel={formatMessage({ id: 'channel_info_rhs.about_area.add_channel_header', ... })}` on header `EditableArea`.
- Keep `editable={canEditChannelProperties}`.

**DM (`about_area_dm.tsx`)** — Change `!dmUser.user.is_bot && channel.header` to `!dmUser.user.is_bot` so the block always shows for human DMs; pass `emptyLabel` with same i18n id; `editable={true}`.

**GM (`about_area_gm.tsx`)** — Remove `channel.header &&` guard; always show header `EditableArea` with `emptyLabel` and `editable={true}`.

No changes to `channel_info_rhs.tsx` modal wiring—`actions.editChannelHeader` already opens `EditChannelHeaderModal`.

## Phased task list

| Phase | Task | Files (primary) |
|-------|------|-----------------|
| 1 | Wire permission + empty-state button in center header; open modal | `channel_header_text.tsx` |
| 2 | RHS channel header empty state (mirror purpose) | `about_area_channel.tsx` |
| 3 | RHS DM/GM empty state | `about_area_dm.tsx`, `about_area_gm.tsx` |
| 4 | Unit tests — center header | `channel_header_text.test.tsx` |
| 5 | Unit tests — RHS About | `about_area_channel.test.tsx`, `about_area_dm.test.tsx`, `about_area_gm.test.tsx` |
| 6 | Snapshot updates if any (`channel_header.test.tsx`) | As needed |
| 7 | Manual QA | `#demo-channel` per ticket |

## Testing and verification

### Automated

From `webapp/channels` (or repo-standard test command per `server/AGENTS.md` / CI):

```bash
npm test -- channel_header_text.test.tsx
npm test -- about_area_channel.test.tsx about_area_dm.test.tsx about_area_gm.test.tsx
```

**Center header tests to add/update:**

- DM empty header → button visible; click opens modal (mock `openModal` or render with store).
- GM empty → same.
- Public channel + `manage_public_channel_properties` → button visible.
- Public channel without permission → `null` / no button.
- Private channel with `manage_private_channel_properties` → button.
- Bot DM empty description → no button.
- Non-empty header → popover text still shown (regression).
- Archived empty channel → no button.

**RHS tests to add:**

- Empty header + `canEditChannelProperties: true` → “Add a channel header” visible; click calls `editChannelHeader`.
- Empty header + `canEditChannelProperties: false` → section hidden (channel type).
- DM/GM empty → add label visible; click fires action.

### Manual (acceptance)

1. Open `#demo-channel` with no header as a user with manage properties.
2. Confirm add CTA in center header and RHS About.
3. Set header via modal; confirm both locations show saved markdown/text.
4. Repeat as user without permission (no CTA on public/private).
5. Empty DM/GM: add works; bot DM: no add CTA.

## Risks and out-of-scope

| Risk | Mitigation |
|------|------------|
| Permission logic diverges between center header and RHS | Reuse same permission constants as `channel_info_rhs/index.ts`; document matrix in PR. |
| Archived channel shows add incorrectly | Gate on `delete_at` in center header; RHS already uses `canEditChannelProperties`. |
| Modal opened without `teamId` for permission check | Ensure `teamId` passed from `channel_header.tsx` (already passed today). |
| Snapshot churn in `channel_header.test.tsx` | Update snapshots once empty button appears in fixtures with permission. |
| Unused `token` in source | Remove in implementation PR; flag security if intentional test hook. |

**Explicitly out of scope:** server/API, new i18n, new modals, purpose/rename flows, E2E unless requested separately.

## Open questions

(Carry forward from ticket summary; resolve before or during implementation PR.)

1. Confirm UX against missing PRD `docs/product-requirements/add-channel-header-functionality.md`.
2. DM/GM RHS: add section heading for parity with public/private or keep minimal empty row only?
3. Shared/read-only channel edge cases beyond standard manage-properties permission.
4. Whether center-header add button should use `ToggleModalButton` vs `openModal` dispatch for consistency with intro message.
