// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestCanvasMarkdown(t *testing.T) {
	got := canvasMarkdown("launch plan", "## Timeline\n- ship Friday", workspaceContext{
		ChannelName: "demo",
		Posts:       []contextPost{{Permalink: "https://mm.example/t/pl/1"}},
	})
	assert.Contains(t, got, "# Canvas")
	assert.Contains(t, got, "launch plan")
	assert.Contains(t, got, "Timeline")
	assert.Contains(t, got, "/pl/1")
}

func TestScheduleProposalAndSubmission(t *testing.T) {
	proposal := scheduleProposal("design review", "", workspaceContext{})
	assert.Contains(t, proposal, "Meeting proposal")
	assert.Contains(t, proposal, "design review")

	formatted := formatScheduleSubmission("Standup", "Thu 2pm", "@sam", "recap launch")
	assert.Contains(t, formatted, "**Title:** Standup")
	assert.Contains(t, formatted, "**When:** Thu 2pm")
	assert.Contains(t, formatted, "**Attendees:** @sam")
	assert.Contains(t, formatted, "**Agenda:** recap launch")
}

func TestRouteHandoff(t *testing.T) {
	got := routeHandoff("route this to draft a doc", "I'll write the doc")
	assert.Contains(t, got, "**Handoff**")
	assert.Contains(t, got, "draft")
	assert.Contains(t, got, "I'll write the doc")
}

func TestGitHubAPIURL(t *testing.T) {
	assert.Equal(t, "https://api.github.com/repos/yvettejade/mattermost", githubAPIURL("https://github.com/yvettejade/mattermost"))
	assert.Equal(t, "https://api.github.com/repos/yvettejade/mattermost", githubAPIURL("https://github.com/yvettejade/mattermost.git"))
	assert.Equal(t, "", githubAPIURL("https://example.com/repo"))
}

func TestJiraBaseURL(t *testing.T) {
	assert.Equal(t, "https://fe-anysphere-demo.atlassian.net", jiraBaseURL(defaultJiraURL))
	assert.Equal(t, "https://example.atlassian.net", jiraBaseURL("https://example.atlassian.net/browse/ABC-1"))
}

func TestSubmissionString(t *testing.T) {
	assert.Equal(t, "", submissionString(nil, "title"))
	assert.Equal(t, "Standup", submissionString(map[string]any{"title": " Standup "}, "title"))
}

func TestConfigurationDefaults(t *testing.T) {
	cfg := &configuration{}
	assert.Equal(t, defaultGitHub, cfg.githubRepo())
	assert.Equal(t, defaultJiraURL, cfg.jiraURL())

	cfg.GitHubRepo = " https://github.com/acme/app "
	cfg.JiraURL = " https://jira.example/YJIRA "
	assert.Equal(t, "https://github.com/acme/app", cfg.githubRepo())
	assert.Equal(t, "https://jira.example/YJIRA", cfg.jiraURL())
}
