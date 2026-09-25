package llm

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestGrokCompleteRequestShape(t *testing.T) {
	var gotAuth, gotPath, gotCT string
	var payload chatRequest

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotAuth = r.Header.Get("Authorization")
		gotPath = r.URL.Path
		gotCT = r.Header.Get("Content-Type")
		body, err := io.ReadAll(r.Body)
		require.NoError(t, err)
		require.NoError(t, json.Unmarshal(body, &payload))
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"choices":[{"message":{"content":"hello"}}]}`))
	}))
	defer srv.Close()

	client := NewGrok(GrokConfig{BaseURL: srv.URL, Model: "grok-4", APIKey: "secret-key-xyz"}, srv.Client())
	out, err := client.Complete(context.Background(), CompletionRequest{
		Messages:    []Message{{Role: "system", Content: "sys"}, {Role: "user", Content: "hi"}},
		Temperature: 0.2,
	})
	require.NoError(t, err)
	require.Equal(t, "hello", out)
	require.Equal(t, "Bearer secret-key-xyz", gotAuth)
	require.Equal(t, "/chat/completions", gotPath)
	require.Equal(t, "application/json", gotCT)
	require.Equal(t, "grok-4", payload.Model)
	require.False(t, payload.Stream)
	require.Equal(t, 0.2, payload.Temperature)
	require.Len(t, payload.Messages, 2)
}

func TestGrokErrorMappingAndNoSecretLeak(t *testing.T) {
	secret := "super-secret-api-key"
	t.Run("401", func(t *testing.T) {
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusUnauthorized)
			_, _ = w.Write([]byte(`{"error":{"message":"bad key super-secret-api-key"}}`))
		}))
		defer srv.Close()
		client := NewGrok(GrokConfig{BaseURL: srv.URL, APIKey: secret}, srv.Client())
		_, err := client.Complete(context.Background(), CompletionRequest{Messages: []Message{{Role: "user", Content: "x"}}})
		require.Error(t, err)
		require.Equal(t, "grok authentication failed", err.Error())
		require.NotContains(t, err.Error(), secret)
	})
	t.Run("429", func(t *testing.T) {
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusTooManyRequests)
		}))
		defer srv.Close()
		client := NewGrok(GrokConfig{BaseURL: srv.URL, APIKey: secret}, srv.Client())
		_, err := client.Complete(context.Background(), CompletionRequest{Messages: []Message{{Role: "user", Content: "x"}}})
		require.EqualError(t, err, "grok rate limited")
	})
	t.Run("500", func(t *testing.T) {
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusInternalServerError)
		}))
		defer srv.Close()
		client := NewGrok(GrokConfig{BaseURL: srv.URL, APIKey: secret}, srv.Client())
		_, err := client.Complete(context.Background(), CompletionRequest{Messages: []Message{{Role: "user", Content: "x"}}})
		require.EqualError(t, err, "grok unavailable")
	})
	t.Run("transport echoes secret", func(t *testing.T) {
		client := NewGrok(GrokConfig{BaseURL: "http://127.0.0.1:1", APIKey: secret}, &http.Client{})
		_, err := client.Complete(context.Background(), CompletionRequest{Messages: []Message{{Role: "user", Content: "x"}}})
		require.Error(t, err)
		require.NotContains(t, err.Error(), secret)
		require.True(t, strings.Contains(err.Error(), "grok request failed"))
	})
}
