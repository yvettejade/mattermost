// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"strings"
)

type Intent string

const (
	IntentAsk       Intent = "ask"
	IntentSummarize Intent = "summarize"
	IntentCatchUp   Intent = "catch_up"
	IntentMeeting   Intent = "meeting"
	IntentDraft     Intent = "draft"
	IntentSchedule  Intent = "schedule"
	IntentCanvas    Intent = "canvas"
	IntentGitHub    Intent = "github"
	IntentJira      Intent = "jira"
	IntentRoute     Intent = "route"
	IntentSearch    Intent = "search"
	IntentHelp      Intent = "help"
)

// ParseIntent maps a user message to a workspace-agent action.
// The first matching keyword wins so "summarize the auth thread" is summarize, not ask.
func ParseIntent(message string) Intent {
	normalized := strings.ToLower(strings.TrimSpace(message))
	normalized = strings.TrimPrefix(normalized, "@"+botUsername)
	normalized = strings.TrimSpace(normalized)

	if normalized == "" || normalized == "help" || normalized == "?" {
		return IntentHelp
	}

	switch {
	case normalized == "route" || strings.HasPrefix(normalized, "route ") || hasKeyword(normalized, "hand off", "handoff"):
		return IntentRoute
	case hasKeyword(normalized, "schedule", "calendar", "book time"):
		return IntentSchedule
	case hasKeyword(normalized, "meeting recap", "meeting notes", "standup recap", "summarize the meeting", "summarize meeting"):
		return IntentMeeting
	case hasKeyword(normalized, "summarize", "summary", "summarise", "tldr", "tl;dr"):
		return IntentSummarize
	case hasKeyword(normalized, "catch up", "catch-up", "catchup", "missed", "what did i miss", "recap"):
		return IntentCatchUp
	case hasKeyword(normalized, "canvas", "whiteboard"):
		return IntentCanvas
	case hasKeyword(normalized, "draft", "write a doc", "document"):
		return IntentDraft
	case hasKeyword(normalized, "github", "repo", "pull request", "pr #"):
		return IntentGitHub
	case hasKeyword(normalized, "jira", "ticket", "yjira-"):
		return IntentJira
	case hasKeyword(normalized, "search team", "search the team") || strings.HasPrefix(normalized, "search "):
		return IntentSearch
	default:
		return IntentAsk
	}
}

func hasKeyword(message string, keywords ...string) bool {
	for _, keyword := range keywords {
		if strings.Contains(message, keyword) {
			return true
		}
	}
	return false
}

// StripBotMention removes a leading @yvette-grok mention so intent parsing sees the request.
func StripBotMention(message string) string {
	trimmed := strings.TrimSpace(message)
	prefix := "@" + botUsername
	if len(trimmed) >= len(prefix) && strings.EqualFold(trimmed[:len(prefix)], prefix) {
		return strings.TrimSpace(trimmed[len(prefix):])
	}
	return trimmed
}

func searchTerms(query string) string {
	trimmed := strings.TrimSpace(query)
	lower := strings.ToLower(trimmed)
	for _, prefix := range []string{"search the team ", "search team ", "search "} {
		if strings.HasPrefix(lower, prefix) {
			return strings.TrimSpace(trimmed[len(prefix):])
		}
	}
	return trimmed
}

func useMeetingWindow(intent Intent, query string) bool {
	if intent == IntentMeeting {
		return true
	}
	q := strings.ToLower(query)
	return (intent == IntentSummarize || intent == IntentCatchUp) && strings.Contains(q, "meeting")
}

func routeSpecialist(query string) Intent {
	stripped := strings.ToLower(strings.TrimSpace(query))
	for _, prefix := range []string{"route this to ", "route to ", "handoff to ", "hand off to ", "route "} {
		if strings.HasPrefix(stripped, prefix) {
			stripped = strings.TrimSpace(stripped[len(prefix):])
			break
		}
	}
	intent := ParseIntent(stripped)
	if intent == IntentRoute || intent == IntentHelp {
		return IntentAsk
	}
	return intent
}

func firstAction(intent Intent) string {
	switch intent {
	case IntentSummarize, IntentCatchUp, IntentMeeting:
		return "summarize recent history"
	case IntentDraft:
		return "draft a document"
	case IntentSchedule:
		return "propose a meeting"
	case IntentCanvas:
		return "build a canvas"
	case IntentGitHub:
		return "look up the GitHub repo"
	case IntentJira:
		return "look up the YJIRA project"
	case IntentSearch:
		return "search the team"
	default:
		return "answer from workspace history"
	}
}
