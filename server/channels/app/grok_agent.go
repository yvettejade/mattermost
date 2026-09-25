// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

const (
	grokAgentHistoryLimit = 30
	grokHTTPTimeout       = 30 * time.Second
)

var (
	grokHTTPClient   = &http.Client{Timeout: grokHTTPTimeout}
	grokHTTPClientMu sync.RWMutex
)

func SetGrokHTTPClient(client *http.Client) {
	grokHTTPClientMu.Lock()
	defer grokHTTPClientMu.Unlock()
	if client == nil {
		grokHTTPClient = &http.Client{Timeout: grokHTTPTimeout}
		return
	}
	grokHTTPClient = client
}

func getGrokHTTPClient() *http.Client {
	grokHTTPClientMu.RLock()
	defer grokHTTPClientMu.RUnlock()
	return grokHTTPClient
}

func (a *App) GetGrokAgentStatus() model.GrokAgentStatus {
	settings := model.LoadGrokChatSettings()
	return model.GrokAgentStatus{
		Available:      true,
		Provider:       settings.Provider(),
		Model:          settings.Model,
		GitHubRepo:     settings.GitHubRepo,
		JiraProjectKey: settings.JiraProjectKey,
		JiraBaseURL:    settings.JiraBaseURL,
	}
}

func (a *App) QueryGrokAgent(rctx request.CTX, userID string, req model.GrokAgentQueryRequest) (*model.GrokAgentQueryResponse, *model.AppError) {
	if strings.TrimSpace(req.ChannelID) == "" {
		return nil, model.NewAppError("QueryGrokAgent", "app.grok_agent.channel_required", nil, "", http.StatusBadRequest)
	}

	if ok, _ := a.HasPermissionToChannel(rctx, userID, req.ChannelID, model.PermissionReadChannel); !ok {
		return nil, model.NewAppError("QueryGrokAgent", "app.grok_agent.permission_denied", nil, "", http.StatusForbidden)
	}

	intent, message := model.NormalizeGrokAgentIntent(req.Intent, req.Message)
	if message == "" && intent == model.GrokAgentIntentAsk {
		intent = model.GrokAgentIntentSummarize
	}

	settings := model.LoadGrokChatSettings()
	channel, appErr := a.GetChannel(rctx, req.ChannelID)
	if appErr != nil {
		return nil, appErr
	}

	history, historyErr := a.collectGrokAgentHistory(rctx, userID, channel, req.RootID)
	if historyErr != nil {
		return nil, historyErr
	}

	sources := []string{fmt.Sprintf("Mattermost channel %s", channelDisplayName(channel))}
	if req.RootID != "" {
		sources = append(sources, "current thread")
	}

	githubContext := ""
	jiraContext := ""
	if intent == model.GrokAgentIntentGitHub || intent == model.GrokAgentIntentAsk || intent == model.GrokAgentIntentRoute {
		githubContext = a.fetchGitHubRepoContext(rctx, settings)
		if githubContext != "" {
			sources = append(sources, "GitHub "+settings.GitHubRepo)
		}
	}
	if intent == model.GrokAgentIntentJira || intent == model.GrokAgentIntentAsk || intent == model.GrokAgentIntentRoute {
		jiraContext = a.fetchJiraContext(rctx, settings, message)
		if jiraContext != "" {
			sources = append(sources, "Jira "+settings.JiraProjectKey)
		}
	}

	if settings.HasGrokAPIKey() {
		reply, err := a.completeGrokChat(rctx, settings, intent, message, channelDisplayName(channel), formatWorkspaceHistory(history), githubContext, jiraContext)
		if err != nil {
			rctx.Logger().Warn("Grok Chat completion failed, using workspace fallback", mlog.Err(err))
		} else {
			return &model.GrokAgentQueryResponse{
				Intent:   intent,
				Reply:    reply,
				Provider: model.GrokAgentProviderGrok,
				Model:    settings.Model,
				Sources:  sources,
				Actions:  grokAgentActions(intent, message, settings, history),
			}, nil
		}
	}

	reply, actions := a.buildWorkspaceAgentReply(intent, message, channel, history, githubContext, jiraContext, settings)
	return &model.GrokAgentQueryResponse{
		Intent:   intent,
		Reply:    reply,
		Provider: model.GrokAgentProviderWorkspace,
		Model:    settings.Model,
		Sources:  sources,
		Actions:  actions,
	}, nil
}

