// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"net/http"
	"strings"
	"unicode/utf8"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

func (api *API) InitAssistant() {
	api.BaseRoutes.Channel.Handle("/assistant", api.APISessionRequired(askAssistant)).Methods(http.MethodPost)
}

func askAssistant(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireChannelId()
	if c.Err != nil {
		return
	}

	channel, appErr := c.App.GetChannel(c.AppContext, c.Params.ChannelId)
	if appErr != nil {
		c.Err = appErr
		return
	}
	if channel.DeleteAt != 0 {
		c.Err = model.NewAppError("askAssistant", "api.command_assistant.permission.app_error", nil, "", http.StatusBadRequest)
		return
	}
	if ok, _ := c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), channel.Id, model.PermissionReadChannelContent); !ok {
		c.SetPermissionError(model.PermissionReadChannelContent)
		return
	}

	var req model.AssistantAsk
	r.Body = http.MaxBytesReader(w, r.Body, 64*1024)
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		c.SetInvalidParamWithErr("message", err)
		return
	}
	message, ok := normalizeAssistantMessage(req.Message)
	if !ok {
		c.SetInvalidParam("message")
		return
	}

	rootID := strings.TrimSpace(req.RootId)
	if rootID != "" {
		post, postErr := c.App.GetSinglePost(c.AppContext, rootID, false)
		if postErr != nil || post.ChannelId != channel.Id {
			c.SetInvalidParam("root_id")
			return
		}
	}

	teamID := channel.TeamId
	if teamID == "" {
		teamID = strings.TrimSpace(req.TeamId)
		if teamID != "" && !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), teamID, model.PermissionViewTeam) {
			teamID = ""
		}
	}

	text, _ := c.App.AskAssistant(c.AppContext, &model.CommandArgs{
		UserId:    c.AppContext.Session().UserId,
		ChannelId: channel.Id,
		TeamId:    teamID,
		RootId:    rootID,
		T:         c.AppContext.T,
	}, message)

	w.WriteHeader(http.StatusOK)
	if err := json.NewEncoder(w).Encode(model.AssistantReply{Reply: text}); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func normalizeAssistantMessage(message string) (string, bool) {
	message = strings.TrimSpace(message)
	if message == "" || utf8.RuneCountInString(message) > model.PostMessageMaxRunesV2 {
		return "", false
	}
	return message, true
}
