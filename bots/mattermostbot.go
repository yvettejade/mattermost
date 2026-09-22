// Copyright (c) 2023-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package bots

import (
	"errors"
	"os"
	"strings"

	"github.com/mattermost/mattermost-plugin-ai/llm"
)

const (
	// MattermostBotUsername is the stable bot account EnsureBot creates.
	MattermostBotUsername = "mattermostbot"
	// MattermostBotDisplayName is the name shown in Channels.
	MattermostBotDisplayName = "MattermostBot"
	// GrokServiceID is the plugin service the default bot uses.
	GrokServiceID = "grok"
	// GrokAPIEnvVar is the only place the xAI key is read. It is never stored.
	GrokAPIEnvVar = "YvetteGrokAPI" // #nosec G101 -- environment variable name, not a credential

	grokInputTokenLimit         = 128000
	grokOutputTokenLimit        = 8192
	grokStreamingTimeoutSeconds = 180
)

// errGrokKeyUnset is returned instead of calling xAI when the environment has no key.
var errGrokKeyUnset = errors.New("YvetteGrokAPI is unset; Grok completions are unavailable")

// IsMattermostBot reports whether this bot is the phase-1 default agent.
func IsMattermostBot(bot *Bot) bool {
	return bot != nil && bot.cfg.Name == MattermostBotUsername
}

// ResolveServiceAPIKey copies the xAI key from the environment onto a service
// value used to build the client. Stored keys are ignored for this service so
// a plugin config save cannot become the credential source.
// The returned config must not be logged or persisted.
func ResolveServiceAPIKey(service llm.ServiceConfig) (llm.ServiceConfig, bool) {
	if service.Type != llm.ServiceTypeXAI {
		return service, true
	}
	service.APIKey = ""
	key, ok := os.LookupEnv(GrokAPIEnvVar)
	key = strings.TrimSpace(key)
	if !ok || key == "" {
		return service, false
	}
	service.APIKey = key
	return service, true
}

// GrokServiceConfig is the saved service definition. APIKey is intentionally empty.
func GrokServiceConfig() llm.ServiceConfig {
	return llm.ServiceConfig{
		ID:                      GrokServiceID,
		Name:                    "Grok",
		Type:                    llm.ServiceTypeXAI,
		DefaultModel:            llm.GrokModelID,
		APIURL:                  llm.GrokAPIURL,
		InputTokenLimit:         grokInputTokenLimit,
		OutputTokenLimit:        grokOutputTokenLimit,
		StreamingTimeoutSeconds: grokStreamingTimeoutSeconds,
	}
}

// MattermostBotConfig is the saved bot definition. Tools stay off so a mention
// cannot post or call the web. Retrieval is injected before the model runs.
func MattermostBotConfig() llm.BotConfig {
	return llm.BotConfig{
		ID:           MattermostBotUsername,
		Name:         MattermostBotUsername,
		DisplayName:  MattermostBotDisplayName,
		ServiceID:    GrokServiceID,
		DisableTools: true,
	}
}

type keyUnsetModel struct{}

// NewKeyUnsetModel answers chat calls with errGrokKeyUnset and does not dial out.
func NewKeyUnsetModel() llm.LanguageModel {
	return keyUnsetModel{}
}

func (keyUnsetModel) ChatCompletion(llm.CompletionRequest, ...llm.LanguageModelOption) (*llm.TextStreamResult, error) {
	return nil, errGrokKeyUnset
}

func (keyUnsetModel) ChatCompletionNoStream(llm.CompletionRequest, ...llm.LanguageModelOption) (string, error) {
	return "", errGrokKeyUnset
}

func (keyUnsetModel) CountTokens(string) int { return 0 }

func (keyUnsetModel) InputTokenLimit() int { return 0 }
