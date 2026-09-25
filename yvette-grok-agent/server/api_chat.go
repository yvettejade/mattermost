package main

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/mattermost/mattermost/server/public/model"

	"github.com/yvettejade/mattermost/yvette-grok-agent/server/actions"
	"github.com/yvettejade/mattermost/yvette-grok-agent/server/llm"
)

type chatRequestBody struct {
	Message   string `json:"message"`
	TeamID    string `json:"team_id"`
	ChannelID string `json:"channel_id"`
	RootID    string `json:"root_id"`
	SessionID string `json:"session_id"`
}

type chatCitation struct {
	PostID    string `json:"post_id"`
	Permalink string `json:"permalink"`
}

type chatAction struct {
	Type   string `json:"type"`
	Status string `json:"status"`
}

type chatResponse struct {
	Reply        string         `json:"reply"`
	Citations    []chatCitation `json:"citations,omitempty"`
	ActionsTaken []chatAction   `json:"actions_taken,omitempty"`
}

func (p *Plugin) handleChat(w http.ResponseWriter, r *http.Request) {
	headerUserID := strings.TrimSpace(r.Header.Get(mattermostUserHeader))
	if headerUserID == "" {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	var body chatRequestBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "invalid chat payload", http.StatusBadRequest)
		return
	}

	channelID := strings.TrimSpace(body.ChannelID)
	if channelID == "" {
		http.Error(w, "channel_id is required", http.StatusBadRequest)
		return
	}

	member, appErr := p.API.GetChannelMember(channelID, headerUserID)
	if appErr != nil || member == nil || member.UserId != headerUserID {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}
	if !p.API.HasPermissionToChannel(headerUserID, channelID, model.PermissionReadChannel) {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}

	channel, appErr := p.API.GetChannel(channelID)
	if appErr != nil || channel == nil {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}

	teamID := channel.TeamId
	if teamID == "" {
		teamID = strings.TrimSpace(body.TeamID)
	}

	cfg := p.getConfiguration()
	req := userRequest{
		UserID:    headerUserID,
		ChannelID: channelID,
		RootID:    strings.TrimSpace(body.RootID),
		TeamID:    teamID,
		Text:      strings.TrimSpace(body.Message),
		SiteURL:   p.siteURL(),
	}
	intent := Classify(req.Text, cfg.JiraProjectKey, cfg.GitHubOwner, cfg.GitHubRepo)
	resp := p.resolveChat(req, intent, cfg)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(resp)
}

