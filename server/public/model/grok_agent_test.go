// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNormalizeGrokAgentIntent(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name            string
		intent          string
		message         string
		expectedIntent  string
		expectedMessage string
	}{
		{name: "explicit ask", intent: "ask", message: "what did we decide?", expectedIntent: GrokAgentIntentAsk, expectedMessage: "what did we decide?"},
		{name: "explicit recap alias", intent: "recap", message: "yesterday", expectedIntent: GrokAgentIntentSummarize, expectedMessage: "yesterday"},
		{name: "leading summarize token", message: "summarize this thread", expectedIntent: GrokAgentIntentSummarize, expectedMessage: "this thread"},
		{name: "leading github token", message: "github open issues", expectedIntent: GrokAgentIntentGitHub, expectedMessage: "open issues"},
		{name: "infer draft", message: "draft a project update", expectedIntent: GrokAgentIntentDraft, expectedMessage: "a project update"},
		{name: "infer schedule", message: "schedule standup tomorrow 10am", expectedIntent: GrokAgentIntentSchedule, expectedMessage: "standup tomorrow 10am"},
		{name: "infer canvas", message: "build a canvas for the launch", expectedIntent: GrokAgentIntentCanvas, expectedMessage: "build a canvas for the launch"},
		{name: "infer route", message: "route this to a specialist", expectedIntent: GrokAgentIntentRoute, expectedMessage: "this to a specialist"},
		{name: "infer jira from ticket key", message: "status of YJIRA-22", expectedIntent: GrokAgentIntentJira, expectedMessage: "status of YJIRA-22"},
		{name: "default ask", message: "why is the header empty?", expectedIntent: GrokAgentIntentAsk, expectedMessage: "why is the header empty?"},
		{name: "catch up phrase", message: "catch up on this channel", expectedIntent: GrokAgentIntentSummarize, expectedMessage: "catch up on this channel"},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			intent, message := NormalizeGrokAgentIntent(tc.intent, tc.message)
			assert.Equal(t, tc.expectedIntent, intent)
			assert.Equal(t, tc.expectedMessage, message)
		})
	}
}

func TestExtractJiraIssueKeys(t *testing.T) {
	t.Parallel()

	assert.Equal(t, []string{"YJIRA-22", "MM-100"}, ExtractJiraIssueKeys("See YJIRA-22 and MM-100, then YJIRA-22 again"))
	assert.Nil(t, ExtractJiraIssueKeys("no tickets here"))
}

func TestLoadGrokChatSettingsUsesEnv(t *testing.T) {
	t.Setenv(GrokAPIKeyEnv, "test-key")
	t.Setenv("MM_GROK_MODEL", "grok-4")
	t.Setenv("MM_GROK_GITHUB_REPO", "acme/demo")
	t.Setenv("MM_GROK_JIRA_PROJECT", "DEMO")

	settings := LoadGrokChatSettings()
	require.True(t, settings.HasGrokAPIKey())
	assert.Equal(t, GrokAgentProviderGrok, settings.Provider())
	assert.Equal(t, "grok-4", settings.Model)
	assert.Equal(t, "acme/demo", settings.GitHubRepo)
	assert.Equal(t, "DEMO", settings.JiraProjectKey)
	assert.Equal(t, GrokDefaultAPIURL, settings.APIURL)
	assert.Equal(t, GrokDefaultJiraBaseURL, settings.JiraBaseURL)
}

func TestLoadGrokChatSettingsWithoutKeyUsesWorkspaceProvider(t *testing.T) {
	t.Setenv(GrokAPIKeyEnv, "")
	settings := LoadGrokChatSettings()
	assert.False(t, settings.HasGrokAPIKey())
	assert.Equal(t, GrokAgentProviderWorkspace, settings.Provider())
	assert.Equal(t, GrokDefaultGitHubRepo, settings.GitHubRepo)
}
