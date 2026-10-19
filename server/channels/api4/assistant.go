// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"net/http"

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

	var ask model.AssistantAsk
	if err := json.NewDecoder(r.Body).Decode(&ask); err != nil {
		c.SetInvalidParamWithErr("assistant_ask", err)
		return
	}

	channel, appErr := c.App.GetChannel(c.AppContext, c.Params.ChannelId)
	if appErr != nil {
		c.Err = appErr
		return
	}

	hasPermission, _ := c.App.SessionHasPermissionToReadChannel(c.AppContext, *c.AppContext.Session(), channel)
	if !hasPermission {
		c.SetPermissionError(model.PermissionReadChannelContent)
		return
	}

	reply, appErr := c.App.AskAssistant(c.AppContext, c.Params.ChannelId, c.AppContext.Session().UserId, &ask)
	if appErr != nil {
		c.Err = appErr
		return
	}

	if err := json.NewEncoder(w).Encode(reply); err != nil {
		c.Logger.Warn("Error while writing assistant response", mlog.Err(err))
	}
}
