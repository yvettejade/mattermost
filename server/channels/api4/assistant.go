// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/app"
	"github.com/mattermost/mattermost/server/v8/channels/app/assistant"
)

const assistantMaxBodyBytes = 1 << 20

func (api *API) InitAssistant() {
	// GET /api/v4/assistant/status
	api.BaseRoutes.Assistant.Handle("/status", api.APISessionRequired(getAssistantStatus)).Methods(http.MethodGet)
	// POST /api/v4/assistant/chat
	api.BaseRoutes.Assistant.Handle("/chat", api.APISessionRequiredDisableWhenBusy(assistantChat)).Methods(http.MethodPost)
	// POST /api/v4/assistant/actions/execute
	api.BaseRoutes.Assistant.Handle("/actions/execute", api.APISessionRequired(executeAssistantAction)).Methods(http.MethodPost)
}

func getAssistantStatus(c *Context, w http.ResponseWriter, r *http.Request) {
	if err := json.NewEncoder(w).Encode(c.App.GetAssistantStatus()); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func assistantChat(c *Context, w http.ResponseWriter, r *http.Request) {
	var req model.AssistantChatRequest
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, assistantMaxBodyBytes)).Decode(&req); err != nil {
		c.SetInvalidParamWithErr("body", err)
		return
	}

	resp, appErr := c.App.AssistantChat(c.AppContext, *c.AppContext.Session(), &req)
	if appErr != nil {
		c.Err = appErr
		return
	}

	if err := json.NewEncoder(w).Encode(resp); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

// executeAssistantAction runs an action the user explicitly confirmed in the assistant UI.
// Post-creating actions go through the same checks as POST /api/v4/posts.
func executeAssistantAction(c *Context, w http.ResponseWriter, r *http.Request) {
	var req model.AssistantExecuteActionRequest
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, assistantMaxBodyBytes)).Decode(&req); err != nil {
		c.SetInvalidParamWithErr("body", err)
		return
	}

	plan, err := assistant.PlanAction(req.Type, req.Args)
	if err != nil {
		c.SetInvalidParamWithErr("args", err)
		return
	}

	if plan.Agent != nil {
		content, appErr := c.App.AssistantRunAgent(c.AppContext, *c.AppContext.Session(), plan.Agent)
		if appErr != nil {
			c.Err = appErr
			return
		}
		if err := json.NewEncoder(w).Encode(&model.AssistantExecuteActionResponse{Content: content}); err != nil {
			c.Logger.Warn("Error while writing response", mlog.Err(err))
		}
		return
	}

	if !model.IsValidId(plan.Post.ChannelId) {
		c.SetInvalidParam("channel_id")
		return
	}
	if plan.Post.RootId != "" && !model.IsValidId(plan.Post.RootId) {
		c.SetInvalidParam("root_id")
		return
	}

	post := &model.Post{
		ChannelId: plan.Post.ChannelId,
		RootId:    plan.Post.RootId,
		Message:   plan.Post.Message,
		UserId:    c.AppContext.Session().UserId,
		IsPinned:  plan.Post.Pin,
	}

	auditRec := c.MakeAuditRecord(model.AuditEventCreatePost, model.AuditStatusFail)
	defer c.LogAuditRecWithLevel(auditRec, app.LevelContent)
	model.AddEventParameterAuditableToAuditRec(auditRec, "post", post)
	model.AddEventParameterToAuditRec(auditRec, "assistant_action", req.Type)

	createPostChecks("Api4.executeAssistantAction", c, post)
	if c.Err != nil {
		return
	}

	if post.RootId != "" {
		root, appErr := c.App.GetSinglePost(c.AppContext, post.RootId, false)
		if appErr != nil || root.ChannelId != post.ChannelId {
			c.SetInvalidParam("root_id")
			return
		}
	}

	rp, _, appErr := c.App.CreatePostAsUser(c.AppContext, post, c.AppContext.Session().Id, true)
	if appErr != nil {
		c.Err = appErr
		return
	}
	auditRec.Success()
	auditRec.AddEventResultState(rp)
	auditRec.AddEventObjectType("post")

	w.WriteHeader(http.StatusCreated)
	if err := json.NewEncoder(w).Encode(&model.AssistantExecuteActionResponse{Post: rp}); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}
