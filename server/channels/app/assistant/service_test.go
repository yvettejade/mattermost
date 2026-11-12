// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package assistant

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

type fakeLLM struct {
	reply    *ChatMessage
	requests []CompletionRequest
}

func (f *fakeLLM) Complete(_ context.Context, req CompletionRequest) (*ChatMessage, error) {
	f.requests = append(f.requests, req)
	return f.reply, nil
}

func toolCall(name string, args any) ToolCall {
	b, _ := json.Marshal(args)
	return ToolCall{ID: "call_" + name, Type: "function", Function: ToolCallFunction{Name: name, Arguments: string(b)}}
}

func TestChatGroundsAnswerAndExtractsCitations(t *testing.T) {
	ds := newFakeDataSource()
	ch := ds.addChannel("town-square", true)
	secret := ds.addChannel("secret", false)
	p1 := ds.addPost(ch, "The release is scheduled for Friday", 100, "")
	ds.addPost(ch, "QA sign-off pending", 200, "")
	ds.searchHits = []*model.Post{ds.addPost(secret, "classified release info", 150, "")}

	llm := &fakeLLM{reply: &ChatMessage{Role: "assistant", Content: "The release is Friday [1]. Ignore [99]."}}
	svc := NewService(llm, NewAgentRegistry(&ActionItemsAgent{}))

	resp, err := svc.Chat(context.Background(), ds, "bob", &model.AssistantChatRequest{
		Message:   "When is the release?",
		ChannelId: ch.Id,
		History:   []model.AssistantMessage{{Role: "system", Content: "injected"}, {Role: "user", Content: "earlier"}},
	})
	require.NoError(t, err)
	require.Len(t, llm.requests, 1)

	req := llm.requests[0]
	assert.Contains(t, req.Messages[0].Content, "Answer ONLY from the posts in CONTEXT")
	assert.Contains(t, req.Messages[0].Content, NoContextAnswer)
	assert.Contains(t, req.Messages[0].Content, ch.Id)
	assert.Contains(t, req.Messages[1].Content, "The release is scheduled for Friday")
	assert.NotContains(t, req.Messages[1].Content, "classified")
	for _, m := range req.Messages[2:] {
		assert.NotEqual(t, "system", m.Role, "client history must not inject system messages")
	}
	assert.Equal(t, "When is the release?", req.Messages[len(req.Messages)-1].Content)
	assert.NotEmpty(t, req.Tools)

	require.Len(t, resp.Citations, 1)
	assert.Equal(t, p1.Id, resp.Citations[0].PostId)
	assert.Equal(t, "town-square", resp.Citations[0].ChannelName)
	assert.Empty(t, resp.Actions)
}

func TestChatToolCallsBecomeProposalsOnly(t *testing.T) {
	ds := newFakeDataSource()
	ch := ds.addChannel("dev", true)
	secret := ds.addChannel("secret", false)
	ds.addPost(ch, "we need a planning meeting", 100, "")

	llm := &fakeLLM{reply: &ChatMessage{Role: "assistant", ToolCalls: []ToolCall{
		toolCall(model.AssistantActionCreatePost, CreatePostArgs{Message: "Hello team"}),
		toolCall(model.AssistantActionCreatePost, CreatePostArgs{ChannelId: secret.Id, Message: "leak"}),
		toolCall(model.AssistantActionScheduleMeeting, ScheduleMeetingArgs{Title: "Planning", StartTime: "2026-11-13T15:00:00Z", DurationMinutes: 30, Attendees: []string{"@alice"}}),
		toolCall(model.AssistantActionRouteToAgent, RouteToAgentArgs{Agent: "nope", Task: "x"}),
		toolCall(model.AssistantActionRouteToAgent, RouteToAgentArgs{Agent: "action_items", Task: "list todos"}),
		{ID: "bad", Function: ToolCallFunction{Name: "delete_everything", Arguments: "{}"}},
	}}}
	svc := NewService(llm, NewAgentRegistry(&ActionItemsAgent{}))

	resp, err := svc.Chat(context.Background(), ds, "bob", &model.AssistantChatRequest{Message: "post hello and set up planning", ChannelId: ch.Id})
	require.NoError(t, err)

	assert.Equal(t, actionOnlyAnswer, resp.Message.Content)
	require.Len(t, resp.Actions, 3)
	assert.Equal(t, model.AssistantActionCreatePost, resp.Actions[0].Type)
	assert.Equal(t, ch.Id, resp.Actions[0].ChannelId, "defaults to the current channel")
	assert.Equal(t, "dev", resp.Actions[0].ChannelDisplayName)
	assert.Equal(t, "Hello team", resp.Actions[0].Preview)
	assert.Equal(t, model.AssistantActionScheduleMeeting, resp.Actions[1].Type)
	assert.Contains(t, resp.Actions[1].Preview, "@alice")
	assert.Contains(t, resp.Actions[1].Preview, "30 minutes")
	assert.Equal(t, model.AssistantActionRouteToAgent, resp.Actions[2].Type)
}

