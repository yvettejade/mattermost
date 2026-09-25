// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package slashcommands

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/app/assistant"
)

func TestAssistantProvider(t *testing.T) {
	th := setup(t).initBasic(t)
	provider := AssistantProvider{}

	cmd := provider.GetCommand(th.App, func(id string, args ...any) string { return id })
	require.NotNil(t, cmd)
	assert.Equal(t, CmdAssistant, cmd.Trigger)
	assert.False(t, cmd.AutoComplete)
	assert.Equal(t, assistantSlashUsername, cmd.Username)

	t.Run("config error is ephemeral", func(t *testing.T) {
		t.Setenv(assistant.EnvGrokAPI, "")
		resp := provider.DoCommand(th.App, th.Context, &model.CommandArgs{
			UserId:    th.BasicUser.Id,
			ChannelId: th.BasicChannel.Id,
			T:         func(id string, args ...any) string { return id },
		}, "summarize")
		assert.Equal(t, model.CommandResponseTypeEphemeral, resp.ResponseType)
		assert.NotEmpty(t, resp.Text)
		assert.NotContains(t, resp.Text, "YvetteGrokAPI=")
	})

	t.Run("success posts in-channel as Assistant", func(t *testing.T) {
		t.Setenv(assistant.EnvGrokAPI, "test-grok-key")
		orig := assistant.Complete
		t.Cleanup(func() { assistant.Complete = orig })
		assistant.Complete = func(ctx context.Context, systemPrompt, userPrompt string) (string, *model.AppError) {
			return "in-channel reply", nil
		}

		resp := provider.DoCommand(th.App, th.Context, &model.CommandArgs{
			UserId:    th.BasicUser.Id,
			ChannelId: th.BasicChannel.Id,
			T:         func(id string, args ...any) string { return id },
		}, "summarize")
		assert.Equal(t, model.CommandResponseTypeInChannel, resp.ResponseType)
		assert.Equal(t, assistantSlashUsername, resp.Username)
		assert.Equal(t, "in-channel reply", resp.Text)
	})

	t.Run("missing create_post is ephemeral", func(t *testing.T) {
		t.Setenv(assistant.EnvGrokAPI, "test-grok-key")
		orig := assistant.Complete
		t.Cleanup(func() { assistant.Complete = orig })
		assistant.Complete = func(ctx context.Context, systemPrompt, userPrompt string) (string, *model.AppError) {
			return "private reply", nil
		}

		role, appErr := th.App.GetRoleByName(th.Context, model.ChannelUserRoleId)
		require.Nil(t, appErr)
		original := append([]string{}, role.Permissions...)
		filtered := make([]string, 0, len(role.Permissions))
		for _, perm := range role.Permissions {
			if perm != model.PermissionCreatePost.Id {
				filtered = append(filtered, perm)
			}
		}
		role.Permissions = filtered
		_, appErr = th.App.UpdateRole(role)
		require.Nil(t, appErr)
		t.Cleanup(func() {
			restored, restoreErr := th.App.GetRoleByName(th.Context, model.ChannelUserRoleId)
			require.Nil(t, restoreErr)
			restored.Permissions = original
			_, restoreErr = th.App.UpdateRole(restored)
			require.Nil(t, restoreErr)
		})

		resp := provider.DoCommand(th.App, th.Context, &model.CommandArgs{
			UserId:    th.BasicUser.Id,
			ChannelId: th.BasicChannel.Id,
			T:         func(id string, args ...any) string { return id },
		}, "summarize")
		assert.Equal(t, model.CommandResponseTypeEphemeral, resp.ResponseType)
		assert.Equal(t, "private reply", resp.Text)
	})
}
