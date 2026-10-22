// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

func (api *API) InitPoll() {
	api.BaseRoutes.Post.Handle("/poll", api.APISessionRequired(getPollResults)).Methods(http.MethodGet)
	api.BaseRoutes.Post.Handle("/poll/vote", api.APISessionRequired(votePoll)).Methods(http.MethodPost)
	api.BaseRoutes.Post.Handle("/poll/vote", api.APISessionRequired(retractPollVote)).Methods(http.MethodDelete)
}

func getPollResults(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequirePostId()
	if c.Err != nil {
		return
	}

	if ok, _ := c.App.SessionHasPermissionToReadPost(c.AppContext, *c.AppContext.Session(), c.Params.PostId); !ok {
		c.SetPermissionError(model.PermissionReadChannelContent)
		return
	}

	results, appErr := c.App.GetPollResults(c.AppContext, c.Params.PostId)
	if appErr != nil {
		c.Err = appErr
		return
	}

	writePollResults(c, w, results)
}

func votePoll(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequirePostId()
	if c.Err != nil {
		return
	}

	var req model.PollVoteRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.OptionID == "" {
		c.SetInvalidParamWithErr("option_id", err)
		return
	}

	setPollVote(c, w, req.OptionID)
}

func retractPollVote(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequirePostId()
	if c.Err != nil {
		return
	}

	setPollVote(c, w, "")
}

func setPollVote(c *Context, w http.ResponseWriter, optionID string) {
	// Voting is gated like reacting: a lightweight response to a post rather than a new post.
	if !c.App.SessionHasPermissionToChannelByPost(*c.AppContext.Session(), c.Params.PostId, model.PermissionAddReaction) {
		c.SetPermissionError(model.PermissionAddReaction)
		return
	}

	results, appErr := c.App.VotePoll(c.AppContext, c.Params.PostId, c.AppContext.Session().UserId, optionID)
	if appErr != nil {
		c.Err = appErr
		return
	}

	writePollResults(c, w, results)
}

func writePollResults(c *Context, w http.ResponseWriter, results *model.PollResults) {
	js, err := json.Marshal(results)
	if err != nil {
		c.Err = model.NewAppError("writePollResults", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	if _, err := w.Write(js); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}
