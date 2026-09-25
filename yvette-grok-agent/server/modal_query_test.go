package main

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin/plugintest"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/yvettejade/mattermost/yvette-grok-agent/server/llm"
)

type stubLLM struct {
	reply string
	err   error
}

func (s stubLLM) Complete(_ context.Context, _ llm.CompletionRequest) (string, error) {
	return s.reply, s.err
}

func newModalTestPlugin(t *testing.T, api *plugintest.API) *Plugin {
	t.Helper()
	t.Setenv("YvetteGrokAPI", "")
	t.Setenv("YVETTE_GROK_API", "")

	p := newDialogTestPlugin(api)
	cfg := &configuration{}
	cfg.applyDefaultsAndEnv()
	p.setConfiguration(cfg)
	api.On("GetConfig").Return(&model.Config{}).Maybe()
	api.On("LogError", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Maybe()
	return p
}

func TestHandleStatusUnauthorized(t *testing.T) {
	api := &plugintest.API{}
	p := newModalTestPlugin(t, api)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/status", nil)
	rec := httptest.NewRecorder()
	p.ServeHTTP(nil, rec, req)
	require.Equal(t, http.StatusUnauthorized, rec.Code)
}

func TestHandleStatusOK(t *testing.T) {
	api := &plugintest.API{}
	p := newModalTestPlugin(t, api)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/status", nil)
	req.Header.Set(mattermostUserHeader, "alice")
	rec := httptest.NewRecorder()
	p.ServeHTTP(nil, rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
	var got modalStatusResponse
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &got))
	require.True(t, got.OK)
	require.False(t, got.GrokConfigured)
	require.Equal(t, "workspace", got.Provider)
	require.Equal(t, defaultGitHubOwner, got.GitHubOwner)
	require.Equal(t, defaultJiraProjectKey, got.JiraProjectKey)
}

func TestHandleQueryUnauthorized(t *testing.T) {
	api := &plugintest.API{}
	p := newModalTestPlugin(t, api)

	body, _ := json.Marshal(modalQueryRequest{Text: "hello", ChannelID: "chan-1"})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/query", bytes.NewReader(body))
	rec := httptest.NewRecorder()
	p.ServeHTTP(nil, rec, req)
	require.Equal(t, http.StatusUnauthorized, rec.Code)
	api.AssertNotCalled(t, "GetChannelMember", mock.Anything, mock.Anything)
}

func TestHandleQueryRequiresTextAndChannel(t *testing.T) {
	api := &plugintest.API{}
	p := newModalTestPlugin(t, api)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/query", bytes.NewReader([]byte(`{"channel_id":"chan-1"}`)))
	req.Header.Set(mattermostUserHeader, "alice")
	rec := httptest.NewRecorder()
	p.ServeHTTP(nil, rec, req)
	require.Equal(t, http.StatusBadRequest, rec.Code)

	req = httptest.NewRequest(http.MethodPost, "/api/v1/query", bytes.NewReader([]byte(`{"text":"hi"}`)))
	req.Header.Set(mattermostUserHeader, "alice")
	rec = httptest.NewRecorder()
	p.ServeHTTP(nil, rec, req)
	require.Equal(t, http.StatusBadRequest, rec.Code)
}

func TestHandleQueryForbiddenWhenNotMember(t *testing.T) {
	api := &plugintest.API{}
	p := newModalTestPlugin(t, api)
	api.On("GetChannelMember", "chan-1", "alice").Return(nil, model.NewAppError("GetChannelMember", "app.channel.get_member.app_error", nil, "", http.StatusForbidden))

	body, _ := json.Marshal(modalQueryRequest{Text: "catch me up", ChannelID: "chan-1"})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/query", bytes.NewReader(body))
	req.Header.Set(mattermostUserHeader, "alice")
	rec := httptest.NewRecorder()
	p.ServeHTTP(nil, rec, req)

	require.Equal(t, http.StatusForbidden, rec.Code)
	api.AssertNotCalled(t, "GetPostsForChannel", mock.Anything, mock.Anything, mock.Anything)
}

