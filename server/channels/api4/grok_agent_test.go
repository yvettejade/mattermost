// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

func TestGetGrokAgentStatus(t *testing.T) {
	mainHelper.Parallel(t)
	t.Setenv(model.GrokAPIKeyEnv, "")
	th := Setup(t).InitBasic(t)

	status, httpResp, err := getAPIResponse[model.GrokAgentStatus](t, th.Client, "/grok_agent/status")
	require.NoError(t, err)
	CheckOKStatus(t, httpResp)
	assert.True(t, status.Available)
	assert.Equal(t, model.GrokDefaultGitHubRepo, status.GitHubRepo)
	assert.Equal(t, model.GrokDefaultJiraProjectKey, status.JiraProjectKey)
}

func TestQueryGrokAgentAPI(t *testing.T) {
	mainHelper.Parallel(t)
	t.Setenv(model.GrokAPIKeyEnv, "")
	th := Setup(t).InitBasic(t)

	_, _, createErr := th.App.CreatePost(th.Context, &model.Post{
		UserId:    th.BasicUser.Id,
		ChannelId: th.BasicChannel.Id,
		Message:   "Need a recap of the Grok agent work",
	}, th.BasicChannel, model.CreatePostFlags{})
	require.Nil(t, createErr)

	httpResp, err := th.Client.DoAPIPostJSON(context.Background(), "/grok_agent/query", model.GrokAgentQueryRequest{
		ChannelID: th.BasicChannel.Id,
		Intent:    model.GrokAgentIntentSummarize,
	})
	require.NoError(t, err)
	defer httpResp.Body.Close()
	require.Equal(t, http.StatusOK, httpResp.StatusCode)

	resp, _, err := model.DecodeJSONFromResponse[model.GrokAgentQueryResponse](httpResp)
	require.NoError(t, err)
	assert.Equal(t, model.GrokAgentIntentSummarize, resp.Intent)
	assert.Contains(t, resp.Reply, "Grok agent work")
}

func TestQueryGrokAgentAPIRequiresAuthAndChannelAccess(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	th.Client.Logout(context.Background())
	httpResp, err := th.Client.DoAPIPostJSON(context.Background(), "/grok_agent/query", model.GrokAgentQueryRequest{
		ChannelID: th.BasicChannel.Id,
		Message:   "summarize",
	})
	require.Error(t, err)
	CheckUnauthorizedStatus(t, model.BuildResponse(httpResp))

	th.LoginBasic(t)
	otherTeam := th.CreateTeamWithClient(t, th.SystemAdminClient)
	otherChannel := th.CreateChannelWithClientAndTeam(t, th.SystemAdminClient, model.ChannelTypePrivate, otherTeam.Id)

	httpResp, err = th.Client.DoAPIPostJSON(context.Background(), "/grok_agent/query", model.GrokAgentQueryRequest{
		ChannelID: otherChannel.Id,
		Message:   "summarize",
	})
	require.Error(t, err)
	CheckForbiddenStatus(t, model.BuildResponse(httpResp))
}

func TestQueryGrokAgentAPIRejectsInvalidBody(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	httpResp, err := th.Client.DoAPIPost(context.Background(), "/grok_agent/query", "{")
	require.Error(t, err)
	CheckBadRequestStatus(t, model.BuildResponse(httpResp))
}
