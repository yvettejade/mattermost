// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"

	"github.com/mattermost/mattermost/server/v8/channels/store"
)

const pollVoteMaxAttempts = 5

func (a *App) getPollPost(rctx request.CTX, postID string) (*model.Post, *model.Poll, *model.AppError) {
	post, appErr := a.GetSinglePost(rctx, postID, false)
	if appErr != nil {
		return nil, nil, appErr
	}

	poll, err := model.PollFromPost(post)
	if err != nil {
		return nil, nil, model.NewAppError("getPollPost", "app.poll.not_a_poll.app_error", nil, "", http.StatusBadRequest).Wrap(err)
	}

	return post, poll, nil
}

func (a *App) getPollVotes(postID string, fromMaster bool) (model.PollVotes, []byte, *model.AppError) {
	var raw []byte
	if fromMaster {
		kv, err := a.Srv().Store().Plugin().GetFromMaster(model.PollKVNamespace, model.PollVotesKVKey(postID))
		if err == nil {
			raw = kv.Value
		} else if nfErr := new(store.ErrNotFound); !errors.As(err, &nfErr) {
			return nil, nil, model.NewAppError("getPollVotes", "app.plugin_store.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	} else {
		var appErr *model.AppError
		raw, appErr = a.GetPluginKey(model.PollKVNamespace, model.PollVotesKVKey(postID))
		if appErr != nil {
			return nil, nil, appErr
		}
	}

	votes := model.PollVotes{}
	if raw == nil {
		return votes, nil, nil
	}

	if err := json.Unmarshal(raw, &votes); err != nil {
		return nil, nil, model.NewAppError("getPollVotes", "app.poll.decode.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return votes, raw, nil
}

func (a *App) GetPollResults(rctx request.CTX, postID string) (*model.PollResults, *model.AppError) {
	_, poll, appErr := a.getPollPost(rctx, postID)
	if appErr != nil {
		return nil, appErr
	}

	votes, _, appErr := a.getPollVotes(postID, false)
	if appErr != nil {
		return nil, appErr
	}

	return votes.Results(poll, postID), nil
}

// VotePoll sets userID's vote on the poll, replacing any previous vote.
// An empty optionID retracts the vote. Results are broadcast to the channel.
func (a *App) VotePoll(rctx request.CTX, postID, userID, optionID string) (*model.PollResults, *model.AppError) {
	post, poll, appErr := a.getPollPost(rctx, postID)
	if appErr != nil {
		return nil, appErr
	}

	if optionID != "" && !poll.HasOption(optionID) {
		return nil, model.NewAppError("VotePoll", "app.poll.invalid_option.app_error", nil, "", http.StatusBadRequest)
	}

	channel, appErr := a.GetChannel(rctx, post.ChannelId)
	if appErr != nil {
		return nil, appErr
	}
	if channel.DeleteAt > 0 {
		return nil, model.NewAppError("VotePoll", "app.poll.archived_channel.app_error", nil, "", http.StatusForbidden)
	}

	key := model.PollVotesKVKey(postID)
	for range pollVoteMaxAttempts {
		votes, oldRaw, appErr := a.getPollVotes(postID, true)
		if appErr != nil {
			return nil, appErr
		}

		next := votes.WithVote(userID, optionID, model.GetMillis())
		newRaw, err := json.Marshal(next)
		if err != nil {
			return nil, model.NewAppError("VotePoll", "app.poll.decode.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}

		saved, appErr := a.CompareAndSetPluginKey(model.PollKVNamespace, key, oldRaw, newRaw)
		if appErr != nil {
			return nil, appErr
		}
		if !saved {
			continue
		}

		results := next.Results(poll, postID)
		a.publishPollUpdated(rctx, post.ChannelId, results)
		return results, nil
	}

	return nil, model.NewAppError("VotePoll", "app.poll.vote_conflict.app_error", nil, "", http.StatusConflict)
}

func (a *App) publishPollUpdated(rctx request.CTX, channelID string, results *model.PollResults) {
	resultsJSON, err := json.Marshal(results)
	if err != nil {
		rctx.Logger().Warn("Failed to encode poll results", mlog.String("post_id", results.PostID), mlog.Err(err))
		return
	}

	message := model.NewWebSocketEvent(model.WebsocketEventPollUpdated, "", channelID, "", nil, "")
	message.Add("results", string(resultsJSON))
	a.Publish(message)
}
