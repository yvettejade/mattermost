// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"
	"strings"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/app/assistant"
)

const assistantMaxPosts = 50

func (a *App) AskAssistant(rctx request.CTX, channelID, userID string, ask *model.AssistantAsk) (*model.AssistantReply, *model.AppError) {
	if ask == nil {
		ask = &model.AssistantAsk{}
	}

	channel, appErr := a.GetChannel(rctx, channelID)
	if appErr != nil {
		return nil, appErr
	}
	if ok, _ := a.HasPermissionToReadChannel(rctx, userID, channel); !ok {
		return nil, model.NewAppError("AskAssistant", "api.assistant.permission", nil, "", http.StatusForbidden)
	}

	intent := assistant.Route(ask.Message, ask.RootId)

	if strings.TrimSpace(assistant.Env(assistant.EnvGrokAPI)) == "" {
		return nil, model.NewAppError("AskAssistant", "api.assistant.config_missing", nil, "", http.StatusNotImplemented)
	}

	posts, appErr := a.loadAssistantPosts(rctx, channelID, userID, ask, intent)
	if appErr != nil {
		return nil, appErr
	}

	var packet *assistant.JiraPacket
	if intent == model.AssistantIntentJira {
		keys := assistant.ExtractIssueKeys(ask.Message)
		lookedUp, jiraErr := assistant.LookupJira(rctx.Context(), keys, ask.Message)
		if jiraErr != nil {
			return nil, jiraErr
		}
		packet = lookedUp
		if len(keys) > 0 && packet.Empty() {
			return &model.AssistantReply{
				Reply:  assistant.UngroundedIssueKeyMessage,
				Intent: intent,
			}, nil
		}
	}

	system := assistant.SystemPrompt(intent, packet != nil)
	userPrompt := assistant.UserPrompt(ask.Message, posts, packet)

	reply, completeErr := assistant.Complete(rctx.Context(), system, userPrompt)
	if completeErr != nil {
		rctx.Logger().Warn("assistant grok failed", mlog.String("intent", intent), mlog.String("error", assistant.Redact(completeErr.Error())))
		return nil, completeErr
	}
	reply = assistant.Redact(reply)

	if intent == model.AssistantIntentJira {
		reply = assistant.GuardUngroundedKeys(reply, packet)
	}

	result := &model.AssistantReply{
		Reply:  reply,
		Intent: intent,
	}

	switch intent {
	case model.AssistantIntentScheduleMeeting:
		proposal := assistant.NormalizeMeetingProposal(reply, firstLine(ask.Message))
		result.Reply = assistant.FormatMeetingProposal(proposal)
	case model.AssistantIntentDraft:
		playbook, canvas := assistant.MentionsUnavailableTools(ask.Message)
		if playbook || canvas {
			result.Reply = strings.TrimSpace(result.Reply) + "\n\nPlaybooks and canvas are unavailable in this assistant."
		}
	case model.AssistantIntentBoard:
		result = a.applyBoardSideEffects(rctx, channel, userID, ask, result)
	case model.AssistantIntentSchedulePost:
		result = a.applyScheduledPostSideEffect(rctx, channel, userID, ask, result)
	}

	return result, nil
}

func (a *App) loadAssistantPosts(rctx request.CTX, channelID, userID string, ask *model.AssistantAsk, intent string) ([]assistant.ChannelPost, *model.AppError) {
	if strings.TrimSpace(ask.RootId) != "" {
		list, appErr := a.GetPostThread(rctx, ask.RootId, model.GetPostsOptions{CollapsedThreads: false}, userID)
		if appErr != nil {
			return nil, appErr
		}
		return assistant.CollectGroundablePosts(list), nil
	}

	if intent == model.AssistantIntentCatchUp {
		lastViewedAt, viewedErr := a.Srv().Store().Channel().GetMemberLastViewedAt(rctx, channelID, userID)
		if viewedErr != nil {
			rctx.Logger().Debug("assistant catch-up last viewed lookup failed", mlog.Err(viewedErr))
			lastViewedAt = 0
		}
		since := assistant.ParseCatchUpSince(ask.Message, lastViewedAt, time.Now())
		list, appErr := a.GetPostsSince(rctx, model.GetPostsSinceOptions{
			UserId:    userID,
			ChannelId: channelID,
			Time:      since,
		})
		if appErr != nil {
			return nil, appErr
		}
		return assistant.CollectGroundablePosts(list), nil
	}

	list, appErr := a.GetPosts(rctx, channelID, 0, assistantMaxPosts)
	if appErr != nil {
		return nil, appErr
	}
	return assistant.CollectGroundablePosts(list), nil
}

