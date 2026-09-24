// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
	"github.com/mattermost/mattermost/server/public/plugin/plugintest"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

func TestExecuteCommandHelp(t *testing.T) {
	api := &plugintest.API{}
	p := &Plugin{}
	p.SetAPI(api)

	resp, appErr := p.ExecuteCommand(&plugin.Context{}, &model.CommandArgs{Command: "/yvette"})
	require.Nil(t, appErr)
	assert.Equal(t, model.CommandResponseTypeEphemeral, resp.ResponseType)
	assert.Contains(t, resp.Text, "/yvette summarize")

	resp, appErr = p.ExecuteCommand(&plugin.Context{}, &model.CommandArgs{Command: "/yvette help"})
	require.Nil(t, appErr)
	assert.Contains(t, resp.Text, "@yvette-grok")
}

func TestOnActivateRegistersBotAndCommand(t *testing.T) {
	api := &plugintest.API{}
	api.On("LoadPluginConfiguration", mock.Anything).Return(nil)
	api.On("EnsureBotUser", mock.MatchedBy(func(bot *model.Bot) bool {
		return bot.Username == botUsername
	})).Return("bot-user-id", nil)
	api.On("RegisterCommand", mock.MatchedBy(func(cmd *model.Command) bool {
		return cmd.Trigger == slashTrigger
	})).Return(nil)

	p := &Plugin{}
	p.SetAPI(api)
	require.NoError(t, p.OnActivate())
	assert.Equal(t, "bot-user-id", p.botUserID)
	api.AssertExpectations(t)
}

func TestHandleQueryAskFallback(t *testing.T) {
	t.Setenv(apiKeyEnv, "")
	t.Setenv(apiKeyAltEnv, "")

	now := time.Now().UnixMilli()
	channel := &model.Channel{Id: "ch1", Name: "demo", DisplayName: "Demo", TeamId: "team1"}
	user := &model.User{Id: "u1", Username: "sam"}
	post := &model.Post{Id: "p1", UserId: "u1", Message: "we shipped the header", CreateAt: now, ChannelId: "ch1"}
	list := &model.PostList{Order: []string{"p1"}, Posts: map[string]*model.Post{"p1": post}}
	team := &model.Team{Id: "team1", Name: "cursorteam"}
	site := "https://mm.example"
	cfg := &model.Config{}
	cfg.SetDefaults()
	cfg.ServiceSettings.SiteURL = &site

	api := &plugintest.API{}
	api.On("GetChannel", "ch1").Return(channel, nil)
	api.On("HasPermissionToChannel", "u1", "ch1", model.PermissionReadChannel).Return(true)
	api.On("GetConfig").Return(cfg)
	api.On("GetTeam", "team1").Return(team, nil)
	api.On("GetPostsForChannel", "ch1", 0, contextPostLimit).Return(list, nil)
	api.On("GetUser", "u1").Return(user, nil)
	api.On("EnsureBotUser", mock.Anything).Return("bot-user-id", nil)
	api.On("GetTeamMember", "team1", "bot-user-id").Return(&model.TeamMember{}, nil)
	api.On("GetChannelMember", "ch1", "bot-user-id").Return(&model.ChannelMember{}, nil)
	api.On("CreatePost", mock.AnythingOfType("*model.Post")).Return(func(post *model.Post) *model.Post {
		post.Id = "reply1"
		return post
	}, nil).Once()

	p := &Plugin{}
	p.SetAPI(api)
	p.setConfiguration(&configuration{})

	created, err := p.handleQuery(queryRequest{
		UserID:    "u1",
		ChannelID: "ch1",
		TeamID:    "team1",
		Message:   "what shipped?",
	})
	require.NoError(t, err)
	require.NotNil(t, created)
	assert.Equal(t, "reply1", created.Id)
	assert.Contains(t, created.Message, "we shipped the header")
	assert.Contains(t, created.Message, "/pl/p1")
	assert.Equal(t, "true", created.GetProp(propFromAgent))
}

func TestHandleQueryDeniedWithoutPermission(t *testing.T) {
	api := &plugintest.API{}
	api.On("GetChannel", "ch1").Return(&model.Channel{Id: "ch1"}, nil)
	api.On("HasPermissionToChannel", "u1", "ch1", model.PermissionReadChannel).Return(false)

	p := &Plugin{}
	p.SetAPI(api)
	_, err := p.handleQuery(queryRequest{UserID: "u1", ChannelID: "ch1", Message: "hello"})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "no permission")
}

