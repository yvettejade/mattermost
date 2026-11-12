// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"errors"
	"net/http"
	"sort"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/app/assistant"
)

// assistantDataSource reads Mattermost data on behalf of a single session. The
// assistant.Retriever re-checks CanReadChannel for every post it uses.
type assistantDataSource struct {
	a       *App
	rctx    request.CTX
	session model.Session
	users   map[string]string
	teams   map[string]string
}

func newAssistantDataSource(a *App, rctx request.CTX, session model.Session) *assistantDataSource {
	return &assistantDataSource{a: a, rctx: rctx, session: session, users: map[string]string{}, teams: map[string]string{}}
}

func (ds *assistantDataSource) GetChannel(channelID string) (*model.Channel, error) {
	channel, appErr := ds.a.GetChannel(ds.rctx, channelID)
	if appErr != nil {
		return nil, appErr
	}
	return channel, nil
}

func (ds *assistantDataSource) CanReadChannel(channel *model.Channel) bool {
	ok, _ := ds.a.SessionHasPermissionToReadChannel(ds.rctx, ds.session, channel)
	return ok
}

func (ds *assistantDataSource) GetPostThread(rootID string) (*model.PostList, error) {
	list, appErr := ds.a.GetPostThread(ds.rctx, rootID, model.GetPostsOptions{}, ds.session.UserId)
	if appErr != nil {
		return nil, appErr
	}
	return list, nil
}

func (ds *assistantDataSource) GetChannelPosts(channelID string, since int64, limit int) (*model.PostList, error) {
	if since <= 0 {
		list, appErr := ds.a.GetPostsPage(ds.rctx, model.GetPostsOptions{ChannelId: channelID, PerPage: limit, UserId: ds.session.UserId})
		if appErr != nil {
			return nil, appErr
		}
		return list, nil
	}

	list, appErr := ds.a.GetPostsSince(ds.rctx, model.GetPostsSinceOptions{ChannelId: channelID, Time: since, UserId: ds.session.UserId})
	if appErr != nil {
		return nil, appErr
	}
	// GetPostsSince also returns older posts that were edited after `since`.
	posts := make([]*model.Post, 0, len(list.Posts))
	for _, p := range list.Posts {
		if p.CreateAt > since {
			posts = append(posts, p)
		}
	}
	sort.Slice(posts, func(i, j int) bool { return posts[i].CreateAt > posts[j].CreateAt })
	if len(posts) > limit {
		posts = posts[:limit]
	}
	out := model.NewPostList()
	for _, p := range posts {
		out.AddPost(p)
		out.AddOrder(p.Id)
	}
	return out, nil
}

func (ds *assistantDataSource) GetLastViewedAt(channelID string) (int64, error) {
	member, appErr := ds.a.GetChannelMember(ds.rctx, channelID, ds.session.UserId)
	if appErr != nil {
		return 0, appErr
	}
	return member.LastViewedAt, nil
}

func (ds *assistantDataSource) SearchPosts(terms string, limit int) (*model.PostList, error) {
	results, _, appErr := ds.a.SearchPostsForUser(ds.rctx, terms, ds.session.UserId, "", true, false, 0, 0, limit)
	if appErr != nil {
		return nil, appErr
	}
	return results.PostList, nil
}

func (ds *assistantDataSource) GetRecentlyActiveChannels(limit int) ([]*model.Channel, error) {
	channels, appErr := ds.a.GetChannelsForUser(ds.rctx, ds.session.UserId, false, 0, 200, "")
	if appErr != nil {
		return nil, appErr
	}
	list := []*model.Channel(channels)
	sort.Slice(list, func(i, j int) bool { return list[i].LastPostAt > list[j].LastPostAt })
	if len(list) > limit {
		list = list[:limit]
	}
	return list, nil
}

func (ds *assistantDataSource) GetUsername(userID string) string {
	if name, ok := ds.users[userID]; ok {
		return name
	}
	name := "unknown"
	if user, appErr := ds.a.GetUser(userID); appErr == nil {
		name = user.Username
	}
	ds.users[userID] = name
	return name
}

func (ds *assistantDataSource) GetTeamName(teamID string) string {
	if teamID == "" {
		return ""
	}
	if name, ok := ds.teams[teamID]; ok {
		return name
	}
	name := ""
	if team, appErr := ds.a.GetTeam(teamID); appErr == nil {
		name = team.Name
	}
	ds.teams[teamID] = name
	return name
}

func assistantAppError(where string, err error) *model.AppError {
	var appErr *model.AppError
	switch {
	case errors.Is(err, assistant.ErrNotConfigured):
		return model.NewAppError(where, "app.assistant.not_configured.app_error", nil, "", http.StatusNotImplemented).Wrap(err)
	case errors.Is(err, assistant.ErrForbidden):
		return model.NewAppError(where, "app.assistant.forbidden.app_error", nil, "", http.StatusForbidden)
	case errors.Is(err, assistant.ErrNotFound):
		return model.NewAppError(where, "app.assistant.not_found.app_error", nil, "", http.StatusNotFound)
	case errors.Is(err, assistant.ErrInvalidAction):
		return model.NewAppError(where, "app.assistant.invalid_action.app_error", nil, "", http.StatusBadRequest)
	case errors.As(err, &appErr):
		return appErr
	default:
		return model.NewAppError(where, "app.assistant.llm_error.app_error", nil, "", http.StatusBadGateway).Wrap(err)
	}
}

func (a *App) newAssistantService() (*assistant.Service, error) {
	llm, err := assistant.NewGrokClientFromEnv()
	if err != nil {
		return nil, err
	}
	return assistant.NewService(llm, assistant.DefaultAgents), nil
}

func (a *App) GetAssistantStatus() *model.AssistantStatus {
	return &model.AssistantStatus{
		Configured: assistant.IsConfigured(),
		Agents:     assistant.DefaultAgents.Info(),
	}
}

func (a *App) AssistantChat(rctx request.CTX, session model.Session, req *model.AssistantChatRequest) (*model.AssistantChatResponse, *model.AppError) {
	if appErr := req.IsValid(); appErr != nil {
		return nil, appErr
	}
	svc, err := a.newAssistantService()
	if err != nil {
		return nil, assistantAppError("AssistantChat", err)
	}
	username := "user"
	if user, appErr := a.GetUser(session.UserId); appErr == nil {
		username = user.Username
	}
	resp, err := svc.Chat(rctx.Context(), newAssistantDataSource(a, rctx, session), username, req)
	if err != nil {
		rctx.Logger().Warn("Assistant chat failed", mlog.Err(err))
		return nil, assistantAppError("AssistantChat", err)
	}
	return resp, nil
}

func (a *App) AssistantRunAgent(rctx request.CTX, session model.Session, args *assistant.RouteToAgentArgs) (string, *model.AppError) {
	if (args.ChannelId != "" && !model.IsValidId(args.ChannelId)) || (args.RootId != "" && !model.IsValidId(args.RootId)) {
		return "", assistantAppError("AssistantRunAgent", assistant.ErrInvalidAction)
	}
	svc, err := a.newAssistantService()
	if err != nil {
		return "", assistantAppError("AssistantRunAgent", err)
	}
	content, err := svc.RunAgent(rctx.Context(), newAssistantDataSource(a, rctx, session), args)
	if err != nil {
		rctx.Logger().Warn("Assistant agent failed", mlog.String("agent", args.Agent), mlog.Err(err))
		return "", assistantAppError("AssistantRunAgent", err)
	}
	return content, nil
}
