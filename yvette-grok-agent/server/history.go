// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"fmt"
	"strings"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
)

type contextPost struct {
	ID        string
	Username  string
	Message   string
	CreateAt  int64
	Permalink string
}

type workspaceContext struct {
	ChannelName string
	TeamName    string
	SiteURL     string
	IsThread    bool
	IsSearch    bool
	Posts       []contextPost
}

func postPermalink(siteURL, teamName, postID string) string {
	siteURL = strings.TrimRight(siteURL, "/")
	if postID == "" {
		return ""
	}
	if teamName == "" {
		return siteURL + "/pl/" + postID
	}
	return siteURL + "/" + teamName + "/pl/" + postID
}

func withinHistoryWindow(createAt, nowMs, maxAgeMs int64) bool {
	if createAt <= 0 {
		return false
	}
	return createAt >= nowMs-maxAgeMs
}

func (p *Plugin) siteURL() string {
	if p.API == nil {
		return ""
	}
	cfg := p.API.GetConfig()
	if cfg != nil && cfg.ServiceSettings.SiteURL != nil {
		return strings.TrimRight(*cfg.ServiceSettings.SiteURL, "/")
	}
	return ""
}

func (p *Plugin) loadWorkspaceContext(userID, channelID, rootID, teamID string, intent Intent, query string) workspaceContext {
	ctx := workspaceContext{
		IsThread: rootID != "",
		IsSearch: intent == IntentSearch,
		SiteURL:  p.siteURL(),
	}

	if !p.API.HasPermissionToChannel(userID, channelID, model.PermissionReadChannel) {
		return ctx
	}

	channel, appErr := p.API.GetChannel(channelID)
	if appErr != nil || channel == nil {
		return ctx
	}
	ctx.ChannelName = channel.DisplayName
	if ctx.ChannelName == "" {
		ctx.ChannelName = channel.Name
	}

	if teamID == "" {
		teamID = channel.TeamId
	}
	if teamID != "" {
		if team, err := p.API.GetTeam(teamID); err == nil && team != nil {
			ctx.TeamName = team.Name
		}
	}

	nowMs := time.Now().UnixMilli()
	maxAge := int64(historyMaxAge)
	if useMeetingWindow(intent, query) {
		maxAge = meetingWindowMs
	}

	if intent == IntentSearch {
		terms := searchTerms(query)
		if terms != "" && teamID != "" {
			perPage := contextPostLimit
			results, err := p.API.SearchPostsInTeamForUser(teamID, userID, model.SearchParameter{
				Terms:   &terms,
				PerPage: &perPage,
			})
			if err == nil && results != nil {
				p.appendPosts(&ctx, results.PostList, nowMs, maxAge)
				return ctx
			}
		}
	}

	var postList *model.PostList
	if rootID != "" {
		postList, _ = p.API.GetPostThread(rootID)
	} else {
		postList, _ = p.API.GetPostsForChannel(channelID, 0, contextPostLimit)
	}
	p.appendPosts(&ctx, postList, nowMs, maxAge)
	return ctx
}

func (p *Plugin) appendPosts(ctx *workspaceContext, postList *model.PostList, nowMs, maxAgeMs int64) {
	if postList == nil {
		return
	}
	order := postList.Order
	if len(order) > contextPostLimit {
		order = order[:contextPostLimit]
	}

	// GetPostsForChannel returns newest-first; present oldest-first to the model.
	for i := len(order) - 1; i >= 0; i-- {
		if len(ctx.Posts) >= contextPostLimit {
			break
		}
		post := postList.Posts[order[i]]
		if post == nil || post.DeleteAt != 0 || post.Message == "" {
			continue
		}
		if post.GetProp(propFromAgent) != nil {
			continue
		}
		if !withinHistoryWindow(post.CreateAt, nowMs, maxAgeMs) {
			continue
		}
		username := ""
		if user, err := p.API.GetUser(post.UserId); err == nil && user != nil {
			username = user.Username
		}
		ctx.Posts = append(ctx.Posts, contextPost{
			ID:        post.Id,
			Username:  username,
			Message:   post.Message,
			CreateAt:  post.CreateAt,
			Permalink: postPermalink(ctx.SiteURL, ctx.TeamName, post.Id),
		})
	}
}

func buildWorkspaceContextText(ctx workspaceContext) string {
	var b strings.Builder
	scope := "channel"
	if ctx.IsThread {
		scope = "thread"
	}
	if ctx.IsSearch {
		scope = "team search"
	}
	fmt.Fprintf(&b, "Scope: %s\n", scope)
	if ctx.TeamName != "" {
		fmt.Fprintf(&b, "Team: %s\n", ctx.TeamName)
	}
	if ctx.ChannelName != "" {
		fmt.Fprintf(&b, "Channel: %s\n", ctx.ChannelName)
	}
	b.WriteString("Conversation:\n")
	if len(ctx.Posts) == 0 {
		b.WriteString("(no recent messages)\n")
		return b.String()
	}
	for _, post := range ctx.Posts {
		username := post.Username
		if username == "" {
			username = "unknown"
		}
		timestamp := time.UnixMilli(post.CreateAt).UTC().Format("2006-01-02 15:04")
		if post.Permalink != "" {
			fmt.Fprintf(&b, "[%s] @%s: %s (%s)\n", timestamp, username, post.Message, post.Permalink)
		} else {
			fmt.Fprintf(&b, "[%s] @%s: %s\n", timestamp, username, post.Message)
		}
	}
	return b.String()
}

func citePermalinks(ctx workspaceContext, limit int) string {
	if limit <= 0 {
		limit = 3
	}
	var links []string
	start := 0
	if len(ctx.Posts) > limit {
		start = len(ctx.Posts) - limit
	}
	for _, post := range ctx.Posts[start:] {
		if post.Permalink == "" {
			continue
		}
		links = append(links, post.Permalink)
	}
	if len(links) == 0 {
		return ""
	}
	return "Sources: " + strings.Join(links, " · ")
}
