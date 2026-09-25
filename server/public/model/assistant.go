// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

const (
	AssistantIntentSummarize       = "summarize"
	AssistantIntentCatchUp         = "catch_up"
	AssistantIntentQA              = "qa"
	AssistantIntentDraft           = "draft"
	AssistantIntentBoard           = "board"
	AssistantIntentScheduleMeeting = "schedule_meeting"
	AssistantIntentSchedulePost    = "schedule_post"
	AssistantIntentJira            = "jira"

	AssistantActionScheduledPost = "scheduled_post"
	AssistantActionBoardChannel  = "board_channel"
	AssistantActionCard          = "card"
)

// AssistantAsk is the request body for POST /api/v4/channels/{channel_id}/assistant.
type AssistantAsk struct {
	Message string `json:"message"`
	RootId  string `json:"root_id"`
}

// AssistantAction describes an optional side effect from an assistant ask.
type AssistantAction struct {
	Type   string `json:"type"`
	Id     string `json:"id,omitempty"`
	Detail string `json:"detail,omitempty"`
}

// AssistantReply is the success body for an assistant ask.
type AssistantReply struct {
	Reply   string            `json:"reply"`
	Intent  string            `json:"intent"`
	Actions []AssistantAction `json:"actions,omitempty"`
}
