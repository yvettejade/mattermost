package main

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/yvettejade/mattermost/yvette-grok-agent/server/actions"
	"github.com/yvettejade/mattermost/yvette-grok-agent/server/llm"
)

type modalQueryRequest struct {
	Text      string `json:"text"`
	Message   string `json:"message"`
	ChannelID string `json:"channel_id"`
	RootID    string `json:"root_id"`
	TeamID    string `json:"team_id"`
	Intent    string `json:"intent"`
}

type modalQueryResponse struct {
	Reply    string   `json:"reply"`
	Intent   string   `json:"intent"`
	Provider string   `json:"provider"`
	Sources  []string `json:"sources,omitempty"`
}

type modalStatusResponse struct {
	OK             bool   `json:"ok"`
	GrokConfigured bool   `json:"grok_configured"`
	Provider       string `json:"provider"`
	GitHubOwner    string `json:"github_owner"`
	GitHubRepo     string `json:"github_repo"`
	JiraProjectKey string `json:"jira_project_key"`
}

func (p *Plugin) handleStatus(w http.ResponseWriter, r *http.Request) {
	if strings.TrimSpace(r.Header.Get(mattermostUserHeader)) == "" {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	cfg := p.getConfiguration()
	provider := "workspace"
	if p.grokReady() {
		provider = "grok"
	}
	writeJSON(w, http.StatusOK, modalStatusResponse{
		OK:             true,
		GrokConfigured: p.grokReady(),
		Provider:       provider,
		GitHubOwner:    cfg.GitHubOwner,
		GitHubRepo:     cfg.GitHubRepo,
		JiraProjectKey: cfg.JiraProjectKey,
	})
}

func (p *Plugin) handleQuery(w http.ResponseWriter, r *http.Request) {
	userID := strings.TrimSpace(r.Header.Get(mattermostUserHeader))
	if userID == "" {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	var body modalQueryRequest
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "invalid query payload", http.StatusBadRequest)
		return
	}

	text := strings.TrimSpace(body.Text)
	if text == "" {
		text = strings.TrimSpace(body.Message)
	}
	if text == "" {
		http.Error(w, "text required", http.StatusBadRequest)
		return
	}
	if strings.TrimSpace(body.ChannelID) == "" {
		http.Error(w, "channel_id required", http.StatusBadRequest)
		return
	}

	if _, appErr := p.API.GetChannelMember(body.ChannelID, userID); appErr != nil {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}

	cfg := p.getConfiguration()
	intent := Classify(text, cfg.JiraProjectKey, cfg.GitHubOwner, cfg.GitHubRepo)
	if forced := forceIntent(body.Intent, intent); forced.Kind != "" {
		intent = forced
	}

	req := userRequest{
		UserID:    userID,
		ChannelID: body.ChannelID,
		RootID:    body.RootID,
		TeamID:    body.TeamID,
		Text:      text,
		SiteURL:   p.siteURL(),
	}

	reply, sources, provider := p.answerForModal(req, intent, cfg)
	writeJSON(w, http.StatusOK, modalQueryResponse{
		Reply:    reply,
		Intent:   string(intent.Kind),
		Provider: provider,
		Sources:  sources,
	})
}

func forceIntent(raw string, base Intent) Intent {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "summarize", "catchup", "catch_up":
		base.Kind = IntentSummarize
		if base.Scope == "" {
			base.Scope = ScopeMissed
		}
	case "draft":
		base.Kind = IntentDraft
		if base.Title == "" {
			base.Title = base.Query
		}
	case "canvas":
		base.Kind = IntentCanvas
		if base.Title == "" {
			base.Title = base.Query
		}
	case "schedule":
		base.Kind = IntentSchedule
	case "route":
		base.Kind = IntentRoute
	case "github":
		base.Kind = IntentGitHub
	case "jira":
		base.Kind = IntentJira
	case "help":
		base.Kind = IntentHelp
	case "ask", "qa":
		base.Kind = IntentQA
	}
	return base
}

