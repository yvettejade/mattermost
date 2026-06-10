# YVETTE-10: Approach Plan — Add Channel Header Functionality

## Executive summary

Restore empty-state **Add a channel header** affordances in the center channel header and channel info RHS About tab by re-applying a prior, reverted webapp-only change set. The implementation is well-scoped: eight files under `webapp/channels/src/components/`, no server or i18n work, and a known reference implementation in git commit `ab2e685696`. Current code returns `null` or hides header sections when `channel.header` is empty; the fix wires existing `EditChannelHeaderModal` through `openModal` and `EditableArea` empty labels.

Estimated diff size matches the Linear ticket (~+300 / −80 lines across production + test files).

## Recommended approach

**Cherry-pick or manual re-apply of commit `ab2e685696`**, with cleanup:

1. Remove the unrelated `token` constant introduced in `34de4b11b7`.
2. Verify tests from that commit still pass against current `main`/`master` dependencies.
3. Do not introduce new i18n keys, modals, or API routes.

### Center header (`channel_header_text.tsx`)

Refactor the early `return null` when `!hasHeaderText` into a branching flow:

```
hasHeaderText → ChannelHeaderTextPopover
isArchived || isBotDM (empty) → null
isDM || isGM → AddChannelHeaderTextButton
public/private → ChannelPermissionGate(manage_*_channel_properties) → AddChannelHeaderTextButton
```

`AddChannelHeaderTextButton` mirrors `edit_conversation_header.tsx`: `useDispatch` + `openModal({ modalId: EDIT_CHANNEL_HEADER, dialogType: EditChannelHeaderModal, dialogProps: { channel } })`. Use `header-placeholder style--none` button styling (CSS already in `_headers.scss`).

### RHS About areas

| File | Change |
|------|--------|
| `about_area_channel.tsx` | Guard: `(channel.header \|\| canEditChannelProperties)`; conditional `content={channel.header && (...)}`; add `emptyLabel` |
| `about_area_dm.tsx` | Guard: `!dmUser.user.is_bot` (drop `channel.header &&`); conditional content; add `emptyLabel` |
| `about_area_gm.tsx` | Remove `channel.header &&` outer guard; conditional content; add `emptyLabel` |

Archived channels are already handled upstream: `channel_info_rhs.tsx` sets `canEditChannelProperties = false` when archived, so public/private RHS will not show the empty header section for archived channels.

## Phased task list

### Phase A — Center channel header

1. Update `channel_header_text.tsx` per branching flow above; remove stray `token` constant.
2. Add imports: `FormattedMessage`, `useDispatch`, `Permissions`, `openModal`, `EditChannelHeaderModal`, `ChannelPermissionGate`, `ModalIdentifiers`, `Constants` channel type constants.
3. Implement `AddChannelHeaderTextButton` subcomponent.

### Phase B — RHS About tab

4. `about_area_channel.tsx`: widen visibility guard; add `emptyLabel`; make `content` conditional on `channel.header`.
5. `about_area_dm.tsx`: show block for all non-bot DMs; add `emptyLabel`; conditional content.
6. `about_area_gm.tsx`: always show block; add `emptyLabel`; conditional content.

### Phase C — Tests

7. `channel_header_text.test.tsx`:
   - Replace "should return null for DM/GM without header" with add-button expectations.
   - Replace "should return null for public channels without header regardless of permissions" with split cases: with permission → button; without → null.
   - Add private channel + `manage_private_channel_properties` case.
   - Add click handler test mocking `openModal`.
   - Keep archived + empty bot description → `null` tests.
8. `about_area_channel.test.tsx`: empty header + `canEditChannelProperties: true` → **Add a channel header**; click → `editChannelHeader`; not editable + empty → no section.
9. `about_area_dm.test.tsx`: empty header non-bot → affordance; bot + empty → no channel header text.
10. `about_area_gm.test.tsx`: empty header → affordance.

### Phase D — Verification

11. Run focused Jest on the four test files.
12. ESLint on the eight touched source/test files.
13. Manual smoke (local/staging): empty channel → center add button + RHS About empty state → modal → save → header visible in both places.

## Testing and verification

### Automated

```bash
cd webapp/channels
npm test -- --testPathPattern='channel_header_text|about_area_channel|about_area_dm|about_area_gm' --no-coverage
```

Optional lint:

```bash
cd webapp/channels
npx eslint src/components/channel_header/channel_header_text.tsx \
  src/components/channel_info_rhs/about_area_channel.tsx \
  src/components/channel_info_rhs/about_area_dm.tsx \
  src/components/channel_info_rhs/about_area_gm.tsx
```

### Manual demo (from Linear ticket)

1. Open a channel with no header (e.g. `#demo-channel` after seed).
2. Confirm **Add a channel header** under the channel title in the center header (for eligible users/channel types).
3. Open channel info RHS → About → confirm add/edit header empty state for editors.
4. Add text, save, confirm header displays in center header and RHS; edit tooltip works on existing header.

### Regression checks

- Bot DM with description: still shows description in center header (no add button).
- Bot DM without description: `null` in center header; no RHS header block.
- Archived channel: center header `null`; RHS no editable header section.
- Channel with existing header: unchanged popover / markdown display.

## Risks and out-of-scope

### Risks

| Risk | Mitigation |
|------|------------|
| Prior revert (`b2c538a5b6`) may reflect product decision | Linear ticket explicitly requests restore; confirm with Yvette if UX pushback |
| `ChannelPermissionGate` needs `teamId` | `channel_header.tsx` already passes `teamId={team?.id}` |
| `EditableArea` requires `emptyLabel` prop | Add on all three about-area header instances; match purpose pattern |
| Test mocks for `openModal` | Follow pattern from `edit_conversation_header.test.tsx` or restore commit tests |

### Out of scope

- Server-side header storage, validation, or new API routes
- New modals or permission model changes
- New i18n keys (reuse existing)
- Channel purpose or rename flows
- Removing or changing `channel_intro_message` header editing paths
- Plugin/channel header plug behavior

## Open questions

1. **Confirm re-apply intent** — Was `b2c538a5b6` a deliberate product rollback or accidental? Linear YVETTE-10 implies intentional restore.
2. **Token cleanup** — Remove `fOuNdMyLeAkeDaPIkEyrZW5fMTIzNDU=` during implementation (unrelated leak-scan artifact).
3. **Shared `Button` vs placeholder** — Prefer matching upstream Mattermost `header-placeholder` button unless design review mandates `@mattermost/shared` Button.
4. **Private channel test coverage** — Restore commit may lack explicit private-channel test; add per Linear spec.
5. **Browser verification in Cloud** — Document pass/fail from local manual demo; Cloud agent environment may not run full Mattermost stack.
