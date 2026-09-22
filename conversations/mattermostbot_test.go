// Copyright (c) 2023-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package conversations

import (
	"strings"
	"testing"

	"github.com/mattermost/mattermost-plugin-ai/bots"
	"github.com/mattermost/mattermost-plugin-ai/grounding"
	"github.com/mattermost/mattermost-plugin-ai/llm"
	"github.com/mattermost/mattermost-plugin-ai/mmapi"
	"github.com/mattermost/mattermost-plugin-ai/prompts"
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/require"
)

const (
	askingUser = "user0000000000000000000001"
	botUser    = "botuser0000000000000000001"
	sourcePost = "abc123def456ghij789klmno01"
)

type captureLLM struct {
	calls    int
	answer   string
	system   string
	fail     error
	toolsOff bool
}

func (c *captureLLM) ChatCompletion(req llm.CompletionRequest, opts ...llm.LanguageModelOption) (*llm.TextStreamResult, error) {
	c.calls++
	cfg := llm.LanguageModelConfig{}
	for _, opt := range opts {
		opt(&cfg)
	}
	c.toolsOff = cfg.ToolsDisabled
	if len(req.Posts) > 0 {
		c.system = req.Posts[0].Message
	}
	if c.fail != nil {
		return nil, c.fail
	}
	return llm.NewStreamFromString(c.answer), nil
}

func (c *captureLLM) ChatCompletionNoStream(llm.CompletionRequest, ...llm.LanguageModelOption) (string, error) {
	return "", c.fail
}

func (c *captureLLM) CountTokens(string) int { return 1 }

func (c *captureLLM) InputTokenLimit() int { return 1000 }

type quietClient struct{ mmapi.Client }

func (quietClient) LogWarn(string, ...interface{})  {}
func (quietClient) LogError(string, ...interface{}) {}
func (quietClient) LogDebug(string, ...interface{}) {}

func mattermostBot(lm llm.LanguageModel) *bots.Bot {
	return bots.NewBot(
		bots.MattermostBotConfig(),
		bots.GrokServiceConfig(),
		&model.Bot{UserId: botUser, Username: bots.MattermostBotUsername},
		lm,
	)
}

func testConv(t *testing.T, search grounding.PostSearcher, mm mmapi.Client) *Conversations {
	t.Helper()
	loaded, err := llm.NewPrompts(prompts.PromptsFolder)
	require.NoError(t, err)
	if mm == nil {
		mm = quietClient{}
	}
	conv := New(loaded, mm, nil, nil, nil, nil, nil, nil, nil, nil)
	// PostToAIPost asks whether the author is a bot. An empty registry is enough.
	conv.bots = &bots.MMBots{}
	conv.SetGrounding(grounding.New(search, mm))
	return conv
}

func groundedContext() *llm.Context {
	ctx := llm.NewContext()
	ctx.SiteURL = "https://chat.example.com"
	ctx.BotName = bots.MattermostBotDisplayName
	ctx.BotUsername = bots.MattermostBotUsername
	return ctx
}

func ask(message string) (*model.User, *model.Channel, *model.Post) {
	user := &model.User{Id: askingUser, Username: "ada"}
	channel := &model.Channel{Id: "channel0000000000000000001", Type: model.ChannelTypeOpen, Name: "town-square"}
	post := &model.Post{Id: "question000000000000000001", UserId: askingUser, ChannelId: channel.Id, Message: message}
	return user, channel, post
}

func TestMattermostBotRefusesWhenNothingMatches(t *testing.T) {
	captured := &captureLLM{answer: "The migration is on Friday."}
	searcher := &recordingSearch{results: &model.PostSearchResults{PostList: model.NewPostList()}}
	conv := testConv(t, searcher, allowMM{allow: askingUser})
	user, channel, post := ask("when is the database migration")

	stream, err := conv.ProcessUserRequestWithContext(mattermostBot(captured), user, channel, post, groundedContext(), true)
	require.NoError(t, err)
	answer, err := stream.ReadAll()
	require.NoError(t, err)
	require.Equal(t, grounding.RefusalMessage, answer)
	require.Zero(t, captured.calls)
	require.Equal(t, askingUser, searcher.userID)
}

