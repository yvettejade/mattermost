// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
)

func systemPrompt(intent Intent, cfg *configuration) string {
	var b strings.Builder
	b.WriteString("You are Yvette Grok, a Slackbot-class workspace agent inside Mattermost. ")
	b.WriteString("Answer from the provided Mattermost history. Do not invent facts, owners, or decisions that are not in the context. ")
	b.WriteString("Mention people with @username when the history includes their username. ")
	b.WriteString("Cite permalinks from the conversation when you reference a specific post.\n")
	b.WriteString("When GitHub or Jira is relevant, cite these integrations:\n")
	b.WriteString("- GitHub: " + cfg.githubRepo() + "\n")
	b.WriteString("- Jira: " + cfg.jiraURL() + "\n")
	b.WriteString("You can take these actions: summarize or catch users up on threads and meetings, draft documents, propose meetings, build canvases, surface GitHub or Jira context, search the team, and route work to a specialist.\n")

	switch intent {
	case IntentSummarize, IntentCatchUp, IntentMeeting:
		b.WriteString("Return a concise recap with Highlights and Action items. Ground every bullet in the conversation.")
	case IntentDraft:
		b.WriteString("Return a ready-to-share markdown document with a title, summary, and next steps.")
	case IntentSchedule:
		b.WriteString("Return a meeting proposal: title, suggested time window, attendees (@username), and agenda.")
	case IntentCanvas:
		b.WriteString("Return a canvas as Markdown sections the team can paste into a Mattermost canvas.")
	case IntentGitHub:
		b.WriteString("Surface repo context from the conversation and the configured GitHub repository. Do not claim PR or issue state you cannot see.")
	case IntentJira:
		b.WriteString("Surface Jira ticket context from the conversation and the configured YJIRA project. Do not invent ticket status.")
	case IntentRoute:
		b.WriteString("Name the specialist (summarize, draft, schedule, canvas, github, jira) and the first action they should take.")
	case IntentSearch:
		b.WriteString("Answer from the team search results. Cite permalinks. Do not invent posts that are not listed.")
	}

	return b.String()
}

func localFallback(intent Intent, query string, ctx workspaceContext, cfg *configuration) string {
	var b strings.Builder
	switch intent {
	case IntentHelp:
		b.WriteString("I'm Yvette Grok, the workspace agent. Ask a question or try:\n")
		b.WriteString("- `/yvette summarize` — recap this channel or thread\n")
		b.WriteString("- `/yvette catch up` — what you missed\n")
		b.WriteString("- `/yvette summarize meeting` — recap recent posts in a meeting window\n")
		b.WriteString("- `/yvette draft …` — draft a markdown document\n")
		b.WriteString("- `/yvette schedule …` — propose a meeting\n")
		b.WriteString("- `/yvette canvas …` — build a canvas\n")
		b.WriteString("- `/yvette github` / `/yvette jira` — surface repo or ticket context\n")
		b.WriteString("- `/yvette search …` — search the team\n")
		b.WriteString("- `/yvette route …` — hand off to a specialist\n")
		b.WriteString("You can also mention `@yvette-grok` or DM me. Answers are grounded in Mattermost history.")
		return b.String()
	case IntentGitHub:
		fmt.Fprintf(&b, "GitHub integration: %s\n", cfg.githubRepo())
		b.WriteString("I can tie chat questions to that repository. Set `YvetteGrokAPI` for Grok Chat to reason over the latest history.")
		return b.String()
	case IntentJira:
		fmt.Fprintf(&b, "Jira integration: %s\n", cfg.jiraURL())
		b.WriteString("I can tie chat questions to the YJIRA project. Set `YvetteGrokAPI` for Grok Chat to reason over the latest history.")
		return b.String()
	case IntentRoute:
		routed := routeSpecialist(query)
		fmt.Fprintf(&b, "Routing to the **%s** specialist → %s.", routed, firstAction(routed))
		return b.String()
	}

	if len(ctx.Posts) == 0 {
		return "I don't have recent channel history to work from. Ask in a channel with messages from the last 7 days, or set `YvetteGrokAPI` so I can still answer general questions."
	}

	b.WriteString(localHistoryRecap(intent, ctx))
	if cites := citePermalinks(ctx, 3); cites != "" {
		b.WriteString("\n\n")
		b.WriteString(cites)
	}
	if !grokAPIConfigured() {
		b.WriteString("\n\n_Grok Chat is not configured. Set the `YvetteGrokAPI` secret for LLM-backed answers._")
	}
	return b.String()
}

