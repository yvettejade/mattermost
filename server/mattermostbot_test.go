// Copyright (c) 2023-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"encoding/json"
	"testing"

	"github.com/mattermost/mattermost-plugin-ai/bots"
	"github.com/mattermost/mattermost-plugin-ai/config"
	"github.com/mattermost/mattermost-plugin-ai/llm"
	"github.com/stretchr/testify/require"
)

func TestEnsureMattermostBotConfigFresh(t *testing.T) {
	t.Setenv(bots.GrokAPIEnvVar, "SENTINEL-DO-NOT-PERSIST")

	cfg, changed := ensureMattermostBotConfig(config.Config{})
	require.True(t, changed)
	require.Equal(t, bots.MattermostBotUsername, cfg.DefaultBotName)
	require.False(t, cfg.EnableChannelMentionToolCalling)
	require.Len(t, cfg.Bots, 1)
	require.Equal(t, bots.MattermostBotUsername, cfg.Bots[0].Name)
	require.Equal(t, bots.MattermostBotDisplayName, cfg.Bots[0].DisplayName)
	require.True(t, cfg.Bots[0].DisableTools)
	require.Empty(t, cfg.Bots[0].EnabledNativeTools)
	require.Empty(t, cfg.EmbeddingSearchConfig.Type)

	service, ok := cfg.GetServiceByID(bots.GrokServiceID)
	require.True(t, ok)
	require.Empty(t, service.APIKey)
	require.Equal(t, llm.ServiceTypeXAI, service.Type)
	require.Equal(t, llm.GrokModelID, service.DefaultModel)
	require.Equal(t, llm.GrokAPIURL, service.APIURL)

	encoded, err := json.Marshal(cfg)
	require.NoError(t, err)
	require.NotContains(t, string(encoded), "SENTINEL-DO-NOT-PERSIST")

	again, changedAgain := ensureMattermostBotConfig(cfg)
	require.False(t, changedAgain)
	require.Equal(t, cfg.DefaultBotName, again.DefaultBotName)
	require.Len(t, again.Bots, 1)
}

func TestEnsureMattermostBotConfigKeepsExistingDefaultWhenBotAlreadyPresent(t *testing.T) {
	cfg := config.Config{
		DefaultBotName: "other",
		Services:       []llm.ServiceConfig{bots.GrokServiceConfig()},
		Bots:           []llm.BotConfig{bots.MattermostBotConfig()},
	}
	got, changed := ensureMattermostBotConfig(cfg)
	require.False(t, changed)
	require.Equal(t, "other", got.DefaultBotName)
}

func TestEnsureMattermostBotConfigBecomesDefaultWhenIntroduced(t *testing.T) {
	cfg := config.Config{
		DefaultBotName: "other",
		Bots: []llm.BotConfig{{
			ID:          "existing",
			Name:        "other",
			DisplayName: "Other",
			ServiceID:   "svc",
		}},
		Services: []llm.ServiceConfig{{
			ID:     "svc",
			Type:   llm.ServiceTypeOpenAI,
			APIKey: "leave-this-key",
		}},
	}
	got, changed := ensureMattermostBotConfig(cfg)
	require.True(t, changed)
	require.Equal(t, bots.MattermostBotUsername, got.DefaultBotName)
	require.Equal(t, "other", got.Bots[0].Name)
	require.Equal(t, bots.MattermostBotUsername, got.Bots[1].Name)
	require.Equal(t, "leave-this-key", got.Services[0].APIKey)
	grok, ok := got.GetServiceByID(bots.GrokServiceID)
	require.True(t, ok)
	require.Empty(t, grok.APIKey)
	require.False(t, got.EnableChannelMentionToolCalling)
}
