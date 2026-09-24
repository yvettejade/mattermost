// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

func (p *Plugin) uploadDraft(channelID, body string) (string, error) {
	if strings.TrimSpace(body) == "" {
		return "", fmt.Errorf("empty draft")
	}
	filename := draftFilename(time.Now())
	info, appErr := p.API.UploadFile([]byte(body), channelID, filename)
	if appErr != nil {
		return "", appErr
	}
	return info.Id, nil
}

func canvasMarkdown(query, reply string, ctx workspaceContext) string {
	var b strings.Builder
	b.WriteString("# Canvas\n\n")
	if query != "" {
		fmt.Fprintf(&b, "**Request:** %s\n\n", strings.TrimSpace(query))
	}
	if ctx.ChannelName != "" {
		fmt.Fprintf(&b, "**Channel:** %s\n\n", ctx.ChannelName)
	}
	if strings.TrimSpace(reply) != "" {
		b.WriteString(strings.TrimSpace(reply))
		b.WriteString("\n")
	} else {
		b.WriteString("## Overview\n\n")
		b.WriteString(localHistoryRecap(IntentCanvas, ctx))
		b.WriteString("\n")
	}
	if cites := citePermalinks(ctx, 5); cites != "" {
		b.WriteString("\n")
		b.WriteString(cites)
		b.WriteString("\n")
	}
	return b.String()
}

func scheduleProposal(query, reply string, ctx workspaceContext) string {
	var b strings.Builder
	b.WriteString("**Meeting proposal**\n\n")
	if strings.TrimSpace(reply) != "" {
		b.WriteString(strings.TrimSpace(reply))
		b.WriteString("\n")
	} else {
		title := strings.TrimSpace(query)
		if title == "" {
			title = "Working session"
		}
		fmt.Fprintf(&b, "- **Title:** %s\n", title)
		b.WriteString("- **When:** (pick a time)\n")
		b.WriteString("- **Attendees:** people in this thread\n")
		b.WriteString("- **Agenda:** review recent discussion\n")
		if recap := localHistoryRecap(IntentSchedule, ctx); recap != "" {
			b.WriteString("\n")
			b.WriteString(recap)
			b.WriteString("\n")
		}
	}
	return b.String()
}

func routeHandoff(query, reply string) string {
	routed := routeSpecialist(query)
	var b strings.Builder
	fmt.Fprintf(&b, "**Handoff** to the **%s** specialist → %s\n\n", routed, firstAction(routed))
	if strings.TrimSpace(reply) != "" && !strings.Contains(strings.ToLower(reply), "routing to") {
		b.WriteString(strings.TrimSpace(reply))
		b.WriteString("\n")
	}
	return b.String()
}

func (p *Plugin) githubContext() string {
	cfg := p.getConfiguration()
	repo := cfg.githubRepo()
	if strings.TrimSpace(cfg.GitHubToken) == "" {
		return "GitHub: " + repo
	}
	apiURL := githubAPIURL(repo)
	if apiURL == "" {
		return "GitHub: " + repo
	}
	body, err := p.httpGet(apiURL, "Bearer "+cfg.GitHubToken, "")
	if err != nil {
		return "GitHub: " + repo
	}
	var parsed struct {
		FullName    string `json:"full_name"`
		Description string `json:"description"`
		HTMLURL     string `json:"html_url"`
		DefaultBr   string `json:"default_branch"`
	}
	if err := json.Unmarshal(body, &parsed); err != nil || parsed.FullName == "" {
		return "GitHub: " + repo
	}
	desc := parsed.Description
	if desc == "" {
		desc = "no description"
	}
	return fmt.Sprintf("GitHub: [%s](%s) — %s (default branch `%s`)", parsed.FullName, parsed.HTMLURL, desc, parsed.DefaultBr)
}

func githubAPIURL(repoURL string) string {
	repoURL = strings.TrimSpace(strings.TrimSuffix(repoURL, ".git"))
	repoURL = strings.TrimRight(repoURL, "/")
	const prefix = "https://github.com/"
	if !strings.HasPrefix(repoURL, prefix) {
		return ""
	}
	path := strings.TrimPrefix(repoURL, prefix)
	parts := strings.Split(path, "/")
	if len(parts) < 2 || parts[0] == "" || parts[1] == "" {
		return ""
	}
	return "https://api.github.com/repos/" + parts[0] + "/" + parts[1]
}