func TestHandleQueryOpensScheduleDialog(t *testing.T) {
	api := &plugintest.API{}
	api.On("GetChannel", "ch1").Return(&model.Channel{Id: "ch1", Name: "demo"}, nil)
	api.On("HasPermissionToChannel", "u1", "ch1", model.PermissionReadChannel).Return(true)
	api.On("GetConfig").Return(&model.Config{})
	api.On("OpenInteractiveDialog", mock.MatchedBy(func(req model.OpenDialogRequest) bool {
		return req.TriggerId == "trig" && req.Dialog.Title == "Schedule a meeting"
	})).Return(nil)

	p := &Plugin{}
	p.SetAPI(api)
	created, err := p.handleQuery(queryRequest{
		UserID:    "u1",
		ChannelID: "ch1",
		TriggerID: "trig",
		Message:   "schedule a design review",
	})
	require.NoError(t, err)
	assert.Nil(t, created)
	api.AssertExpectations(t)
}

func TestMessageHasBeenPostedSkipsBotsAndAgentPosts(t *testing.T) {
	api := &plugintest.API{}
	p := &Plugin{}
	p.SetAPI(api)

	p.MessageHasBeenPosted(&plugin.Context{}, &model.Post{Message: ""})

	agent := &model.Post{Message: "hi", UserId: "u1"}
	agent.AddProp(propFromAgent, "true")
	p.MessageHasBeenPosted(&plugin.Context{}, agent)

	api.On("GetUser", "bot1").Return(&model.User{Id: "bot1", IsBot: true}, nil)
	p.MessageHasBeenPosted(&plugin.Context{}, &model.Post{Message: "hello", UserId: "bot1"})
	api.AssertExpectations(t)
}

func TestMessageHasBeenPostedHandlesMention(t *testing.T) {
	t.Setenv(apiKeyEnv, "")
	t.Setenv(apiKeyAltEnv, "")

	now := time.Now().UnixMilli()
	channel := &model.Channel{Id: "ch1", Name: "demo", DisplayName: "Demo", TeamId: "team1", Type: model.ChannelTypeOpen}
	user := &model.User{Id: "u1", Username: "sam"}
	history := &model.Post{Id: "p1", UserId: "u1", Message: "ready to ship", CreateAt: now}
	list := &model.PostList{Order: []string{"p1"}, Posts: map[string]*model.Post{"p1": history}}
	team := &model.Team{Id: "team1", Name: "cursorteam"}
	site := "https://mm.example"
	cfg := &model.Config{}
	cfg.SetDefaults()
	cfg.ServiceSettings.SiteURL = &site

	api := &plugintest.API{}
	api.On("GetUser", "u1").Return(user, nil)
	api.On("EnsureBotUser", mock.Anything).Return("bot-user-id", nil)
	api.On("GetChannel", "ch1").Return(channel, nil)
	api.On("HasPermissionToChannel", "u1", "ch1", model.PermissionReadChannel).Return(true)
	api.On("GetConfig").Return(cfg)
	api.On("GetTeam", "team1").Return(team, nil)
	api.On("GetPostsForChannel", "ch1", 0, contextPostLimit).Return(list, nil)
	api.On("GetTeamMember", "team1", "bot-user-id").Return(&model.TeamMember{}, nil)
	api.On("GetChannelMember", "ch1", "bot-user-id").Return(&model.ChannelMember{}, nil)
	api.On("CreatePost", mock.AnythingOfType("*model.Post")).Return(&model.Post{Id: "reply1"}, nil)

	p := &Plugin{}
	p.SetAPI(api)
	p.setConfiguration(&configuration{})
	p.MessageHasBeenPosted(&plugin.Context{}, &model.Post{
		Id:        "ask1",
		UserId:    "u1",
		ChannelId: "ch1",
		Message:   "@yvette-grok summarize",
	})
	api.AssertExpectations(t)
}