func TestHandleQueryWorkspaceFallback(t *testing.T) {
	api := &plugintest.API{}
	p := newModalTestPlugin(t, api)
	api.On("GetChannelMember", "chan-1", "alice").Return(&model.ChannelMember{UserId: "alice", ChannelId: "chan-1", LastViewedAt: 1}, nil)
	api.On("GetPostsSince", "chan-1", int64(1)).Return(&model.PostList{
		Order: []string{"p1"},
		Posts: map[string]*model.Post{
			"p1": {Id: "p1", UserId: "bob", ChannelId: "chan-1", Message: "ship YJIRA-28 today", CreateAt: model.GetMillis()},
		},
	}, nil)

	body, _ := json.Marshal(modalQueryRequest{Message: "catch up", ChannelID: "chan-1"})
	req := httptest.NewRequest(http.MethodPost, "/query", bytes.NewReader(body))
	req.Header.Set(mattermostUserHeader, "alice")
	rec := httptest.NewRecorder()
	p.ServeHTTP(nil, rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
	var got modalQueryResponse
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &got))
	require.Equal(t, "summarize", got.Intent)
	require.Equal(t, "workspace", got.Provider)
	require.Contains(t, got.Reply, "ship YJIRA-28 today")
}

func TestHandleQueryUsesGrokWhenConfigured(t *testing.T) {
	api := &plugintest.API{}
	p := newModalTestPlugin(t, api)
	cfg := p.getConfiguration().Clone()
	cfg.YvetteGrokAPI = "test-key-not-a-real-secret"
	p.setConfiguration(cfg)
	p.llmClient = stubLLM{reply: "Grok says the thread is about YJIRA-28."}

	api.On("GetChannelMember", "chan-1", "alice").Return(&model.ChannelMember{UserId: "alice", ChannelId: "chan-1"}, nil)
	api.On("GetPostsForChannel", "chan-1", 0, defaultHistoryMaxPosts).Return(&model.PostList{
		Order: []string{"p1"},
		Posts: map[string]*model.Post{
			"p1": {Id: "p1", UserId: "bob", ChannelId: "chan-1", Message: "ship it", CreateAt: model.GetMillis()},
		},
	}, nil)

	body, _ := json.Marshal(modalQueryRequest{Text: "what is going on?", ChannelID: "chan-1"})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/query", bytes.NewReader(body))
	req.Header.Set(mattermostUserHeader, "alice")
	rec := httptest.NewRecorder()
	p.ServeHTTP(nil, rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
	var got modalQueryResponse
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &got))
	require.Equal(t, "qa", got.Intent)
	require.Equal(t, "grok", got.Provider)
	require.Equal(t, "Grok says the thread is about YJIRA-28.", got.Reply)
}

func TestHandleQueryFallsBackWhenGrokErrors(t *testing.T) {
	api := &plugintest.API{}
	p := newModalTestPlugin(t, api)
	cfg := p.getConfiguration().Clone()
	cfg.YvetteGrokAPI = "test-key-not-a-real-secret"
	p.setConfiguration(cfg)
	p.llmClient = stubLLM{err: errString("grok unavailable")}

	api.On("GetChannelMember", "chan-1", "alice").Return(&model.ChannelMember{UserId: "alice", ChannelId: "chan-1"}, nil)
	api.On("GetPostsForChannel", "chan-1", 0, defaultHistoryMaxPosts).Return(&model.PostList{
		Order: []string{"p1"},
		Posts: map[string]*model.Post{
			"p1": {Id: "p1", UserId: "bob", ChannelId: "chan-1", Message: "fallback post", CreateAt: model.GetMillis()},
		},
	}, nil)

	body, _ := json.Marshal(modalQueryRequest{Text: "summarize this channel", ChannelID: "chan-1", Intent: "summarize"})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/query", bytes.NewReader(body))
	req.Header.Set(mattermostUserHeader, "alice")
	rec := httptest.NewRecorder()
	p.ServeHTTP(nil, rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
	var got modalQueryResponse
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &got))
	require.Equal(t, "workspace", got.Provider)
	require.Contains(t, got.Reply, "fallback post")
}

func TestClassifyCatchUp(t *testing.T) {
	in := Classify("catch up", "YJIRA", "yvettejade", "mattermost")
	require.Equal(t, IntentSummarize, in.Kind)
}
