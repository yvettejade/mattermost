// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package assistant

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"os"
	"strings"
	"time"
)

const (
	// APIKeyEnv is the only place the xAI key is read. It must be set on the
	// server process. The value is never written into source, logs, or errors.
	APIKeyEnv = "YvetteGrokAPI"

	defaultEndpoint = "https://api.x.ai/v1/chat/completions"
)

// ErrAPIKeyMissing is returned when YvetteGrokAPI is unset or blank.
var ErrAPIKeyMissing = errors.New("YvetteGrokAPI is not set")

var (
	errNoCompleter     = errors.New("assistant completer is not configured")
	errEmptyCompletion = errors.New("assistant completion was empty")
	// grok-4 is attempted first. Later names are used only when that call fails
	// for a reason other than authentication.
	defaultModels = []string{"grok-4", "grok-3", "grok-2-latest"}
)

// GrokClient calls the xAI chat completions API.
type GrokClient struct {
	HTTP     *http.Client
	Endpoint string
	Models   []string
	// Key overrides the environment variable. Production leaves it empty so
	// the key is read from YvetteGrokAPI on each request.
	Key string
}

// NewGrokClient returns a client that reads YvetteGrokAPI at request time.
func NewGrokClient(httpClient *http.Client) *GrokClient {
	if httpClient == nil {
		httpClient = &http.Client{
			Timeout: 25 * time.Second,
			CheckRedirect: func(*http.Request, []*http.Request) error {
				return http.ErrUseLastResponse
			},
		}
	}
	return &GrokClient{
		HTTP:     httpClient,
		Endpoint: defaultEndpoint,
		Models:   append([]string{}, defaultModels...),
	}
}

type chatRequest struct {
	Model       string        `json:"model"`
	Messages    []chatMessage `json:"messages"`
	Temperature float64       `json:"temperature"`
}

type chatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type chatResponse struct {
	Choices []struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
	} `json:"choices"`
	Error json.RawMessage `json:"error"`
}

// Complete calls chat completions. The API key is redacted from every error and from the reply.
func (c *GrokClient) Complete(ctx context.Context, messages []Message) (string, error) {
	if c == nil {
		return "", errNoCompleter
	}
	key := c.Key
	if strings.TrimSpace(key) == "" {
		key = os.Getenv(APIKeyEnv)
	}
	key = strings.TrimSpace(key)
	if key == "" {
		return "", ErrAPIKeyMissing
	}

	models := c.Models
	if len(models) == 0 {
		models = defaultModels
	}
	endpoint := c.Endpoint
	if endpoint == "" {
		endpoint = defaultEndpoint
	}
	client := c.HTTP
	if client == nil {
		client = http.DefaultClient
	}

	payload := make([]chatMessage, 0, len(messages))
	for _, message := range messages {
		payload = append(payload, chatMessage{Role: message.Role, Content: message.Content})
	}

	var lastErr error
	for i, model := range models {
		body, err := json.Marshal(chatRequest{Model: model, Messages: payload, Temperature: 0})
		if err != nil {
			return "", err
		}
		req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
		if err != nil {
			return "", err
		}
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+key)

		resp, err := client.Do(req)
		if err != nil {
			lastErr = errors.New(Redact(err.Error(), key))
			if ctx.Err() != nil {
				return "", lastErr
			}
			continue
		}

		respBody, readErr := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
		// Close is best-effort; a close error after a failed read must not hide that read error.
		if cerr := resp.Body.Close(); cerr != nil && readErr == nil {
			readErr = cerr
		}
		if readErr != nil {
			lastErr = errors.New(Redact(readErr.Error(), key))
			continue
		}
		snippet := Redact(string(respBody), key)
		if len(snippet) > 300 {
			snippet = snippet[:300]
		}

		if resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden {
			return "", errors.New("xAI rejected the API key (" + resp.Status + ")")
		}
		if resp.StatusCode != http.StatusOK {
			lastErr = errors.New("xAI chat completion failed for model " + model + ": " + resp.Status + " " + snippet)
			if !shouldTryNextModel(resp.StatusCode) || i == len(models)-1 {
				return "", lastErr
			}
			continue
		}

		var parsed chatResponse
		if err := json.Unmarshal(respBody, &parsed); err != nil {
			return "", errors.New("xAI chat completion returned unreadable JSON")
		}
		if len(parsed.Choices) == 0 || strings.TrimSpace(parsed.Choices[0].Message.Content) == "" {
			return "", errEmptyCompletion
		}
		return Redact(strings.TrimSpace(parsed.Choices[0].Message.Content), key), nil
	}
	if lastErr == nil {
		lastErr = errors.New("xAI chat completion failed")
	}
	return "", lastErr
}

func shouldTryNextModel(status int) bool {
	switch status {
	case http.StatusBadRequest, http.StatusNotFound, http.StatusUnprocessableEntity,
		http.StatusInternalServerError, http.StatusBadGateway, http.StatusServiceUnavailable:
		return true
	default:
		return false
	}
}

// Redact removes secret from message. A blank secret leaves message unchanged.
func Redact(message, secret string) string {
	if secret == "" || message == "" {
		return message
	}
	return strings.ReplaceAll(message, secret, "[redacted]")
}
