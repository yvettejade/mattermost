package llm

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
)

// Client is the Completions abstraction so the xAI transport can be swapped later
// (e.g. Responses API) without changing actions.
type Client interface {
	Complete(ctx context.Context, req CompletionRequest) (string, error)
}

type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type CompletionRequest struct {
	Messages    []Message
	Temperature float64
	Model       string
}

type GrokConfig struct {
	BaseURL string
	Model   string
	APIKey  string
}

type Grok struct {
	cfg    GrokConfig
	client *http.Client
}

func NewGrok(cfg GrokConfig, httpClient *http.Client) *Grok {
	if httpClient == nil {
		httpClient = http.DefaultClient
	}
	if cfg.BaseURL == "" {
		cfg.BaseURL = "https://api.x.ai/v1"
	}
	if cfg.Model == "" {
		cfg.Model = "grok-4"
	}
	cfg.BaseURL = strings.TrimRight(cfg.BaseURL, "/")
	return &Grok{cfg: cfg, client: httpClient}
}

type chatRequest struct {
	Model       string    `json:"model"`
	Stream      bool      `json:"stream"`
	Messages    []Message `json:"messages"`
	Temperature float64   `json:"temperature"`
}

type chatResponse struct {
	Choices []struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
	} `json:"choices"`
	Error *struct {
		Message string `json:"message"`
	} `json:"error"`
}

func (g *Grok) Complete(ctx context.Context, req CompletionRequest) (string, error) {
	if strings.TrimSpace(g.cfg.APIKey) == "" {
		return "", fmt.Errorf("grok api key is not configured")
	}
	model := req.Model
	if model == "" {
		model = g.cfg.Model
	}
	temp := req.Temperature
	if temp == 0 {
		temp = 0.2
	}
	body, err := json.Marshal(chatRequest{
		Model:       model,
		Stream:      false,
		Messages:    req.Messages,
		Temperature: temp,
	})
	if err != nil {
		return "", fmt.Errorf("grok encode request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, g.cfg.BaseURL+"/chat/completions", bytes.NewReader(body))
	if err != nil {
		return "", fmt.Errorf("grok build request: %w", err)
	}
	httpReq.Header.Set("Authorization", "Bearer "+g.cfg.APIKey)
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := g.client.Do(httpReq)
	if err != nil {
		return "", g.safeErr("grok request failed", err)
	}
	defer resp.Body.Close()

	raw, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return "", g.safeErr("grok read response", err)
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", g.mapStatus(resp.StatusCode, raw)
	}

	var parsed chatResponse
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return "", fmt.Errorf("grok decode response: %w", err)
	}
	if parsed.Error != nil && parsed.Error.Message != "" {
		return "", g.safeErr("grok api error", fmt.Errorf("%s", parsed.Error.Message))
	}
	if len(parsed.Choices) == 0 {
		return "", fmt.Errorf("grok returned no choices")
	}
	return parsed.Choices[0].Message.Content, nil
}

func (g *Grok) mapStatus(code int, raw []byte) error {
	switch code {
	case http.StatusUnauthorized, http.StatusForbidden:
		return fmt.Errorf("grok authentication failed")
	case http.StatusTooManyRequests:
		return fmt.Errorf("grok rate limited")
	default:
		if code >= 500 {
			return fmt.Errorf("grok unavailable")
		}
		return g.safeErr(fmt.Sprintf("grok http %d", code), fmt.Errorf("%s", redact(string(raw), g.cfg.APIKey)))
	}
}

func (g *Grok) safeErr(prefix string, err error) error {
	if err == nil {
		return fmt.Errorf("%s", prefix)
	}
	return fmt.Errorf("%s: %s", prefix, redact(err.Error(), g.cfg.APIKey))
}

func redact(s, secret string) string {
	if secret == "" {
		return s
	}
	out := strings.ReplaceAll(s, secret, "[redacted]")
	out = strings.ReplaceAll(out, "Bearer "+secret, "Bearer [redacted]")
	return out
}
