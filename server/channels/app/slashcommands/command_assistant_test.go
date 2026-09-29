// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package slashcommands

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/i18n"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/app"
)

func TestAssistantCommandHiddenFromAutocomplete(t *testing.T) {
	cmd := (&AssistantProvider{}).GetCommand(nil, i18n.IdentityTfunc())
	require.Equal(t, CmdAssistant, cmd.Trigger)
	require.False(t, cmd.AutoComplete)
	require.Empty(t, cmd.AutoCompleteDesc)
	require.Empty(t, cmd.AutoCompleteHint)
}

func TestAssistantDoCommandKeepsCompletionEphemeral(t *testing.T) {
	orig := runAssistant
	t.Cleanup(func() { runAssistant = orig })
	runAssistant = func(*app.App, request.CTX, *model.CommandArgs, string) (string, bool) {
		return "PLAT-9 status is Open assignee is sam", false
	}

	resp := (&AssistantProvider{}).DoCommand(nil, request.TestContext(t), &model.CommandArgs{
		UserId:    "admin",
		ChannelId: "town",
		T:         i18n.IdentityTfunc(),
	}, "status of PLAT-9")

	require.Equal(t, model.CommandResponseTypeEphemeral, resp.ResponseType)
	require.Empty(t, resp.Username)
	require.NotEqual(t, model.CommandResponseTypeInChannel, resp.ResponseType)
	require.Contains(t, resp.Text, "PLAT-9 status is Open assignee is sam")
}

func TestAssistantDoCommandRejectsEmptyChannel(t *testing.T) {
	resp := (&AssistantProvider{}).DoCommand((*app.App)(nil), request.TestContext(t), &model.CommandArgs{
		T: i18n.IdentityTfunc(),
	}, "summarize this channel")
	require.Equal(t, model.CommandResponseTypeEphemeral, resp.ResponseType)
	require.Equal(t, "api.command_assistant.permission.app_error", resp.Text)
	require.NotContains(t, resp.Text, "YvetteGrokAPI")
}
