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

func TestAssistantDoCommandRejectsEmptyChannel(t *testing.T) {
	resp := (&AssistantProvider{}).DoCommand((*app.App)(nil), request.TestContext(t), &model.CommandArgs{
		T: i18n.IdentityTfunc(),
	}, "summarize this channel")
	require.Equal(t, model.CommandResponseTypeEphemeral, resp.ResponseType)
	require.Equal(t, "api.command_assistant.permission.app_error", resp.Text)
	require.NotContains(t, resp.Text, "YvetteGrokAPI")
}
