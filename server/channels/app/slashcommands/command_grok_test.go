// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package slashcommands

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

func TestGrokProviderHelp(t *testing.T) {
	th := setup(t).initBasic(t)
	provider := GrokProvider{}
	args := &model.CommandArgs{
		T:         func(s string, args ...any) string { return s },
		ChannelId: th.BasicChannel.Id,
		TeamId:    th.BasicTeam.Id,
		UserId:    th.BasicUser.Id,
	}

	resp := provider.DoCommand(th.App, th.Context, args, "")
	assert.Equal(t, model.CommandResponseTypeEphemeral, resp.ResponseType)
	assert.Equal(t, "api.command_grok.help", resp.Text)

	resp = provider.DoCommand(th.App, th.Context, args, "help")
	assert.Equal(t, "api.command_grok.help", resp.Text)
}

func TestGrokProviderSummarize(t *testing.T) {
	t.Setenv(model.GrokAPIKeyEnv, "")
	th := setup(t).initBasic(t)
	provider := GrokProvider{}
	args := &model.CommandArgs{
		T:         func(s string, args ...any) string { return s },
		ChannelId: th.BasicChannel.Id,
		TeamId:    th.BasicTeam.Id,
		UserId:    th.BasicUser.Id,
	}

	_, _, appErr := th.App.CreatePost(th.Context, &model.Post{
		UserId:    th.BasicUser.Id,
		ChannelId: th.BasicChannel.Id,
		Message:   "Ship the Grok-backed workspace agent",
	}, th.BasicChannel, model.CreatePostFlags{})
	require.Nil(t, appErr)

	resp := provider.DoCommand(th.App, th.Context, args, "summarize")
	require.Equal(t, model.CommandResponseTypeEphemeral, resp.ResponseType)
	assert.Contains(t, resp.Text, "Grok-backed workspace agent")
	assert.Contains(t, resp.Text, "YvetteGrokAPI")
}

func TestGrokProviderGetCommand(t *testing.T) {
	th := setup(t)
	provider := GrokProvider{}
	cmd := provider.GetCommand(th.App, func(id string, args ...any) string { return id })
	assert.Equal(t, "grok", cmd.Trigger)
	assert.True(t, cmd.AutoComplete)
	assert.Equal(t, "api.command_grok.desc", cmd.AutoCompleteDesc)
}
