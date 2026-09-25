// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

// AssistantAsk is the body of POST /api/v4/channels/{channel_id}/assistant.
type AssistantAsk struct {
	Message string `json:"message"`
	RootId  string `json:"root_id,omitempty"`
	TeamId  string `json:"team_id,omitempty"`
}

// AssistantReply is the assistant text for the channel chat. It is not posted.
type AssistantReply struct {
	Reply string `json:"reply"`
}
