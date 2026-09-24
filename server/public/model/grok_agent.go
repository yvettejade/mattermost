// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"os"
	"strings"
)

const (
	GrokAgentUsername    = "grok"
	GrokAgentDisplayName = "Grok"
	GrokAgentDescription = "Workspace AI agent that answers from Mattermost history and can draft, summarize, and route work."
	GrokAgentOwnerID     = "com.mattermost.grok-agent"
	GrokAgentBotPluginID = "com.mattermost.grok-agent"

	GrokAPIKeyEnv    = "YvetteGrokAPI"
	GrokAPIModelEnv  = "YvetteGrokModel"
	GrokAPIURLEnv    = "YvetteGrokAPIURL"
	GrokAPIKeyAltEnv = "MM_GROKAGENTSETTINGS_APIKEY"

	GrokDefaultModel  = "grok-3"
	GrokDefaultAPIURL = "https://api.x.ai/v1/chat/completions"

	GrokDefaultGitHubRepo = "https://github.com/yvettejade/mattermost"
	GrokDefaultJiraURL    = "https://fe-anysphere-demo.atlassian.net/jira/software/projects/YJIRA/"

	PostPropsFromGrokAgent = "from_grok_agent"

	GrokContextPostLimit = 30
)

type GrokIntent string

const (
	GrokIntentAsk       GrokIntent = "ask"
	GrokIntentSummarize GrokIntent = "summarize"
	GrokIntentCatchUp   GrokIntent = "catch_up"
	GrokIntentDraft     GrokIntent = "draft"
	GrokIntentSchedule  GrokIntent = "schedule"
	GrokIntentCanvas    GrokIntent = "canvas"
	GrokIntentGitHub    GrokIntent = "github"
	GrokIntentJira      GrokIntent = "jira"
	GrokIntentRoute     GrokIntent = "route"
	GrokIntentHelp      GrokIntent = "help"
)

// GrokAPIKey returns the Grok Chat API key from the dedicated env/secret
// (YvetteGrokAPI) or the Mattermost-style fallback.
func GrokAPIKey() string {
	if key := strings.TrimSpace(os.Getenv(GrokAPIKeyEnv)); key != "" {
		return key
	}
	return strings.TrimSpace(os.Getenv(GrokAPIKeyAltEnv))
}

// GrokModel is the xAI chat model. Override with YvetteGrokModel.
func GrokModel() string {
	if modelName := strings.TrimSpace(os.Getenv(GrokAPIModelEnv)); modelName != "" {
		return modelName
	}
	return GrokDefaultModel
}

// GrokAPIURL is the chat completions endpoint. Override with YvetteGrokAPIURL
// (used by tests and private gateways).
func GrokAPIURL() string {
	if apiURL := strings.TrimSpace(os.Getenv(GrokAPIURLEnv)); apiURL != "" {
		return apiURL
	}
	return GrokDefaultAPIURL
}

func GrokAPIConfigured() bool {
	return GrokAPIKey() != ""
}

// ParseGrokIntent maps a user message to a workspace-agent action.
// The first matching keyword wins so `/grok summarize the auth thread` is summarize, not ask.
func ParseGrokIntent(message string) GrokIntent {
	normalized := strings.ToLower(strings.TrimSpace(message))
	normalized = strings.TrimPrefix(normalized, "@"+GrokAgentUsername)
	normalized = strings.TrimSpace(normalized)

	if normalized == "" || normalized == "help" || normalized == "?" {
		return GrokIntentHelp
	}

	switch {
	case hasGrokKeyword(normalized, "summarize", "summary", "summarise", "tldr", "tl;dr"):
		return GrokIntentSummarize
	case hasGrokKeyword(normalized, "catch up", "catch-up", "catchup", "missed", "what did i miss", "recap"):
		return GrokIntentCatchUp
	case hasGrokKeyword(normalized, "schedule", "meeting", "calendar", "book time"):
		return GrokIntentSchedule
	case hasGrokKeyword(normalized, "canvas", "whiteboard"):
		return GrokIntentCanvas
	case hasGrokKeyword(normalized, "draft", "write a doc", "document"):
		return GrokIntentDraft
	case hasGrokKeyword(normalized, "github", "repo", "pull request", "pr #"):
		return GrokIntentGitHub
	case hasGrokKeyword(normalized, "jira", "ticket", "yjira-"):
		return GrokIntentJira
	case hasGrokKeyword(normalized, "route", "hand off", "handoff", "specialist"):
		return GrokIntentRoute
	default:
		return GrokIntentAsk
	}
}

func hasGrokKeyword(message string, keywords ...string) bool {
	for _, keyword := range keywords {
		if strings.Contains(message, keyword) {
			return true
		}
	}
	return false
}

// StripGrokMention removes a leading @grok mention so intent parsing sees the request.
func StripGrokMention(message string) string {
	trimmed := strings.TrimSpace(message)
	prefix := "@" + GrokAgentUsername
	if len(trimmed) >= len(prefix) && strings.EqualFold(trimmed[:len(prefix)], prefix) {
		return strings.TrimSpace(trimmed[len(prefix):])
	}
	return trimmed
}