func localHistoryRecap(intent Intent, ctx workspaceContext) string {
	title := "Highlights"
	switch intent {
	case IntentCatchUp:
		title = "Catch up"
	case IntentMeeting:
		title = "Meeting recap"
	case IntentDraft:
		title = "Draft from recent discussion"
	case IntentSchedule:
		title = "Meeting proposal from recent discussion"
	case IntentCanvas:
		title = "Canvas from recent discussion"
	case IntentSearch:
		title = "Team search"
	}

	var b strings.Builder
	fmt.Fprintf(&b, "**%s**", title)
	if ctx.ChannelName != "" && intent != IntentSearch {
		fmt.Fprintf(&b, " in %s", ctx.ChannelName)
	}
	b.WriteString(":\n")

	limit := 5
	if len(ctx.Posts) < limit {
		limit = len(ctx.Posts)
	}
	start := len(ctx.Posts) - limit
	for _, post := range ctx.Posts[start:] {
		username := post.Username
		if username == "" {
			username = "someone"
		}
		line := fmt.Sprintf("- @%s: %s", username, truncateSnippet(post.Message, 160))
		if post.Permalink != "" {
			line += " — " + post.Permalink
		}
		b.WriteString(line + "\n")
	}
	return strings.TrimRight(b.String(), "\n")
}

func truncateSnippet(message string, limit int) string {
	message = strings.TrimSpace(strings.ReplaceAll(message, "\n", " "))
	if len(message) <= limit {
		return message
	}
	return strings.TrimSpace(message[:limit]) + "…"
}

func shouldSkipPost(post *model.Post) bool {
	if post == nil || post.Message == "" {
		return true
	}
	if post.GetProp(propFromAgent) != nil {
		return true
	}
	if post.Type != "" && post.Type != model.PostTypeDefault {
		return true
	}
	return false
}

func looksLikeMention(message string) bool {
	return strings.Contains(strings.ToLower(message), "@"+botUsername)
}

func (p *Plugin) chatClient() ChatClient {
	if p.clientForTest != nil {
		return p.clientForTest
	}
	apiKey := grokAPIKey()
	if apiKey == "" {
		return nil
	}
	cfg := p.getConfiguration()
	return newGrokHTTPClient(apiKey, cfg.grokModel(), cfg.grokAPIURL())
}

func (p *Plugin) generateReply(ctx context.Context, intent Intent, query string, workspace workspaceContext) string {
	cfg := p.getConfiguration()
	if intent == IntentHelp {
		return localFallback(intent, query, workspace, cfg)
	}

	client := p.chatClient()
	if client == nil {
		return localFallback(intent, query, workspace, cfg)
	}

	userPrompt := query
	if userPrompt == "" {
		userPrompt = string(intent)
	}
	messages := []ChatMessage{
		{Role: "system", Content: systemPrompt(intent, cfg)},
		{Role: "user", Content: buildWorkspaceContextText(workspace) + "\nUser request:\n" + userPrompt},
	}

	completion, err := client.Complete(ctx, messages)
	if err != nil {
		if p.API != nil {
			p.API.LogWarn("Grok Chat completion failed, using local fallback")
		}
		return localFallback(intent, query, workspace, cfg) + "\n\n_Grok Chat request failed; showing a history-only fallback._"
	}

	reply := strings.TrimSpace(completion)
	if cites := citePermalinks(workspace, 3); cites != "" && !strings.Contains(reply, "/pl/") {
		reply += "\n\n" + cites
	}
	return reply
}

