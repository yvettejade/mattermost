# Design Doc: Add channel header functionality (YJIRA-12)

Ticket: https://fe-anysphere-demo.atlassian.net/browse/YJIRA-12
Status at analysis: IN PROGRESS
Source of scope: ticket summary only. The Jira description was not readable from this environment. This document pins the contract to the behavior already implemented in this repository.

## Current state

Channel header text is already stored, authorized, edited, rendered, and announced. Downstream work for YJIRA-12 is to keep that contract intact. Do not add a second header field, endpoint, modal, or slash command.

## 1. Requirements

### Functional

Members who are allowed to edit a channel can set, replace, and clear a markdown header. The header is the `header` string on the existing channel record.

Supported write paths, all of which must keep working:

- `PUT /api/v4/channels/{channel_id}` writes `Channel.Header` through `updateChannel` in `server/channels/api4/channel.go`.
- `PUT /api/v4/channels/{channel_id}/patch` with `ChannelPatch.Header` writes through `patchChannel` and `App.PatchChannel` in `server/channels/app/channel.go`. The web app uses this path (`mattermost-redux` `patchChannel`).
- Slash command `/header <text>` in `server/channels/app/slashcommands/command_channel_header.go` applies the same patch. An empty message returns an ephemeral error and does not clear the header.
- Editors in the product UI:
  - `webapp/channels/src/components/edit_channel_header_modal/edit_channel_header_modal.tsx` (header menu and channel info RHS). Saving trims the value. An unchanged value closes the modal without a request. An empty trimmed value clears the header.
  - `webapp/channels/src/components/channel_settings_modal/channel_settings_info_tab.tsx` includes header in the channel-settings save payload when it differs from the stored value.

Authorization, matching the handlers above:

- Open channels (`O`): `manage_public_channel_properties`.
- Private channels (`P`): `manage_private_channel_properties`.
- Direct and group channels (`D`, `G`): caller must be a member. Name, display name, and purpose stay immutable on these types. Header remains editable.
- Other channel types: reject with the existing forbidden error.
- `PUT` rejects archived channels (`DeleteAt > 0`).
- `App.PatchChannel` rejects restricted DMs via `CheckIfChannelIsRestrictedDM`.

Persistence and fan-out:

- Max length is `model.ChannelHeaderMaxRunes` (1024 Unicode code points), enforced by `Channel.IsValid` in `server/public/model/channel.go`. Over-length input returns `model.channel.is_valid.header.app_error`.
- `App.UpdateChannel` persists the row, invalidates the channel cache, and publishes `channel_updated` with the channel JSON.
- `App.PatchChannel`, when the header actually changes, posts a `system_header_change` message via `PostUpdateChannelHeaderMessage`. Props include `username`, `old_header`, and `new_header`. Copy covers set, replace, and clear.
- Clients render the header in `ChannelHeaderText` (`webapp/channels/src/components/channel_header/channel_header_text.tsx`). Whitespace-only headers render nothing. The bar uses single-line markdown; overflow opens `ChannelHeaderTextPopover` with multiline markdown, mentions, and channel-mention maps. Custom emoji in the header are loaded by `ChannelHeader` on mount and when the header changes.
- Bot DMs display `dmUser.bot_description` in that slot instead of `channel.header`.
- Shared-channel sync copies `Channel.Header` into `ShareHeader` on the existing share paths in `server/channels/app/channel.go`. Do not add a separate sync job.

### Non-Functional

- No schema migration. `Channels.Header` is already written by `server/channels/store/sqlstore/channel_store.go`.
- Header text is untrusted user input. Keep rendering on the existing `Markdown` component. Do not interpolate the header into HTML.
- A header save is one channel update plus, on the patch path, one system post and one `channel_updated` websocket event. Do not add extra queries or a new event type.
- Permission failures stay on the existing permission and forbidden errors. Do not widen who can edit.
- Client length checks in the edit modal and channel settings modal stay aligned with the 1024 limit (`headerMaxLength` / `HEADER_MAX_LENGTH`). The server remains the authority and counts runes, not UTF-16 code units.

## 2. Non-Requirements (Out of Scope)

- A new column, table, API route, websocket event, or Redux slice for headers.
- Channel purpose, display name, banner (`banner_info`), or channel bookmarks.
- Plugin header buttons (`channel_header_plug`) and the header icon row (favorites, mute, pins, files, search).
- Changing who may edit a header, including guests, archived channels, and restricted DMs.
- Making `/header` with an empty argument clear the header. Clearing stays on the modal and on an explicit patch of `header` to `""`.
- Making `PUT /api/v4/channels/{channel_id}` emit `system_header_change`. That announcement is owned by `App.PatchChannel`. The UI and `/header` already use patch.
- Switching client validation from JavaScript string length to rune length.
- Rich-text or block-editor UI, header history, per-member headers, or scheduled header changes.
- i18n extraction. Do not add user-facing strings; reuse `edit_channel_header_modal.error` and the existing `api.command_channel_header.*` / `api.channel.post_update_channel_header_message_and_forget.*` keys.
- Enterprise-only behavior (shared channels beyond the existing `ShareHeader` copy, ABAC, managed categories).

