// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestParseGrokIntent(t *testing.T) {
	tests := []struct {
		name    string
		message string
		want    GrokIntent
	}{
		{name: "empty is help", message: "", want: GrokIntentHelp},
		{name: "help", message: "help", want: GrokIntentHelp},
		{name: "question mark", message: "?", want: GrokIntentHelp},
		{name: "bare mention is help", message: "@grok", want: GrokIntentHelp},
		{name: "summarize thread", message: "summarize this thread", want: GrokIntentSummarize},
		{name: "tldr", message: "tl;dr the search channel", want: GrokIntentSummarize},
		{name: "catch up", message: "catch me up on what I missed", want: GrokIntentCatchUp},
		{name: "recap", message: "recap town-square", want: GrokIntentCatchUp},
		{name: "draft doc", message: "draft a project update document", want: GrokIntentDraft},
		{name: "schedule meeting", message: "schedule a meeting with search", want: GrokIntentSchedule},
		{name: "canvas", message: "build a canvas for the launch plan", want: GrokIntentCanvas},
		{name: "github", message: "what is open on github?", want: GrokIntentGitHub},
		{name: "jira ticket key", message: "status of YJIRA-26", want: GrokIntentJira},
		{name: "route", message: "route this to a specialist", want: GrokIntentRoute},
		{name: "plain question", message: "who owns the auth proxy cutover?", want: GrokIntentAsk},
		{name: "summarize wins over ask", message: "@grok summarize the auth thread", want: GrokIntentSummarize},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.want, ParseGrokIntent(tc.message))
		})
	}
}

func TestStripGrokMention(t *testing.T) {
	assert.Equal(t, "summarize this", StripGrokMention("@grok summarize this"))
	assert.Equal(t, "summarize this", StripGrokMention("@Grok summarize this"))
	assert.Equal(t, "hello", StripGrokMention("hello"))
	assert.Equal(t, "", StripGrokMention("@grok"))
}

func TestGrokAPIKeyPrefersDedicatedEnv(t *testing.T) {
	t.Setenv(GrokAPIKeyEnv, "dedicated-key")
	t.Setenv(GrokAPIKeyAltEnv, "alt-key")
	assert.Equal(t, "dedicated-key", GrokAPIKey())
	assert.True(t, GrokAPIConfigured())
}

func TestGrokAPIKeyFallsBackToMattermostEnv(t *testing.T) {
	t.Setenv(GrokAPIKeyEnv, "")
	t.Setenv(GrokAPIKeyAltEnv, "alt-key")
	assert.Equal(t, "alt-key", GrokAPIKey())
}

func TestGrokModelAndURLDefaults(t *testing.T) {
	t.Setenv(GrokAPIModelEnv, "")
	t.Setenv(GrokAPIURLEnv, "")
	assert.Equal(t, GrokDefaultModel, GrokModel())
	assert.Equal(t, GrokDefaultAPIURL, GrokAPIURL())

	t.Setenv(GrokAPIModelEnv, "grok-4")
	t.Setenv(GrokAPIURLEnv, "https://example.test/v1/chat/completions")
	assert.Equal(t, "grok-4", GrokModel())
	assert.Equal(t, "https://example.test/v1/chat/completions", GrokAPIURL())
}

func TestGrokAPIConfiguredFalseWhenUnset(t *testing.T) {
	t.Setenv(GrokAPIKeyEnv, "")
	t.Setenv(GrokAPIKeyAltEnv, "")
	require.False(t, GrokAPIConfigured())
	assert.Equal(t, "", GrokAPIKey())
}
