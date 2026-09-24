// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

const grokSpecialistSeparator = " → "

// grokChatClientForTest overrides the env-backed Grok client in unit tests.
var grokChatClientForTest GrokChatClient

type grokContextPost struct {
	Username string
	Message  string
	CreateAt int64
}

type grokWorkspaceContext struct {
	ChannelName string
	TeamName    string
	IsThread    bool
	Posts       []grokContextPost
}

func (a *App) getGrokChatClient() GrokChatClient {
	if grokChatClientForTest != nil {
		return grokChatClientForTest
	}
	return newGrokHTTPClientFromEnv()
}

func grokSystemPrompt(intent model.GrokIntent) string {
	var b strings.Builder
	b.WriteString("You are Grok, a Slackbot-class workspace agent inside Mattermost. ")
	b.WriteString("Answer from the provided Mattermost history. Do not invent facts, owners, or decisions that are not in the context. ")
	b.WriteString("Mention people with @username when the history includes their username. ")
	b.WriteString("When GitHub or Jira is relevant, cite these integrations:\n")
	b.WriteString("- GitHub: " + model.GrokDefaultGitHubRepo + "\n")
	b.WriteString("- Jira: " + model.GrokDefaultJiraURL + "\n")
	b.WriteString("You can take these actions: summarize or catch users up on threads, draft documents, propose meetings, build canvases, surface GitHub or Jira context, and route work to a specialist.\n")

	switch intent {
	case model.GrokIntentSummarize, model.GrokIntentCatchUp:
		b.WriteString("Return a concise recap with Highlights and Action items. Ground every bullet in the conversation.")
	case model.GrokIntentDraft:
		b.WriteString("Return a ready-to-share document draft with a title, summary, and next steps.")
	case model.GrokIntentSchedule:
		b.WriteString("Return a meeting proposal: title, suggested time window, attendees (@username), and agenda.")
	case model.GrokIntentCanvas:
		b.WriteString("Return a canvas as Markdown sections the team can paste into a Mattermost canvas.")
	case model.GrokIntentGitHub:
		b.WriteString("Surface repo context from the conversation and the configured GitHub repository. Do not claim PR or issue state you cannot see.")
	case model.GrokIntentJira:
		b.WriteString("Surface Jira ticket context from the conversation and the configured YJIRA project. Do not invent ticket status.")
	case model.GrokIntentRoute:
		b.WriteString("Name the specialist (summarize, draft, schedule, canvas, github, jira) and the first action they should take.")
	}

	return b.String()
}

func buildGrokWorkspaceContextText(ctx grokWorkspaceContext) string {
	var b strings.Builder
	scope := "channel"
	if ctx.IsThread {
		scope = "thread"
	}
	fmt.Fprintf(&b, "Scope: %s\n", scope)
	if ctx.TeamName != "" {
		fmt.Fprintf(&b, "Team: %s\n", ctx.TeamName)
	}
	if ctx.ChannelName != "" {
		fmt.Fprintf(&b, "Channel: %s\n", ctx.ChannelName)
	}
	b.WriteString("Conversation:\n")
	if len(ctx.Posts) == 0 {
		b.WriteString("(no recent messages)\n")
		return b.String()
	}
	for _, post := range ctx.Posts {
		username := post.Username
		if username == "" {
			username = "unknown"
		}
		timestamp := time.UnixMilli(post.CreateAt).UTC().Format("2006-01-02 15:04")
		fmt.Fprintf(&b, "[%s] @%s: %s\n", timestamp, username, post.Message)
	}
	return b.String()
}

