// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package slashcommands

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

func TestGrokProviderMetadata(t *testing.T) {
	provider := GrokProvider{}
	assert.Equal(t, CmdGrok, provider.GetTrigger())

	cmd := provider.GetCommand(nil, func(id string, _ ...any) string { return id })
	require.NotNil(t, cmd)
	assert.Equal(t, "grok", cmd.Trigger)
	assert.True(t, cmd.AutoComplete)
	assert.Equal(t, "api.command_grok.desc", cmd.AutoCompleteDesc)
	assert.Equal(t, "api.command_grok.hint", cmd.AutoCompleteHint)
	assert.Equal(t, "api.command_grok.name", cmd.DisplayName)
}

func TestGrokProviderDoCommandHelp(t *testing.T) {
	provider := GrokProvider{}
	args := &model.CommandArgs{
		T: func(id string, _ ...any) string { return id },
	}

	for _, message := range []string{"", "help", "HELP", "?"} {
		resp := provider.DoCommand(nil, nil, args, message)
		assert.Equal(t, model.CommandResponseTypeEphemeral, resp.ResponseType, message)
		assert.Equal(t, "api.command_grok.help", resp.Text, message)
	}
}

func TestGrokProviderDoCommandWithoutApp(t *testing.T) {
	provider := GrokProvider{}
	args := &model.CommandArgs{
		T: func(id string, _ ...any) string { return id },
	}

	resp := provider.DoCommand(nil, nil, args, "summarize this thread")
	assert.Equal(t, model.CommandResponseTypeEphemeral, resp.ResponseType)
	assert.Equal(t, "api.command_grok.unavailable.app_error", resp.Text)
}
