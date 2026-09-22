// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package assistant

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestCompleteReadsEnvSetAfterClientIsCreated(t *testing.T) {
	t.Setenv(APIKeyEnv, "")
	client := NewGrokClient(nil)

	_, err := client.Complete(context.Background(), []Message{{Role: "user", Content: "hi"}})
	require.ErrorIs(t, err, ErrAPIKeyMissing)

	const key = "yvette-late-env-key"
	t.Setenv(APIKeyEnv, key)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, "Bearer "+key, r.Header.Get("Authorization"))
		w.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(w, `{"choices":[{"message":{"content":"late env reply"}}]}`)
	}))
	t.Cleanup(server.Close)
	client.HTTP = server.Client()
	client.Endpoint = server.URL
	client.Models = []string{"grok-4"}

	reply, err := client.Complete(context.Background(), []Message{{Role: "user", Content: "hi"}})
	require.NoError(t, err)
	require.Equal(t, "late env reply", reply)
}

func TestCompleteMissingKey(t *testing.T) {
	t.Setenv(APIKeyEnv, "   ")
	client := NewGrokClient(nil)
	_, err := client.Complete(context.Background(), []Message{{Role: "user", Content: "hi"}})
	require.ErrorIs(t, err, ErrAPIKeyMissing)
	require.NotContains(t, err.Error(), "sk-")
}

func TestCompleteTriesGrok4ThenFallbackAndRedactsKey(t *testing.T) {
	const key = "yvette-test-key-should-not-leak"
	t.Setenv(APIKeyEnv, "")

	var models []string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, "Bearer "+key, r.Header.Get("Authorization"))
		body, err := io.ReadAll(r.Body)
		require.NoError(t, err)
		models = append(models, modelFromBody(string(body)))
		if strings.Contains(string(body), `"model":"grok-4"`) {
			w.WriteHeader(http.StatusNotFound)
			_, _ = io.WriteString(w, `{"error":"model grok-4 missing `+key+`"}`)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(w, `{"choices":[{"message":{"content":"grounded reply `+key+`"}}]}`)
	}))
	t.Cleanup(server.Close)

	client := NewGrokClient(server.Client())
	client.Endpoint = server.URL
	client.Key = key
	client.Models = []string{"grok-4", "grok-3"}

	reply, err := client.Complete(context.Background(), []Message{{Role: "user", Content: "summarize"}})
	require.NoError(t, err)
	require.Equal(t, []string{"grok-4", "grok-3"}, models)
	require.Equal(t, "grounded reply [redacted]", reply)
	require.NotContains(t, reply, key)
}

func TestCompleteStopsOnUnauthorizedWithoutTryingNextModel(t *testing.T) {
	const key = "yvette-unauthorized-key"
	calls := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		w.WriteHeader(http.StatusUnauthorized)
		_, _ = io.WriteString(w, `{"error":"bad `+key+`"}`)
	}))
	t.Cleanup(server.Close)

	client := NewGrokClient(server.Client())
	client.Endpoint = server.URL
	client.Key = key
	client.Models = []string{"grok-4", "grok-3"}

	_, err := client.Complete(context.Background(), []Message{{Role: "user", Content: "hi"}})
	require.Error(t, err)
	require.Equal(t, 1, calls)
	require.NotContains(t, err.Error(), key)
	require.Contains(t, err.Error(), "rejected the API key")
}

func TestCompleteRedactsKeyFromFallbackError(t *testing.T) {
	const key = "yvette-error-body-key"
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusBadRequest)
		_, _ = io.WriteString(w, `{"error":"no such model `+key+`"}`)
	}))
	t.Cleanup(server.Close)

	client := NewGrokClient(server.Client())
	client.Endpoint = server.URL
	client.Key = key
	client.Models = []string{"grok-4"}

	_, err := client.Complete(context.Background(), []Message{{Role: "user", Content: "hi"}})
	require.Error(t, err)
	require.NotContains(t, err.Error(), key)
	require.Contains(t, err.Error(), "[redacted]")
}

func modelFromBody(body string) string {
	const marker = `"model":"`
	start := strings.Index(body, marker)
	if start < 0 {
		return ""
	}
	rest := body[start+len(marker):]
	end := strings.Index(rest, `"`)
	if end < 0 {
		return ""
	}
	return rest[:end]
}
