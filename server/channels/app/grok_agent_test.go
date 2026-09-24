// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"context"
	"fmt"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

type stubGrokClient struct {
	completeFn func(ctx context.Context, messages []GrokChatMessage) (string, error)
	calls      [][]GrokChatMessage
}

func (s *stubGrokClient) Complete(ctx context.Context, messages []GrokChatMessage) (string, error) {
	s.calls = append(s.calls, messages)
	if s.completeFn != nil {
		return s.completeFn(ctx, messages)
	}
	return "stub reply", nil
}

func TestBuildGrokWorkspaceContextText(t *testing.T) {
	text := buildGrokWorkspaceContextText(grokWorkspaceContext{
		ChannelName: "Search",
		TeamName:    "demo",
		IsThread:    true,
		Posts: []grokContextPost{
			{Username: "bobby.watson", Message: "Phase 1 is lexical rank.", CreateAt: 1_700_000_000_000},
		},
	})

	assert.Contains(t, text, "Scope: thread")
	assert.Contains(t, text, "Team: demo")
	assert.Contains(t, text, "Channel: Search")
	assert.Contains(t, text, "@bobby.watson: Phase 1 is lexical rank.")
}

func TestLocalGrokFallbackHelpAndIntegrations(t *testing.T) {
	help := localGrokFallback(model.GrokIntentHelp, "", grokWorkspaceContext{})
	assert.Contains(t, help, "/grok summarize")
	assert.Contains(t, help, "@grok")

	github := localGrokFallback(model.GrokIntentGitHub, "repo status", grokWorkspaceContext{})
	assert.Contains(t, github, model.GrokDefaultGitHubRepo)

	jira := localGrokFallback(model.GrokIntentJira, "YJIRA-23", grokWorkspaceContext{})
	assert.Contains(t, jira, model.GrokDefaultJiraURL)

	routed := localGrokFallback(model.GrokIntentRoute, "summarize the auth thread", grokWorkspaceContext{})
	assert.Contains(t, routed, string(model.GrokIntentSummarize))
}

func TestLocalHistoryRecapUsesRecentPosts(t *testing.T) {
	ctx := grokWorkspaceContext{
		ChannelName: "Auth",
		Posts: []grokContextPost{
			{Username: "robert.ward", Message: "Cutover is Thursday."},
			{Username: "kimberly.george", Message: "Keep zero forced logouts."},
		},
	}

	recap := localHistoryRecap(model.GrokIntentCatchUp, ctx)
	assert.Contains(t, recap, "Catch up")
	assert.Contains(t, recap, "@robert.ward: Cutover is Thursday.")
	assert.Contains(t, recap, "@kimberly.george: Keep zero forced logouts.")
}

func TestShouldSkipGrokPost(t *testing.T) {
	assert.True(t, shouldSkipGrokPost(nil))
	assert.True(t, shouldSkipGrokPost(&model.Post{Message: ""}))
	assert.True(t, shouldSkipGrokPost(&model.Post{Message: "hi", Type: model.PostTypeJoinChannel}))

	fromAgent := &model.Post{Message: "done"}
	fromAgent.AddProp(model.PostPropsFromGrokAgent, "true")
	assert.True(t, shouldSkipGrokPost(fromAgent))

	assert.False(t, shouldSkipGrokPost(&model.Post{Message: "@grok catch me up"}))
	assert.True(t, postLooksLikeGrokMention("@Grok summarize this"))
	assert.False(t, postLooksLikeGrokMention("hello grok without a mention"))
}

func TestGenerateGrokReplyUsesClientAndWorkspace(t *testing.T) {
	th := Setup(t).InitBasic(t)
	t.Cleanup(func() { grokChatClientForTest = nil })

	client := &stubGrokClient{
		completeFn: func(_ context.Context, messages []GrokChatMessage) (string, error) {
			require.Len(t, messages, 2)
			assert.Equal(t, "system", messages[0].Role)
			assert.Contains(t, messages[0].Content, model.GrokDefaultGitHubRepo)
			assert.Contains(t, messages[1].Content, "who owns search?")
			assert.Contains(t, messages[1].Content, "Channel:")
			return "Keith owns the search rewrite.", nil
		},
	}
	grokChatClientForTest = client

	reply, appErr := th.App.generateGrokReply(th.Context, model.GrokIntentAsk, "who owns search?", grokWorkspaceContext{
		ChannelName: "Search",
		Posts:       []grokContextPost{{Username: "keith.ryan", Message: "I'll take search.", CreateAt: 1}},
	})
	require.Nil(t, appErr)
	assert.Equal(t, "Keith owns the search rewrite.", reply)
	require.Len(t, client.calls, 1)
}

func TestGenerateGrokReplyFallsBackWhenClientErrors(t *testing.T) {
	th := Setup(t).InitBasic(t)
	t.Cleanup(func() { grokChatClientForTest = nil })

	grokChatClientForTest = &stubGrokClient{
		completeFn: func(context.Context, []GrokChatMessage) (string, error) {
			return "", fmt.Errorf("upstream down")
		},
	}

	reply, appErr := th.App.generateGrokReply(th.Context, model.GrokIntentSummarize, "summarize", grokWorkspaceContext{
		ChannelName: "Search",
		Posts:       []grokContextPost{{Username: "bobby.watson", Message: "Lexical ranker first."}},
	})
	require.Nil(t, appErr)
	assert.Contains(t, reply, "@bobby.watson: Lexical ranker first.")
	assert.Contains(t, reply, "history-only fallback")
}

