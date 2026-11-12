// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/app/assistant"
)

type fakeGrok struct {
	mu       sync.Mutex
	server   *httptest.Server
	reply    assistant.ChatMessage
	requests []assistant.CompletionRequest
}

func newFakeGrok(t *testing.T) *fakeGrok {
	f := &fakeGrok{reply: assistant.ChatMessage{Role: "assistant", Content: "ok"}}
	f.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var req assistant.CompletionRequest
		require.NoError(t, json.NewDecoder(r.Body).Decode(&req))
		f.mu.Lock()
		f.requests = append(f.requests, req)
		reply := f.reply
		f.mu.Unlock()
		require.NoError(t, json.NewEncoder(w).Encode(map[string]any{"choices": []any{map[string]any{"message": reply}}}))
	}))
	t.Cleanup(f.server.Close)
	t.Setenv(assistant.APIKeyEnvVar, "test-key")
	t.Setenv(assistant.BaseURLEnvVar, f.server.URL)
	return f
}

func (f *fakeGrok) setReply(m assistant.ChatMessage) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.reply = m
}

func (f *fakeGrok) allPromptText() string {
	f.mu.Lock()
	defer f.mu.Unlock()
	var sb strings.Builder
	for _, r := range f.requests {
		for _, m := range r.Messages {
			sb.WriteString(m.Content)
			sb.WriteString("\n")
		}
	}
	return sb.String()
}

func (f *fakeGrok) count() int {
	f.mu.Lock()
	defer f.mu.Unlock()
	return len(f.requests)
}

func TestAssistantNotConfigured(t *testing.T) {
	th := Setup(t).InitBasic(t)
	t.Setenv(assistant.APIKeyEnvVar, "")

	status, _, err := th.Client.GetAssistantStatus(context.Background())
	require.NoError(t, err)
	assert.False(t, status.Configured)
	assert.NotEmpty(t, status.Agents)

	_, resp, err := th.Client.AssistantChat(context.Background(), &model.AssistantChatRequest{Message: "hello"})
	require.Error(t, err)
	CheckNotImplementedStatus(t, resp)
	CheckErrorID(t, err, "app.assistant.not_configured.app_error")
}

func TestAssistantChat(t *testing.T) {
	th := Setup(t).InitBasic(t)
	grok := newFakeGrok(t)

	// BasicUser is not a member of BasicPrivateChannel2.
	_, appErr := th.App.GetChannelMember(th.Context, th.BasicPrivateChannel2.Id, th.BasicUser.Id)
	require.NotNil(t, appErr)

	visible := th.CreateMessagePostWithClient(t, th.Client, th.BasicChannel, "The zephyr launch is planned for Friday")
	secret := th.CreateMessagePostWithClient(t, th.SystemAdminClient, th.BasicPrivateChannel2, "Secret zephyr acquisition codename")

	t.Run("status is configured without exposing the key", func(t *testing.T) {
		status, _, err := th.Client.GetAssistantStatus(context.Background())
		require.NoError(t, err)
		assert.True(t, status.Configured)
		raw, _ := json.Marshal(status)
		assert.NotContains(t, string(raw), "test-key")
	})

	t.Run("grounds answers only in readable content and cites sources", func(t *testing.T) {
		grok.setReply(assistant.ChatMessage{Role: "assistant", Content: "Launch is Friday [1]."})
		res, _, err := th.Client.AssistantChat(context.Background(), &model.AssistantChatRequest{
			Message:   "When is the zephyr launch?",
			ChannelId: th.BasicChannel.Id,
		})
		require.NoError(t, err)

		prompt := grok.allPromptText()
		assert.Contains(t, prompt, visible.Message)
		assert.NotContains(t, prompt, "acquisition")
		assert.NotContains(t, prompt, secret.Id)

		require.NotEmpty(t, res.Citations)
		cited := map[string]bool{}
		for _, c := range res.Citations {
			cited[c.PostId] = true
			assert.NotEqual(t, th.BasicPrivateChannel2.Id, c.ChannelId)
		}
		assert.Equal(t, "Launch is Friday [1].", res.Message.Content)
	})

	t.Run("rejects channel and thread context the user cannot read", func(t *testing.T) {
		before := grok.count()
		_, resp, err := th.Client.AssistantChat(context.Background(), &model.AssistantChatRequest{Message: "summarize", ChannelId: th.BasicPrivateChannel2.Id})
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)

		_, resp, err = th.Client.AssistantChat(context.Background(), &model.AssistantChatRequest{Mode: model.AssistantModeSummarizeThread, ChannelId: th.BasicChannel.Id, RootId: secret.Id})
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)

		_, resp, err = th.Client.AssistantChat(context.Background(), &model.AssistantChatRequest{Mode: model.AssistantModeSummarizeUnread, ChannelId: th.BasicPrivateChannel2.Id})
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
		assert.Equal(t, before, grok.count(), "model must not be called for forbidden context")
	})

	t.Run("summarizes a thread", func(t *testing.T) {
		reply := th.CreateMessagePostWithClient(t, th.Client, th.BasicChannel, "reply body")
		reply.RootId = visible.Id
		_, _, err := th.Client.UpdatePost(context.Background(), reply.Id, reply)
		require.NoError(t, err)

		grok.setReply(assistant.ChatMessage{Role: "assistant", Content: "Thread summary [1]"})
		res, _, err := th.Client.AssistantChat(context.Background(), &model.AssistantChatRequest{Mode: model.AssistantModeSummarizeThread, RootId: visible.Id})
		require.NoError(t, err)
		assert.Equal(t, "Thread summary [1]", res.Message.Content)
		require.Len(t, res.Citations, 1)
		assert.Equal(t, visible.Id, res.Citations[0].PostId)
	})

	t.Run("validates requests", func(t *testing.T) {
		_, resp, err := th.Client.AssistantChat(context.Background(), &model.AssistantChatRequest{})
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)

		_, resp, err = th.Client.AssistantChat(context.Background(), &model.AssistantChatRequest{Mode: "bogus", Message: "x"})
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("returns tool calls as proposals without executing them", func(t *testing.T) {
		args, _ := json.Marshal(assistant.CreatePostArgs{Message: "proposed hello"})
		grok.setReply(assistant.ChatMessage{Role: "assistant", ToolCalls: []assistant.ToolCall{{
			ID: "call_1", Type: "function", Function: assistant.ToolCallFunction{Name: model.AssistantActionCreatePost, Arguments: string(args)},
		}}})
		res, _, err := th.Client.AssistantChat(context.Background(), &model.AssistantChatRequest{Message: "say hello", ChannelId: th.BasicChannel.Id})
		require.NoError(t, err)
		require.Len(t, res.Actions, 1)
		assert.Equal(t, th.BasicChannel.Id, res.Actions[0].ChannelId)

		posts, _, err := th.Client.GetPostsForChannel(context.Background(), th.BasicChannel.Id, 0, 50, "", false, false)
		require.NoError(t, err)
		for _, p := range posts.Posts {
			assert.NotEqual(t, "proposed hello", p.Message)
		}
	})
}