func (a *App) collectGrokAgentHistory(rctx request.CTX, userID string, channel *model.Channel, rootID string) ([]workspacePost, *model.AppError) {
	var postList *model.PostList
	var appErr *model.AppError

	if rootID != "" {
		postList, appErr = a.GetPostThread(rctx, rootID, model.GetPostsOptions{SkipFetchThreads: false}, userID)
	} else {
		postList, appErr = a.GetPosts(rctx, channel.Id, 0, grokAgentHistoryLimit)
	}
	if appErr != nil {
		return nil, appErr
	}

	posts := postList.ToSlice()
	if rootID == "" && len(posts) > grokAgentHistoryLimit {
		posts = posts[len(posts)-grokAgentHistoryLimit:]
	}

	history := make([]workspacePost, 0, len(posts))
	users := map[string]string{}
	for _, post := range posts {
		if post == nil || post.DeleteAt > 0 || strings.TrimSpace(post.Message) == "" {
			continue
		}
		username, ok := users[post.UserId]
		if !ok {
			if user, userErr := a.GetUser(post.UserId); userErr == nil {
				username = user.Username
			} else {
				username = "user"
			}
			users[post.UserId] = username
		}
		history = append(history, workspacePost{
			Username: username,
			Message:  post.Message,
			CreateAt: post.CreateAt,
		})
	}
	sort.Slice(history, func(i, j int) bool {
		return history[i].CreateAt < history[j].CreateAt
	})
	return history, nil
}

type workspacePost struct {
	Username string
	Message  string
	CreateAt int64
}

func formatWorkspaceHistory(history []workspacePost) string {
	if len(history) == 0 {
		return "No recent channel messages were available."
	}

	var builder strings.Builder
	for _, post := range history {
		builder.WriteString("@")
		builder.WriteString(post.Username)
		builder.WriteString(": ")
		builder.WriteString(post.Message)
		builder.WriteString("\n")
	}
	return strings.TrimSpace(builder.String())
}

func (a *App) completeGrokChat(rctx request.CTX, settings model.GrokChatSettings, intent, message, channelName, history, githubContext, jiraContext string) (string, error) {
	systemPrompt := `You are the Mattermost workspace agent, similar to Slackbot. Answer from the provided Mattermost history plus optional GitHub and Jira context. Do not invent facts that are not in that context. If the user asks you to draft, schedule, build a canvas, or route work, produce a concrete artifact they can paste or act on. Keep replies concise and use Mattermost markdown.`

	userPrompt := fmt.Sprintf("Intent: %s\nChannel: %s\nQuestion: %s\n\nWorkspace history:\n%s", intent, channelName, emptyAs(message, "(none)"), history)
	if githubContext != "" {
		userPrompt += "\n\nGitHub:\n" + githubContext
	}
	if jiraContext != "" {
		userPrompt += "\n\nJira:\n" + jiraContext
	}

	payload := map[string]any{
		"model": settings.Model,
		"messages": []map[string]string{
			{"role": "system", "content": systemPrompt},
			{"role": "user", "content": userPrompt},
		},
		"temperature": 0.2,
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return "", err
	}

	httpReq, err := http.NewRequestWithContext(rctx.Context(), http.MethodPost, settings.APIURL, bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	httpReq.Header.Set("Authorization", "Bearer "+settings.APIKey)
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := getGrokHTTPClient().Do(httpReq)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return "", err
	}
	if resp.StatusCode >= 300 {
		return "", fmt.Errorf("grok chat returned status %d", resp.StatusCode)
	}

	var completion struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := json.Unmarshal(respBody, &completion); err != nil {
		return "", err
	}
	if len(completion.Choices) == 0 || strings.TrimSpace(completion.Choices[0].Message.Content) == "" {
		return "", fmt.Errorf("grok chat returned an empty completion")
	}
	return strings.TrimSpace(completion.Choices[0].Message.Content), nil
}

