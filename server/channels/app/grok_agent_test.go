// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

func TestQueryGrokAgentSummarizesWorkspaceHistory(t *testing.T) {
	t.Setenv(model.GrokAPIKeyEnv, "")
	th := Setup(t).InitBasic(t)

	_, _, appErr := th.App.CreatePost(th.Context, &model.Post{
		UserId:    th.BasicUser.Id,
		ChannelId: th.BasicChannel.Id,
		Message:   "Please ship the channel header empty state tomorrow",
	}, th.BasicChannel, model.CreatePostFlags{})
	require.Nil(t, appErr)

	resp, appErr := th.App.QueryGrokAgent(th.Context, th.BasicUser.Id, model.GrokAgentQueryRequest{
		ChannelID: th.BasicChannel.Id,
		Intent:    model.GrokAgentIntentSummarize,
	})
	require.Nil(t, appErr)
	require.NotNil(t, resp)
	assert.Equal(t, model.GrokAgentIntentSummarize, resp.Intent)
	assert.Equal(t, model.GrokAgentProviderWorkspace, resp.Provider)
	assert.Contains(t, resp.Reply, "Catch-up")
	assert.Contains(t, resp.Reply, "channel header empty state")
	assert.Contains(t, resp.Reply, "Possible action items")
}

func TestQueryGrokAgentRequiresChannelAccess(t *testing.T) {
	t.Setenv(model.GrokAPIKeyEnv, "")
	th := Setup(t).InitBasic(t)

	privateChannel := th.CreatePrivateChannel(t, th.BasicTeam)
	_ = th.App.RemoveUserFromChannel(th.Context, th.BasicUser.Id, "", privateChannel)

	_, appErr := th.App.QueryGrokAgent(th.Context, th.BasicUser.Id, model.GrokAgentQueryRequest{
		ChannelID: privateChannel.Id,
		Message:   "summarize",
	})
	require.NotNil(t, appErr)
	assert.Equal(t, http.StatusForbidden, appErr.StatusCode)
}

func TestQueryGrokAgentUsesGrokWhenConfigured(t *testing.T) {
	th := Setup(t).InitBasic(t)

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, http.MethodPost, r.Method)
		assert.True(t, strings.HasPrefix(r.Header.Get("Authorization"), "Bearer "))
		body, err := io.ReadAll(r.Body)
		require.NoError(t, err)
		assert.Contains(t, string(body), "Workspace history")
		require.NoError(t, json.NewEncoder(w).Encode(map[string]any{
			"choices": []map[string]any{{
				"message": map[string]string{"content": "Grok says the header work is still open."},
			}},
		}))
	}))
	t.Cleanup(server.Close)
	SetGrokHTTPClient(server.Client())
	t.Cleanup(func() { SetGrokHTTPClient(nil) })

	t.Setenv(model.GrokAPIKeyEnv, "test-key")
	t.Setenv("MM_GROK_API_URL", server.URL)

	resp, appErr := th.App.QueryGrokAgent(th.Context, th.BasicUser.Id, model.GrokAgentQueryRequest{
		ChannelID: th.BasicChannel.Id,
		Message:   "what is left on the header work?",
	})
	require.Nil(t, appErr)
	require.NotNil(t, resp)
	assert.Equal(t, model.GrokAgentProviderGrok, resp.Provider)
	assert.Equal(t, "Grok says the header work is still open.", resp.Reply)
}

