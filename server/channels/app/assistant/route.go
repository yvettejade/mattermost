// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package assistant

import (
	"regexp"
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
)

const (
	EnvGrokAPI       = "YvetteGrokAPI"
	EnvJira          = "YvetteJira"
	EnvJiraMCPURL    = "JIRA_MCP_URL"
	DefaultJiraMCPURL = "https://mcp.atlassian.com/v2/mcp"
	JiraSiteHost     = "fe-anysphere-demo.atlassian.net"

	UngroundedIssueKeyMessage = "I can't answer with issue keys that were not in the Jira lookup."

	GrokEndpoint = "https://api.x.ai/v1/chat/completions"
)

var (
	issueKeyPattern = regexp.MustCompile(`\b[A-Z][A-Z0-9]+-\d+\b`)
	durationPattern = regexp.MustCompile(`(?:since\s+)?(\d+)\s*(h|hours?|m|mins?|minutes?|d|days?)\b`)
)

// Route returns the first matching intent for a user utterance.
// rootID is unused for intent selection; thread vs channel is applied when loading posts.
func Route(message, rootID string) string {
	_ = rootID
	trimmed := strings.TrimSpace(message)
	lower := strings.ToLower(trimmed)

	if isJiraIntent(trimmed, lower) {
		return model.AssistantIntentJira
	}
	if isScheduleMeetingIntent(lower) {
		return model.AssistantIntentScheduleMeeting
	}
	if isSchedulePostIntent(lower) {
		return model.AssistantIntentSchedulePost
	}
	if isBoardIntent(lower) {
		return model.AssistantIntentBoard
	}
	if isDraftIntent(lower) {
		return model.AssistantIntentDraft
	}
	if isCatchUpIntent(lower) {
		return model.AssistantIntentCatchUp
	}
	if isSummarizeIntent(trimmed, lower) {
		return model.AssistantIntentSummarize
	}
	return model.AssistantIntentQA
}

func isJiraIntent(original, lower string) bool {
	if strings.Contains(lower, "jira") || strings.Contains(lower, "ticket") {
		return true
	}
	return len(ExtractIssueKeys(original)) > 0
}

func isScheduleMeetingIntent(lower string) bool {
	return strings.Contains(lower, "schedule meeting") ||
		strings.Contains(lower, "schedule a meeting") ||
		strings.Contains(lower, "start a call") ||
		strings.Contains(lower, "schedule a call") ||
		strings.Contains(lower, "schedule call")
}

func isSchedulePostIntent(lower string) bool {
	return strings.Contains(lower, "schedule a post") ||
		strings.Contains(lower, "schedule post")
}

func isBoardIntent(lower string) bool {
	if strings.Contains(lower, "kanban") {
		return true
	}
	if regexp.MustCompile(`\b(create|new|make)\s+(a\s+)?(board|card)\b`).MatchString(lower) {
		return true
	}
	return regexp.MustCompile(`\bboard\b`).MatchString(lower)
}

func isDraftIntent(lower string) bool {
	return strings.Contains(lower, "draft") ||
		strings.Contains(lower, "document") ||
		strings.Contains(lower, "playbook") ||
		strings.Contains(lower, "canvas")
}

func isCatchUpIntent(lower string) bool {
	if strings.Contains(lower, "catch me up") ||
		strings.Contains(lower, "catch-up") ||
		strings.Contains(lower, "what did i miss") ||
		strings.Contains(lower, "since yesterday") {
		return true
	}
	return durationPattern.MatchString(lower) && (strings.Contains(lower, "since") || strings.Contains(lower, "last"))
}

func isSummarizeIntent(original, lower string) bool {
	if strings.TrimSpace(original) == "" {
		return true
	}
	return strings.Contains(lower, "summarize") ||
		strings.Contains(lower, "tldr") ||
		strings.Contains(lower, "tl;dr") ||
		strings.Contains(lower, "summary")
}

// ExtractIssueKeys returns Jira-style issue keys from text, de-duplicated in order.
func ExtractIssueKeys(text string) []string {
	found := issueKeyPattern.FindAllString(text, -1)
	if len(found) == 0 {
		return nil
	}
	seen := make(map[string]struct{}, len(found))
	out := make([]string, 0, len(found))
	for _, key := range found {
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}
		out = append(out, key)
	}
	return out
}
