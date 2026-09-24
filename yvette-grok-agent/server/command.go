// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
)

func (p *Plugin) registerCommand() error {
	return p.API.RegisterCommand(&model.Command{
		Trigger:          slashTrigger,
		AutoComplete:     true,
		AutoCompleteDesc: "Ask Yvette Grok about this channel, or summarize, draft, schedule, canvas, search, or route work",
		AutoCompleteHint: "[ask | summarize | catch up | draft | schedule | canvas | github | jira | search | route]",
		DisplayName:      "Yvette Grok",
		Description:      "Workspace agent backed by Grok Chat",
	})
}

func helpText() string {
	return localFallback(IntentHelp, "", workspaceContext{}, &configuration{})
}

func (p *Plugin) ExecuteCommand(_ *plugin.Context, args *model.CommandArgs) (*model.CommandResponse, *model.AppError) {
	message := ""
	if args != nil {
		message = strings.TrimSpace(strings.TrimPrefix(args.Command, "/"+slashTrigger))
		message = strings.TrimSpace(message)
	}
	if args == nil || message == "" || strings.EqualFold(message, "help") || message == "?" {
		return &model.CommandResponse{
			ResponseType: model.CommandResponseTypeEphemeral,
			Text:         helpText(),
		}, nil
	}

	_, err := p.handleQuery(queryRequest{
		UserID:    args.UserId,
		ChannelID: args.ChannelId,
		RootID:    args.RootId,
		TeamID:    args.TeamId,
		TriggerID: args.TriggerId,
		Message:   message,
	})
	if err != nil {
		p.API.LogWarn("Yvette Grok slash command failed")
		return &model.CommandResponse{
			ResponseType: model.CommandResponseTypeEphemeral,
			Text:         "I couldn't complete that request. Check that I can read this channel.",
		}, nil
	}

	return &model.CommandResponse{}, nil
}
