package main

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
)

const helpText = `**Yvette Grok** — in-Mattermost agent (sibling of mattermost-ai)

` + "`" + `/yvette help` + "`" + `
` + "`" + `/yvette ask <question>` + "`" + `
` + "`" + `/yvette summarize [thread|channel|meeting] [duration]` + "`" + `
` + "`" + `/yvette draft <title>` + "`" + `
` + "`" + `/yvette canvas <title>` + "`" + `
` + "`" + `/yvette schedule` + "`" + `
` + "`" + `/yvette jira <YJIRA-n>` + "`" + `
` + "`" + `/yvette github <pr|issue|#n|path>` + "`" + `
` + "`" + `/yvette route <agent> <brief>` + "`" + `

You can also @mention ` + "`" + `@yvette-grok` + "`" + ` or DM the bot.
Schedule posts an in-channel meeting proposal (no calendar write). Canvas is structured markdown.`

func (p *Plugin) ExecuteCommand(_ *plugin.Context, args *model.CommandArgs) (*model.CommandResponse, *model.AppError) {
	if args == nil {
		return &model.CommandResponse{ResponseType: model.CommandResponseTypeEphemeral, Text: helpText}, nil
	}

	cfg := p.getConfiguration()
	intent := ParseSlash(args.Command, cfg.JiraProjectKey, cfg.GitHubOwner, cfg.GitHubRepo)
	if intent.Kind == IntentHelp {
		return &model.CommandResponse{ResponseType: model.CommandResponseTypeEphemeral, Text: helpText}, nil
	}

	req := userRequest{
		UserID:    args.UserId,
		ChannelID: args.ChannelId,
		RootID:    args.RootId,
		TeamID:    args.TeamId,
		Text:      args.Command,
		TriggerID: args.TriggerId,
		SiteURL:   firstNonEmpty(args.SiteURL, p.siteURL()),
	}

	go p.executeIntent(req, intent, cfg)

	return &model.CommandResponse{
		ResponseType: model.CommandResponseTypeEphemeral,
		Text:         "Working on it…",
	}, nil
}
