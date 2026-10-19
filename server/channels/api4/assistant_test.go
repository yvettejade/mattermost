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
	"github.com/mattermost/mattermost/server/v8/channels/app/assistant"
)

func TestAskAssistantAPI(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	origComplete := assistant.Complete
	t.Cleanup(func() {
		assistant.Complete = origComplete
	})

	t.Run("unauthenticated returns 401", func(t *testing.T) {
		client := th.CreateClient()
		_, resp, err := client.AskAssistant(context.Background(), th.BasicChannel.Id, &model.AssistantAsk{Message: "summarize"})
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})

	t.Run("no read permission returns 403", func(t *testing.T) {
		other := th.CreateUser(t)
		otherClient := th.CreateClient()
		_, _, err := otherClient.Login(context.Background(), other.Email, other.Password)
		require.NoError(t, err)

		_, resp, err := otherClient.AskAssistant(context.Background(), th.BasicChannel.Id, &model.AssistantAsk{Message: "summarize"})
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("missing grok config returns 501", func(t *testing.T) {
		t.Setenv(assistant.EnvGrokAPI, "")
		_, resp, err := th.Client.AskAssistant(context.Background(), th.BasicChannel.Id, &model.AssistantAsk{Message: "summarize"})
		require.Error(t, err)
		CheckNotImplementedStatus(t, resp)
	})

	t.Run("success shape is 200", func(t *testing.T) {
		t.Setenv(assistant.EnvGrokAPI, "test-grok-key")
		assistant.Complete = func(ctx context.Context, systemPrompt, userPrompt string) (string, *model.AppError) {
			return "grounded summary", nil
		}

		reply, resp, err := th.Client.AskAssistant(context.Background(), th.BasicChannel.Id, &model.AssistantAsk{
			Message: "summarize",
			RootId:  "",
		})
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.NotNil(t, reply)
		assert.Equal(t, "grounded summary", reply.Reply)
		assert.Equal(t, model.AssistantIntentSummarize, reply.Intent)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
	})
}
