package main

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
	"github.com/mattermost/mattermost/server/public/pluginapi"

	"github.com/yvettejade/mattermost/yvette-grok-agent/server/actions"
	"github.com/yvettejade/mattermost/yvette-grok-agent/server/integrations"
	"github.com/yvettejade/mattermost/yvette-grok-agent/server/llm"
)

const (
	pluginID         = "com.yvette.grok-agent"
	botUsername      = "yvette-grok"
	botDisplayName   = "Yvette Grok"
	botDescription   = "Yvette Grok agent — answers and actions from Mattermost history"
	commandTrigger   = "yvette"
	sentByPluginProp = "sent_by_plugin"
)

// Plugin implements the Mattermost plugin hooks for the Yvette Grok agent.
type Plugin struct {
	plugin.MattermostPlugin

	client *pluginapi.Client

	configurationLock sync.RWMutex
	configuration     *configuration

	botUserID string

	llmClient    llm.Client
	githubClient *integrations.GitHub
	jiraClient   *integrations.Jira
}

func (p *Plugin) OnActivate() error {
	p.client = pluginapi.NewClient(p.API, p.Driver)

	if err := p.OnConfigurationChange(); err != nil {
		return err
	}

	botID, err := p.ensureBot()
	if err != nil {
		return err
	}
	p.botUserID = botID

	if err := p.registerCommand(); err != nil {
		return err
	}

	cfg := p.getConfiguration()
	p.client.Log.Info("Yvette Grok agent activated",
		"plugin_id", pluginID,
		"grok_configured", cfg.YvetteGrokAPI != "",
		"github_configured", cfg.GitHubToken != "",
		"jira_configured", cfg.JiraEmail != "" && cfg.JiraAPIToken != "",
	)
	return nil
}

func (p *Plugin) OnDeactivate() error {
	if p.client != nil {
		p.client.Log.Info("Yvette Grok agent deactivated", "plugin_id", pluginID)
	}
	return nil
}

func (p *Plugin) rebuildClients(cfg *configuration) {
	if cfg == nil {
		return
	}
	httpClient := &http.Client{Timeout: 45 * time.Second}
	p.llmClient = llm.NewGrok(llm.GrokConfig{
		BaseURL: cfg.GrokBaseURL,
		Model:   cfg.GrokModel,
		APIKey:  cfg.YvetteGrokAPI,
	}, httpClient)
	p.githubClient = integrations.NewGitHub(integrations.GitHubConfig{
		Token:   cfg.GitHubToken,
		Owner:   cfg.GitHubOwner,
		Repo:    cfg.GitHubRepo,
		BaseURL: "https://api.github.com",
	}, httpClient)
	p.jiraClient = integrations.NewJira(integrations.JiraConfig{
		BaseURL:  cfg.JiraBaseURL,
		Email:    cfg.JiraEmail,
		APIToken: cfg.JiraAPIToken,
	}, httpClient)
}

