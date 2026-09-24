// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGrokHTTPClientComplete(t *testing.T) {
	t.Run("sends bearer auth and returns assistant text", func(t *testing.T) {
		var gotAuth string
		var gotBody grokChatRequest
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			gotAuth = r.Header.Get("Authorization")
			body, err := io.ReadAll(r.Body)
			require.NoError(t, err)
			require.NoError(t, json.Unmarshal(body, &gotBody))
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"choices":[{"message":{"content":"Auth proxy is owned by robert.ward."}}]}`))
		}))
		defer server.Close()

		client := newGrokHTTPClient("test-key", "grok-3", server.URL)
		result, err := client.Complete(context.Background(), []GrokChatMessage{
			{Role: "system", Content: "You are Grok."},
			{Role: "user", Content: "Who owns auth?"},
		})
		require.NoError(t, err)
		assert.Equal(t, "Auth proxy is owned by robert.ward.", result)
		assert.Equal(t, "Bearer test-key", gotAuth)
		assert.Equal(t, "grok-3", gotBody.Model)
		require.Len(t, gotBody.Messages, 2)
		assert.Equal(t, "user", gotBody.Messages[1].Role)
	})

	t.Run("surfaces api error message", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusUnauthorized)
			_, _ = w.Write([]byte(`{"error":{"message":"Incorrect API key provided"}}`))
		}))
		defer server.Close()

		client := newGrokHTTPClient("bad-key", "grok-3", server.URL)
		_, err := client.Complete(context.Background(), []GrokChatMessage{{Role: "user", Content: "hi"}})
		require.Error(t, err)
		assert.Contains(t, err.Error(), "Incorrect API key provided")
	})

	t.Run("rejects empty messages", func(t *testing.T) {
		client := newGrokHTTPClient("test-key", "grok-3", "http://127.0.0.1")
		_, err := client.Complete(context.Background(), nil)
		require.Error(t, err)
	})
}

func TestNewGrokHTTPClientFromEnv(t *testing.T) {
	t.Setenv("YvetteGrokAPI", "")
	t.Setenv("MM_GROKAGENTSETTINGS_APIKEY", "")
	assert.Nil(t, newGrokHTTPClientFromEnv())

	t.Setenv("YvetteGrokAPI", "env-key")
	client := newGrokHTTPClientFromEnv()
	require.NotNil(t, client)
	httpClient, ok := client.(*grokHTTPClient)
	require.True(t, ok)
	assert.Equal(t, "env-key", httpClient.apiKey)
}

func TestNewGrokHTTPClientDefaults(t *testing.T) {
	client := newGrokHTTPClient("key", "", "")
	assert.Equal(t, "grok-3", client.model)
	assert.Equal(t, "https://api.x.ai/v1/chat/completions", client.apiURL)
}
