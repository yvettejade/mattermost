// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGrokAPIKey(t *testing.T) {
	t.Setenv(apiKeyEnv, "")
	t.Setenv(apiKeyAltEnv, "")
	assert.False(t, grokAPIConfigured())
	assert.Equal(t, "", grokAPIKey())

	t.Setenv(apiKeyEnv, " secret-from-env ")
	assert.True(t, grokAPIConfigured())
	assert.Equal(t, "secret-from-env", grokAPIKey())
}

func TestGrokModelAndURLDefaults(t *testing.T) {
	t.Setenv(modelEnv, "")
	t.Setenv(apiURLEnv, "")
	cfg := &configuration{}
	assert.Equal(t, defaultModel, cfg.grokModel())
	assert.Equal(t, defaultAPIURL, cfg.grokAPIURL())

	t.Setenv(modelEnv, "grok-test")
	t.Setenv(apiURLEnv, "https://example.test/v1/chat/completions")
	assert.Equal(t, "grok-test", cfg.grokModel())
	assert.Equal(t, "https://example.test/v1/chat/completions", cfg.grokAPIURL())
}

func TestGrokHTTPClientComplete(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, http.MethodPost, r.Method)
		assert.Equal(t, "Bearer test-key", r.Header.Get("Authorization"))
		var payload grokChatRequest
		require.NoError(t, json.NewDecoder(r.Body).Decode(&payload))
		assert.Equal(t, "grok-3", payload.Model)
		require.Len(t, payload.Messages, 1)
		_ = json.NewEncoder(w).Encode(grokChatResponse{
			Choices: []struct {
				Message struct {
					Content string `json:"content"`
				} `json:"message"`
			}{{Message: struct {
				Content string `json:"content"`
			}{Content: "hello from grok"}}},
		})
	}))
	defer server.Close()

	client := newGrokHTTPClient("test-key", defaultModel, server.URL)
	got, err := client.Complete(context.Background(), []ChatMessage{{Role: "user", Content: "hi"}})
	require.NoError(t, err)
	assert.Equal(t, "hello from grok", got)
}

func TestGrokHTTPClientErrors(t *testing.T) {
	client := newGrokHTTPClient("", defaultModel, defaultAPIURL)
	_, err := client.Complete(context.Background(), []ChatMessage{{Role: "user", Content: "hi"}})
	require.Error(t, err)

	client = newGrokHTTPClient("key", defaultModel, defaultAPIURL)
	_, err = client.Complete(context.Background(), nil)
	require.Error(t, err)

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
		_ = json.NewEncoder(w).Encode(grokChatResponse{
			Error: &struct {
				Message string `json:"message"`
			}{Message: "bad key"},
		})
	}))
	defer server.Close()

	client = newGrokHTTPClient("key", defaultModel, server.URL)
	_, err = client.Complete(context.Background(), []ChatMessage{{Role: "user", Content: "hi"}})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "bad key")
}
