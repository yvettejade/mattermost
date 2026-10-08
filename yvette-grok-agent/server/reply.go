package main

import (
	"github.com/mattermost/mattermost/server/public/model"
)

func (p *Plugin) reply(req userRequest, message string) {
	post := &model.Post{
		UserId:    p.botUserID,
		ChannelId: req.ChannelID,
		RootId:    req.RootID,
		Message:   message,
	}
	post.AddProp(sentByPluginProp, true)
	if _, err := p.API.CreatePost(post); err != nil {
		p.logErr("create post", err)
	}
}

func (p *Plugin) replyWithFile(req userRequest, message, fileID string) {
	post := &model.Post{
		UserId:    p.botUserID,
		ChannelId: req.ChannelID,
		RootId:    req.RootID,
		Message:   message,
		FileIds:   model.StringArray{fileID},
	}
	post.AddProp(sentByPluginProp, true)
	if _, err := p.API.CreatePost(post); err != nil {
		p.logErr("create post with file", err)
	}
}

func (p *Plugin) replyEphemeral(userID, channelID, message string) {
	p.API.SendEphemeralPost(userID, &model.Post{
		UserId:    p.botUserID,
		ChannelId: channelID,
		Message:   message,
		Props: map[string]any{
			sentByPluginProp: true,
		},
	})
}
