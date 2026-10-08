package main

import (
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
)

func (p *Plugin) MessageHasBeenPosted(_ *plugin.Context, post *model.Post) {
	if post == nil {
		return
	}
	if sentByPlugin, _ := post.GetProp(sentByPluginProp).(bool); sentByPlugin {
		return
	}
	if p.botUserID != "" && post.UserId == p.botUserID {
		return
	}
	if strings.TrimSpace(post.Message) == "" {
		return
	}

	channel, appErr := p.API.GetChannel(post.ChannelId)
	if appErr != nil || channel == nil {
		return
	}

	mentioned := mentionBot(post.Message)
	isDM := model.IsBotDMChannel(channel, p.botUserID)
	if !mentioned && !isDM {
		return
	}

	text := stripBotMention(post.Message)
	if strings.TrimSpace(text) == "" {
		return
	}

	rootID := post.RootId
	if rootID == "" {
		rootID = post.Id
	}

	req := userRequest{
		UserID:    post.UserId,
		ChannelID: post.ChannelId,
		RootID:    rootID,
		TeamID:    channel.TeamId,
		Text:      text,
		SiteURL:   p.siteURL(),
	}

	go p.dispatch(req)
}

func mentionBot(message string) bool {
	return strings.Contains(strings.ToLower(message), "@"+botUsername)
}

func stripBotMention(message string) string {
	out := message
	for _, token := range []string{"@" + botUsername, "@" + strings.ReplaceAll(botUsername, "-", "")} {
		out = strings.ReplaceAll(out, token, "")
	}
	return strings.TrimSpace(out)
}
