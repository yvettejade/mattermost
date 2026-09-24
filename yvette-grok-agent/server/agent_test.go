// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type stubChatClient struct {
	reply string
	err   error
	got   []ChatMessage
}

func (s *stubChatClient) Complete(_ context.Context, messages []ChatMessage) (string, error) {
	s.got = messages
	return s.reply, s.err
}

func TestLocalFallbackHelpAndIntegrations(t *testing.T) {
	t.Setenv(apiKeyEnv, "")
	t.Setenv(apiKeyAltEnv, "")
	cfg := &configuration{}

	help := localFallback(IntentHelp, "", workspaceContext{}, cfg)
	assert.Contains(t, help, "/yvette summarize")
	assert.Contains(t, help, "@yvette-grok")

	gh := localFallback(IntentGitHub, "", workspaceContext{}, cfg)
	assert.Contains(t, gh, defaultGitHub)

	jira := localFallback(IntentJira, "", workspaceContext{}, cfg)
	assert.Contains(t, jira, defaultJiraURL)

	route := localFallback(IntentRoute, "route this to draft a doc", workspaceContext{}, cfg)
	assert.Contains(t, route, "draft")
}

func TestLocalHistoryRecap(t *testing.T) {
	t.Setenv(apiKeyEnv, "")
	t.Setenv(apiKeyAltEnv, "")
	ctx := workspaceContext{
		ChannelName: "demo",
		Posts: []contextPost{{
			Username:  "sam",
			Message:   "we shipped the header",
			Permalink: "https://mm.example/t/pl/abc",
		}},
	}
	recap := localHistoryRecap(IntentCatchUp, ctx)
	assert.Contains(t, recap, "Catch up")
	assert.Contains(t, recap, "@sam")
	assert.Contains(t, recap, "/pl/abc")

	empty := localFallback(IntentAsk, "hello", workspaceContext{}, &configuration{})
	assert.Contains(t, empty, "don't have recent channel history")
}

func TestShouldSkipPost(t *testing.T) {
	require.True(t, shouldSkipPost(nil))
	require.True(t, shouldSkipPost(&model.Post{}))
	require.True(t, shouldSkipPost(&model.Post{Message: "join", Type: model.PostTypeJoinChannel}))

	agent := &model.Post{Message: "hi"}
	agent.AddProp(propFromAgent, "true")
	require.True(t, shouldSkipPost(agent))

	require.False(t, shouldSkipPost(&model.Post{Message: "@yvette-grok summarize"}))
	require.True(t, looksLikeMention("hey @yvette-grok"))
	require.False(t, looksLikeMention("hey grok"))
}

func TestGenerateReplyUsesClientAndFallback(t *testing.T) {
	t.Setenv(apiKeyEnv, "")
	t.Setenv(apiKeyAltEnv, "")

	p := &Plugin{}
	p.setConfiguration(&configuration{})
	workspace := workspaceContext{
		ChannelName: "demo",
		Posts:       []contextPost{{Username: "sam", Message: "hello", Permalink: "https://mm.example/t/pl/1"}},
	}

	help := p.generateReply(context.Background(), IntentHelp, "", workspace)
	assert.Contains(t, help, "/yvette")

	fallback := p.generateReply(context.Background(), IntentAsk, "what shipped?", workspace)
	assert.Contains(t, fallback, "YvetteGrokAPI")
	assert.Contains(t, fallback, "/pl/1")

	stub := &stubChatClient{reply: "Shipped the header. No extra cites."}
	p.clientForTest = stub
	reply := p.generateReply(context.Background(), IntentAsk, "what shipped?", workspace)
	assert.Contains(t, reply, "Shipped the header")
	assert.Contains(t, reply, "Sources:")
	require.Len(t, stub.got, 2)
	assert.Equal(t, "system", stub.got[0].Role)
	assert.Contains(t, stub.got[1].Content, "hello")

	stub.err = fmt.Errorf("boom")
	failed := p.generateReply(context.Background(), IntentAsk, "what shipped?", workspace)
	assert.Contains(t, failed, "history-only fallback")
}

func TestDraftFilename(t *testing.T) {
	name := draftFilename(time.Date(2026, 9, 24, 15, 4, 0, 0, time.UTC))
	assert.Equal(t, "yvette-draft-20260924-1504.md", name)
}

func TestSystemPromptMentionsIntegrations(t *testing.T) {
	prompt := systemPrompt(IntentSummarize, &configuration{})
	assert.Contains(t, prompt, defaultGitHub)
	assert.Contains(t, prompt, defaultJiraURL)
	assert.Contains(t, prompt, "Highlights")
}
