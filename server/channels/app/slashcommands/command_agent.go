// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package slashcommands

import (
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/i18n"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/app"
)

type AgentProvider struct {
}

const (
	CmdAgent = "agent"
)

func init() {
	app.RegisterCommandProvider(&AgentProvider{})
}

func (*AgentProvider) GetTrigger() string {
	return CmdAgent
}

func (*AgentProvider) GetCommand(a *app.App, T i18n.TranslateFunc) *model.Command {
	return &model.Command{
		Trigger:          CmdAgent,
		AutoComplete:     true,
		AutoCompleteDesc: T("api.command_agent.desc"),
		AutoCompleteHint: T("api.command_agent.hint"),
		DisplayName:      T("api.command_agent.name"),
	}
}

func (*AgentProvider) DoCommand(a *app.App, rctx request.CTX, args *model.CommandArgs, message string) *model.CommandResponse {
	if strings.TrimSpace(message) == "" || strings.EqualFold(strings.TrimSpace(message), "help") {
		return &model.CommandResponse{
			ResponseType: model.CommandResponseTypeEphemeral,
			Text:         args.T("api.command_agent.help"),
		}
	}

	resp, appErr := a.QueryGrokAgent(rctx, args.UserId, model.GrokAgentQueryRequest{
		ChannelID: args.ChannelId,
		RootID:    args.RootId,
		Message:   message,
	})
	if appErr != nil {
		if appErr.Id == "app.grok_agent.permission_denied" {
			return &model.CommandResponse{
				ResponseType: model.CommandResponseTypeEphemeral,
				Text:         args.T("api.command_agent.permission.app_error"),
			}
		}
		return &model.CommandResponse{
			ResponseType: model.CommandResponseTypeEphemeral,
			Text:         args.T("api.command_agent.query.app_error"),
		}
	}

	text := resp.Reply
	if resp.Provider == model.GrokAgentProviderGrok {
		text = text + "\n\n_Answered by Grok Chat using workspace context._"
	} else {
		text = text + "\n\n_Answered from Mattermost workspace history. Set the YvetteGrokAPI secret to enable Grok Chat._"
	}

	return &model.CommandResponse{
		ResponseType: model.CommandResponseTypeEphemeral,
		Text:         text,
	}
}