func localGrokFallback(intent model.GrokIntent, query string, ctx grokWorkspaceContext) string {
	var b strings.Builder
	switch intent {
	case model.GrokIntentHelp:
		b.WriteString("I'm Grok, the workspace agent. Ask a question or try:\n")
		b.WriteString("- `/grok summarize` — recap this channel or thread\n")
		b.WriteString("- `/grok catch up` — what you missed\n")
		b.WriteString("- `/grok draft …` — draft a document\n")
		b.WriteString("- `/grok schedule …` — propose a meeting\n")
		b.WriteString("- `/grok canvas …` — build a canvas\n")
		b.WriteString("- `/grok github` / `/grok jira` — surface repo or ticket context\n")
		b.WriteString("- `/grok route …` — hand off to a specialist\n")
		b.WriteString("You can also mention `@grok` or DM me. Answers are grounded in Mattermost history.")
		return b.String()
	case model.GrokIntentGitHub:
		fmt.Fprintf(&b, "GitHub integration: %s\n", model.GrokDefaultGitHubRepo)
		b.WriteString("I can tie chat questions to that repository. Set `YvetteGrokAPI` for Grok Chat to reason over the latest history.")
		return b.String()
	case model.GrokIntentJira:
		fmt.Fprintf(&b, "Jira integration: %s\n", model.GrokDefaultJiraURL)
		b.WriteString("I can tie chat questions to the YJIRA project. Set `YvetteGrokAPI` for Grok Chat to reason over the latest history.")
		return b.String()
	case model.GrokIntentRoute:
		routed := routeGrokSpecialist(query)
		fmt.Fprintf(&b, "Routing to the **%s** specialist%s%s.", routed, grokSpecialistSeparator, firstGrokAction(routed))
		return b.String()
	}

	if len(ctx.Posts) == 0 {
		return "I don't have recent channel history to work from. Ask in a channel with messages, or set `YvetteGrokAPI` so I can still answer general questions."
	}

	b.WriteString(localHistoryRecap(intent, ctx))
	if !model.GrokAPIConfigured() && grokChatClientForTest == nil {
		b.WriteString("\n\n_Grok Chat is not configured. Set the `YvetteGrokAPI` secret for LLM-backed answers._")
	}
	return b.String()
}

func routeGrokSpecialist(query string) model.GrokIntent {
	intent := model.ParseGrokIntent(query)
	if intent == model.GrokIntentRoute || intent == model.GrokIntentHelp {
		return model.GrokIntentAsk
	}
	return intent
}

func firstGrokAction(intent model.GrokIntent) string {
	switch intent {
	case model.GrokIntentSummarize, model.GrokIntentCatchUp:
		return "summarize recent history"
	case model.GrokIntentDraft:
		return "draft a document"
	case model.GrokIntentSchedule:
		return "propose a meeting"
	case model.GrokIntentCanvas:
		return "build a canvas"
	case model.GrokIntentGitHub:
		return "look up the GitHub repo"
	case model.GrokIntentJira:
		return "look up the YJIRA project"
	default:
		return "answer from workspace history"
	}
}

func localHistoryRecap(intent model.GrokIntent, ctx grokWorkspaceContext) string {
	title := "Highlights"
	switch intent {
	case model.GrokIntentCatchUp:
		title = "Catch up"
	case model.GrokIntentDraft:
		title = "Draft from recent discussion"
	case model.GrokIntentSchedule:
		title = "Meeting proposal from recent discussion"
	case model.GrokIntentCanvas:
		title = "Canvas from recent discussion"
	}

	var b strings.Builder
	fmt.Fprintf(&b, "**%s**", title)
	if ctx.ChannelName != "" {
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
		fmt.Fprintf(&b, "- @%s: %s\n", username, truncateGrokSnippet(post.Message, 160))
	}
	return strings.TrimRight(b.String(), "\n")
}

func truncateGrokSnippet(message string, limit int) string {
	message = strings.TrimSpace(strings.ReplaceAll(message, "\n", " "))
	if len(message) <= limit {
		return message
	}
	return strings.TrimSpace(message[:limit]) + "…"
}

func shouldSkipGrokPost(post *model.Post) bool {
	if post == nil || post.Message == "" {
		return true
	}
	if post.GetProp(model.PostPropsFromGrokAgent) != nil {
		return true
	}
	if post.Type != "" && post.Type != model.PostTypeDefault {
		return true
	}
	return false
}

