// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
)

func (p *Plugin) dialogURL() string {
	site := p.siteURL()
	path := "/plugins/" + pluginID + "/dialog/schedule"
	if site == "" {
		return path
	}
	return site + path
}

func (p *Plugin) openScheduleDialog(req queryRequest) error {
	state, err := json.Marshal(map[string]string{
		"channel_id": req.ChannelID,
		"root_id":    req.RootID,
		"user_id":    req.UserID,
		"query":      req.Message,
	})
	if err != nil {
		return err
	}

	defaultTitle := strings.TrimSpace(req.Message)
	defaultTitle = strings.TrimPrefix(strings.ToLower(defaultTitle), "schedule")
	defaultTitle = strings.TrimSpace(defaultTitle)
	if defaultTitle == "" {
		defaultTitle = "Working session"
	}

	if appErr := p.API.OpenInteractiveDialog(model.OpenDialogRequest{
		TriggerId: req.TriggerID,
		URL:       p.dialogURL(),
		Dialog: model.Dialog{
			CallbackId:       "yvette-schedule",
			Title:            "Schedule a meeting",
			IntroductionText: "Propose a meeting in this channel. On submit, @yvette-grok posts the proposal.",
			SubmitLabel:      "Propose",
			State:            string(state),
			Elements: []model.DialogElement{
				{DisplayName: "Title", Name: "title", Type: "text", Default: defaultTitle, Placeholder: "Working session"},
				{DisplayName: "When", Name: "when", Type: "text", Placeholder: "Thu 2pm PT", Optional: true},
				{DisplayName: "Attendees", Name: "attendees", Type: "text", Placeholder: "@username @username", Optional: true},
				{DisplayName: "Agenda", Name: "agenda", Type: "textarea", Placeholder: "What should we cover?", Optional: true},
			},
		},
	}); appErr != nil {
		return appErr
	}
	return nil
}

func (p *Plugin) ServeHTTP(_ *plugin.Context, w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.NotFound(w, r)
		return
	}
	switch r.URL.Path {
	case "/dialog/schedule":
		p.handleScheduleDialog(w, r)
	default:
		http.NotFound(w, r)
	}
}

func (p *Plugin) handleScheduleDialog(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(io.LimitReader(r.Body, 1<<20))
	if err != nil {
		http.Error(w, "invalid body", http.StatusBadRequest)
		return
	}
	var req model.SubmitDialogRequest
	if err := json.Unmarshal(body, &req); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}
	if req.Cancelled {
		w.WriteHeader(http.StatusOK)
		return
	}

	title := submissionString(req.Submission, "title")
	when := submissionString(req.Submission, "when")
	attendees := submissionString(req.Submission, "attendees")
	agenda := submissionString(req.Submission, "agenda")
	if title == "" {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(model.SubmitDialogResponse{
			Errors: map[string]string{"title": "Title is required"},
		})
		return
	}

	var state map[string]string
	_ = json.Unmarshal([]byte(req.State), &state)
	channelID := req.ChannelId
	rootID := ""
	userID := req.UserId
	if state != nil {
		if state["channel_id"] != "" {
			channelID = state["channel_id"]
		}
		rootID = state["root_id"]
		if state["user_id"] != "" {
			userID = state["user_id"]
		}
	}

	proposal := formatScheduleSubmission(title, when, attendees, agenda)
	botUserID, err := p.ensureBot()
	if err != nil {
		http.Error(w, "bot unavailable", http.StatusInternalServerError)
		return
	}
	if _, postErr := p.postReply(botUserID, channelID, rootID, userID, proposal, nil); postErr != nil {
		http.Error(w, "failed to post proposal", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(model.SubmitDialogResponse{Type: "ok"})
}

func submissionString(submission map[string]any, key string) string {
	if submission == nil {
		return ""
	}
	value, ok := submission[key]
	if !ok || value == nil {
		return ""
	}
	return strings.TrimSpace(fmt.Sprint(value))
}

func formatScheduleSubmission(title, when, attendees, agenda string) string {
	var b strings.Builder
	b.WriteString("**Meeting proposal**\n")
	fmt.Fprintf(&b, "- **Title:** %s\n", title)
	if when != "" {
		fmt.Fprintf(&b, "- **When:** %s\n", when)
	} else {
		b.WriteString("- **When:** (pick a time)\n")
	}
	if attendees != "" {
		fmt.Fprintf(&b, "- **Attendees:** %s\n", attendees)
	}
	if agenda != "" {
		fmt.Fprintf(&b, "- **Agenda:** %s\n", agenda)
	}
	return b.String()
}