func (a *App) buildWorkspaceAgentReply(intent, message string, channel *model.Channel, history []workspacePost, githubContext, jiraContext string, settings model.GrokChatSettings) (string, []model.GrokAgentAction) {
	historyText := formatWorkspaceHistory(history)
	channelName := channelDisplayName(channel)
	actions := grokAgentActions(intent, message, settings, history)

	switch intent {
	case model.GrokAgentIntentSummarize:
		return buildSummarizeReply(channelName, history), actions
	case model.GrokAgentIntentDraft:
		return fmt.Sprintf("**Draft document**\n\n# %s\n\n%s\n\n## Source channel\n%s", draftTitle(message, channelName), relevantHistory(message, history, historyText), channelName), actions
	case model.GrokAgentIntentSchedule:
		return fmt.Sprintf("**Meeting proposal**\n\n- **Title:** %s\n- **When:** %s\n- **Channel:** %s\n- **Agenda from recent discussion:**\n%s", scheduleTitle(message, channelName), scheduleWhen(message), channelName, historyText), actions
	case model.GrokAgentIntentCanvas:
		return fmt.Sprintf("**Canvas**\n\n### Goal\n%s\n\n### Context from %s\n%s\n\n### Decisions\n- Capture decisions from the thread above.\n\n### Next steps\n- Assign owners and dates in-channel.", emptyAs(message, "Untitled canvas"), channelName, historyText), actions
	case model.GrokAgentIntentRoute:
		return buildRouteReply(message, historyText, githubContext, jiraContext), actions
	case model.GrokAgentIntentGitHub:
		return fmt.Sprintf("**GitHub: %s**\n\n%s\n\nWorkspace mentions:\n%s", settings.GitHubRepo, emptyAs(githubContext, "GitHub context is unavailable."), relevantHistory(message, history, historyText)), actions
	case model.GrokAgentIntentJira:
		return fmt.Sprintf("**Jira: %s**\n\n%s\n\nWorkspace mentions:\n%s", settings.JiraProjectKey, emptyAs(jiraContext, jiraFallback(settings, message)), relevantHistory(message, history, historyText)), actions
	default:
		return buildAskReply(message, channelName, history, githubContext, jiraContext), actions
	}
}

func buildSummarizeReply(channelName string, history []workspacePost) string {
	if len(history) == 0 {
		return fmt.Sprintf("No recent messages in %s to summarize.", channelName)
	}

	var highlights strings.Builder
	fmt.Fprintf(&highlights, "**Catch-up for %s** (%d messages)\n\n", channelName, len(history))
	start := 0
	if len(history) > 8 {
		start = len(history) - 8
	}
	for _, post := range history[start:] {
		fmt.Fprintf(&highlights, "- @%s: %s\n", post.Username, compactMessage(post.Message))
	}

	var actions []string
	for _, post := range history {
		lower := strings.ToLower(post.Message)
		if strings.Contains(lower, "todo") || strings.Contains(lower, "action") || strings.Contains(lower, "please") || strings.Contains(lower, "will ") {
			actions = append(actions, fmt.Sprintf("- @%s: %s", post.Username, compactMessage(post.Message)))
		}
	}
	if len(actions) > 0 {
		highlights.WriteString("\n**Possible action items**\n")
		highlights.WriteString(strings.Join(actions, "\n"))
	}
	return strings.TrimSpace(highlights.String())
}

func buildAskReply(message, channelName string, history []workspacePost, githubContext, jiraContext string) string {
	matches := relevantHistory(message, history, formatWorkspaceHistory(history))
	var builder strings.Builder
	fmt.Fprintf(&builder, "I looked through %s for **%s**.\n\n%s", channelName, emptyAs(message, "recent discussion"), matches)
	if githubContext != "" {
		builder.WriteString("\n\n**GitHub**\n")
		builder.WriteString(githubContext)
	}
	if jiraContext != "" {
		builder.WriteString("\n\n**Jira**\n")
		builder.WriteString(jiraContext)
	}
	return builder.String()
}

func buildRouteReply(message, historyText, githubContext, jiraContext string) string {
	target := "workspace Q&A"
	lower := strings.ToLower(message)
	switch {
	case strings.Contains(lower, "github") || strings.Contains(lower, "repo"):
		target = "GitHub specialist"
	case strings.Contains(lower, "jira") || strings.Contains(lower, "ticket"):
		target = "Jira specialist"
	case strings.Contains(lower, "meet") || strings.Contains(lower, "schedule"):
		target = "scheduling specialist"
	case strings.Contains(lower, "summar") || strings.Contains(lower, "catch"):
		target = "summarization specialist"
	}

	var builder strings.Builder
	fmt.Fprintf(&builder, "Routing to the **%s**.\n\nHandoff brief:\n%s", target, emptyAs(message, historyText))
	if githubContext != "" {
		builder.WriteString("\n\n")
		builder.WriteString(githubContext)
	}
	if jiraContext != "" {
		builder.WriteString("\n\n")
		builder.WriteString(jiraContext)
	}
	return builder.String()
}