func (p *Plugin) ensureBot() (string, error) {
	if p.botUserID != "" {
		return p.botUserID, nil
	}
	botID, err := p.API.EnsureBotUser(&model.Bot{
		Username:    botUsername,
		DisplayName: botDisplay,
		Description: botDesc,
	})
	if err != nil {
		return "", err
	}
	p.botUserID = botID
	return botID, nil
}

func (p *Plugin) addBotToChannel(botUserID string, channel *model.Channel) {
	if channel == nil || channel.IsGroupOrDirect() {
		return
	}
	if channel.TeamId != "" {
		if _, err := p.API.GetTeamMember(channel.TeamId, botUserID); err != nil {
			if _, addErr := p.API.CreateTeamMember(channel.TeamId, botUserID); addErr != nil {
				p.API.LogWarn("Failed to add yvette-grok bot to team")
			}
		}
	}
	if _, err := p.API.GetChannelMember(channel.Id, botUserID); err != nil {
		if _, addErr := p.API.AddChannelMember(channel.Id, botUserID); addErr != nil {
			p.API.LogWarn("Failed to add yvette-grok bot to channel")
		}
	}
}

func (p *Plugin) postReply(botUserID, channelID, rootID, requesterID, reply string, fileIDs []string) (*model.Post, error) {
	post := &model.Post{
		ChannelId: channelID,
		RootId:    rootID,
		UserId:    botUserID,
		Message:   reply,
		FileIds:   fileIDs,
	}
	post.AddProp(propFromAgent, "true")
	post.AddProp("from_bot", "true")
	if requesterID != "" {
		post.AddProp("yvette_grok_query_user_id", requesterID)
	}

	created, appErr := p.API.CreatePost(post)
	if appErr != nil {
		return nil, appErr
	}
	return created, nil
}

type queryRequest struct {
	UserID    string
	ChannelID string
	RootID    string
	TeamID    string
	TriggerID string
	Message   string
}

func (p *Plugin) handleQuery(req queryRequest) (*model.Post, error) {
	query := StripBotMention(req.Message)
	intent := ParseIntent(query)

	channel, appErr := p.API.GetChannel(req.ChannelID)
	if appErr != nil {
		return nil, appErr
	}
	if !p.API.HasPermissionToChannel(req.UserID, req.ChannelID, model.PermissionReadChannel) {
		return nil, fmt.Errorf("no permission to read this channel")
	}

	if intent == IntentSchedule && req.TriggerID != "" {
		if err := p.openScheduleDialog(req); err != nil {
			return nil, err
		}
		return nil, nil
	}

	workspace := p.loadWorkspaceContext(req.UserID, req.ChannelID, req.RootID, req.TeamID, intent, query)
	reply := p.generateReply(context.Background(), intent, query, workspace)

	var fileIDs []string
	switch intent {
	case IntentDraft:
		if id, err := p.uploadDraft(req.ChannelID, reply); err == nil && id != "" {
			fileIDs = []string{id}
			reply = "Drafted a markdown document and attached it to this post.\n\n" + reply
		}
	case IntentCanvas:
		reply = canvasMarkdown(query, reply, workspace)
	case IntentRoute:
		reply = routeHandoff(query, reply)
		p.postRouteWebhook(req, query, reply)
	case IntentGitHub:
		if extra := p.githubContext(); extra != "" {
			reply = extra + "\n\n" + reply
		}
	case IntentJira:
		if extra := p.jiraContext(); extra != "" {
			reply = extra + "\n\n" + reply
		}
	case IntentSchedule:
		reply = scheduleProposal(query, reply, workspace)
	}

	botUserID, err := p.ensureBot()
	if err != nil {
		return nil, err
	}
	p.addBotToChannel(botUserID, channel)

	return p.postReply(botUserID, req.ChannelID, req.RootID, req.UserID, reply, fileIDs)
}

func draftFilename(now time.Time) string {
	return "yvette-draft-" + now.UTC().Format("20060102-1504") + ".md"
}
