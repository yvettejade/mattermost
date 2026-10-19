package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin/plugintest"
	"github.com/mattermost/mattermost/server/public/pluginapi"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/yvettejade/mattermost/yvette-grok-agent/server/actions"
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

func TestHandleScheduleDialogMissingUserHeader(t *testing.T) {
	api := &plugintest.API{}
	p := newDialogTestPlugin(api)

	body, _ := json.Marshal(model.SubmitDialogRequest{
		CallbackId: actions.ScheduleCallbackID,
		State:      "sess-1",
		ChannelId:  "attacker-channel",
		UserId:     "attacker-user",
		Submission: map[string]any{"title": "Injected"},
	})
	req := httptest.NewRequest(http.MethodPost, "/dialog", bytes.NewReader(body))
	rec := httptest.NewRecorder()

	p.ServeHTTP(nil, rec, req)

	require.Equal(t, http.StatusUnauthorized, rec.Code)
	api.AssertNotCalled(t, "CreatePost", mock.Anything)
}

func TestHandleScheduleDialogMissingSession(t *testing.T) {
	api := &plugintest.API{}
	p := newDialogTestPlugin(api)
	api.On("KVGet", sessionKey("missing")).Return(nil, nil)

	body, _ := json.Marshal(model.SubmitDialogRequest{
		CallbackId: actions.ScheduleCallbackID,
		State:      "missing",
		ChannelId:  "attacker-channel",
		UserId:     "attacker-user",
		Submission: map[string]any{"title": "Injected"},
	})
	req := httptest.NewRequest(http.MethodPost, "/dialog", bytes.NewReader(body))
	req.Header.Set(mattermostUserHeader, "attacker-user")
	rec := httptest.NewRecorder()

	p.ServeHTTP(nil, rec, req)

	require.Equal(t, http.StatusForbidden, rec.Code)
	api.AssertNotCalled(t, "CreatePost", mock.Anything)
}

func TestHandleScheduleDialogUserMismatch(t *testing.T) {
	api := &plugintest.API{}
	p := newDialogTestPlugin(api)
	raw, _ := json.Marshal(sessionState{UserID: "alice", ChannelID: "chan-1", Kind: "schedule"})
	api.On("KVGet", sessionKey("sess-1")).Return(raw, nil)

	body, _ := json.Marshal(model.SubmitDialogRequest{
		CallbackId: actions.ScheduleCallbackID,
		State:      "sess-1",
		ChannelId:  "attacker-channel",
		UserId:     "attacker-user",
		Submission: map[string]any{"title": "Injected"},
	})
	req := httptest.NewRequest(http.MethodPost, "/dialog", bytes.NewReader(body))
	req.Header.Set(mattermostUserHeader, "attacker-user")
	rec := httptest.NewRecorder()

	p.ServeHTTP(nil, rec, req)

	require.Equal(t, http.StatusForbidden, rec.Code)
	api.AssertNotCalled(t, "CreatePost", mock.Anything)
}

func TestHandleScheduleDialogValidSessionPosts(t *testing.T) {
	api := &plugintest.API{}
	p := newDialogTestPlugin(api)
	raw, _ := json.Marshal(sessionState{
		UserID:    "alice",
		ChannelID: "chan-1",
		RootID:    "root-1",
		Kind:      "schedule",
	})
	api.On("KVGet", sessionKey("sess-1")).Return(raw, nil)
	api.On("KVSetWithOptions", sessionKey("sess-1"), mock.Anything, mock.Anything).Return(true, nil)
	api.On("GetUser", "alice").Return(&model.User{Username: "alice"}, nil)
	api.On("CreatePost", mock.MatchedBy(func(post *model.Post) bool {
		return post != nil &&
			post.ChannelId == "chan-1" &&
			post.RootId == "root-1" &&
			post.UserId == "bot-user-id"
	})).Return(&model.Post{Id: "posted"}, nil)

	body, _ := json.Marshal(model.SubmitDialogRequest{
		CallbackId: actions.ScheduleCallbackID,
		State:      "sess-1",
		ChannelId:  "attacker-channel",
		UserId:     "attacker-user",
		Submission: map[string]any{"title": "Sprint planning", "when": "Thu 10:00", "participants": "@bob"},
	})
	req := httptest.NewRequest(http.MethodPost, "/dialog", bytes.NewReader(body))
	req.Header.Set(mattermostUserHeader, "alice")
	rec := httptest.NewRecorder()

	p.ServeHTTP(nil, rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
	api.AssertCalled(t, "CreatePost", mock.Anything)
}

func newDialogTestPlugin(api *plugintest.API) *Plugin {
	p := &Plugin{botUserID: "bot-user-id"}
	p.SetAPI(api)
	p.SetDriver(&plugintest.Driver{})
	p.client = pluginapi.NewClient(api, &plugintest.Driver{})
	return p
}
