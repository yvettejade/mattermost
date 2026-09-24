package main

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin/plugintest"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

func TestOnActivateEnsuresBotAndRegistersCommand(t *testing.T) {
	api := &plugintest.API{}
	t.Cleanup(func() { api.AssertExpectations(t) })

	api.On("LoadPluginConfiguration", mock.Anything).Return(nil)
	api.On("GetServerVersion").Return("10.0.0")
	api.On("KVSetWithOptions", mock.Anything, mock.Anything, mock.Anything).Return(true, nil)
	api.On("LogError", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Maybe()
	api.On("LogInfo", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Maybe()

	api.On("EnsureBotUser", mock.MatchedBy(func(bot *model.Bot) bool {
		return bot != nil && bot.Username == botUsername && bot.DisplayName == botDisplayName
	})).Return("bot-user-id", nil).Once()

	api.On("RegisterCommand", mock.MatchedBy(func(cmd *model.Command) bool {
		return cmd != nil && cmd.Trigger == commandTrigger
	})).Return(nil).Once()

	p := &Plugin{}
	p.SetAPI(api)
	p.SetDriver(&plugintest.Driver{})

	err := p.OnActivate()
	require.NoError(t, err)
	require.Equal(t, "bot-user-id", p.botUserID)
}

func TestMessageHasBeenPostedIgnoresOwnPosts(t *testing.T) {
	api := &plugintest.API{}
	p := &Plugin{botUserID: "bot-user-id"}
	p.SetAPI(api)

	p.MessageHasBeenPosted(nil, &model.Post{
		UserId:    "alice",
		ChannelId: "ch",
		Message:   "loop",
		Props:     map[string]any{sentByPluginProp: true},
	})
	p.MessageHasBeenPosted(nil, &model.Post{
		UserId:    "bot-user-id",
		ChannelId: "ch",
		Message:   "@yvette-grok hi",
	})

	api.AssertNotCalled(t, "GetChannel", mock.Anything)
}
