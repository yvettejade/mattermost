// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Package assistant implements the built-in AI assistant: permission-aware context
// retrieval, grounding prompts, tool calling and specialized agents, backed by an
// OpenAI-compatible chat completions API (xAI Grok by default).
package assistant

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"
)

const (
	// APIKeyEnvVar holds the Grok API key. It is only ever read server-side.
	APIKeyEnvVar  = "YvetteGrokAPI"
	BaseURLEnvVar = "MM_ASSISTANT_GROK_BASE_URL"
	ModelEnvVar   = "MM_ASSISTANT_GROK_MODEL"

	DefaultBaseURL = "https://api.x.ai/v1"
	DefaultModel   = "grok-4"

	requestTimeout   = 120 * time.Second
	maxResponseBytes = 4 << 20
)

var ErrNotConfigured = errors.New("assistant is not configured: the " + APIKeyEnvVar + " environment variable is not set")

type ChatMessage struct {
	Role       string     `json:"role"`
	Content    string     `json:"content"`
	ToolCalls  []ToolCall `json:"tool_calls,omitempty"`
	ToolCallID string     `json:"tool_call_id,omitempty"`
}

type ToolCall struct {
	ID       string           `json:"id"`
	Type     string           `json:"type"`
	Function ToolCallFunction `json:"function"`
}

type ToolCallFunction struct {
	Name      string `json:"name"`
	Arguments string `json:"arguments"`
}

type Tool struct {
	Type     string       `json:"type"`
	Function ToolFunction `json:"function"`
}

type ToolFunction struct {
	Name        string         `json:"name"`
	Description string         `json:"description"`
	Parameters  map[string]any `json:"parameters"`
}

type CompletionRequest struct {
	Model       string        `json:"model"`
	Messages    []ChatMessage `json:"messages"`
	Tools       []Tool        `json:"tools,omitempty"`
	ToolChoice  string        `json:"tool_choice,omitempty"`
	Temperature float64       `json:"temperature"`
}

type completionResponse struct {
	Choices []struct {
		Message ChatMessage `json:"message"`
	} `json:"choices"`
	Error *struct {
		Message string `json:"message"`
	} `json:"error,omitempty"`
}

// LLMClient is the minimal chat-completions surface the assistant needs.
type LLMClient interface {
	Complete(ctx context.Context, req CompletionRequest) (*ChatMessage, error)
}

type GrokClient struct {
	baseURL    string
	apiKey     string
	model      string
	httpClient *http.Client
}

// NewGrokClientFromEnv returns ErrNotConfigured when the API key is missing.
func NewGrokClientFromEnv() (*GrokClient, error) {
	apiKey := strings.TrimSpace(os.Getenv(APIKeyEnvVar))
	if apiKey == "" {
		return nil, ErrNotConfigured
	}
	baseURL := strings.TrimRight(strings.TrimSpace(os.Getenv(BaseURLEnvVar)), "/")
	if baseURL == "" {
		baseURL = DefaultBaseURL
	}
	model := strings.TrimSpace(os.Getenv(ModelEnvVar))
	if model == "" {
		model = DefaultModel
	}
	return &GrokClient{
		baseURL:    baseURL,
		apiKey:     apiKey,
		model:      model,
		httpClient: &http.Client{Timeout: requestTimeout},
	}, nil
}

func IsConfigured() bool {
	return strings.TrimSpace(os.Getenv(APIKeyEnvVar)) != ""
}

func (g *GrokClient) Complete(ctx context.Context, req CompletionRequest) (*ChatMessage, error) {
	if req.Model == "" {
		req.Model = g.model
	}
	body, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("failed to encode completion request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, g.baseURL+"/chat/completions", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("failed to build completion request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+g.apiKey)

	resp, err := g.httpClient.Do(httpReq)
	if err != nil {
		// The URL never contains the key, but scrub it anyway in case a proxy echoes headers.
		return nil, fmt.Errorf("completion request failed: %s", g.scrub(err.Error()))
	}
	defer resp.Body.Close()

	raw, err := io.ReadAll(io.LimitReader(resp.Body, maxResponseBytes))
	if err != nil {
		return nil, fmt.Errorf("failed to read completion response: %w", err)
	}

	var parsed completionResponse
	if jsonErr := json.Unmarshal(raw, &parsed); jsonErr != nil && resp.StatusCode == http.StatusOK {
		return nil, fmt.Errorf("failed to decode completion response: %w", jsonErr)
	}

	if resp.StatusCode != http.StatusOK {
		msg := http.StatusText(resp.StatusCode)
		if parsed.Error != nil && parsed.Error.Message != "" {
			msg = parsed.Error.Message
		}
		return nil, fmt.Errorf("completion request returned status %d: %s", resp.StatusCode, g.scrub(msg))
	}
	if len(parsed.Choices) == 0 {
		return nil, errors.New("completion response contained no choices")
	}
	return &parsed.Choices[0].Message, nil
}

func (g *GrokClient) scrub(s string) string {
	if g.apiKey == "" {
		return s
	}
	return strings.ReplaceAll(s, g.apiKey, "[REDACTED]")
}
