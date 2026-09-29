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
	text, _ := runAssistant(a, rctx, args, message)
	// Completions stay ephemeral. Channel posts and Jira packet text are not written into the channel.
	return assistantEphemeral(text)
}

// runAssistant is the slash-command entry to AskAssistant. Tests replace it.
var runAssistant = func(a *app.App, rctx request.CTX, args *model.CommandArgs, message string) (string, bool) {
	return a.AskAssistant(rctx, args, message, true)
}

func assistantEphemeral(text string) *model.CommandResponse {
	return &model.CommandResponse{
		ResponseType:     model.CommandResponseTypeEphemeral,
		Text:             text,
		SkipSlackParsing: true,
	}
}
