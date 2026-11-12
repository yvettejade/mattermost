// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import "encoding/json"

const (
	AssistantModeAsk             = "ask"
	AssistantModeSummarizeThread = "summarize_thread"
	AssistantModeSummarizeUnread = "summarize_unread"
	AssistantModeSummarizeRecent = "summarize_recent"

	AssistantActionDraftDocument   = "draft_document"
	AssistantActionCreatePost      = "create_post"
	AssistantActionScheduleMeeting = "schedule_meeting"
	AssistantActionCreateCanvas    = "create_canvas"
	AssistantActionRouteToAgent    = "route_to_agent"

	AssistantRoleUser      = "user"
	AssistantRoleAssistant = "assistant"

	AssistantMaxHistoryMessages = 20
	AssistantMaxMessageLength   = 8000
)

type AssistantMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type AssistantChatRequest struct {
	Message   string             `json:"message"`
	History   []AssistantMessage `json:"history,omitempty"`
	Mode      string             `json:"mode,omitempty"`
	ChannelId string             `json:"channel_id,omitempty"`
	RootId    string             `json:"root_id,omitempty"`
}

func (r *AssistantChatRequest) IsValid() *AppError {
	switch r.Mode {
	case "", AssistantModeAsk, AssistantModeSummarizeThread, AssistantModeSummarizeUnread, AssistantModeSummarizeRecent:
	default:
		return NewAppError("AssistantChatRequest.IsValid", "model.assistant.is_valid.mode.app_error", nil, "", 400)
	}
	if r.ChannelId != "" && !IsValidId(r.ChannelId) {
		return NewAppError("AssistantChatRequest.IsValid", "model.assistant.is_valid.channel_id.app_error", nil, "", 400)
	}
	if r.RootId != "" && !IsValidId(r.RootId) {
		return NewAppError("AssistantChatRequest.IsValid", "model.assistant.is_valid.root_id.app_error", nil, "", 400)
	}
	if len(r.Message) > AssistantMaxMessageLength {
		return NewAppError("AssistantChatRequest.IsValid", "model.assistant.is_valid.message.app_error", nil, "", 400)
	}
	if (r.Mode == "" || r.Mode == AssistantModeAsk) && r.Message == "" {
		return NewAppError("AssistantChatRequest.IsValid", "model.assistant.is_valid.message.app_error", nil, "", 400)
	}
	if r.Mode == AssistantModeSummarizeThread && r.RootId == "" {
		return NewAppError("AssistantChatRequest.IsValid", "model.assistant.is_valid.root_id.app_error", nil, "", 400)
	}
	if r.Mode == AssistantModeSummarizeUnread && r.ChannelId == "" {
		return NewAppError("AssistantChatRequest.IsValid", "model.assistant.is_valid.channel_id.app_error", nil, "", 400)
	}
	return nil
}

// AssistantCitation references a post that was supplied to the model as grounding.
type AssistantCitation struct {
	Index              int    `json:"index"`
	PostId             string `json:"post_id"`
	ChannelId          string `json:"channel_id"`
	ChannelName        string `json:"channel_name"`
	ChannelDisplayName string `json:"channel_display_name"`
	TeamName           string `json:"team_name,omitempty"`
	Username           string `json:"username,omitempty"`
	CreateAt           int64  `json:"create_at"`
	Snippet            string `json:"snippet"`
	Permalink          string `json:"permalink"`
}

// AssistantAction is an action the model proposed. It is never executed until the
// user confirms it and the client calls the execute endpoint.
type AssistantAction struct {
	Id                 string          `json:"id"`
	Type               string          `json:"type"`
	Title              string          `json:"title"`
	ChannelId          string          `json:"channel_id,omitempty"`
	ChannelDisplayName string          `json:"channel_display_name,omitempty"`
	Args               json.RawMessage `json:"args"`
	Preview            string          `json:"preview,omitempty"`
}

type AssistantChatResponse struct {
	Message   AssistantMessage     `json:"message"`
	Citations []*AssistantCitation `json:"citations"`
	Actions   []*AssistantAction   `json:"actions"`
}

type AssistantExecuteActionRequest struct {
	Type string          `json:"type"`
	Args json.RawMessage `json:"args"`
}

type AssistantExecuteActionResponse struct {
	Post    *Post  `json:"post,omitempty"`
	Content string `json:"content,omitempty"`
}

type AssistantAgentInfo struct {
	Name        string `json:"name"`
	Description string `json:"description"`
}

type AssistantStatus struct {
	Configured bool                  `json:"configured"`
	Agents     []*AssistantAgentInfo `json:"agents"`
}
