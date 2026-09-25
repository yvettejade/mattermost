// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"os"
	"regexp"
	"strings"
)

const (
	GrokAPIKeyEnv              = "YvetteGrokAPI"
	GrokDefaultAPIURL          = "https://api.x.ai/v1/chat/completions"
	GrokDefaultModel           = "grok-3"
	GrokDefaultGitHubRepo      = "yvettejade/mattermost"
	GrokDefaultJiraBaseURL     = "https://fe-anysphere-demo.atlassian.net"
	GrokDefaultJiraProjectKey  = "YJIRA"
	GrokAgentProviderGrok      = "grok"
	GrokAgentProviderWorkspace = "workspace"

	GrokAgentIntentAsk       = "ask"
	GrokAgentIntentSummarize = "summarize"
	GrokAgentIntentDraft     = "draft"
	GrokAgentIntentSchedule  = "schedule"
	GrokAgentIntentCanvas    = "canvas"
	GrokAgentIntentRoute     = "route"
	GrokAgentIntentGitHub    = "github"
	GrokAgentIntentJira      = "jira"
)

var (
	jiraIssueKeyPattern = regexp.MustCompile(`\b([A-Z][A-Z0-9]+-\d+)\b`)
	intentTokenPattern  = regexp.MustCompile(`(?i)^(ask|summarize|recap|draft|schedule|canvas|route|github|jira)\b`)
)

// GrokChatSettings is the runtime configuration for the built-in Grok workspace agent.
// The API key is read from the YvetteGrokAPI environment variable and is never serialized.
type GrokChatSettings struct {
	APIKey         string `json:"-"`
	APIURL         string `json:"api_url"`
	Model          string `json:"model"`
	GitHubRepo     string `json:"github_repo"`
	JiraBaseURL    string `json:"jira_base_url"`
	JiraProjectKey string `json:"jira_project_key"`
	JiraEmail      string `json:"-"`
	JiraAPIToken   string `json:"-"`
}

type GrokAgentQueryRequest struct {
	ChannelID string `json:"channel_id"`
	RootID    string `json:"root_id,omitempty"`
	Message   string `json:"message"`
	Intent    string `json:"intent,omitempty"`
}

type GrokAgentAction struct {
	Type    string `json:"type"`
	Title   string `json:"title"`
	Payload string `json:"payload,omitempty"`
}

type GrokAgentQueryResponse struct {
	Intent   string            `json:"intent"`
	Reply    string            `json:"reply"`
	Provider string            `json:"provider"`
	Model    string            `json:"model,omitempty"`
	Sources  []string          `json:"sources,omitempty"`
	Actions  []GrokAgentAction `json:"actions,omitempty"`
}

type GrokAgentStatus struct {
	Available      bool   `json:"available"`
	Provider       string `json:"provider"`
	Model          string `json:"model,omitempty"`
	GitHubRepo     string `json:"github_repo"`
	JiraProjectKey string `json:"jira_project_key"`
	JiraBaseURL    string `json:"jira_base_url"`
}

func LoadGrokChatSettings() GrokChatSettings {
	settings := GrokChatSettings{
		APIKey:         strings.TrimSpace(os.Getenv(GrokAPIKeyEnv)),
		APIURL:         envOrDefault("MM_GROK_API_URL", GrokDefaultAPIURL),
		Model:          envOrDefault("MM_GROK_MODEL", GrokDefaultModel),
		GitHubRepo:     envOrDefault("MM_GROK_GITHUB_REPO", GrokDefaultGitHubRepo),
		JiraBaseURL:    strings.TrimRight(envOrDefault("MM_GROK_JIRA_BASE_URL", GrokDefaultJiraBaseURL), "/"),
		JiraProjectKey: envOrDefault("MM_GROK_JIRA_PROJECT", GrokDefaultJiraProjectKey),
		JiraEmail:      strings.TrimSpace(os.Getenv("JIRA_EMAIL")),
		JiraAPIToken:   strings.TrimSpace(os.Getenv("JIRA_API_TOKEN")),
	}
	return settings
}

func (s GrokChatSettings) HasGrokAPIKey() bool {
	return s.APIKey != ""
}

func (s GrokChatSettings) Provider() string {
	if s.HasGrokAPIKey() {
		return GrokAgentProviderGrok
	}
	return GrokAgentProviderWorkspace
}

func envOrDefault(key, fallback string) string {
	if value := strings.TrimSpace(os.Getenv(key)); value != "" {
		return value
	}
	return fallback
}

func NormalizeGrokAgentIntent(intent, message string) (string, string) {
	intent = strings.ToLower(strings.TrimSpace(intent))
	message = strings.TrimSpace(message)

	switch intent {
	case GrokAgentIntentAsk, GrokAgentIntentSummarize, GrokAgentIntentDraft, GrokAgentIntentSchedule,
		GrokAgentIntentCanvas, GrokAgentIntentRoute, GrokAgentIntentGitHub, GrokAgentIntentJira:
		return intent, message
	case "recap", "catchup", "catch-up":
		return GrokAgentIntentSummarize, message
	}

	if match := intentTokenPattern.FindStringSubmatch(message); len(match) == 2 {
		normalized, remainder := NormalizeGrokAgentIntent(match[1], strings.TrimSpace(message[len(match[0]):]))
		return normalized, remainder
	}

	lower := strings.ToLower(message)
	switch {
	case containsAny(lower, "summarize", "summary", "recap", "catch up", "catch-up", "missed"):
		return GrokAgentIntentSummarize, message
	case containsAny(lower, "draft", "write a doc", "write a document", "document"):
		return GrokAgentIntentDraft, message
	case containsAny(lower, "schedule", "meeting", "calendar"):
		return GrokAgentIntentSchedule, message
	case containsAny(lower, "canvas", "outline", "whiteboard"):
		return GrokAgentIntentCanvas, message
	case containsAny(lower, "route", "handoff", "hand off", "specialist"):
		return GrokAgentIntentRoute, message
	case containsAny(lower, "github", "repo", "pull request"):
		return GrokAgentIntentGitHub, message
	case containsAny(lower, "jira", "ticket") || len(ExtractJiraIssueKeys(message)) > 0:
		return GrokAgentIntentJira, message
	default:
		return GrokAgentIntentAsk, message
	}
}

func ExtractJiraIssueKeys(text string) []string {
	matches := jiraIssueKeyPattern.FindAllString(text, -1)
	if len(matches) == 0 {
		return nil
	}

	seen := make(map[string]struct{}, len(matches))
	keys := make([]string, 0, len(matches))
	for _, match := range matches {
		if _, ok := seen[match]; ok {
			continue
		}
		seen[match] = struct{}{}
		keys = append(keys, match)
	}
	return keys
}

func containsAny(haystack string, needles ...string) bool {
	for _, needle := range needles {
		if strings.Contains(haystack, needle) {
			return true
		}
	}
	return false
}