func relevantHistory(message string, history []workspacePost, fallback string) string {
	terms := strings.Fields(strings.ToLower(message))
	if len(terms) == 0 {
		return fallback
	}

	var matches []string
	for _, post := range history {
		lower := strings.ToLower(post.Message)
		for _, term := range terms {
			if len(term) < 3 {
				continue
			}
			if strings.Contains(lower, term) {
				matches = append(matches, fmt.Sprintf("- @%s: %s", post.Username, compactMessage(post.Message)))
				break
			}
		}
	}
	if len(matches) == 0 {
		return fallback
	}
	return strings.Join(matches, "\n")
}

func grokAgentActions(intent, message string, settings model.GrokChatSettings, history []workspacePost) []model.GrokAgentAction {
	switch intent {
	case model.GrokAgentIntentDraft:
		return []model.GrokAgentAction{{Type: "draft", Title: draftTitle(message, "Workspace draft")}}
	case model.GrokAgentIntentSchedule:
		return []model.GrokAgentAction{{Type: "schedule", Title: scheduleTitle(message, "Working session"), Payload: scheduleWhen(message)}}
	case model.GrokAgentIntentCanvas:
		return []model.GrokAgentAction{{Type: "canvas", Title: emptyAs(message, "Workspace canvas")}}
	case model.GrokAgentIntentRoute:
		return []model.GrokAgentAction{{Type: "route", Title: "Route to specialist"}}
	case model.GrokAgentIntentGitHub:
		return []model.GrokAgentAction{{Type: "github", Title: settings.GitHubRepo, Payload: "https://github.com/" + settings.GitHubRepo}}
	case model.GrokAgentIntentJira:
		keys := model.ExtractJiraIssueKeys(message)
		if len(keys) == 0 {
			return []model.GrokAgentAction{{Type: "jira", Title: settings.JiraProjectKey, Payload: settings.JiraBaseURL + "/jira/software/projects/" + settings.JiraProjectKey}}
		}
		actions := make([]model.GrokAgentAction, 0, len(keys))
		for _, key := range keys {
			actions = append(actions, model.GrokAgentAction{
				Type:    "jira",
				Title:   key,
				Payload: settings.JiraBaseURL + "/browse/" + key,
			})
		}
		return actions
	case model.GrokAgentIntentSummarize:
		return []model.GrokAgentAction{{Type: "summarize", Title: fmt.Sprintf("%d messages", len(history))}}
	default:
		return nil
	}
}

func (a *App) fetchGitHubRepoContext(rctx request.CTX, settings model.GrokChatSettings) string {
	url := "https://api.github.com/repos/" + settings.GitHubRepo
	body, err := grokDoJSONGet(rctx, url, nil)
	if err != nil {
		rctx.Logger().Debug("GitHub repo lookup failed", mlog.Err(err), mlog.String("repo", settings.GitHubRepo))
		return fmt.Sprintf("Repository %s — https://github.com/%s", settings.GitHubRepo, settings.GitHubRepo)
	}

	var repo struct {
		FullName        string `json:"full_name"`
		Description     string `json:"description"`
		DefaultBranch   string `json:"default_branch"`
		HTMLURL         string `json:"html_url"`
		OpenIssuesCount int    `json:"open_issues_count"`
		StargazersCount int    `json:"stargazers_count"`
	}
	if err := json.Unmarshal(body, &repo); err != nil {
		return fmt.Sprintf("Repository %s — https://github.com/%s", settings.GitHubRepo, settings.GitHubRepo)
	}

	return fmt.Sprintf("%s\n%s\nDefault branch: %s\nOpen issues: %d\nStars: %d\n%s",
		emptyAs(repo.FullName, settings.GitHubRepo),
		emptyAs(repo.Description, "No description"),
		emptyAs(repo.DefaultBranch, "unknown"),
		repo.OpenIssuesCount,
		repo.StargazersCount,
		emptyAs(repo.HTMLURL, "https://github.com/"+settings.GitHubRepo),
	)
}