func (p *Plugin) answerForModal(req userRequest, intent Intent, cfg *configuration) (string, []string, string) {
	if intent.Kind == IntentHelp {
		return helpText, nil, providerFor(p.grokReady())
	}
	if intent.Kind == IntentSchedule {
		return actions.MeetingProposal("Working session", "TBD — use /yvette schedule to post this in-channel", "(from Grok modal)", "you") +
			"\n\nThe chat modal cannot open the interactive dialog. Use `/yvette schedule` to post a meeting proposal.", nil, providerFor(p.grokReady())
	}

	ctx, cancel := context.WithTimeout(context.Background(), 50*time.Second)
	defer cancel()

	var extra []string
	if intent.IssueKey != "" || intent.Kind == IntentJira {
		if card, err := p.fetchJiraCard(ctx, intent.IssueKey); err == nil && card != "" {
			extra = append(extra, card)
			if intent.Kind == IntentJira && strings.TrimSpace(intent.Query) == "" {
				return card, permalinksFromExtra(extra), providerFor(p.grokReady())
			}
		} else if intent.Kind == IntentJira {
			return "Jira lookup failed (credentials missing or issue not found). Default project is " + cfg.JiraProjectKey + ".", nil, providerFor(p.grokReady())
		}
	}
	if intent.GitHub != nil || intent.Kind == IntentGitHub {
		if card, err := p.fetchGitHubCard(ctx, intent.GitHub); err == nil && card != "" {
			extra = append(extra, card)
			if intent.Kind == IntentGitHub && strings.TrimSpace(intent.Query) == "" {
				return card, permalinksFromExtra(extra), providerFor(p.grokReady())
			}
		} else if intent.Kind == IntentGitHub {
			return "GitHub lookup failed (token missing or ref not found). Default repo is " + cfg.GitHubOwner + "/" + cfg.GitHubRepo + ".", nil, providerFor(p.grokReady())
		}
	}

	if intent.Kind == IntentRoute {
		agent := intent.Agent
		if agent == "" {
			agent = "specialist"
		}
		brief := intent.Brief
		if brief == "" {
			brief = intent.Query
		}
		return actions.HandoffCard(agent, brief, req.UserID, req.ChannelID) +
			"\n\nUse `/yvette route <agent> <brief>` to post this handoff in-channel.", nil, providerFor(p.grokReady())
	}

	posts, err := p.gatherForIntent(req, intent, cfg)
	if err != nil {
		return "Could not load channel history you are allowed to see.", nil, providerFor(p.grokReady())
	}
	history := formatHistory(posts)
	if len(extra) > 0 {
		history = strings.Join(extra, "\n\n") + "\n\n" + history
	}
	sources := collectSources(posts)

	if !p.grokReady() {
		return localHistoryFallback(intent, history), sources, "workspace"
	}

	var (
		answer string
		llmErr error
	)
	switch intent.Kind {
	case IntentSummarize:
		answer, llmErr = actions.Summarize(ctx, p.llmClient, string(intent.Scope), history, intent.Query)
	case IntentDraft:
		answer, llmErr = actions.DraftDoc(ctx, p.llmClient, intent.Title, intent.Query, history)
	case IntentCanvas:
		answer, llmErr = actions.BuildCanvas(ctx, p.llmClient, intent.Title, intent.Query, history)
	default:
		answer, llmErr = p.llmClient.Complete(ctx, llm.CompletionRequest{
			Messages: []llm.Message{
				{Role: "system", Content: llm.SystemQA},
				{Role: "user", Content: llm.QAUserPrompt(intent.Query, history)},
			},
			Temperature: 0.2,
		})
	}
	if llmErr != nil {
		p.logErr("modal grok", llmErr)
		return localHistoryFallback(intent, history), sources, "workspace"
	}
	return answer, sources, "grok"
}

func localHistoryFallback(intent Intent, history string) string {
	prefix := "Workspace recap (Grok is not configured or the request failed; using permissioned Mattermost history):\n\n"
	switch intent.Kind {
	case IntentDraft:
		prefix = "Draft from workspace history (set YvetteGrokAPI for a Grok-written document):\n\n"
	case IntentCanvas:
		prefix = "Canvas from workspace history (set YvetteGrokAPI for a Grok-written canvas):\n\n"
	case IntentSummarize:
		prefix = "Catch-up from workspace history (set YvetteGrokAPI for a Grok summary):\n\n"
	}
	return prefix + truncate(history, 2500)
}

func collectSources(posts []HistoryPost) []string {
	out := make([]string, 0, len(posts))
	seen := map[string]bool{}
	for _, post := range posts {
		if post.Permalink == "" || seen[post.Permalink] {
			continue
		}
		seen[post.Permalink] = true
		out = append(out, post.Permalink)
		if len(out) >= 8 {
			break
		}
	}
	return out
}

func permalinksFromExtra(extra []string) []string {
	if len(extra) == 0 {
		return nil
	}
	return extra
}

func providerFor(grokReady bool) string {
	if grokReady {
		return "grok"
	}
	return "workspace"
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}
