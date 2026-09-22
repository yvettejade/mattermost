// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package slashcommands

import (
	"context"
	"errors"
	"os"
	"strings"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/i18n"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/app"
	"github.com/mattermost/mattermost/server/v8/channels/app/assistant"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

type AssistantProvider struct{}

const (
	CmdAssistant = "assistant"

	// Told to the model when channel membership has no last-viewed timestamp.
	// The reply has to say the window is not a confirmed unread set.
	lastVisitUnavailableNote = "Last visit time is not available for this channel. These posts are the most recent ones, not a confirmed unread window. Say that explicitly in the answer."
)

func init() {
	app.RegisterCommandProvider(&AssistantProvider{})
}

func (*AssistantProvider) GetTrigger() string {
	return CmdAssistant
}

func (*AssistantProvider) GetCommand(a *app.App, T i18n.TranslateFunc) *model.Command {
	return &model.Command{
		Trigger:          CmdAssistant,
		AutoComplete:     true,
		AutoCompleteDesc: T("api.command_assistant.desc"),
		AutoCompleteHint: T("api.command_assistant.hint"),
		DisplayName:      T("api.command_assistant.name"),
	}
}

func (*AssistantProvider) DoCommand(a *app.App, rctx request.CTX, args *model.CommandArgs, message string) *model.CommandResponse {
	if args.ChannelId == "" || args.UserId == "" {
		return assistantEphemeral(args.T("api.command_assistant.permission.app_error"))
	}
	if ok, _ := a.HasPermissionToChannel(rctx, args.UserId, args.ChannelId, model.PermissionReadChannelContent); !ok {
		return assistantEphemeral(args.T("api.command_assistant.permission.app_error"))
	}

	req := assistant.Route(message, time.Now().UTC())
	if req.SinceUnparsed {
		return assistantEphemeral(args.T("api.command_assistant.since_unparsed"))
	}
	if req.Scope == assistant.ScopeThread && args.RootId == "" {
		return assistantEphemeral(args.T("api.command_assistant.thread_missing"))
	}

	posts, req, failed := loadAssistantPosts(a, rctx, args, req)
	if failed != nil {
		return failed
	}

	since := time.Time{}
	if req.HasSince || req.SinceLastVisit {
		since = req.Since
	}
	prepared := assistant.PrepareContext(posts, func(channelID string) bool {
		return channelID == args.ChannelId
	}, since, assistant.MaxPosts)

	ctx, cancel := context.WithTimeout(context.WithoutCancel(rctx.Context()), 25*time.Second)
	defer cancel()

	result, err := assistant.Run(ctx, req, prepared, assistant.NewGrokClient(nil))
	if err != nil {
		if errors.Is(err, assistant.ErrAPIKeyMissing) {
			return assistantEphemeral(args.T("api.command_assistant.not_configured"))
		}
		rctx.Logger().Warn("assistant completion failed", mlog.String("error", assistant.Redact(err.Error(), os.Getenv(assistant.APIKeyEnv))))
		return assistantEphemeral(args.T("api.command_assistant.failed"))
	}
	if result.MissingContext {
		return assistantReply(a, rctx, args, args.T("api.command_assistant.no_posts"))
	}

	reply := assistant.Redact(result.Reply, os.Getenv(assistant.APIKeyEnv))
	reply = applyAssistantActions(a, rctx, args, req, result, reply)
	return assistantReply(a, rctx, args, assistant.TruncateReply(reply))
}

func loadAssistantPosts(a *app.App, rctx request.CTX, args *model.CommandArgs, req assistant.Request) ([]assistant.Post, assistant.Request, *model.CommandResponse) {
	scope := req.Scope
	if scope == assistant.ScopeAuto {
		if args.RootId != "" {
			scope = assistant.ScopeThread
		} else {
			scope = assistant.ScopeChannel
		}
	}

	if req.SinceLastVisit && !req.HasSince {
		viewedAt, err := a.Srv().Store().Channel().GetMemberLastViewedAt(rctx, args.ChannelId, args.UserId)
		if err != nil || viewedAt <= 0 {
			req.ContextNote = lastVisitUnavailableNote
		} else {
			req.Since = time.UnixMilli(viewedAt).UTC()
			req.HasSince = true
		}
	}

	var list *model.PostList
	var appErr *model.AppError
	switch {
	case scope == assistant.ScopeThread:
		list, appErr = a.GetPostThread(rctx, args.RootId, model.GetPostsOptions{UserId: args.UserId}, args.UserId)
	case req.HasSince:
		list, appErr = a.GetPostsSince(rctx, model.GetPostsSinceOptions{
			UserId:    args.UserId,
			ChannelId: args.ChannelId,
			Time:      req.Since.UnixMilli(),
		})
	default:
		list, appErr = a.GetPosts(rctx, args.ChannelId, 0, assistant.MaxPosts)
	}
	if appErr != nil {
		rctx.Logger().Warn("assistant failed to read posts", mlog.Err(appErr))
		return nil, req, assistantEphemeral(args.T("api.command_assistant.fetch_failed"))
	}

	rctx.Logger().Debug("assistant request", mlog.String("action", string(req.Action)), mlog.Int("posts", postCount(list)))
	return toAssistantPosts(list, authorNames(a, rctx, list)), req, nil
}

func applyAssistantActions(a *app.App, rctx request.CTX, args *model.CommandArgs, req assistant.Request, result assistant.Result, reply string) string {
	var notes []string
	if req.PlaybooksUnavailable {
		notes = append(notes, args.T("api.command_assistant.playbook_unavailable"))
	}
	if req.AskedForCanvas {
		notes = append(notes, args.T("api.command_assistant.canvas_unavailable"))
	}

	switch result.Action {
	case assistant.ActionCreateBoard:
		notes = append(notes, createAssistantBoard(a, rctx, args, result))
	case assistant.ActionDraftDocument:
		notes = append(notes, createAssistantCard(a, rctx, args, result))
	case assistant.ActionSchedulePost:
		notes = append(notes, createAssistantScheduledPost(a, rctx, args, result))
	}

	notes = compactNotes(notes)
	if len(notes) == 0 {
		return reply
	}
	return reply + "\n\n" + strings.Join(notes, "\n\n")
}

func createAssistantBoard(a *app.App, rctx request.CTX, args *model.CommandArgs, result assistant.Result) string {
	if !a.Config().FeatureFlags.IntegratedBoards {
		return args.T("api.command_assistant.board_disabled")
	}
	if args.TeamId == "" {
		return args.T("api.command_assistant.board_no_team")
	}
	if !a.HasPermissionToTeam(rctx, args.UserId, args.TeamId, model.PermissionCreatePrivateChannel) {
		return args.T("api.command_assistant.board_forbidden")
	}

	channelName := "channel"
	if channel, err := a.GetChannel(rctx, args.ChannelId); err == nil && channel != nil && channel.DisplayName != "" {
		channelName = channel.DisplayName
	}

	board, appErr := a.CreateBoardChannel(rctx, &model.Channel{
		TeamId:      args.TeamId,
		Type:        model.ChannelTypePrivateBoard,
		DisplayName: assistant.BoardDisplayName(result.DraftTitle, channelName),
		Name:        "assistant-" + strings.ToLower(model.NewId()),
		CreatorId:   args.UserId,
	})
	if appErr != nil {
		rctx.Logger().Warn("assistant board create failed", mlog.Err(appErr))
		return args.T("api.command_assistant.board_failed")
	}
	return args.T("api.command_assistant.board_created", map[string]any{"Name": board.DisplayName})
}

func createAssistantCard(a *app.App, rctx request.CTX, args *model.CommandArgs, result assistant.Result) string {
	if !a.Config().FeatureFlags.IntegratedBoards {
		return args.T("api.command_assistant.card_disabled")
	}
	if ok, _ := a.HasPermissionToChannel(rctx, args.UserId, args.ChannelId, model.PermissionCreatePost); !ok {
		return args.T("api.command_assistant.card_forbidden")
	}
	channel, appErr := a.GetChannel(rctx, args.ChannelId)
	if appErr != nil {
		rctx.Logger().Warn("assistant card channel lookup failed", mlog.Err(appErr))
		return args.T("api.command_assistant.card_failed")
	}
	body := strings.TrimSpace(result.DraftBody)
	if body == "" {
		body = strings.TrimSpace(result.Reply)
	}
	if body == "" {
		return args.T("api.command_assistant.card_failed")
	}
	_, _, appErr = a.CreatePost(rctx, &model.Post{
		UserId:    args.UserId,
		ChannelId: args.ChannelId,
		RootId:    args.RootId,
		Message:   assistant.TruncateReply(body),
		Type:      model.PostTypeCard,
	}, channel, model.CreatePostFlags{})
	if appErr != nil {
		rctx.Logger().Warn("assistant card create failed", mlog.Err(appErr))
		return args.T("api.command_assistant.card_failed")
	}
	return args.T("api.command_assistant.card_created")
}

func createAssistantScheduledPost(a *app.App, rctx request.CTX, args *model.CommandArgs, result assistant.Result) string {
	if result.Proposal == nil || result.TimeCleared || strings.TrimSpace(result.Proposal.Time) == "" || strings.TrimSpace(result.Proposal.Notes) == "" {
		return args.T("api.command_assistant.scheduled_post_skipped")
	}
	when, err := time.Parse(time.RFC3339, result.Proposal.Time)
	if err != nil || !when.After(time.Now()) {
		return args.T("api.command_assistant.scheduled_post_skipped")
	}
	if ok, _ := a.HasPermissionToChannel(rctx, args.UserId, args.ChannelId, model.PermissionCreatePost); !ok {
		return args.T("api.command_assistant.scheduled_post_forbidden")
	}
	_, appErr := a.SaveScheduledPost(rctx, &model.ScheduledPost{
		Draft: model.Draft{
			UserId:    args.UserId,
			ChannelId: args.ChannelId,
			RootId:    args.RootId,
			Message:   assistant.TruncateReply(result.Proposal.Notes),
		},
		ScheduledAt: when.UnixMilli(),
	}, "")
	if appErr != nil {
		rctx.Logger().Warn("assistant scheduled post failed", mlog.Err(appErr))
		return args.T("api.command_assistant.scheduled_post_failed")
	}
	return args.T("api.command_assistant.scheduled_post_created", map[string]any{
		"Time": when.UTC().Format(time.RFC3339),
	})
}

func authorNames(a *app.App, rctx request.CTX, list *model.PostList) map[string]string {
	names := map[string]string{}
	if list == nil {
		return names
	}
	seen := map[string]bool{}
	ids := make([]string, 0, len(list.Posts))
	for _, post := range list.Posts {
		if post == nil || post.UserId == "" || seen[post.UserId] {
			continue
		}
		seen[post.UserId] = true
		ids = append(ids, post.UserId)
	}
	if len(ids) == 0 {
		return names
	}
	users, err := a.GetUsersByIds(rctx, ids, &store.UserGetByIdsOpts{})
	if err != nil {
		rctx.Logger().Debug("assistant username lookup failed", mlog.Err(err))
		return names
	}
	for _, user := range users {
		if user != nil && user.Username != "" {
			names[user.Id] = user.Username
		}
	}
	return names
}

func toAssistantPosts(list *model.PostList, names map[string]string) []assistant.Post {
	if list == nil {
		return nil
	}
	seen := map[string]bool{}
	out := make([]assistant.Post, 0, len(list.Posts))
	add := func(post *model.Post) {
		if post == nil || post.Id == "" || seen[post.Id] || post.DeleteAt != 0 {
			return
		}
		seen[post.Id] = true
		author := names[post.UserId]
		if author == "" {
			author = post.UserId
		}
		out = append(out, assistant.Post{
			ID:        post.Id,
			ChannelID: post.ChannelId,
			Author:    author,
			CreateAt:  post.CreateAt,
			Text:      post.Message,
		})
	}
	for _, id := range list.Order {
		add(list.Posts[id])
	}
	for _, post := range list.Posts {
		add(post)
	}
	return out
}

func postCount(list *model.PostList) int {
	if list == nil {
		return 0
	}
	return len(list.Posts)
}

func compactNotes(notes []string) []string {
	out := make([]string, 0, len(notes))
	for _, note := range notes {
		if strings.TrimSpace(note) != "" {
			out = append(out, note)
		}
	}
	return out
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
