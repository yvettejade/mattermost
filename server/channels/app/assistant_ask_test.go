// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/app/assistant"
)

func TestAskAssistantConfigMissing(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	origComplete := assistant.Complete
	t.Cleanup(func() {
		assistant.Complete = origComplete
	})

	t.Setenv(assistant.EnvGrokAPI, "")
	assistant.Complete = func(ctx context.Context, systemPrompt, userPrompt string) (string, *model.AppError) {
		t.Fatal("Complete should not run when Grok is unconfigured")
		return "", nil
	}

	_, err := th.App.AskAssistant(th.Context, th.BasicChannel.Id, th.BasicUser.Id, &model.AssistantAsk{Message: "summarize"})
	require.NotNil(t, err)
	assert.Equal(t, http.StatusNotImplemented, err.StatusCode)
	assert.Equal(t, "api.assistant.config_missing", err.Id)
}

func TestAskAssistantLoadsPostsAndIntents(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	t.Setenv(assistant.EnvGrokAPI, "test-grok-key")

	origComplete := assistant.Complete
	origLookup := assistant.LookupJira
	t.Cleanup(func() {
		assistant.Complete = origComplete
		assistant.LookupJira = origLookup
	})

	t.Run("loads at most 50 posts", func(t *testing.T) {
		var captured string
		assistant.Complete = func(ctx context.Context, systemPrompt, userPrompt string) (string, *model.AppError) {
			captured = userPrompt
			return "summary", nil
		}

		for i := 0; i < 55; i++ {
			th.CreatePost(t, th.BasicChannel, func(p *model.Post) {
				p.Message = fmt.Sprintf("bulk-post-%02d", i)
				p.CreateAt = model.GetMillis() - int64(55000-i*100)
			})
		}

		reply, err := th.App.AskAssistant(th.Context, th.BasicChannel.Id, th.BasicUser.Id, &model.AssistantAsk{Message: "summarize"})
		require.Nil(t, err)
		assert.Equal(t, model.AssistantIntentSummarize, reply.Intent)
		assert.Equal(t, "summary", reply.Reply)
		assert.LessOrEqual(t, strings.Count(captured, "bulk-post-"), 50)
		assert.Contains(t, captured, "bulk-post-54")
	})

	t.Run("catch-up uses LastViewedAt", func(t *testing.T) {
		old := th.CreatePost(t, th.BasicChannel, func(p *model.Post) {
			p.Message = "old-catchup-token"
			p.CreateAt = model.GetMillis() - 60000
		})
		require.NotEmpty(t, old.Id)

		_, viewedErr := th.App.MarkChannelsAsViewed(th.Context, []string{th.BasicChannel.Id}, th.BasicUser.Id, "", true, false)
		require.Nil(t, viewedErr)

		th.CreatePost(t, th.BasicChannel, func(p *model.Post) {
			p.Message = "new-catchup-token"
			p.CreateAt = model.GetMillis() + 5000
		})

		var captured string
		assistant.Complete = func(ctx context.Context, systemPrompt, userPrompt string) (string, *model.AppError) {
			captured = userPrompt
			return "catch-up", nil
		}

		reply, err := th.App.AskAssistant(th.Context, th.BasicChannel.Id, th.BasicUser.Id, &model.AssistantAsk{Message: "catch me up"})
		require.Nil(t, err)
		assert.Equal(t, model.AssistantIntentCatchUp, reply.Intent)
		assert.Contains(t, captured, "new-catchup-token")
		assert.NotContains(t, captured, "old-catchup-token")
	})

	t.Run("thread scope uses root_id", func(t *testing.T) {
		root := th.CreateMessagePost(t, th.BasicChannel, "thread-root-token")
		th.CreatePostReply(t, root)
		th.CreateMessagePost(t, th.BasicChannel, "channel-only-token")

		var captured string
		assistant.Complete = func(ctx context.Context, systemPrompt, userPrompt string) (string, *model.AppError) {
			captured = userPrompt
			return "thread-answer", nil
		}

		reply, err := th.App.AskAssistant(th.Context, th.BasicChannel.Id, th.BasicUser.Id, &model.AssistantAsk{
			Message: "what was said?",
			RootId:  root.Id,
		})
		require.Nil(t, err)
		assert.Equal(t, model.AssistantIntentQA, reply.Intent)
		assert.Contains(t, captured, "thread-root-token")
		assert.NotContains(t, captured, "channel-only-token")
	})

	t.Run("boards off is a soft unavailable draft", func(t *testing.T) {
		require.False(t, th.App.Config().FeatureFlags.IntegratedBoards)
		assistant.Complete = func(ctx context.Context, systemPrompt, userPrompt string) (string, *model.AppError) {
			return "Board draft", nil
		}

		reply, err := th.App.AskAssistant(th.Context, th.BasicChannel.Id, th.BasicUser.Id, &model.AssistantAsk{
			Message: "create a board for launch",
		})
		require.Nil(t, err)
		assert.Equal(t, model.AssistantIntentBoard, reply.Intent)
		assert.Contains(t, reply.Reply, "Boards are unavailable")
		assert.Empty(t, reply.Actions)
	})

	t.Run("scheduled post without license notes unavailable", func(t *testing.T) {
		assistant.Complete = func(ctx context.Context, systemPrompt, userPrompt string) (string, *model.AppError) {
			return "Later note", nil
		}
		reply, err := th.App.AskAssistant(th.Context, th.BasicChannel.Id, th.BasicUser.Id, &model.AssistantAsk{
			Message: "schedule a post in 1 hour",
		})
		require.Nil(t, err)
		assert.Equal(t, model.AssistantIntentSchedulePost, reply.Intent)
		assert.Contains(t, reply.Reply, "Scheduled posts are unavailable")
		assert.Empty(t, reply.Actions)
	})

	t.Run("fabricated jira key refuses without grok", func(t *testing.T) {
		completeCalled := false
		assistant.Complete = func(ctx context.Context, systemPrompt, userPrompt string) (string, *model.AppError) {
			completeCalled = true
			return "should not run", nil
		}
		assistant.LookupJira = func(ctx context.Context, keys []string, query string) (*assistant.JiraPacket, *model.AppError) {
			assert.Equal(t, []string{"FAKE-999"}, keys)
			return &assistant.JiraPacket{Site: assistant.JiraSiteHost}, nil
		}

		reply, err := th.App.AskAssistant(th.Context, th.BasicChannel.Id, th.BasicUser.Id, &model.AssistantAsk{
			Message: "what is FAKE-999?",
		})
		require.Nil(t, err)
		assert.Equal(t, model.AssistantIntentJira, reply.Intent)
		assert.Equal(t, assistant.UngroundedIssueKeyMessage, reply.Reply)
		assert.False(t, completeCalled)
	})
}
