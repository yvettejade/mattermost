// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestParseIntent(t *testing.T) {
	cases := []struct {
		in   string
		want Intent
	}{
		{"", IntentHelp},
		{"help", IntentHelp},
		{"?", IntentHelp},
		{"summarize the auth thread", IntentSummarize},
		{"tldr", IntentSummarize},
		{"catch up", IntentCatchUp},
		{"what did I miss", IntentCatchUp},
		{"summarize the meeting", IntentMeeting},
		{"meeting notes", IntentMeeting},
		{"schedule a design review", IntentSchedule},
		{"canvas the launch plan", IntentCanvas},
		{"draft a status doc", IntentDraft},
		{"what's open on github", IntentGitHub},
		{"status of YJIRA-26", IntentJira},
		{"route this to a specialist", IntentRoute},
		{"route this to draft a doc", IntentRoute},
		{"search the team for launch", IntentSearch},
		{"search deploy rollback", IntentSearch},
		{"who owns onboarding?", IntentAsk},
	}
	for _, tc := range cases {
		assert.Equal(t, tc.want, ParseIntent(tc.in), tc.in)
	}
}

func TestStripBotMention(t *testing.T) {
	assert.Equal(t, "summarize", StripBotMention("@yvette-grok summarize"))
	assert.Equal(t, "summarize", StripBotMention("@Yvette-Grok summarize"))
	assert.Equal(t, "hello", StripBotMention("hello"))
}

func TestSearchTerms(t *testing.T) {
	assert.Equal(t, "launch", searchTerms("search the team launch"))
	assert.Equal(t, "deploy rollback", searchTerms("search deploy rollback"))
	assert.Equal(t, "plain", searchTerms("plain"))
}

func TestRouteSpecialist(t *testing.T) {
	assert.Equal(t, IntentDraft, routeSpecialist("route this to draft a doc"))
	assert.Equal(t, IntentAsk, routeSpecialist("route this"))
	assert.Equal(t, "draft a document", firstAction(IntentDraft))
}

func TestUseMeetingWindow(t *testing.T) {
	require.True(t, useMeetingWindow(IntentMeeting, "anything"))
	require.True(t, useMeetingWindow(IntentSummarize, "summarize the meeting"))
	require.False(t, useMeetingWindow(IntentSummarize, "summarize the channel"))
	require.False(t, useMeetingWindow(IntentAsk, "meeting later?"))
}
