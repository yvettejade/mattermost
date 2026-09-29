// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package slashcommands

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/i18n"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/app"
)

type AssistantProvider struct{}

const (
	CmdAssistant = "assistant"
)

func init() {
	app.RegisterCommandProvider(&AssistantProvider{})
}

func (*AssistantProvider) GetTrigger() string {
	return CmdAssistant
}

func (*AssistantProvider) GetCommand(a *app.App, T i18n.TranslateFunc) *model.Command {
	return &model.Command{
		Trigger:      CmdAssistant,
		AutoComplete: false,
		DisplayName:  T("api.command_assistant.name"),
	}
}

func (*AssistantProvider) DoCommand(a *app.App, rctx request.CTX, args *model.CommandArgs, message string) *model.CommandResponse {
	text, ephemeral := a.AskAssistant(rctx, args, message)
	if ephemeral {
		return assistantEphemeral(text)
	}
	return assistantReply(a, rctx, args, text)
}

func assistantEphemeral(text string) *model.CommandResponse {
	return &model.CommandResponse{
		ResponseType:     model.CommandResponseTypeEphemeral,
		Text:             text,
		SkipSlackParsing: true,
	}
}

func assistantReply(a *app.App, rctx request.CTX, args *model.CommandArgs, text string) *model.CommandResponse {
	body := "**Assistant**\n\n" + text
	if args == nil || args.ChannelId == "" || args.UserId == "" {
		return assistantEphemeral(body)
	}
	if ok, _ := a.HasPermissionToChannel(rctx, args.UserId, args.ChannelId, model.PermissionCreatePost); !ok {
		return assistantEphemeral(body)
	}
	return &model.CommandResponse{
		ResponseType:     model.CommandResponseTypeInChannel,
		Username:         "Assistant",
		Text:             body,
		SkipSlackParsing: true,
	}
}
