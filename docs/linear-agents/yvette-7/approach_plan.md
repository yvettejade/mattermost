# YVETTE-7 — Approach plan: Channel header empty-state affordance

## Executive summary

Implement discoverable “add channel header” empty states in the **center channel header** and **RHS About** tab using existing UI primitives: i18n strings, `EditChannelHeaderModal`, `patchChannel`, `EditableArea`, and `haveIChannelPermission`. No server work. The codebase already contains i18n keys and SCSS hooks (`.header-placeholder`); production TSX still hides all header UI when `channel.header` is empty.

Estimated touch surface: ~6–8 frontend files plus tests, low integration risk because save/edit paths are mature.

## Recommended approach

### 1. Center header — `ChannelHeaderText`

**Permission helper (new local logic or shared util):**

```text
canShowAddHeader(channel, dmUser, canManageChannelProperties, isArchived):
  - if archived → false
  - if bot DM → false
  - if DM or GM → true (non-bot path already handled)
  - if O/P → canManageChannelProperties
```

Source `canManageChannelProperties` the same way as `webapp/channels/src/components/channel_info_rhs/index.ts` (public vs private permission constant).

**Rendering when `!hasHeaderText`:**

- If `canShowAddHeader`, render a button (or `ToggleModalButton`) with:
  - Label: `formatMessage({ id: 'channel_header.headerText.addNewButton', ... })`
  - Class: `header-placeholder` (matches `_headers.scss` hover behavior)
  - `aria-label` aligned with visible text
  - Opens `EditChannelHeaderModal` with `{ channel }`
- Else return `null` (preserves bot-description-only and permission-denied cases).

**Redux wiring:** Prefer a thin `channel_header_text/index.ts` `connect()` (or extend `channel_header/index.ts`) to supply:

- `canManageProperties` (or precomputed `canShowAddHeader`)
- `isArchived` from `isCurrentChannelArchived`
- `openModal` action (same as RHS)

Avoid duplicating modal open logic inline in presentational component.

**Remove or ignore** the unused `token` constant per ticket out-of-scope unless a separate cleanup ticket exists.

### 2. RHS About — mirror purpose pattern

**`about_area_channel.tsx`**

- Change condition from `{channel.header && (` to `{(channel.header || canEditChannelProperties) && (`.
- Always render `ChannelDescriptionHeading` when section visible.
- Pass `content={channel.header ? <LineLimiter>...</LineLimiter> : undefined}` (or falsy).
- Add `emptyLabel={formatMessage({ id: 'channel_info_rhs.about_area.add_channel_header', ... })}` on `EditableArea` (same as purpose’s `add_channel_purpose`).

**`about_area_dm.tsx`**

- Change `{!dmUser.user.is_bot && channel.header && (` to `{!dmUser.user.is_bot && (` so block shows when empty.
- Use `EditableArea` with `editable={true}`, `emptyLabel` for add header, content conditional on `channel.header`.

**`about_area_gm.tsx`**

- Change `{channel.header && (` to always show `ChannelHeader` block for GMs.
- Same `EditableArea` empty pattern as DM.

No changes to `channel_info_rhs.tsx` modal handlers—`editChannelHeader` already correct.

### 3. Styling

- Center: use existing `.header-placeholder` in `_headers.scss` (flex, muted color, pencil icon on hover). Verify layout alongside guest/autotranslation dividers (`:has(.header-placeholder)` rules already present).
- If product wants always-visible empty state, adjust SCSS in a follow-up (see open questions)—default implementation should match existing hover-reveal design unless UX overrides.

### 4. Tests

| File | Changes |
|------|---------|
| `channel_header_text.test.tsx` | Replace “null for empty DM/GM” with “shows add button”; add “null without permission” for public channel; keep archived/bot-empty null cases; add click opens modal (mock `openModal` or render connected wrapper). |
| `about_area_channel.test.tsx` | Empty header + `canEditChannelProperties: true` shows add label; false hides section. |
| `about_area_dm.test.tsx` | Empty header shows add; bot still hides header block. |
| `about_area_gm.test.tsx` | Empty header shows add. |

Run targeted Jest:

```bash
cd webapp/channels && npm test -- --testPathPattern="channel_header_text|about_area_(channel|dm|gm)" --no-cache
```

## Phased task list

| Phase | Task | Done when |
|-------|------|-----------|
| **A** | Add permission + modal wiring to center header component | Empty eligible channel shows add control; ineligible shows nothing |
| **B** | Update RHS about_area_channel / dm / gm | Empty states use `EditableArea` + existing i18n |
| **C** | Unit tests green for all touched test files | CI-style local Jest pass |
| **D** | Manual sandbox verification | Center + RHS save updates both surfaces; bot DM and no-permission public negative |

## Testing and verification

### Automated

- Unit tests listed above (primary gate for this automation run).
- Optional: snapshot or accessibility check on `header-placeholder` button `aria-label`.

### Manual (demo sandbox per ticket)

1. Seed or open `#demo-channel` without header as user with manage channel properties.
2. Confirm center add affordance (hover if using `.header-placeholder`).
3. Open RHS About → see matching empty/add row.
4. Set header text in modal → save.
5. Confirm center popover text and RHS markdown match.
6. Repeat as user **without** manage properties on public channel → no add UI.
7. Open bot DM → no add; bot description still shows when set.

### Regression checks

- Channels with existing header: popover + RHS edit pencil unchanged.
- Archived channel: no add affordance.
- Intro message “Set header” button unaffected.

## Risks and out-of-scope

| Risk | Mitigation |
|------|------------|
| Hover-only placeholder hurts discoverability | Confirm with UX; one-line SCSS change if always-visible required |
| Permission drift between center and RHS | Single helper or copy `channel_info_rhs/index.ts` selector pattern |
| `channel_header_text.test.tsx` name “regardless of permissions” is misleading | Rename tests when updating expectations |
| Missing PRD | Implement from Linear AC; flag doc gap to PM |

**Out of scope (do not implement in YVETTE-7):** server/API, new i18n, new modals, purpose/rename flows, token cleanup, PRD file commit.

## Open questions

1. **Hover vs always visible** for center `.header-placeholder` — default to existing SCSS unless PRD/UX says otherwise.
2. **PRD** — obtain `docs/product/add-channel-header-functionality-prd.md` or confirm Linear description is source of truth.
3. **E2E** — ticket lists demo sandbox manual verification only; Playwright not required unless team wants regression in `e2e-tests/`.
4. **Private vs public permission** — use channel type branch identical to RHS (`MANAGE_PRIVATE_CHANNEL_PROPERTIES` vs `MANAGE_PUBLIC_CHANNEL_PROPERTIES`).
