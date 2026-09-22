// Copyright (c) 2023-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package bots

import (
	"errors"
	"strings"
	"testing"

	"github.com/mattermost/mattermost-plugin-ai/llm"
)

func TestResolveServiceAPIKeyUnset(t *testing.T) {
	t.Setenv(GrokAPIEnvVar, "")
	service := llm.ServiceConfig{
		ID:     GrokServiceID,
		Type:   llm.ServiceTypeXAI,
		APIKey: "stored-value-must-not-be-used",
	}

	got, ready := ResolveServiceAPIKey(service)
	if ready {
		t.Fatal("expected Grok to be unavailable when the environment variable is empty")
	}
	if got.APIKey != "" {
		t.Fatal("expected stored API key to be cleared when the environment variable is empty")
	}
}

func TestResolveServiceAPIKeyFromEnvironment(t *testing.T) {
	const sentinel = "test-key-not-a-secret"
	t.Setenv(GrokAPIEnvVar, "  "+sentinel+"  ")
	service := llm.ServiceConfig{
		ID:     GrokServiceID,
		Type:   llm.ServiceTypeXAI,
		APIKey: "stored-value-must-not-be-used",
	}

	got, ready := ResolveServiceAPIKey(service)
	if !ready {
		t.Fatal("expected Grok to be ready when the environment variable is set")
	}
	if got.APIKey != sentinel {
		t.Fatal("runtime API key was not applied from the environment")
	}
	if strings.Contains(GrokServiceConfig().APIKey, sentinel) {
		t.Fatal("saved service config must not contain the runtime key")
	}
}

func TestResolveServiceAPIKeyLeavesOtherServices(t *testing.T) {
	t.Setenv(GrokAPIEnvVar, "test-key-not-a-secret")
	service := llm.ServiceConfig{ID: "openai", Type: llm.ServiceTypeOpenAI, APIKey: "keep"}
	got, ready := ResolveServiceAPIKey(service)
	if !ready || got.APIKey != "keep" {
		t.Fatal("non-xAI services must keep their configured key")
	}
}

func TestKeyUnsetModelDoesNotSucceed(t *testing.T) {
	model := NewKeyUnsetModel()
	result, err := model.ChatCompletion(llm.CompletionRequest{})
	if result != nil {
		t.Fatal("unset key must not return a completion stream")
	}
	if !errors.Is(err, errGrokKeyUnset) {
		t.Fatalf("ChatCompletion error = %v, want key unset", err)
	}
	text, err := model.ChatCompletionNoStream(llm.CompletionRequest{})
	if text != "" || !errors.Is(err, errGrokKeyUnset) {
		t.Fatal("ChatCompletionNoStream must fail closed when the key is unset")
	}
}

func TestGrokServiceConfigOmitsKey(t *testing.T) {
	cfg := GrokServiceConfig()
	if cfg.APIKey != "" {
		t.Fatal("Grok service config must not carry an API key")
	}
	if cfg.Type != llm.ServiceTypeXAI || cfg.DefaultModel != llm.GrokModelID || cfg.APIURL != llm.GrokAPIURL {
		t.Fatalf("unexpected grok service config: type=%s model=%s url=%s", cfg.Type, cfg.DefaultModel, cfg.APIURL)
	}
	bot := MattermostBotConfig()
	if !bot.DisableTools || bot.Name != MattermostBotUsername || len(bot.EnabledNativeTools) != 0 {
		t.Fatal("MattermostBot must be the default username with tools disabled and no native web search")
	}
}