func TestExecuteAssistantAction(t *testing.T) {
	th := Setup(t).InitBasic(t)
	grok := newFakeGrok(t)

	execute := func(actionType string, args any) (*model.AssistantExecuteActionResponse, *model.Response, error) {
		raw, err := json.Marshal(args)
		require.NoError(t, err)
		return th.Client.ExecuteAssistantAction(context.Background(), &model.AssistantExecuteActionRequest{Type: actionType, Args: raw})
	}

	t.Run("creates a post as the user", func(t *testing.T) {
		res, resp, err := execute(model.AssistantActionCreatePost, assistant.CreatePostArgs{ChannelId: th.BasicChannel.Id, Message: "confirmed message"})
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
		assert.Equal(t, th.BasicUser.Id, res.Post.UserId)
		assert.Equal(t, "confirmed message", res.Post.Message)
	})

	t.Run("replies in a thread", func(t *testing.T) {
		res, _, err := execute(model.AssistantActionCreatePost, assistant.CreatePostArgs{ChannelId: th.BasicChannel.Id, RootId: th.BasicPost.Id, Message: "reply"})
		require.NoError(t, err)
		assert.Equal(t, th.BasicPost.Id, res.Post.RootId)
	})

	t.Run("creates a pinned canvas", func(t *testing.T) {
		res, _, err := execute(model.AssistantActionCreateCanvas, assistant.CanvasArgs{
			ChannelId: th.BasicChannel.Id, Title: "Roadmap", Pin: true,
			Sections: []assistant.CanvasSection{{Heading: "Now", Body: "Ship assistant"}},
		})
		require.NoError(t, err)
		assert.True(t, res.Post.IsPinned)
		assert.Contains(t, res.Post.Message, "#### Now")
	})

	t.Run("posts a meeting proposal", func(t *testing.T) {
		res, _, err := execute(model.AssistantActionScheduleMeeting, assistant.ScheduleMeetingArgs{
			ChannelId: th.BasicChannel.Id, Title: "Sync", StartTime: "2026-11-13T15:00:00Z", DurationMinutes: 30,
		})
		require.NoError(t, err)
		assert.Contains(t, res.Post.Message, "Meeting proposal: Sync")
	})

	t.Run("enforces create post permission", func(t *testing.T) {
		_, resp, err := execute(model.AssistantActionCreatePost, assistant.CreatePostArgs{ChannelId: th.BasicPrivateChannel2.Id, Message: "nope"})
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)

		_, resp, err = execute(model.AssistantActionDraftDocument, assistant.DraftDocumentArgs{ChannelId: th.BasicPrivateChannel2.Id, Title: "Doc", Content: "x"})
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("rejects replies to a root in another channel", func(t *testing.T) {
		other := th.CreateMessagePostWithClient(t, th.Client, th.BasicChannel2, "root elsewhere")
		_, resp, err := execute(model.AssistantActionCreatePost, assistant.CreatePostArgs{ChannelId: th.BasicChannel.Id, RootId: other.Id, Message: "x"})
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("rejects invalid actions", func(t *testing.T) {
		_, resp, err := execute("delete_channel", map[string]string{"channel_id": th.BasicChannel.Id})
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)

		_, resp, err = execute(model.AssistantActionCreatePost, assistant.CreatePostArgs{ChannelId: "bad", Message: "x"})
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("routes to a specialized agent", func(t *testing.T) {
		th.CreateMessagePostWithClient(t, th.Client, th.BasicChannel, "Bob will update the docs tomorrow")
		grok.setReply(assistant.ChatMessage{Role: "assistant", Content: "- [ ] @bob — update the docs [1]"})
		res, _, err := execute(model.AssistantActionRouteToAgent, assistant.RouteToAgentArgs{Agent: "action_items", Task: "list todos", ChannelId: th.BasicChannel.Id})
		require.NoError(t, err)
		assert.Contains(t, res.Content, "@bob")
		assert.Contains(t, grok.allPromptText(), "Bob will update the docs tomorrow")

		_, resp, err := execute(model.AssistantActionRouteToAgent, assistant.RouteToAgentArgs{Agent: "action_items", Task: "list todos", ChannelId: th.BasicPrivateChannel2.Id})
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})
}