func TestGenerateGrokReplyFallsBackWhenUnconfigured(t *testing.T) {
	th := Setup(t).InitBasic(t)
	t.Cleanup(func() { grokChatClientForTest = nil })
	t.Setenv("YvetteGrokAPI", "")
	t.Setenv("MM_GROKAGENTSETTINGS_APIKEY", "")
	grokChatClientForTest = nil

	reply, appErr := th.App.generateGrokReply(th.Context, model.GrokIntentSummarize, "summarize", grokWorkspaceContext{
		ChannelName: "Search",
		Posts:       []grokContextPost{{Username: "bobby.watson", Message: "Lexical ranker first."}},
	})
	require.Nil(t, appErr)
	assert.Contains(t, reply, "@bobby.watson: Lexical ranker first.")
	assert.Contains(t, reply, "YvetteGrokAPI")
}

func TestHandleGrokQueryPostsAsBot(t *testing.T) {
	th := Setup(t).InitBasic(t)
	t.Cleanup(func() { grokChatClientForTest = nil })

	grokChatClientForTest = &stubGrokClient{
		completeFn: func(context.Context, []GrokChatMessage) (string, error) {
			return "Search phase 1 is the lexical ranker.", nil
		},
	}

	_, _, appErr := th.App.CreatePost(th.Context, &model.Post{
		ChannelId: th.BasicChannel.Id,
		UserId:    th.BasicUser.Id,
		Message:   "Phase 1 is a real lexical score.",
	}, th.BasicChannel, model.CreatePostFlags{})
	require.Nil(t, appErr)

	reply, appErr := th.App.HandleGrokQuery(th.Context, th.BasicUser.Id, th.BasicChannel.Id, "", th.BasicTeam.Id, "summarize this channel")
	require.Nil(t, appErr)
	require.NotNil(t, reply)
	assert.Equal(t, "Search phase 1 is the lexical ranker.", reply.Message)
	assert.Equal(t, "true", reply.GetProp(model.PostPropsFromGrokAgent))

	bot, appErr := th.App.GetUserByUsername(model.GrokAgentUsername)
	require.Nil(t, appErr)
	assert.Equal(t, bot.Id, reply.UserId)
	assert.True(t, bot.IsBot)
}

func TestMaybeHandleGrokMentionIgnoresUnrelatedPosts(t *testing.T) {
	th := Setup(t).InitBasic(t)
	t.Cleanup(func() { grokChatClientForTest = nil })

	client := &stubGrokClient{}
	grokChatClientForTest = client

	th.App.MaybeHandleGrokMention(th.Context, &model.Post{
		ChannelId: th.BasicChannel.Id,
		UserId:    th.BasicUser.Id,
		Message:   "lunch?",
	}, th.BasicChannel, th.BasicUser)

	assert.Empty(t, client.calls)
}

func TestMaybeHandleGrokMentionRepliesToAtMention(t *testing.T) {
	th := Setup(t).InitBasic(t)
	t.Cleanup(func() { grokChatClientForTest = nil })

	grokChatClientForTest = &stubGrokClient{
		completeFn: func(context.Context, []GrokChatMessage) (string, error) {
			return "Here is the catch-up.", nil
		},
	}

	th.App.MaybeHandleGrokMention(th.Context, &model.Post{
		ChannelId: th.BasicChannel.Id,
		UserId:    th.BasicUser.Id,
		Message:   "@grok catch me up",
	}, th.BasicChannel, th.BasicUser)

	list, appErr := th.App.GetPosts(th.Context, th.BasicChannel.Id, 0, 20)
	require.Nil(t, appErr)
	var found bool
	for _, item := range list.Posts {
		if item.GetProp(model.PostPropsFromGrokAgent) != nil && strings.Contains(item.Message, "Here is the catch-up.") {
			found = true
			break
		}
	}
	assert.True(t, found, "expected a Grok bot reply in the channel")
}

func TestGrokSystemPromptIncludesIntegrations(t *testing.T) {
	prompt := grokSystemPrompt(model.GrokIntentJira)
	assert.Contains(t, prompt, model.GrokDefaultJiraURL)
	assert.Contains(t, prompt, model.GrokDefaultGitHubRepo)
	assert.Contains(t, prompt, "YJIRA")
}

func TestRouteGrokSpecialist(t *testing.T) {
	assert.Equal(t, model.GrokIntentDraft, routeGrokSpecialist("route this: draft a launch doc"))
	assert.Equal(t, model.GrokIntentAsk, routeGrokSpecialist("route this to someone"))
}

func TestTruncateGrokSnippet(t *testing.T) {
	assert.Equal(t, "short", truncateGrokSnippet("short", 10))
	assert.Equal(t, "12345…", truncateGrokSnippet("1234567890", 5))
}