## 3. Implementation Plan

### Architecture & Schema

No new interfaces. The contract is:

| Piece | Location |
| --- | --- |
| Field | `Channel.Header` and `ChannelPatch.Header` in `server/public/model/channel.go` |
| Limit | `ChannelHeaderMaxRunes = 1024` |
| Write | `updateChannel`, `patchChannel` in `server/channels/api4/channel.go` |
| Domain | `App.UpdateChannel`, `App.PatchChannel`, `App.PostUpdateChannelHeaderMessage` in `server/channels/app/channel.go` |
| Command | `HeaderProvider` in `server/channels/app/slashcommands/command_channel_header.go` |
| Store | `Channel` update in `server/channels/store/sqlstore/channel_store.go` (`Header=:Header`) |
| UI edit | `edit_channel_header_modal.tsx`, `channel_settings_info_tab.tsx` |
| UI read | `channel_header_text.tsx`, `channel_header_text_popover.tsx`, mounted from `channel_header.tsx` |
| Client action | `patchChannel(channelId, {header})` |

`Channel.Patch` applies a non-nil `Header` pointer, including a pointer to `""` (clear). A nil `Header` leaves the stored value alone.

### Logic & Integration

Do not edit these files unless a check below fails. If one fails, restore the behavior in the file that owns it. Do not reimplement it elsewhere.

1. Confirm `Channel.IsValid` rejects a header longer than 1024 runes and accepts 1024 runes, including non-ASCII.
2. Confirm `patchChannel` permission switch for `O`, `P`, `D`, and `G`, and that a DM/GM patch cannot change name, display name, or purpose while still accepting `header`.
3. Confirm `App.PatchChannel` calls `PostUpdateChannelHeaderMessage` only when `channel.Header != oldChannelHeader`, and that `UpdateChannel` still emits `channel_updated`.
4. Confirm `/header` permission checks mirror the API, empty input is an ephemeral error, and `model.channel.is_valid.header.app_error` maps to the max-length ephemeral string using `ChannelHeaderMaxRunes`.
5. Confirm `EditChannelHeaderModal.handleSave` patches `{header}` after trim, skips the request when unchanged, and surfaces `model.channel.is_valid.header.app_error` without closing on failure.
6. Confirm `ChannelHeaderText` returns null for a blank header and uses `bot_description` for bot DMs.
7. Stop. No migration, no new component, no client store change.

## 4. Test Plan

- [ ] Unit: `go test -count=1 ./channels/app/slashcommands/ -run TestHeaderProviderDoCommand` from `server/`. Cover permission denied (open and private), non-member DM/GM, empty message, successful set, and over-length header.
- [ ] Unit: `Channel.IsValid` header cases — empty, 1024 runes, 1025 runes, multibyte characters whose rune count is within the limit and whose UTF-16 length is not (server must accept the rune-legal value).
- [ ] Unit (webapp): `edit_channel_header_modal.test.tsx` `handleSave` — unchanged header does not call `patchChannel`; changed header sends the trimmed string; over-length input sets the server error and does not save.
- [ ] Unit (webapp): `channel_header_text.test.tsx` — blank header renders nothing; non-empty header renders markdown text; bot DM renders the bot description.
- [ ] Integration: `go test -count=1 ./channels/api4/ -run 'TestUpdateChannel|TestPatchChannel'` from `server/`. Assert open, private, DM, and GM header updates; non-member receives forbidden; patch of `header` round-trips on `GET /api/v4/channels/{channel_id}`; a header-only patch creates one `system_header_change` post and a `channel_updated` websocket payload whose `header` matches the patch.
- [ ] Manual: as a channel admin, open a public channel, set a header from Channel Settings (`channel_settings_header_textbox`) to `**status** [docs](https://example.com)`, save, and confirm the header bar shows formatted text and the popover shows the link. Clear the field, save, and confirm the bar disappears and a header-removed system post appears.
- [ ] Manual: as a member without manage-properties permission, confirm the edit entry is absent or the patch returns a permission error. Run `/header hello` in a DM you belong to and confirm the header updates. Run `/header` with no text and confirm an ephemeral error and an unchanged header.

## Trade-off

`PUT` updates the header without a system post, and the web client counts UTF-16 code units while the server counts runes. Both are pre-existing. Fixing either is a behavior change and is out of scope for YJIRA-12. An execution agent that "cleans this up" will fail existing API clients and tests.