func postLooksLikeGrokMention(message string) bool {
	return strings.Contains(strings.ToLower(message), "@"+model.GrokAgentUsername)
}

func (a *App) loadGrokWorkspaceContext(rctx request.CTX, channel *model.Channel, team *model.Team, rootID string) grokWorkspaceContext {
	ctx := grokWorkspaceContext{
		IsThread: rootID != "",
	}
	if channel != nil {
		ctx.ChannelName = channel.DisplayName
		if ctx.ChannelName == "" {
			ctx.ChannelName = channel.Name
		}
	}
	if team != nil {
		ctx.TeamName = team.DisplayName
		if ctx.TeamName == "" {
			ctx.TeamName = team.Name
		}
	}

	var postList *model.PostList
	var appErr *model.AppError
	if rootID != "" {
		postList, appErr = a.GetPostThread(rctx, rootID, model.GetPostsOptions{}, "")
	} else if channel != nil {
		postList, appErr = a.GetPosts(rctx, channel.Id, 0, model.GrokContextPostLimit)
	}
	if appErr != nil || postList == nil {
		return ctx
	}

	order := postList.Order
	if len(order) > model.GrokContextPostLimit {
		order = order[:model.GrokContextPostLimit]
	}

	// GetPosts returns newest-first order; present oldest-first to the model.
	for i := len(order) - 1; i >= 0; i-- {
		post := postList.Posts[order[i]]
		if post == nil || post.DeleteAt != 0 || post.Message == "" {
			continue
		}
		if post.GetProp(model.PostPropsFromGrokAgent) != nil {
			continue
		}
		username := ""
		if user, err := a.GetUser(post.UserId); err == nil && user != nil {
			username = user.Username
		}
		ctx.Posts = append(ctx.Posts, grokContextPost{
			Username: username,
			Message:  post.Message,
			CreateAt: post.CreateAt,
		})
	}

	return ctx
}

func (a *App) generateGrokReply(rctx request.CTX, intent model.GrokIntent, query string, workspace grokWorkspaceContext) (string, *model.AppError) {
	if intent == model.GrokIntentHelp {
		return localGrokFallback(intent, query, workspace), nil
	}

	client := a.getGrokChatClient()
	if client == nil {
		return localGrokFallback(intent, query, workspace), nil
	}

	userPrompt := query
	if userPrompt == "" {
		userPrompt = string(intent)
	}
	messages := []GrokChatMessage{
		{Role: "system", Content: grokSystemPrompt(intent)},
		{Role: "user", Content: buildGrokWorkspaceContextText(workspace) + "\nUser request:\n" + userPrompt},
	}

	completion, err := client.Complete(rctx.Context(), messages)
	if err != nil {
		rctx.Logger().Warn("Grok Chat completion failed, using local fallback", mlog.Err(err))
		fallback := localGrokFallback(intent, query, workspace)
		return fallback + "\n\n_Grok Chat request failed; showing a history-only fallback._", nil
	}

	return strings.TrimSpace(completion), nil
}