func TestHandleQueryDraftUploadsFile(t *testing.T) {
	t.Setenv(apiKeyEnv, "")
	t.Setenv(apiKeyAltEnv, "")

	now := time.Now().UnixMilli()
	channel := &model.Channel{Id: "ch1", Name: "demo", DisplayName: "Demo", TeamId: "team1"}
	user := &model.User{Id: "u1", Username: "sam"}
	post := &model.Post{Id: "p1", UserId: "u1", Message: "write the launch doc", CreateAt: now}
	list := &model.PostList{Order: []string{"p1"}, Posts: map[string]*model.Post{"p1": post}}
	team := &model.Team{Id: "team1", Name: "cursorteam"}

	api := &plugintest.API{}
	api.On("GetChannel", "ch1").Return(channel, nil)
	api.On("HasPermissionToChannel", "u1", "ch1", model.PermissionReadChannel).Return(true)
	api.On("GetConfig").Return(&model.Config{})
	api.On("GetTeam", "team1").Return(team, nil)
	api.On("GetPostsForChannel", "ch1", 0, contextPostLimit).Return(list, nil)
	api.On("GetUser", "u1").Return(user, nil)
	api.On("UploadFile", mock.Anything, "ch1", mock.AnythingOfType("string")).Return(&model.FileInfo{Id: "file1"}, nil)
	api.On("EnsureBotUser", mock.Anything).Return("bot-user-id", nil)
	api.On("GetTeamMember", "team1", "bot-user-id").Return(&model.TeamMember{}, nil)
	api.On("GetChannelMember", "ch1", "bot-user-id").Return(&model.ChannelMember{}, nil)
	api.On("CreatePost", mock.MatchedBy(func(post *model.Post) bool {
		return len(post.FileIds) == 1 && post.FileIds[0] == "file1"
	})).Return(&model.Post{Id: "reply1"}, nil)

	p := &Plugin{}
	p.SetAPI(api)
	p.setConfiguration(&configuration{})
	created, err := p.handleQuery(queryRequest{
		UserID:    "u1",
		ChannelID: "ch1",
		TeamID:    "team1",
		Message:   "draft a launch doc",
	})
	require.NoError(t, err)
	require.NotNil(t, created)
}

func TestHandleQueryRouteStoresKV(t *testing.T) {
	t.Setenv(apiKeyEnv, "")
	t.Setenv(apiKeyAltEnv, "")

	channel := &model.Channel{Id: "ch1", Name: "demo", TeamId: "team1"}
	api := &plugintest.API{}
	api.On("GetChannel", "ch1").Return(channel, nil)
	api.On("HasPermissionToChannel", "u1", "ch1", model.PermissionReadChannel).Return(true)
	api.On("GetConfig").Return(&model.Config{})
	api.On("GetTeam", "team1").Return(&model.Team{Id: "team1", Name: "cursorteam"}, nil)
	api.On("GetPostsForChannel", "ch1", 0, contextPostLimit).Return(&model.PostList{}, nil)
	api.On("KVSet", "last_route", mock.Anything).Return(nil)
	api.On("EnsureBotUser", mock.Anything).Return("bot-user-id", nil)
	api.On("GetTeamMember", "team1", "bot-user-id").Return(&model.TeamMember{}, nil)
	api.On("GetChannelMember", "ch1", "bot-user-id").Return(&model.ChannelMember{}, nil)
	api.On("CreatePost", mock.AnythingOfType("*model.Post")).Return(&model.Post{Id: "reply1"}, nil)

	p := &Plugin{}
	p.SetAPI(api)
	p.setConfiguration(&configuration{})
	_, err := p.handleQuery(queryRequest{
		UserID:    "u1",
		ChannelID: "ch1",
		TeamID:    "team1",
		Message:   "route this to draft a doc",
	})
	require.NoError(t, err)
	api.AssertCalled(t, "KVSet", "last_route", mock.Anything)
}

func TestScheduleDialogPostsProposal(t *testing.T) {
	api := &plugintest.API{}
	api.On("EnsureBotUser", mock.Anything).Return("bot-user-id", nil)
	api.On("CreatePost", mock.MatchedBy(func(post *model.Post) bool {
		return post.ChannelId == "ch1" && bytes.Contains([]byte(post.Message), []byte("Standup"))
	})).Return(&model.Post{Id: "reply1"}, nil)

	p := &Plugin{}
	p.SetAPI(api)

	payload, err := json.Marshal(model.SubmitDialogRequest{
		ChannelId: "ch1",
		UserId:    "u1",
		State:     `{"channel_id":"ch1","root_id":"","user_id":"u1"}`,
		Submission: map[string]any{
			"title":     "Standup",
			"when":      "Thu 2pm",
			"attendees": "@sam",
			"agenda":    "recap",
		},
	})
	require.NoError(t, err)

	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodPost, "/dialog/schedule", bytes.NewReader(payload))
	p.ServeHTTP(&plugin.Context{}, w, r)
	assert.Equal(t, http.StatusOK, w.Code)
}

func TestServeHTTPNotFound(t *testing.T) {
	p := &Plugin{}
	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodGet, "/dialog/schedule", nil)
	p.ServeHTTP(&plugin.Context{}, w, r)
	assert.Equal(t, http.StatusNotFound, w.Code)
}
