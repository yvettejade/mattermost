// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

func (api *API) InitGrokAgent() {
	// GET /api/v4/grok_agent/status
	api.BaseRoutes.GrokAgent.Handle("/status", api.APISessionRequired(getGrokAgentStatus)).Methods(http.MethodGet)
	// POST /api/v4/grok_agent/query
	api.BaseRoutes.GrokAgent.Handle("/query", api.APISessionRequired(queryGrokAgent)).Methods(http.MethodPost)
}

func getGrokAgentStatus(c *Context, w http.ResponseWriter, r *http.Request) {
	status := c.App.GetGrokAgentStatus()
	if err := json.NewEncoder(w).Encode(status); err != nil {
		c.Logger.Warn("Error encoding Grok agent status", mlog.Err(err))
	}
}

func queryGrokAgent(c *Context, w http.ResponseWriter, r *http.Request) {
	var req model.GrokAgentQueryRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		c.SetInvalidParamWithErr("body", err)
		return
	}

	resp, appErr := c.App.QueryGrokAgent(c.AppContext, c.AppContext.Session().UserId, req)
	if appErr != nil {
		c.Err = appErr
		return
	}

	if err := json.NewEncoder(w).Encode(resp); err != nil {
		c.Logger.Warn("Error encoding Grok agent response", mlog.Err(err))
	}
}
