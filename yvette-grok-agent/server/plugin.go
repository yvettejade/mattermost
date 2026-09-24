// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"strings"
	"sync"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
)

// Plugin is the Yvette Grok workspace agent.
type Plugin struct {
	plugin.MattermostPlugin

	configurationLock sync.RWMutex
	configuration     *configuration

	botUserID     string
	clientForTest ChatClient
}

func (p *Plugin) OnActivate() error {
	if err := p.OnConfigurationChange(); err != nil {
		return err
	}
	if _, err := p.ensureBot(); err != nil {
		return err
	}
	return p.registerCommand()
}

func (p *Plugin) MessageHasBeenPosted(_ *plugin.Context, post *model.Post) {
	if shouldSkipPost(post) {
		return
	}

	user, appErr := p.API.GetUser(post.UserId)
	if appErr != nil || user == nil || user.IsBot {
		return
	}

	botUserID, err := p.ensureBot()
	if err != nil {
		return
	}
	if post.UserId == botUserID {
		return
	}

	channel, chErr := p.API.GetChannel(post.ChannelId)
	if chErr != nil || channel == nil {
		return
	}

	mentioned := looksLikeMention(post.Message)
	dmWithBot := channel.Type == model.ChannelTypeDirect && strings.Contains(channel.Name, botUserID)
	if !mentioned && !dmWithBot {
		return
	}

	if _, handleErr := p.handleQuery(queryRequest{
		UserID:    post.UserId,
		ChannelID: post.ChannelId,
		RootID:    post.RootId,
		Message:   post.Message,
	}); handleErr != nil {
		p.API.LogWarn("Yvette Grok failed to handle mention")
	}
}