func (p *Plugin) jiraContext() string {
	cfg := p.getConfiguration()
	jiraURL := cfg.jiraURL()
	if strings.TrimSpace(cfg.JiraToken) == "" {
		return "Jira: " + jiraURL
	}
	base := jiraBaseURL(jiraURL)
	if base == "" {
		return "Jira: " + jiraURL
	}
	authUser := strings.TrimSpace(cfg.JiraEmail)
	searchURL := base + "/rest/api/2/search?jql=project%3DYJIRA%20ORDER%20BY%20updated%20DESC&maxResults=5&fields=summary,status,key"
	body, err := p.httpGet(searchURL, "", basicAuth(authUser, cfg.JiraToken))
	if err != nil {
		return "Jira: " + jiraURL
	}
	var parsed struct {
		Issues []struct {
			Key    string `json:"key"`
			Fields struct {
				Summary string `json:"summary"`
				Status  struct {
					Name string `json:"name"`
				} `json:"status"`
			} `json:"fields"`
		} `json:"issues"`
	}
	if err := json.Unmarshal(body, &parsed); err != nil || len(parsed.Issues) == 0 {
		return "Jira: " + jiraURL
	}
	var b strings.Builder
	fmt.Fprintf(&b, "Jira: %s\n", jiraURL)
	for _, issue := range parsed.Issues {
		fmt.Fprintf(&b, "- %s — %s (%s)\n", issue.Key, issue.Fields.Summary, issue.Fields.Status.Name)
	}
	return strings.TrimRight(b.String(), "\n")
}

func jiraBaseURL(projectURL string) string {
	projectURL = strings.TrimSpace(projectURL)
	idx := strings.Index(projectURL, "/jira/")
	if idx <= 0 {
		if strings.HasPrefix(projectURL, "https://") {
			u := strings.TrimRight(projectURL, "/")
			if i := strings.Index(u[len("https://"):], "/"); i > 0 {
				return u[:len("https://")+i]
			}
			return u
		}
		return ""
	}
	return projectURL[:idx]
}

func basicAuth(user, token string) string {
	if user == "" {
		return token
	}
	return user + ":" + token
}

func (p *Plugin) httpGet(url, bearer, basic string) ([]byte, error) {
	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	if bearer != "" {
		req.Header.Set("Authorization", bearer)
	}
	if basic != "" {
		parts := strings.SplitN(basic, ":", 2)
		if len(parts) == 2 {
			req.SetBasicAuth(parts[0], parts[1])
		}
	}
	req.Header.Set("Accept", "application/json")
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("status %d", resp.StatusCode)
	}
	return io.ReadAll(io.LimitReader(resp.Body, 1<<20))
}

type routeWebhookPayload struct {
	Specialist string `json:"specialist"`
	Action     string `json:"action"`
	Query      string `json:"query"`
	ChannelID  string `json:"channel_id"`
	UserID     string `json:"user_id"`
	Reply      string `json:"reply"`
}

func (p *Plugin) postRouteWebhook(req queryRequest, query, reply string) {
	routed := routeSpecialist(query)
	payload, err := json.Marshal(routeWebhookPayload{
		Specialist: string(routed),
		Action:     firstAction(routed),
		Query:      query,
		ChannelID:  req.ChannelID,
		UserID:     req.UserID,
		Reply:      reply,
	})
	if err != nil {
		return
	}
	if p.API != nil {
		_ = p.API.KVSet("last_route", payload)
	}
	cfg := p.getConfiguration()
	url := strings.TrimSpace(cfg.RouteWebhookURL)
	if url == "" {
		return
	}
	httpReq, err := http.NewRequest(http.MethodPost, url, bytes.NewReader(payload))
	if err != nil {
		return
	}
	httpReq.Header.Set("Content-Type", "application/json")
	client := &http.Client{Timeout: 8 * time.Second}
	resp, err := client.Do(httpReq)
	if err != nil {
		p.API.LogWarn("Route webhook failed")
		return
	}
	resp.Body.Close()
}