func (p *Plugin) ServeHTTP(_ *plugin.Context, w http.ResponseWriter, r *http.Request) {
	switch {
	case r.Method == http.MethodGet && strings.TrimSuffix(r.URL.Path, "/") == "/healthz":
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"status":"ok"}`))
	case r.Method == http.MethodPost && r.URL.Path == "/dialog":
		p.handleScheduleDialog(w, r)
	default:
		http.NotFound(w, r)
	}
}

type userRequest struct {
	UserID    string
	ChannelID string
	RootID    string
	TeamID    string
	Text      string
	TriggerID string
	SiteURL   string
}

func (p *Plugin) dispatch(req userRequest) {
	cfg := p.getConfiguration()
	p.executeIntent(req, Classify(req.Text, cfg.JiraProjectKey, cfg.GitHubOwner, cfg.GitHubRepo), cfg)
}

func (p *Plugin) executeIntent(req userRequest, intent Intent, cfg *configuration) {
	if intent.Kind == IntentHelp {
		p.replyEphemeral(req.UserID, req.ChannelID, helpText)
		return
	}
	if intent.Kind == IntentSchedule {
		if req.TriggerID == "" {
			p.replyEphemeral(req.UserID, req.ChannelID, "Use `/yvette schedule` to open the meeting proposal dialog.")
			return
		}
		if err := p.openScheduleDialog(req); err != nil {
			p.replyEphemeral(req.UserID, req.ChannelID, "Could not open the schedule dialog.")
			p.logErr("open schedule dialog", err)
		}
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 50*time.Second)
	defer cancel()

	var extra []string
	if intent.IssueKey != "" || intent.Kind == IntentJira {
		if card, err := p.fetchJiraCard(ctx, intent.IssueKey); err != nil {
			p.replyEphemeral(req.UserID, req.ChannelID, "Jira lookup failed (credentials missing or issue not found).")
			p.logErr("jira fetch", err)
		} else if card != "" {
			extra = append(extra, card)
			if intent.Kind == IntentJira && strings.TrimSpace(intent.Query) == "" {
				p.reply(req, card)
				return
			}
		}
	}
	if intent.GitHub != nil || intent.Kind == IntentGitHub {
		if card, err := p.fetchGitHubCard(ctx, intent.GitHub); err != nil {
			p.replyEphemeral(req.UserID, req.ChannelID, "GitHub lookup failed (token missing or ref not found).")
			p.logErr("github fetch", err)
		} else if card != "" {
			extra = append(extra, card)
			if intent.Kind == IntentGitHub && strings.TrimSpace(intent.Query) == "" {
				p.reply(req, card)
				return
			}
		}
	}

	if intent.Kind == IntentRoute {
		p.handleRoute(ctx, req, intent)
		return
	}

	posts, err := p.gatherForIntent(req, intent, cfg)
	if err != nil {
		p.replyEphemeral(req.UserID, req.ChannelID, "Could not load channel history.")
		p.logErr("gather history", err)
		return
	}
	history := formatHistory(posts)
	if len(extra) > 0 {
		history = strings.Join(extra, "\n\n") + "\n\n" + history
	}

	switch intent.Kind {
	case IntentSummarize:
		p.handleSummarize(ctx, req, intent, history)
	case IntentDraft:
		p.handleDraft(ctx, req, intent, history, false)
	case IntentCanvas:
		p.handleDraft(ctx, req, intent, history, true)
	default:
		p.handleAsk(ctx, req, intent, history)
	}
}

func (p *Plugin) handleAsk(ctx context.Context, req userRequest, intent Intent, history string) {
	if !p.grokReady() {
		p.replyEphemeral(req.UserID, req.ChannelID, "Yvette Grok is not configured. Set YvetteGrokAPI in plugin settings or the process environment.")
		return
	}
	answer, err := p.llmClient.Complete(ctx, llm.CompletionRequest{
		Messages: []llm.Message{
			{Role: "system", Content: llm.SystemQA},
			{Role: "user", Content: llm.QAUserPrompt(intent.Query, history)},
		},
		Temperature: 0.2,
	})
	if err != nil {
		p.replyEphemeral(req.UserID, req.ChannelID, "Grok request failed.")
		p.logErr("grok ask", err)
		return
	}
	p.reply(req, answer)
}

func (p *Plugin) handleSummarize(ctx context.Context, req userRequest, intent Intent, history string) {
	if !p.grokReady() {
		p.replyEphemeral(req.UserID, req.ChannelID, "Yvette Grok is not configured. Set YvetteGrokAPI to summarize.")
		return
	}
	answer, err := actions.Summarize(ctx, p.llmClient, string(intent.Scope), history, intent.Query)
	if err != nil {
		p.replyEphemeral(req.UserID, req.ChannelID, "Could not summarize this conversation.")
		p.logErr("summarize", err)
		return
	}
	p.reply(req, answer)
}

func (p *Plugin) handleDraft(ctx context.Context, req userRequest, intent Intent, history string, canvas bool) {
	if !p.grokReady() {
		p.replyEphemeral(req.UserID, req.ChannelID, "Yvette Grok is not configured. Set YvetteGrokAPI to draft documents.")
		return
	}
	var (
		body string
		err  error
	)
	if canvas {
		body, err = actions.BuildCanvas(ctx, p.llmClient, intent.Title, intent.Query, history)
	} else {
		body, err = actions.DraftDoc(ctx, p.llmClient, intent.Title, intent.Query, history)
	}
	if err != nil {
		p.replyEphemeral(req.UserID, req.ChannelID, "Could not generate the document.")
		p.logErr("draft", err)
		return
	}
	filename := actions.DraftFilename(intent.Title, canvas)
	info, err := p.API.UploadFile([]byte(body), req.ChannelID, filename)
	if err != nil {
		p.replyEphemeral(req.UserID, req.ChannelID, "Generated the document but could not upload it.")
		p.logErr("upload draft", err)
		return
	}
	title := intent.Title
	if canvas {
		title = actions.CanvasTitle(intent.Title)
	}
	p.replyWithFile(req, "**"+title+"**\n\n"+truncate(body, 1500), info.Id)
}

func (p *Plugin) handleRoute(ctx context.Context, req userRequest, intent Intent) {
	card := actions.HandoffCard(intent.Agent, intent.Brief, req.UserID, req.ChannelID)
	p.reply(req, card)

	hooks := p.getConfiguration().AgentWebhookMap()
	url, ok := hooks[intent.Agent]
	if !ok || url == "" {
		return
	}
	payload := actions.RoutePayload{
		Source:    "mattermost",
		UserID:    req.UserID,
		ChannelID: req.ChannelID,
		Brief:     intent.Brief,
		Agent:     intent.Agent,
	}
	if err := actions.PostWebhook(ctx, url, payload); err != nil {
		p.replyEphemeral(req.UserID, req.ChannelID, "Handoff posted, but the agent webhook failed.")
		p.logErr("agent webhook", err)
	}
}

func (p *Plugin) grokReady() bool {
	return p.getConfiguration().YvetteGrokAPI != "" && p.llmClient != nil
}

func (p *Plugin) logErr(op string, err error) {
	if p.client == nil || err == nil {
		return
	}
	// Status only — llm/integrations already redact secrets from err.
	p.client.Log.Error("yvette-grok operation failed", "op", op, "error", err.Error())
}

func (p *Plugin) fetchJiraCard(ctx context.Context, key string) (string, error) {
	if p.jiraClient == nil || !p.jiraClient.Configured() {
		return "", errIntegrationUnconfigured
	}
	if key == "" {
		return "", nil
	}
	issue, err := p.jiraClient.GetIssue(ctx, key)
	if err != nil {
		return "", err
	}
	return issue.Card(), nil
}

func (p *Plugin) fetchGitHubCard(ctx context.Context, ref *GitHubRef) (string, error) {
	if p.githubClient == nil || !p.githubClient.Configured() {
		return "", errIntegrationUnconfigured
	}
	if ref == nil {
		return "", nil
	}
	switch ref.Kind {
	case GitHubPull:
		pr, err := p.githubClient.GetPull(ctx, ref.Number)
		if err != nil {
			return "", err
		}
		return pr.Card(), nil
	case GitHubIssue:
		issue, err := p.githubClient.GetIssue(ctx, ref.Number)
		if err != nil {
			return "", err
		}
		return issue.Card(), nil
	case GitHubPath:
		file, err := p.githubClient.GetContents(ctx, ref.Path)
		if err != nil {
			return "", err
		}
		return file.Card(), nil
	default:
		if ref.Number > 0 {
			pr, err := p.githubClient.GetPull(ctx, ref.Number)
			if err == nil {
				return pr.Card(), nil
			}
			issue, err2 := p.githubClient.GetIssue(ctx, ref.Number)
			if err2 != nil {
				return "", err
			}
			return issue.Card(), nil
		}
	}
	return "", nil
}

func (p *Plugin) gatherForIntent(req userRequest, intent Intent, cfg *configuration) ([]HistoryPost, error) {
	opts := GatherOptions{
		ChannelID:   req.ChannelID,
		RootID:      req.RootID,
		UserID:      req.UserID,
		TeamID:      req.TeamID,
		BotUserID:   p.botUserID,
		MaxPosts:    cfg.HistoryMaxPostsInt(),
		WindowDays:  cfg.HistoryWindowDaysInt(),
		SiteURL:     req.SiteURL,
		Query:       intent.Query,
		TeamSearch:  intent.Kind == IntentQA && NeedsTeamSearch(intent.Query),
		SearchLimit: 20,
	}
	switch intent.Scope {
	case ScopeThread:
		opts.Mode = GatherThread
	case ScopeChannel:
		opts.Mode = GatherChannel
	case ScopeMeeting:
		opts.Mode = GatherSince
		dur := intent.Duration
		if dur <= 0 {
			dur = time.Hour
		}
		opts.Since = time.Now().Add(-dur).UnixMilli()
	case ScopeMissed:
		opts.Mode = GatherMissed
	default:
		if req.RootID != "" {
			opts.Mode = GatherThread
		} else {
			opts.Mode = GatherChannel
		}
	}
	return p.gatherHistory(opts)
}

func (p *Plugin) openScheduleDialog(req userRequest) error {
	id := model.NewId()
	if err := p.putSession(id, sessionState{
		UserID:    req.UserID,
		ChannelID: req.ChannelID,
		RootID:    req.RootID,
		TeamID:    req.TeamID,
		Kind:      "schedule",
	}); err != nil {
		return err
	}
	dialog := actions.ScheduleDialog(req.TriggerID, p.pluginURL("/dialog"))
	dialog.Dialog.State = id
	return p.client.Frontend.OpenInteractiveDialog(dialog)
}

func (p *Plugin) handleScheduleDialog(w http.ResponseWriter, r *http.Request) {
	var payload model.SubmitDialogRequest
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "invalid dialog payload", http.StatusBadRequest)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	if payload.Cancelled {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{}`))
		return
	}

	state, _ := p.getSession(payload.State)
	p.deleteSession(payload.State)

	channelID := firstNonEmpty(state.ChannelID, payload.ChannelId)
	rootID := state.RootID
	userID := firstNonEmpty(state.UserID, payload.UserId)
	title := actions.SubmissionString(payload.Submission, "title")
	when := actions.SubmissionString(payload.Submission, "when")
	participants := actions.SubmissionString(payload.Submission, "participants")
	proposer := userID
	if user, err := p.API.GetUser(userID); err == nil && user != nil && user.Username != "" {
		proposer = "@" + user.Username
	}

	p.reply(userRequest{UserID: userID, ChannelID: channelID, RootID: rootID}, actions.MeetingProposal(title, when, participants, proposer))
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(`{}`))
}

func (p *Plugin) siteURL() string {
	cfg := p.API.GetConfig()
	if cfg == nil || cfg.ServiceSettings.SiteURL == nil {
		return ""
	}
	return strings.TrimRight(*cfg.ServiceSettings.SiteURL, "/")
}

func (p *Plugin) pluginURL(path string) string {
	return p.siteURL() + "/plugins/" + pluginID + path
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "\n…"
}

var errIntegrationUnconfigured = errString("integration is not configured")

type errString string

func (e errString) Error() string { return string(e) }
