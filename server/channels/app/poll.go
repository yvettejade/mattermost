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

// normalizePollPost validates a poll post on creation and rewrites its props
// to the canonical, server-owned form.
func normalizePollPost(post *model.Post) *model.AppError {
	if err := model.NormalizePollPost(post); err != nil {
		return model.NewAppError("CreatePost", "app.poll.invalid.app_error", nil, "", http.StatusBadRequest).Wrap(err)
	}
	return nil
}

// checkPollPostUpdate rejects edits that would change a poll's type or its
// question/options; only the fallback message and similar fields may change.
func checkPollPostUpdate(oldPost, receivedPost, newPost *model.Post) *model.AppError {
	if oldPost.Type != model.PostTypePoll && receivedPost.Type != model.PostTypePoll {
		return nil
	}

	if receivedPost.Type != "" && receivedPost.Type != oldPost.Type {
		return model.NewAppError("UpdatePost", "app.poll.immutable.app_error", nil, "post type cannot change", http.StatusBadRequest)
	}

	if oldPost.Type == model.PostTypePoll && !model.PollPropsEqual(oldPost, newPost) {
		return model.NewAppError("UpdatePost", "app.poll.immutable.app_error", nil, "poll cannot change", http.StatusBadRequest)
	}

	return nil
}

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

// getPollState always reads from the primary so results are never stale and
// the compare-and-set in VotePoll compares against the latest value.
func (a *App) getPollState(postID string) (model.PollState, []byte, *model.AppError) {
	state := model.PollState{Votes: model.PollVotes{}}

	kv, err := a.Srv().Store().Plugin().GetFromMaster(model.PollKVNamespace, model.PollVotesKVKey(postID))
	if err != nil {
		var nfErr *store.ErrNotFound
		if errors.As(err, &nfErr) {
			return state, nil, nil
		}
		return state, nil, model.NewAppError("getPollState", "app.plugin_store.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	if err := json.Unmarshal(kv.Value, &state); err != nil {
		return state, nil, model.NewAppError("getPollState", "app.poll.decode.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	if state.Votes == nil {
		state.Votes = model.PollVotes{}
	}

	return state, kv.Value, nil
}

func (a *App) GetPollResults(rctx request.CTX, postID string) (*model.PollResults, *model.AppError) {
	_, poll, appErr := a.getPollPost(rctx, postID)
	if appErr != nil {
		return nil, appErr
	}

	state, _, appErr := a.getPollState(postID)
	if appErr != nil {
		return nil, appErr
	}

	return state.Results(poll, postID), nil
}

// VotePoll sets userID's vote on the poll, replacing any previous vote.
// An empty optionID retracts the vote. Changed results are broadcast to the channel.
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
		state, oldRaw, appErr := a.getPollState(postID)
		if appErr != nil {
			return nil, appErr
		}

		now := model.GetMillis()
		votes, changed := state.Votes.WithVote(userID, optionID, now)
		if !changed {
			return state.Results(poll, postID), nil
		}

		next := model.PollState{Votes: votes, UpdateAt: max(now, state.UpdateAt+1)}
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
