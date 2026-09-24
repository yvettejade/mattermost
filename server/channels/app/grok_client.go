// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
)

const grokHTTPTimeout = 45 * time.Second

// GrokChatClient is the Grok Chat completion surface used by the workspace agent.
type GrokChatClient interface {
	Complete(ctx context.Context, messages []GrokChatMessage) (string, error)
}

type GrokChatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type grokChatRequest struct {
	Model    string            `json:"model"`
	Messages []GrokChatMessage `json:"messages"`
}

type grokChatResponse struct {
	Choices []struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
	} `json:"choices"`
	Error *struct {
		Message string `json:"message"`
	} `json:"error"`
}

type grokHTTPClient struct {
	apiKey     string
	model      string
	apiURL     string
	httpClient *http.Client
}

func newGrokHTTPClient(apiKey, modelName, apiURL string) *grokHTTPClient {
	if modelName == "" {
		modelName = model.GrokDefaultModel
	}
	if apiURL == "" {
		apiURL = model.GrokDefaultAPIURL
	}
	return &grokHTTPClient{
		apiKey: apiKey,
		model:  modelName,
		apiURL: apiURL,
		httpClient: &http.Client{
			Timeout: grokHTTPTimeout,
		},
	}
}

func newGrokHTTPClientFromEnv() GrokChatClient {
	apiKey := model.GrokAPIKey()
	if apiKey == "" {
		return nil
	}
	return newGrokHTTPClient(apiKey, model.GrokModel(), model.GrokAPIURL())
}

func (c *grokHTTPClient) Complete(ctx context.Context, messages []GrokChatMessage) (string, error) {
	if c.apiKey == "" {
		return "", fmt.Errorf("grok api key is not configured")
	}
	if len(messages) == 0 {
		return "", fmt.Errorf("grok completion requires at least one message")
	}

	payload, err := json.Marshal(grokChatRequest{
		Model:    c.model,
		Messages: messages,
	})
	if err != nil {
		return "", fmt.Errorf("failed to encode grok request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.apiURL, bytes.NewReader(payload))
	if err != nil {
		return "", fmt.Errorf("failed to build grok request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.apiKey)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("grok request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return "", fmt.Errorf("failed to read grok response: %w", err)
	}

	var parsed grokChatResponse
	if err := json.Unmarshal(body, &parsed); err != nil {
		return "", fmt.Errorf("failed to decode grok response: %w", err)
	}
	if parsed.Error != nil && parsed.Error.Message != "" {
		return "", fmt.Errorf("grok api error: %s", parsed.Error.Message)
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", fmt.Errorf("grok api returned status %d", resp.StatusCode)
	}
	if len(parsed.Choices) == 0 || parsed.Choices[0].Message.Content == "" {
		return "", fmt.Errorf("grok api returned an empty completion")
	}

	return parsed.Choices[0].Message.Content, nil
}

var _ GrokChatClient = (*grokHTTPClient)(nil)
