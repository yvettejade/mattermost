package main

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/pkg/errors"
)

func (p *Plugin) ensureBot() (string, error) {
	botID, err := p.client.Bot.EnsureBot(&model.Bot{
		Username:    botUsername,
		DisplayName: botDisplayName,
		Description: botDescription,
	})
	if err != nil {
		return "", errors.Wrap(err, "failed to ensure yvette-grok bot")
	}
	return botID, nil
}

func (p *Plugin) registerCommand() error {
	return p.client.SlashCommand.Register(&model.Command{
		Trigger:          commandTrigger,
		AutoComplete:     true,
		AutoCompleteDesc: "Yvette Grok agent — ask, summarize, draft, canvas, schedule, jira, github, route",
		AutoCompleteHint: "[help|ask|summarize|draft|canvas|schedule|jira|github|route]",
		DisplayName:      botDisplayName,
		Description:      botDescription,
	})
}