func TestMattermostBotKeepsCitedAnswerAndRefusesUncited(t *testing.T) {
	permalink := "https://chat.example.com/engineering/pl/" + sourcePost + "?view=citation"
	hit := &model.Post{Id: sourcePost, UserId: "someone", ChannelId: "channel0000000000000000001", Message: "The database migration is Friday"}
	searcher := &recordingSearch{results: &model.PostSearchResults{PostList: onePost(hit)}}
	mm := allowMM{allow: askingUser, siteURL: "https://chat.example.com"}

	cited := "The database migration is Friday. [permalink](" + permalink + ")"
	captured := &captureLLM{answer: cited}
	conv := testConv(t, searcher, mm)
	user, channel, post := ask("when is the database migration")
	stream, err := conv.ProcessUserRequestWithContext(mattermostBot(captured), user, channel, post, groundedContext(), true)
	require.NoError(t, err)
	answer, err := stream.ReadAll()
	require.NoError(t, err)
	require.Equal(t, cited, answer)
	require.Equal(t, 1, captured.calls)
	require.True(t, captured.toolsOff)
	require.Contains(t, captured.system, sourcePost)
	require.Contains(t, captured.system, permalink)
	require.Contains(t, captured.system, grounding.RefusalMessage)
	require.NotContains(t, captured.system, "WebSearch")
	require.Equal(t, askingUser, searcher.userID)
	require.NotEqual(t, botUser, searcher.userID)

	captured.answer = "The database migration is Friday."
	captured.calls = 0
	stream, err = conv.ProcessUserRequestWithContext(mattermostBot(captured), user, channel, post, groundedContext(), true)
	require.NoError(t, err)
	answer, err = stream.ReadAll()
	require.NoError(t, err)
	require.Equal(t, grounding.RefusalMessage, answer)
}

func TestMattermostBotDoesNotFakeGrokWhenKeyMissing(t *testing.T) {
	hit := &model.Post{Id: sourcePost, UserId: "someone", ChannelId: "channel0000000000000000001", Message: "The database migration is Friday"}
	searcher := &recordingSearch{results: &model.PostSearchResults{PostList: onePost(hit)}}
	conv := testConv(t, searcher, allowMM{allow: askingUser, siteURL: "https://chat.example.com"})
	user, channel, post := ask("when is the database migration")

	stream, err := conv.ProcessUserRequestWithContext(mattermostBot(bots.NewKeyUnsetModel()), user, channel, post, groundedContext(), true)
	require.Nil(t, stream)
	require.Error(t, err)
	require.Contains(t, err.Error(), "YvetteGrokAPI is unset")
}

func TestChannelToolsStayOffForMattermostBot(t *testing.T) {
	bot := mattermostBot(nil)
	user := &model.User{Id: askingUser}
	post := &model.Post{Message: "hello"}
	require.False(t, channelToolsAllowed(bot, true, post, user))

	other := bots.NewBot(llm.BotConfig{Name: "other"}, llm.ServiceConfig{}, &model.Bot{}, nil)
	require.True(t, channelToolsAllowed(other, true, post, user))
	require.False(t, channelToolsAllowed(other, false, post, user))
}

type recordingSearch struct {
	userID  string
	results *model.PostSearchResults
}

func (r *recordingSearch) SearchPostsInTeamForUser(_, userID string, _ model.SearchParameter) (*model.PostSearchResults, *model.AppError) {
	r.userID = userID
	return r.results, nil
}

type allowMM struct {
	mmapi.Client
	allow   string
	siteURL string
}

func (m allowMM) HasPermissionToChannel(userID, _ string, _ *model.Permission) bool {
	return userID == m.allow
}

func (m allowMM) GetConfig() *model.Config {
	url := m.siteURL
	if url == "" {
		url = "https://chat.example.com"
	}
	return &model.Config{ServiceSettings: model.ServiceSettings{SiteURL: &url}}
}

func (m allowMM) GetChannel(id string) (*model.Channel, error) {
	return &model.Channel{Id: id, DisplayName: "Town Square", Type: model.ChannelTypeOpen, TeamId: "team0000000000000000000001", Name: "town-square"}, nil
}

func (m allowMM) GetTeam(string) (*model.Team, error) {
	return &model.Team{Id: "team0000000000000000000001", Name: "engineering"}, nil
}

func (m allowMM) GetUser(id string) (*model.User, error) {
	return &model.User{Id: id, Username: "alice"}, nil
}

func (m allowMM) LogWarn(string, ...interface{}) {}

func onePost(post *model.Post) *model.PostList {
	list := model.NewPostList()
	list.AddPost(post)
	list.AddOrder(post.Id)
	return list
}

func TestPromptDoesNotMentionWebSearch(t *testing.T) {
	loaded, err := llm.NewPrompts(prompts.PromptsFolder)
	require.NoError(t, err)
	ctx := llm.NewContext()
	ctx.SiteURL = "https://chat.example.com"
	ctx.BotName = "MattermostBot"
	ctx.BotUsername = "mattermostbot"
	ctx.Parameters = map[string]interface{}{
		"Results": []grounding.Source{{
			Index:       1,
			PostID:      sourcePost,
			TeamName:    "engineering",
			Username:    "alice",
			ChannelName: "Town Square",
			Content:     "Ship Friday",
		}},
	}
	message, err := loaded.Format(prompts.PromptMattermostBotSystem, ctx)
	require.NoError(t, err)
	require.Contains(t, message, sourcePost)
	require.Contains(t, message, "https://chat.example.com/engineering/pl/"+sourcePost+"?view=citation")
	require.Contains(t, message, grounding.RefusalMessage)
	require.False(t, strings.Contains(message, "WebSearch"))
}
