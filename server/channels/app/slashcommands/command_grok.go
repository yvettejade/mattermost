// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package slashcommands

import (
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/i18n"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/app"
)

type GrokProvider struct {
}

const (
	CmdGrok = "grok"
)

func init() {
	app.RegisterCommandProvider(&GrokProvider{})
}

func (*GrokProvider) GetTrigger() string {
	return CmdGrok
}

func (*GrokProvider) GetCommand(a *app.App, T i18n.TranslateFunc) *model.Command {
	return &model.Command{
		Trigger:          CmdGrok,
		AutoComplete:     true,
		AutoCompleteDesc: T("api.command_grok.desc"),
		AutoCompleteHint: T("api.command_grok.hint"),
		DisplayName:      T("api.command_grok.name"),
	}
}

func (*GrokProvider) DoCommand(a *app.App, rctx request.CTX, args *model.CommandArgs, message string) *model.CommandResponse {
	message = strings.TrimSpace(message)
	if message == "" || strings.EqualFold(message, "help") || message == "?" {
		return &model.CommandResponse{
			ResponseType: model.CommandResponseTypeEphemeral,
			Text:         args.T("api.command_grok.help"),
		}
	}

	if a == nil {
		return &model.CommandResponse{
			ResponseType: model.CommandResponseTypeEphemeral,
			Text:         args.T("api.command_grok.unavailable.app_error"),
		}
	}

	_, appErr := a.HandleGrokQuery(rctx, args.UserId, args.ChannelId, args.RootId, args.TeamId, message)
	if appErr != nil {
		if rctx != nil {
			rctx.Logger().Warn("Grok slash command failed", mlog.Err(appErr))
		}
		return &model.CommandResponse{
			ResponseType: model.CommandResponseTypeEphemeral,
			Text:         args.T("api.command_grok.request.app_error"),
		}
	}

	return &model.CommandResponse{}
}
