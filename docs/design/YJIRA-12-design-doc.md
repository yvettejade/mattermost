# Design Doc: Add channel header functionality (YJIRA-12)

Ticket: [YJIRA-12](https://fe-anysphere-demo.atlassian.net/browse/YJIRA-12) (status: In Progress). The webhook supplied the title only. This spec is the existing Mattermost channel-header contract in this repo. Do not invent a second header feature.

**Execution outcome:** the behavior below is already implemented. Run the test plan. If every check passes, stop. Change code only when a named check fails, and only in the file listed for that check.

## 1. Requirements

### Functional

Members can read and set a per-channel header string stored on `Channel.Header` (`server/public/model/channel.go`).

- **Display.** When the trimmed header is non-empty, render it under the channel title as single-line Markdown (channel mentions, at-mentions, custom emoji). Overflow opens a popover with multiline Markdown. An empty header renders nothing in the header bar. Bot DMs show `user.bot_description` instead of `channel.header`.
  - `webapp/channels/src/components/channel_header/channel_header_text.tsx`
  - `webapp/channels/src/components/channel_header/channel_header_text_popover.tsx`
  - Mounted from `webapp/channels/src/components/channel_header/channel_header.tsx` inside `channel_view.tsx`.
- **Edit surfaces.** Same value, same patch:
  - Header menu item `EditConversationHeader` opens `EditChannelHeaderModal` for DMs and group messages (`webapp/channels/src/components/channel_header_menu/menu_items/edit_conversation_header.tsx`).
  - Channel settings Info tab textbox `channel_settings_header_textbox` (`webapp/channels/src/components/channel_settings_modal/channel_settings_info_tab.tsx`).
  - Slash command `/header [text]` (`server/channels/app/slashcommands/command_channel_header.go`, trigger `header`).
- **Write API.** No dedicated header route.
  - `PUT /api/v4/channels/{channel_id}/patch` with `{"header":"..."}` → `patchChannel` → `App.PatchChannel`.
  - `PUT /api/v4/channels/{channel_id}` may also set `header` on the full channel body → `updateChannel`.
  - Client saves go through `patchChannel(channelId, {header})`. The modal and settings tab trim before save. Unchanged text closes the modal without a request.
- **Clear.** Modal and settings save a blank header as `""`. `PUT`/`PATCH` accept `header: ""`. `/header` with an empty argument is rejected with ephemeral text `api.command_channel_header.message.app_error` ("Text must be provided with the /header command.").
- **Permissions.**
  - Open channel: `manage_public_channel_properties`.
  - Private channel: `manage_private_channel_properties`.
  - DM and group message: caller must be a member. Name, display name, and purpose cannot change on those types (`api.channel.patch_update_channel.update_direct_or_group_messages_not_allowed.app_error` / `api.channel.update_channel.update_direct_or_group_messages_not_allowed.app_error`). Header can.
  - Missing permission: HTTP 403, or slash-command ephemeral `api.command_channel_header.permission.app_error`.
  - Archived channel (`DeleteAt > 0`): `PUT /api/v4/channels/{channel_id}` returns `api.channel.update_channel.deleted.app_error`.
  - Restricted DM: `App.PatchChannel` returns `api.channel.patch_update_channel.restricted_dm.app_error`.
- **Length.** Server rejects more than 1024 Unicode code points (`model.ChannelHeaderMaxRunes`) with `model.channel.is_valid.header.app_error` (HTTP 400). The slash command maps that id to `api.command_channel_header.update_channel.max_length`. The modal and settings tab block input whose JavaScript string length exceeds 1024 and show `edit_channel_header_modal.error`.
- **System post.** When the stored header changes, `App.PostUpdateChannelHeaderMessage` creates a post of type `system_header_change` with props `username`, `old_header`, and `new_header`. Copy covers set, update, and remove (`api.channel.post_update_channel_header_message_and_forget.updated_to|updated_from|removed`).
- **Fan-out.** `App.UpdateChannel` persists the row, invalidates the channel cache, and publishes websocket `channel_updated` with the channel JSON.

### Non-Functional

- Header text is user content. Render it only through the existing Markdown component. Do not `dangerouslySetInnerHTML` a raw header.
- Validation stays server-side in `Channel.IsValid`. Client checks are advisory and must not be the only limit.
- A failed system-post or websocket publish must not roll back a header that `Channel().Update` already stored. `PatchChannel` already logs header-post failures with `Warn` and still returns the updated channel.
- Permission checks run before `PatchChannel` / `UpdateChannel`. A user who fails the check must not change `Header`.
- No new schema, index, or config setting. `Channels.Header` already exists.

## 2. Non-Requirements (Out of Scope)

- A new column, table, or `POST/PUT /api/v4/channels/{id}/header` route.
- Rebuilding `ChannelHeader`, the header menu, favorite/mute/pin/files buttons, or `ChannelHeaderPlug`.
- Channel purpose (`Channel.Purpose`, max 250 runes), channel banner (`BannerInfo`), or channel display name.
- Letting `/header` with no text clear the header. Empty `/header` stays an error. Clearing stays on the modal, settings tab, and patch API.
- Unifying JavaScript `.length` with `utf8.RuneCountInString`. Both limits stay 1024 in their own units.
- Changing bot DM display away from `bot_description`.
- Making `patchChannel` reject archived channels the way `updateChannel` does.
- Plugin header buttons, auto-translation badges, shared-channel remote names, and ABAC policy behavior on `UpdateChannel`.
- Notifications policy for `system_header_change` (already excluded from mention notifications in `server/channels/app/notification.go`).

## 3. Implementation Plan

### Architecture & Schema

No schema or route changes.

| Piece | Location | Contract |
| --- | --- | --- |
| Field | `Channel.Header string \`json:"header"\`` and `ChannelPatch.Header *string` | Omit `header` on patch to leave it unchanged. Send `""` to clear. |
| Max length | `ChannelHeaderMaxRunes = 1024` | Rune count in `Channel.IsValid`. |
| Patch | `PUT /api/v4/channels/{channel_id}/patch` | `server/channels/api4/channel.go` `patchChannel` |
| Replace | `PUT /api/v4/channels/{channel_id}` | `updateChannel` assigns `oldChannel.Header = channel.Header` |
| Apply | `App.PatchChannel` | Copies patch, `UpdateChannel`, then header system post if the value changed |
| Slash command | `HeaderProvider`, trigger `header` | Builds `ChannelPatch{Header: &message}` and calls `PatchChannel` |
| UI write | `EditChannelHeaderModal.handleSave`, settings Info tab | `patchChannel(id, {header: trimmed})` |
| UI read | `ChannelHeaderText` | `channel.header`, except bot DMs |
| Event | `WebsocketEventChannelUpdated` | Broadcast from `UpdateChannel` |

### Logic & Integration

Do not add files. Confirm this path, then stop:

1. **Model.** `server/public/model/channel.go`: `Header` on `Channel` and `ChannelPatch`; `Patch` copies `*patch.Header`; `IsValid` enforces `ChannelHeaderMaxRunes`.
2. **API auth.** `patchChannel` and `updateChannel` in `server/channels/api4/channel.go` use the permission switch in the requirements. DM/GM header updates are allowed for members; other property edits on those types return 400.
3. **Persist and notify.** `App.PatchChannel` and `PostUpdateChannelHeaderMessage` in `server/channels/app/channel.go`. System post type is `model.PostTypeHeaderChange` (`system_header_change`).
4. **Slash command.** `server/channels/app/slashcommands/command_channel_header.go`. Empty `message` returns the message error before `PatchChannel`. Over-long text surfaces `model.channel.is_valid.header.app_error` as the max-length ephemeral.
5. **Web.** `ChannelHeaderText` hides blank headers and substitutes bot descriptions. `EditChannelHeaderModal` (`headerMaxLength = 1024`) and `channel_settings_info_tab.tsx` (`HEADER_MAX_LENGTH = 1024`) trim and patch. Menu entry is `edit_conversation_header.tsx`.
6. **Failure fix map.** Touch only the file for the failed check:
   - Slash permission or empty-text behavior → `command_channel_header.go` and `command_channel_header_test.go`.
   - HTTP permission, 400 on over-long header, or patch shape → `server/channels/api4/channel.go` and `server/channels/api4/channel_test.go` (`TestPatchChannel`).
   - Missing system post or websocket → `server/channels/app/channel.go`.
   - Header not shown, or bot DM showing `channel.header` → `channel_header_text.tsx` and `channel_header_text.test.tsx`.
   - Save/length UI → `edit_channel_header_modal.tsx` or `channel_settings_info_tab.tsx` and their existing tests.

## 4. Test Plan

- [ ] Unit: slash command. From `server/`:

  ```bash
  go test ./channels/app/slashcommands/ -count=1 -run TestHeaderProviderDoCommand
  ```

  Expect: public and private channels succeed with `manage_*_channel_properties` and fail without it; `""` returns `api.command_channel_header.message.app_error`; a group-channel member can set the header and a non-member cannot.

- [ ] Unit: header rendering. From `webapp/channels/`:

  ```bash
  npm test -- --watchAll=false src/components/channel_header/channel_header_text.test.tsx src/components/edit_channel_header_modal/edit_channel_header_modal.test.tsx
  ```

  Expect: non-empty header renders; empty header does not; bot DM renders `bot_description`; the modal rejects length over 1024 and calls `patchChannel` with the trimmed header.

- [ ] Integration: API. From `server/`:

  ```bash
  go test ./channels/api4/ -count=1 -run 'TestPatchChannel$'
  ```

  Expect: `PatchChannel` updates `header` for a permitted user; DM/GM header patch succeeds; DM/GM display-name or purpose patch returns 400; a header-only change does not require a new route.

- [ ] Manual verification (only if the unit and API tests pass and a UI check is still required):
  1. Log in as a channel member who has manage-properties, open a public channel, and set the header from Channel Settings → Info. The header text appears beside the title.
  2. Run `/header hello from slash`. The header updates and a `system_header_change` post appears.
  3. Run `/header` with no text. An ephemeral error appears and the header is unchanged.
  4. Clear the header in the edit modal. The header bar text disappears and a removal system post appears.
  5. As a user without manage-properties, `PUT /api/v4/channels/{channel_id}/patch` with `{"header":"nope"}` returns 403 and the stored header is unchanged.