func (a *App) applyBoardSideEffects(rctx request.CTX, channel *model.Channel, userID string, ask *model.AssistantAsk, result *model.AssistantReply) *model.AssistantReply {
	if !a.Config().FeatureFlags.IntegratedBoards {
		result.Reply = strings.TrimSpace(result.Reply) + "\n\nBoards are unavailable."
		return result
	}

	title := firstLine(ask.Message)
	if title == "" {
		title = "Assistant board"
	}
	board := &model.Channel{
		TeamId:      channel.TeamId,
		Type:        model.ChannelTypePrivateBoard,
		DisplayName: title,
		Name:        model.NewId(),
		CreatorId:   userID,
	}
	created, appErr := a.CreateBoardChannel(rctx, board)
	if appErr != nil {
		rctx.Logger().Warn("assistant board create failed", mlog.String("error", assistant.Redact(appErr.Error())))
		result.Actions = append(result.Actions, model.AssistantAction{
			Type:   model.AssistantActionBoardChannel,
			Detail: "Board create failed.",
		})
		return result
	}
	result.Actions = append(result.Actions, model.AssistantAction{
		Type:   model.AssistantActionBoardChannel,
		Id:     created.Id,
		Detail: "Created a private board channel.",
	})

	if strings.Contains(strings.ToLower(ask.Message), "card") {
		card := &model.Post{
			ChannelId: channel.Id,
			UserId:    userID,
			Message:   result.Reply,
			Type:      model.PostTypeCard,
		}
		saved, _, cardErr := a.CreatePost(rctx, card, channel, model.CreatePostFlags{})
		if cardErr != nil {
			rctx.Logger().Warn("assistant card create failed", mlog.String("error", assistant.Redact(cardErr.Error())))
			result.Actions = append(result.Actions, model.AssistantAction{
				Type:   model.AssistantActionCard,
				Detail: "Card create failed.",
			})
			return result
		}
		result.Actions = append(result.Actions, model.AssistantAction{
			Type:   model.AssistantActionCard,
			Id:     saved.Id,
			Detail: "Created a card post.",
		})
	}
	return result
}

func (a *App) applyScheduledPostSideEffect(rctx request.CTX, channel *model.Channel, userID string, ask *model.AssistantAsk, result *model.AssistantReply) *model.AssistantReply {
	if a.Config().ServiceSettings.ScheduledPosts == nil || !*a.Config().ServiceSettings.ScheduledPosts || a.License() == nil {
		result.Reply = strings.TrimSpace(result.Reply) + "\n\nScheduled posts are unavailable."
		return result
	}

	when, ok := assistant.ParseScheduleAt(ask.Message, time.Now())
	if !ok {
		result.Reply = strings.TrimSpace(result.Reply) + "\n\nInclude a time such as \"in 1 hour\" to schedule this post."
		return result
	}

	sp := &model.ScheduledPost{
		Draft: model.Draft{
			UserId:    userID,
			ChannelId: channel.Id,
			RootId:    ask.RootId,
			Message:   strings.TrimSpace(result.Reply),
		},
		ScheduledAt: when,
	}
	saved, appErr := a.SaveScheduledPost(rctx, sp, "")
	if appErr != nil {
		rctx.Logger().Warn("assistant scheduled post failed", mlog.String("error", assistant.Redact(appErr.Error())))
		result.Reply = strings.TrimSpace(result.Reply) + "\n\nCould not schedule that post."
		return result
	}
	result.Actions = append(result.Actions, model.AssistantAction{
		Type:   model.AssistantActionScheduledPost,
		Id:     saved.Id,
		Detail: "Scheduled a post.",
	})
	return result
}

func firstLine(s string) string {
	s = strings.TrimSpace(s)
	if i := strings.IndexByte(s, '\n'); i >= 0 {
		s = s[:i]
	}
	return s
}