func (a *App) fetchJiraContext(rctx request.CTX, settings model.GrokChatSettings, message string) string {
	keys := model.ExtractJiraIssueKeys(message)
	if len(keys) == 0 && settings.JiraProjectKey != "" {
		return fmt.Sprintf("Project %s — %s/jira/software/projects/%s", settings.JiraProjectKey, settings.JiraBaseURL, settings.JiraProjectKey)
	}

	var parts []string
	for _, key := range keys {
		browse := settings.JiraBaseURL + "/browse/" + key
		if settings.JiraEmail != "" && settings.JiraAPIToken != "" {
			url := settings.JiraBaseURL + "/rest/api/2/issue/" + key + "?fields=summary,status,assignee"
			body, err := grokDoJSONGet(rctx, url, map[string]string{
				"Authorization": "Basic " + basicAuth(settings.JiraEmail, settings.JiraAPIToken),
			})
			if err == nil {
				var issue struct {
					Fields struct {
						Summary  string                        `json:"summary"`
						Status   struct{ Name string }         `json:"status"`
						Assignee *struct{ DisplayName string } `json:"assignee"`
					} `json:"fields"`
				}
				if json.Unmarshal(body, &issue) == nil && issue.Fields.Summary != "" {
					assignee := "Unassigned"
					if issue.Fields.Assignee != nil {
						assignee = issue.Fields.Assignee.DisplayName
					}
					parts = append(parts, fmt.Sprintf("%s — %s (%s, %s)\n%s", key, issue.Fields.Summary, issue.Fields.Status.Name, assignee, browse))
					continue
				}
			}
		}
		parts = append(parts, fmt.Sprintf("%s — %s", key, browse))
	}
	return strings.Join(parts, "\n")
}

func grokDoJSONGet(rctx request.CTX, url string, headers map[string]string) ([]byte, error) {
	httpReq, err := http.NewRequestWithContext(rctx.Context(), http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("Accept", "application/json")
	httpReq.Header.Set("User-Agent", "Mattermost-Grok-Agent")
	for key, value := range headers {
		httpReq.Header.Set(key, value)
	}

	resp, err := getGrokHTTPClient().Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return nil, err
	}
	if resp.StatusCode >= 300 {
		return nil, fmt.Errorf("request to %s returned status %d", url, resp.StatusCode)
	}
	return body, nil
}

func basicAuth(username, password string) string {
	return base64.StdEncoding.EncodeToString([]byte(username + ":" + password))
}

func channelDisplayName(channel *model.Channel) string {
	if channel == nil {
		return "this channel"
	}
	if channel.DisplayName != "" {
		return channel.DisplayName
	}
	if channel.Name != "" {
		return channel.Name
	}
	return "this channel"
}

func compactMessage(message string) string {
	message = strings.ReplaceAll(message, "\n", " ")
	if len(message) > 180 {
		return strings.TrimSpace(message[:177]) + "..."
	}
	return message
}

func emptyAs(value, fallback string) string {
	if strings.TrimSpace(value) == "" {
		return fallback
	}
	return value
}

func draftTitle(message, fallback string) string {
	message = strings.TrimSpace(strings.TrimPrefix(strings.ToLower(message), "draft"))
	message = strings.TrimSpace(strings.TrimPrefix(message, "a"))
	if message == "" {
		return fallback + " update"
	}
	return strings.TrimSpace(message)
}

func scheduleTitle(message, fallback string) string {
	trimmed := strings.TrimSpace(message)
	if trimmed == "" {
		return fallback
	}
	return trimmed
}

func scheduleWhen(message string) string {
	lower := strings.ToLower(message)
	switch {
	case strings.Contains(lower, "tomorrow"):
		return "tomorrow"
	case strings.Contains(lower, "monday"):
		return "Monday"
	case strings.Contains(lower, "today"):
		return "today"
	default:
		return "next available working slot"
	}
}

func jiraFallback(settings model.GrokChatSettings, message string) string {
	keys := model.ExtractJiraIssueKeys(message)
	if len(keys) == 0 {
		return fmt.Sprintf("Project %s — %s/jira/software/projects/%s", settings.JiraProjectKey, settings.JiraBaseURL, settings.JiraProjectKey)
	}
	var parts []string
	for _, key := range keys {
		parts = append(parts, fmt.Sprintf("%s — %s/browse/%s", key, settings.JiraBaseURL, key))
	}
	return strings.Join(parts, "\n")
}
