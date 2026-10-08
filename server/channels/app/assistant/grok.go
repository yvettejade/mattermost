// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package assistant

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
)

var grokModels = []string{"grok-4", "grok-3", "grok-2-latest"}

var grokHTTPClient = &http.Client{Timeout: 30 * time.Second}

type grokRequest struct {
	Model    string        `json:"model"`
	Messages []grokMessage `json:"messages"`
}

type grokMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type grokResponse struct {
	Choices []struct {
		Message grokMessage `json:"message"`
	} `json:"choices"`
}

// CompleteFunc generates a model completion from system and user prompts.
type CompleteFunc func(ctx context.Context, systemPrompt, userPrompt string) (string, *model.AppError)

// Complete is the Grok completion entry point. Tests replace this.
var Complete CompleteFunc = DefaultComplete

// DefaultComplete reads YvetteGrokAPI per request and falls back grok-4 → grok-3 → grok-2-latest.
func DefaultComplete(ctx context.Context, systemPrompt, userPrompt string) (string, *model.AppError) {
	apiKey := strings.TrimSpace(getenv(EnvGrokAPI))
	if apiKey == "" {
		return "", model.NewAppError("assistant.DefaultComplete", "api.assistant.config_missing", nil, "", http.StatusNotImplemented)
	}

	var lastErr *model.AppError
	for _, modelName := range grokModels {
		text, appErr := completeWithModel(ctx, apiKey, modelName, systemPrompt, userPrompt)
		if appErr == nil {
			return text, nil
		}
		if appErr.StatusCode == http.StatusUnauthorized || appErr.StatusCode == http.StatusForbidden {
			return "", appErr
		}
		lastErr = appErr
	}
	if lastErr == nil {
		lastErr = model.NewAppError("assistant.DefaultComplete", "api.assistant.upstream_error", nil, "", http.StatusBadGateway)
	}
	return "", lastErr
}

func completeWithModel(ctx context.Context, apiKey, modelName, systemPrompt, userPrompt string) (string, *model.AppError) {
	body, err := json.Marshal(grokRequest{
		Model: modelName,
		Messages: []grokMessage{
			{Role: "system", Content: systemPrompt},
			{Role: "user", Content: userPrompt},
		},
	})
	if err != nil {
		return "", model.NewAppError("assistant.completeWithModel", "api.assistant.upstream_error", nil, Redact(err.Error()), http.StatusInternalServerError)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, GrokEndpoint, bytes.NewReader(body))
	if err != nil {
		return "", model.NewAppError("assistant.completeWithModel", "api.assistant.upstream_error", nil, Redact(err.Error()), http.StatusBadGateway)
	}
	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := grokHTTPClient.Do(req)
	if err != nil {
		if isTimeout(ctx, err) {
			return "", model.NewAppError("assistant.completeWithModel", "api.assistant.timeout", nil, "", http.StatusGatewayTimeout)
		}
		return "", model.NewAppError("assistant.completeWithModel", "api.assistant.upstream_error", nil, Redact(err.Error()), http.StatusBadGateway)
	}
	defer resp.Body.Close()

	raw, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden {
		return "", model.NewAppError("assistant.completeWithModel", "api.assistant.upstream_error", nil, "", http.StatusBadGateway)
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", model.NewAppError("assistant.completeWithModel", "api.assistant.upstream_error", nil, Redact(string(raw)), http.StatusBadGateway)
	}

	var parsed grokResponse
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return "", model.NewAppError("assistant.completeWithModel", "api.assistant.upstream_error", nil, Redact(err.Error()), http.StatusBadGateway)
	}
	if len(parsed.Choices) == 0 || strings.TrimSpace(parsed.Choices[0].Message.Content) == "" {
		return "", model.NewAppError("assistant.completeWithModel", "api.assistant.upstream_error", nil, "empty completion", http.StatusBadGateway)
	}
	return parsed.Choices[0].Message.Content, nil
}
