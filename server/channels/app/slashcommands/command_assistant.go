// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package slashcommands

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/i18n"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/app"
)

type AssistantProvider struct {
}

const (
	CmdAssistant          = "assistant"
	assistantSlashUsername = "Assistant"
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
		DisplayName:  "assistant",
		Username:     assistantSlashUsername,
	}
}

func (*AssistantProvider) DoCommand(a *app.App, rctx request.CTX, args *model.CommandArgs, message string) *model.CommandResponse {
	reply, appErr := a.AskAssistant(rctx, args.ChannelId, args.UserId, &model.AssistantAsk{
		Message: message,
		RootId:  args.RootId,
	})
	if appErr != nil {
		text := appErr.Message
		if text == "" {
			text = appErr.Id
		}
		return &model.CommandResponse{
			ResponseType: model.CommandResponseTypeEphemeral,
			Text:         text,
		}
	}

	canPost, _ := a.HasPermissionToChannel(rctx, args.UserId, args.ChannelId, model.PermissionCreatePost)
	if !canPost {
		return &model.CommandResponse{
			ResponseType: model.CommandResponseTypeEphemeral,
			Text:         reply.Reply,
		}
	}

	return &model.CommandResponse{
		ResponseType: model.CommandResponseTypeInChannel,
		Username:     assistantSlashUsername,
		Text:         reply.Reply,
	}
}