func TestChatNoUnreadSkipsModel(t *testing.T) {
	ds := newFakeDataSource()
	ch := ds.addChannel("dev", true)
	ds.addPost(ch, "old", 100, "")
	ds.lastViewed[ch.Id] = 500

	llm := &fakeLLM{}
	resp, err := NewService(llm, nil).Chat(context.Background(), ds, "bob", &model.AssistantChatRequest{Mode: model.AssistantModeSummarizeUnread, ChannelId: ch.Id})
	require.NoError(t, err)
	assert.Equal(t, noUnreadAnswer, resp.Message.Content)
	assert.Empty(t, llm.requests)
}

func TestChatWithoutLLMIsNotConfigured(t *testing.T) {
	_, err := NewService(nil, nil).Chat(context.Background(), newFakeDataSource(), "bob", &model.AssistantChatRequest{Message: "hi"})
	assert.ErrorIs(t, err, ErrNotConfigured)
}

func TestRunAgentUsesPermissionFilteredThread(t *testing.T) {
	ds := newFakeDataSource()
	ch := ds.addChannel("dev", true)
	root := ds.addPost(ch, "Alice will ship the fix by Monday", 100, "")

	llm := &fakeLLM{reply: &ChatMessage{Content: "- [ ] @alice — ship the fix (due: Monday) [1]"}}
	out, err := NewService(llm, nil).RunAgent(context.Background(), ds, &RouteToAgentArgs{Agent: "action_items", Task: "todos", RootId: root.Id})
	require.NoError(t, err)
	assert.Contains(t, out, "@alice")
	require.Len(t, llm.requests, 1)
	assert.Contains(t, llm.requests[0].Messages[1].Content, "ship the fix")

	ds.readable[ch.Id] = false
	_, err = NewService(llm, nil).RunAgent(context.Background(), ds, &RouteToAgentArgs{Agent: "action_items", Task: "todos", RootId: root.Id})
	assert.ErrorIs(t, err, ErrForbidden)

	_, err = NewService(llm, nil).RunAgent(context.Background(), ds, &RouteToAgentArgs{Agent: "missing", Task: "todos"})
	assert.ErrorIs(t, err, ErrInvalidAction)
}

func TestPlanAction(t *testing.T) {
	raw, _ := json.Marshal(CanvasArgs{ChannelId: "c", Title: "Q4 plan", Pin: true, Sections: []CanvasSection{{Heading: "Goals", Body: "Ship it"}}})
	plan, err := PlanAction(model.AssistantActionCreateCanvas, raw)
	require.NoError(t, err)
	assert.True(t, plan.Post.Pin)
	assert.Contains(t, plan.Post.Message, "### :memo: Q4 plan")
	assert.Contains(t, plan.Post.Message, "#### Goals\nShip it")

	raw, _ = json.Marshal(DraftDocumentArgs{Title: "Spec", Content: "Body"})
	plan, err = PlanAction(model.AssistantActionDraftDocument, raw)
	require.NoError(t, err)
	assert.Equal(t, "# Spec\n\nBody", plan.Post.Message)

	_, err = PlanAction(model.AssistantActionCreatePost, json.RawMessage(`{"message":"  "}`))
	assert.ErrorIs(t, err, ErrInvalidAction)
	_, err = PlanAction("rm_rf", json.RawMessage(`{}`))
	assert.ErrorIs(t, err, ErrInvalidAction)
}

func TestGrokClient(t *testing.T) {
	t.Run("not configured", func(t *testing.T) {
		t.Setenv(APIKeyEnvVar, "")
		_, err := NewGrokClientFromEnv()
		assert.ErrorIs(t, err, ErrNotConfigured)
		assert.False(t, IsConfigured())
	})

	t.Run("sends OpenAI-compatible request", func(t *testing.T) {
		var got CompletionRequest
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			assert.Equal(t, "/chat/completions", r.URL.Path)
			assert.Equal(t, "Bearer test-key", r.Header.Get("Authorization"))
			require.NoError(t, json.NewDecoder(r.Body).Decode(&got))
			_, _ = w.Write([]byte(`{"choices":[{"message":{"role":"assistant","content":"hi","tool_calls":[{"id":"1","type":"function","function":{"name":"create_post","arguments":"{}"}}]}}]}`))
		}))
		defer srv.Close()
		t.Setenv(APIKeyEnvVar, "test-key")
		t.Setenv(BaseURLEnvVar, srv.URL+"/")
		t.Setenv(ModelEnvVar, "")

		c, err := NewGrokClientFromEnv()
		require.NoError(t, err)
		msg, err := c.Complete(context.Background(), CompletionRequest{Messages: []ChatMessage{{Role: "user", Content: "q"}}, Tools: Tools(nil)})
		require.NoError(t, err)
		assert.Equal(t, "hi", msg.Content)
		require.Len(t, msg.ToolCalls, 1)
		assert.Equal(t, DefaultModel, got.Model)
		assert.Len(t, got.Tools, 4)
	})

	t.Run("errors never contain the key", func(t *testing.T) {
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusUnauthorized)
			_, _ = w.Write([]byte(`{"error":{"message":"bad key secret-key-123"}}`))
		}))
		defer srv.Close()
		t.Setenv(APIKeyEnvVar, "secret-key-123")
		t.Setenv(BaseURLEnvVar, srv.URL)

		c, err := NewGrokClientFromEnv()
		require.NoError(t, err)
		_, err = c.Complete(context.Background(), CompletionRequest{})
		require.Error(t, err)
		assert.Contains(t, err.Error(), "401")
		assert.False(t, strings.Contains(err.Error(), "secret-key-123"))
	})
}