func (a *App) ensureGrokBot(rctx request.CTX) (*model.User, *model.AppError) {
	if user, appErr := a.GetUserByUsername(model.GrokAgentUsername); appErr == nil && user != nil {
		return user, nil
	}

	bot := &model.Bot{
		Username:    model.GrokAgentUsername,
		DisplayName: model.GrokAgentDisplayName,
		Description: model.GrokAgentDescription,
		OwnerId:     model.GrokAgentOwnerID,
	}
	botID, err := a.EnsureBot(rctx, model.GrokAgentBotPluginID, bot)
	if err != nil {
		return nil, model.NewAppError("ensureGrokBot", "app.grok_agent.ensure_bot.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	user, appErr := a.GetUser(botID)
	if appErr != nil {
		return nil, appErr
	}
	return user, nil
}

func (a *App) addGrokBotToChannel(rctx request.CTX, botUser *model.User, channel *model.Channel) {
	if botUser == nil || channel == nil {
		return
	}
	if channel.IsGroupOrDirect() {
		return
	}
	if channel.TeamId != "" {
		if _, err := a.GetTeamMember(rctx, channel.TeamId, botUser.Id); err != nil {
			if appErr := a.AddUserToTeamByTeamId(rctx, channel.TeamId, botUser); appErr != nil {
				rctx.Logger().Warn("Failed to add Grok bot to team", mlog.String("team_id", channel.TeamId), mlog.Err(appErr))
			}
		}
	}
	if _, err := a.GetChannelMember(rctx, channel.Id, botUser.Id); err != nil {
		if _, appErr := a.AddUserToChannel(rctx, botUser, channel, false); appErr != nil {
			rctx.Logger().Warn("Failed to add Grok bot to channel", mlog.String("channel_id", channel.Id), mlog.Err(appErr))
		}
	}
}

func (a *App) postGrokReply(rctx request.CTX, botUser *model.User, channelID, rootID, requesterID, reply string) (*model.Post, *model.AppError) {
	post := &model.Post{
		ChannelId: channelID,
		RootId:    rootID,
		UserId:    botUser.Id,
		Message:   reply,
	}
	post.AddProp(model.PostPropsFromGrokAgent, "true")
	post.AddProp(model.PostPropsFromBot, "true")
	if requesterID != "" {
		post.AddProp("grok_query_user_id", requesterID)
	}

	created, _, appErr := a.CreatePostMissingChannel(rctx, post, true, false)
	if appErr != nil {
		return nil, appErr
	}
	return created, nil
}

// HandleGrokQuery answers a slash-command or mention using workspace history and Grok Chat.
func (a *App) HandleGrokQuery(rctx request.CTX, userID, channelID, rootID, teamID, message string) (*model.Post, *model.AppError) {
	query := model.StripGrokMention(message)
	intent := model.ParseGrokIntent(query)

	channel, appErr := a.GetChannel(rctx, channelID)
	if appErr != nil {
		return nil, appErr
	}

	var team *model.Team
	if teamID != "" {
		team, _ = a.GetTeam(teamID)
	} else if channel.TeamId != "" {
		team, _ = a.GetTeam(channel.TeamId)
	}

	workspace := a.loadGrokWorkspaceContext(rctx, channel, team, rootID)
	reply, appErr := a.generateGrokReply(rctx, intent, query, workspace)
	if appErr != nil {
		return nil, appErr
	}

	botUser, appErr := a.ensureGrokBot(rctx)
	if appErr != nil {
		return nil, appErr
	}
	a.addGrokBotToChannel(rctx, botUser, channel)

	return a.postGrokReply(rctx, botUser, channelID, rootID, userID, reply)
}

// MaybeHandleGrokMention replies when a user @mentions grok or DMs the bot.
func (a *App) MaybeHandleGrokMention(rctx request.CTX, post *model.Post, channel *model.Channel, user *model.User) {
	if shouldSkipGrokPost(post) {
		return
	}
	if user != nil && user.IsBot {
		return
	}

	botUser, lookupErr := a.GetUserByUsername(model.GrokAgentUsername)
	mentioned := postLooksLikeGrokMention(post.Message)
	dmWithBot := false
	if channel != nil && channel.Type == model.ChannelTypeDirect && botUser != nil {
		dmWithBot = strings.Contains(channel.Name, botUser.Id)
	}

	if !mentioned && !dmWithBot {
		return
	}
	if botUser != nil && post.UserId == botUser.Id {
		return
	}

	if lookupErr != nil && !mentioned {
		return
	}

	_, appErr := a.HandleGrokQuery(rctx, post.UserId, post.ChannelId, post.RootId, "", post.Message)
	if appErr != nil {
		rctx.Logger().Warn("Grok agent failed to handle mention",
			mlog.String("post_id", post.Id),
			mlog.String("user_id", post.UserId),
			mlog.Err(appErr),
		)
	}
}