func (p *Plugin) resolveChat(req userRequest, intent Intent, cfg *configuration) chatResponse {
	if intent.Kind == IntentHelp || strings.TrimSpace(req.Text) == "" {
		return chatResponse{Reply: helpText, ActionsTaken: []chatAction{{Type: "help", Status: "ok"}}}
	}
	if intent.Kind == IntentSchedule {
		return chatResponse{
			Reply:        "Use `/yvette schedule` in the channel to open the meeting proposal dialog. Schedule posts an in-channel proposal only (no calendar write).",
			ActionsTaken: []chatAction{{Type: "schedule", Status: "ok"}},
		}
	}

	ctx, cancel := context.WithTimeout(context.Background(), 50*time.Second)
	defer cancel()

	var extra []string
	if intent.IssueKey != "" || intent.Kind == IntentJira {
		if card, err := p.fetchJiraCard(ctx, intent.IssueKey); err != nil {
			return chatResponse{Reply: "Jira lookup failed (credentials missing or issue not found).", ActionsTaken: []chatAction{{Type: "jira", Status: "error"}}}
		} else if card != "" {
			extra = append(extra, card)
			if intent.Kind == IntentJira && strings.TrimSpace(intent.Query) == "" {
				return chatResponse{Reply: card, ActionsTaken: []chatAction{{Type: "jira", Status: "ok"}}}
			}
		}
	}
	if intent.GitHub != nil || intent.Kind == IntentGitHub {
		if card, err := p.fetchGitHubCard(ctx, intent.GitHub); err != nil {
			return chatResponse{Reply: "GitHub lookup failed (token missing or ref not found).", ActionsTaken: []chatAction{{Type: "github", Status: "error"}}}
		} else if card != "" {
			extra = append(extra, card)
			if intent.Kind == IntentGitHub && strings.TrimSpace(intent.Query) == "" {
				return chatResponse{Reply: card, ActionsTaken: []chatAction{{Type: "github", Status: "ok"}}}
			}
		}
	}

	if intent.Kind == IntentRoute {
		p.handleRoute(ctx, req, intent)
		return chatResponse{
			Reply:        actions.HandoffCard(intent.Agent, intent.Brief, req.UserID, req.ChannelID),
			ActionsTaken: []chatAction{{Type: "route", Status: "ok"}},
		}
	}

	posts, err := p.gatherForIntent(req, intent, cfg)
	if err != nil {
		return chatResponse{Reply: "Could not load channel history.", ActionsTaken: []chatAction{{Type: string(intent.Kind), Status: "error"}}}
	}
	history := formatHistory(posts)
	if len(extra) > 0 {
		history = strings.Join(extra, "\n\n") + "\n\n" + history
	}
	citations := citationsFromHistory(posts)

	switch intent.Kind {
	case IntentSummarize:
		if !p.grokReady() {
			return chatResponse{Reply: "Yvette Grok is not configured. Set YvetteGrokAPI to summarize.", Citations: citations, ActionsTaken: []chatAction{{Type: "summarize", Status: "error"}}}
		}
		answer, err := actions.Summarize(ctx, p.llmClient, string(intent.Scope), history, intent.Query)
		if err != nil {
			return chatResponse{Reply: "Could not summarize this conversation.", Citations: citations, ActionsTaken: []chatAction{{Type: "summarize", Status: "error"}}}
		}
		return chatResponse{Reply: answer, Citations: citations, ActionsTaken: []chatAction{{Type: "summarize", Status: "ok"}}}
	case IntentDraft, IntentCanvas:
		canvas := intent.Kind == IntentCanvas
		if !p.grokReady() {
			return chatResponse{Reply: "Yvette Grok is not configured. Set YvetteGrokAPI to draft documents.", Citations: citations, ActionsTaken: []chatAction{{Type: string(intent.Kind), Status: "error"}}}
		}
		var (
			body   string
			genErr error
		)
		if canvas {
			body, genErr = actions.BuildCanvas(ctx, p.llmClient, intent.Title, intent.Query, history)
		} else {
			body, genErr = actions.DraftDoc(ctx, p.llmClient, intent.Title, intent.Query, history)
		}
		if genErr != nil {
			return chatResponse{Reply: "Could not generate the document.", Citations: citations, ActionsTaken: []chatAction{{Type: string(intent.Kind), Status: "error"}}}
		}
		filename := actions.DraftFilename(intent.Title, canvas)
		info, upErr := p.API.UploadFile([]byte(body), req.ChannelID, filename)
		if upErr != nil {
			return chatResponse{Reply: "Generated the document but could not upload it.", Citations: citations, ActionsTaken: []chatAction{{Type: string(intent.Kind), Status: "error"}}}
		}
		title := intent.Title
		if canvas {
			title = actions.CanvasTitle(intent.Title)
		}
		p.replyWithFile(req, "**"+title+"**\n\n"+truncate(body, 1500), info.Id)
		return chatResponse{Reply: "**" + title + "**\n\n" + truncate(body, 1500), Citations: citations, ActionsTaken: []chatAction{{Type: string(intent.Kind), Status: "ok"}}}
	default:
		if !p.grokReady() {
			return chatResponse{Reply: "Yvette Grok is not configured. Set YvetteGrokAPI in plugin settings or the process environment.", Citations: citations, ActionsTaken: []chatAction{{Type: "qa", Status: "error"}}}
		}
		answer, err := p.llmClient.Complete(ctx, llm.CompletionRequest{
			Messages: []llm.Message{
				{Role: "system", Content: llm.SystemQA},
				{Role: "user", Content: llm.QAUserPrompt(intent.Query, history)},
			},
			Temperature: 0.2,
		})
		if err != nil {
			return chatResponse{Reply: "Grok request failed.", Citations: citations, ActionsTaken: []chatAction{{Type: "qa", Status: "error"}}}
		}
		return chatResponse{Reply: answer, Citations: citations, ActionsTaken: []chatAction{{Type: "qa", Status: "ok"}}}
	}
}

func citationsFromHistory(posts []HistoryPost) []chatCitation {
	out := make([]chatCitation, 0, len(posts))
	for _, post := range posts {
		if post.ID == "" {
			continue
		}
		out = append(out, chatCitation{PostID: post.ID, Permalink: post.Permalink})
	}
	return out
}