func TestQueryGrokAgentGitHubAndJiraIntents(t *testing.T) {
	t.Setenv(model.GrokAPIKeyEnv, "")
	th := Setup(t).InitBasic(t)

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case strings.Contains(r.URL.Path, "/repos/"):
			require.NoError(t, json.NewEncoder(w).Encode(map[string]any{
				"full_name":         "yvettejade/mattermost",
				"description":       "Mattermost demo",
				"default_branch":    "master",
				"html_url":          "https://github.com/yvettejade/mattermost",
				"open_issues_count": 4,
				"stargazers_count":  12,
			}))
		default:
			http.NotFound(w, r)
		}
	}))
	t.Cleanup(server.Close)
	SetGrokHTTPClient(server.Client())
	t.Cleanup(func() { SetGrokHTTPClient(nil) })

	// Point GitHub lookups at the test server by using a custom client only;
	// fetchGitHubRepoContext always hits api.github.com. For this test we
	// assert the fallback + Jira browse URLs, which do not require live GitHub.
	t.Setenv(model.GrokAPIKeyEnv, "")

	githubResp, appErr := th.App.QueryGrokAgent(th.Context, th.BasicUser.Id, model.GrokAgentQueryRequest{
		ChannelID: th.BasicChannel.Id,
		Intent:    model.GrokAgentIntentGitHub,
	})
	require.Nil(t, appErr)
	assert.Equal(t, model.GrokAgentIntentGitHub, githubResp.Intent)
	assert.Contains(t, githubResp.Reply, "yvettejade/mattermost")
	require.NotEmpty(t, githubResp.Actions)
	assert.Equal(t, "github", githubResp.Actions[0].Type)

	jiraResp, appErr := th.App.QueryGrokAgent(th.Context, th.BasicUser.Id, model.GrokAgentQueryRequest{
		ChannelID: th.BasicChannel.Id,
		Message:   "jira YJIRA-22",
	})
	require.Nil(t, appErr)
	assert.Equal(t, model.GrokAgentIntentJira, jiraResp.Intent)
	assert.Contains(t, jiraResp.Reply, "YJIRA-22")
	assert.Contains(t, jiraResp.Reply, "/browse/YJIRA-22")
}

func TestGetGrokAgentStatus(t *testing.T) {
	th := Setup(t).InitBasic(t)
	t.Setenv(model.GrokAPIKeyEnv, "")

	status := th.App.GetGrokAgentStatus()
	assert.True(t, status.Available)
	assert.Equal(t, model.GrokAgentProviderWorkspace, status.Provider)
	assert.Equal(t, model.GrokDefaultGitHubRepo, status.GitHubRepo)
	assert.Equal(t, model.GrokDefaultJiraProjectKey, status.JiraProjectKey)
}

func TestQueryGrokAgentDraftScheduleCanvasRoute(t *testing.T) {
	t.Setenv(model.GrokAPIKeyEnv, "")
	th := Setup(t).InitBasic(t)

	draft, appErr := th.App.QueryGrokAgent(th.Context, th.BasicUser.Id, model.GrokAgentQueryRequest{
		ChannelID: th.BasicChannel.Id,
		Message:   "draft launch notes",
	})
	require.Nil(t, appErr)
	assert.Equal(t, model.GrokAgentIntentDraft, draft.Intent)
	assert.Contains(t, draft.Reply, "Draft document")

	schedule, appErr := th.App.QueryGrokAgent(th.Context, th.BasicUser.Id, model.GrokAgentQueryRequest{
		ChannelID: th.BasicChannel.Id,
		Message:   "schedule standup tomorrow",
	})
	require.Nil(t, appErr)
	assert.Equal(t, model.GrokAgentIntentSchedule, schedule.Intent)
	assert.Contains(t, schedule.Reply, "tomorrow")

	canvas, appErr := th.App.QueryGrokAgent(th.Context, th.BasicUser.Id, model.GrokAgentQueryRequest{
		ChannelID: th.BasicChannel.Id,
		Message:   "canvas Q4 plan",
	})
	require.Nil(t, appErr)
	assert.Equal(t, model.GrokAgentIntentCanvas, canvas.Intent)
	assert.Contains(t, canvas.Reply, "Canvas")

	route, appErr := th.App.QueryGrokAgent(th.Context, th.BasicUser.Id, model.GrokAgentQueryRequest{
		ChannelID: th.BasicChannel.Id,
		Message:   "route this to jira",
	})
	require.Nil(t, appErr)
	assert.Equal(t, model.GrokAgentIntentRoute, route.Intent)
	assert.Contains(t, route.Reply, "Jira specialist")
}
