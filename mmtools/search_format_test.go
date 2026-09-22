// Copyright (c) 2023-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package mmtools

import (
	"errors"
	"net/http"
	"testing"

	"github.com/mattermost/mattermost-plugin-ai/bots"
	"github.com/mattermost/mattermost-plugin-ai/config"
	"github.com/mattermost/mattermost-plugin-ai/embeddings"
	"github.com/mattermost/mattermost-plugin-ai/embeddings/mocks"
	"github.com/mattermost/mattermost-plugin-ai/llm"
	"github.com/mattermost/mattermost-plugin-ai/mmapi"
	"github.com/mattermost/mattermost-plugin-ai/search"
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/require"
)

const citedPostID = "abc123def456ghij789klmno01"

type siteClient struct {
	mmapi.Client
	url string
}

func (s siteClient) GetConfig() *model.Config {
	return &model.Config{ServiceSettings: model.ServiceSettings{SiteURL: &s.url}}
}

func TestFormatSearchResultsIncludesPostIDAndPermalink(t *testing.T) {
	provider := NewMMToolProvider(siteClient{url: "https://chat.example.com"}, nil, nil, nil)
	formatted := provider.formatSearchResults([]search.RAGResult{{
		PostID:      citedPostID,
		TeamName:    "engineering",
		Username:    "alice",
		ChannelName: "Town Square",
		Content:     "Ship Friday",
		Score:       0.91,
	}})

	require.Contains(t, formatted, "PostID: "+citedPostID)
	require.Contains(t, formatted, "Permalink: https://chat.example.com/engineering/pl/"+citedPostID+"?view=citation")
	require.Contains(t, formatted, "Ship Friday")
}

func TestFormatSearchResultsEmpty(t *testing.T) {
	provider := NewMMToolProvider(nil, nil, nil, nil)
	require.Equal(t, "No relevant messages found.", provider.formatSearchResults(nil))
}

func TestMattermostBotToolsExcludeWebAndEmbeddings(t *testing.T) {
	mockEmbedding := mocks.NewMockEmbeddingSearch(t)
	searchService := search.New(func() embeddings.EmbeddingSearch { return mockEmbedding }, nil, nil, nil, nil)
	web := NewWebSearchService(func() *config.Config {
		return &config.Config{
			WebSearch: config.WebSearchConfig{
				Enabled:  true,
				Provider: "google",
				Google: config.WebSearchGoogleConfig{
					APIKey:         "test-google-key",
					SearchEngineID: "test-engine",
				},
			},
		}
	}, &mockLogger{}, http.DefaultClient)

	provider := NewMMToolProvider(toolClient{}, searchService, http.DefaultClient, web)
	mattermostBot := bots.NewBot(bots.MattermostBotConfig(), bots.GrokServiceConfig(), &model.Bot{}, nil)
	for _, tool := range provider.GetTools(mattermostBot) {
		require.NotEqual(t, "WebSearch", tool.Name)
		require.NotEqual(t, "WebSearchFetchSource", tool.Name)
		require.NotEqual(t, "SearchServer", tool.Name)
	}

	other := bots.NewBot(llm.BotConfig{Name: "other"}, llm.ServiceConfig{}, &model.Bot{}, nil)
	names := map[string]bool{}
	for _, tool := range provider.GetTools(other) {
		names[tool.Name] = true
	}
	require.True(t, names["SearchServer"], "other bots still get semantic search when embeddings are enabled")
	require.True(t, names["WebSearch"], "other bots still get web search when it is configured")
}

type toolClient struct{ mmapi.Client }

func (toolClient) GetPluginStatus(string) (*model.PluginStatus, error) {
	return nil, errors.New("not installed")
}
