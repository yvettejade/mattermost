// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package assistant

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/mattermost/mattermost/server/public/model"
)

func TestRoute(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		message string
		rootID  string
		want    string
	}{
		{name: "empty is summarize", message: "", want: model.AssistantIntentSummarize},
		{name: "whitespace is summarize", message: "   ", want: model.AssistantIntentSummarize},
		{name: "summarize keyword", message: "please summarize this", want: model.AssistantIntentSummarize},
		{name: "tldr", message: "tldr", want: model.AssistantIntentSummarize},
		{name: "summary", message: "give me a summary", want: model.AssistantIntentSummarize},
		{name: "issue key is jira", message: "What is PLAT-9?", want: model.AssistantIntentJira},
		{name: "jira keyword", message: "check jira for status", want: model.AssistantIntentJira},
		{name: "tickets keyword", message: "any open tickets?", want: model.AssistantIntentJira},
		{name: "jira beats summarize", message: "summarize PLAT-9", want: model.AssistantIntentJira},
		{name: "schedule meeting", message: "schedule meeting with design", want: model.AssistantIntentScheduleMeeting},
		{name: "start a call", message: "start a call tomorrow", want: model.AssistantIntentScheduleMeeting},
		{name: "jira beats schedule meeting", message: "schedule meeting about jira", want: model.AssistantIntentJira},
		{name: "schedule post", message: "schedule a post in 1 hour", want: model.AssistantIntentSchedulePost},
		{name: "board", message: "create a board for this launch", want: model.AssistantIntentBoard},
		{name: "card", message: "create a card for the bug", want: model.AssistantIntentBoard},
		{name: "draft", message: "draft a recap document", want: model.AssistantIntentDraft},
		{name: "playbook is draft", message: "draft a playbook", want: model.AssistantIntentDraft},
		{name: "catch me up", message: "catch me up", want: model.AssistantIntentCatchUp},
		{name: "what did I miss", message: "what did I miss", want: model.AssistantIntentCatchUp},
		{name: "since yesterday", message: "since yesterday", want: model.AssistantIntentCatchUp},
		{name: "since 2h", message: "what happened since 2h", want: model.AssistantIntentCatchUp},
		{name: "qa fallback", message: "why did we change the API?", want: model.AssistantIntentQA},
		{name: "root id does not change qa", message: "why did we change the API?", rootID: "root123", want: model.AssistantIntentQA},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			assert.Equal(t, tc.want, Route(tc.message, tc.rootID))
		})
	}
}

func TestExtractIssueKeys(t *testing.T) {
	t.Parallel()
	assert.Equal(t, []string{"PLAT-9", "ABC-12"}, ExtractIssueKeys("See PLAT-9 and ABC-12 please"))
	assert.Nil(t, ExtractIssueKeys("no keys here"))
}
