// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package assistant

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestDefaultLookupJiraMissingToken(t *testing.T) {
	origGetenv := getenv
	t.Cleanup(func() { getenv = origGetenv })
	getenv = func(string) string { return "" }

	_, err := DefaultLookupJira(context.Background(), []string{"PLAT-9"}, "")
	require.NotNil(t, err)
	assert.Equal(t, http.StatusNotImplemented, err.StatusCode)
	assert.Equal(t, "api.assistant.jira_config_missing", err.Id)
}

func TestDefaultLookupJiraSuccessfulPacket(t *testing.T) {
	origGetenv := getenv
	origClient := jiraHTTPClient
	t.Cleanup(func() {
		getenv = origGetenv
		jiraHTTPClient = origClient
	})

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "Bearer jira-secret", r.Header.Get("Authorization"))
		var req mcpRequest
		require.NoError(t, json.NewDecoder(r.Body).Decode(&req))
		assert.Equal(t, "tools/call", req.Method)
		assert.Equal(t, JiraSiteHost, req.Params["arguments"].(map[string]any)["cloudId"])
		_ = json.NewEncoder(w).Encode(JiraIssue{
			Key:     "PLAT-9",
			Summary: "Ship MatterBot",
			Status:  "In Progress",
		})
	}))
	t.Cleanup(server.Close)

	getenv = func(key string) string {
		switch key {
		case EnvJira:
			return "jira-secret"
		case EnvJiraMCPURL:
			return server.URL
		default:
			return ""
		}
	}
	jiraHTTPClient = server.Client()

	packet, err := DefaultLookupJira(context.Background(), []string{"PLAT-9"}, "")
	require.Nil(t, err)
	require.NotNil(t, packet)
	require.Len(t, packet.Issues, 1)
	assert.Equal(t, "PLAT-9", packet.Issues[0].Key)
	assert.Equal(t, JiraSiteHost, packet.Site)
	assert.Contains(t, packet.Issues[0].URL, "PLAT-9")
}

func TestDefaultLookupJiraTimeout(t *testing.T) {
	origGetenv := getenv
	origClient := jiraHTTPClient
	t.Cleanup(func() {
		getenv = origGetenv
		jiraHTTPClient = origClient
	})

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(50 * time.Millisecond)
		w.WriteHeader(http.StatusOK)
	}))
	t.Cleanup(server.Close)

	getenv = func(key string) string {
		switch key {
		case EnvJira:
			return "jira-secret"
		case EnvJiraMCPURL:
			return server.URL
		default:
			return ""
		}
	}
	jiraHTTPClient = &http.Client{Timeout: 10 * time.Millisecond}

	_, err := DefaultLookupJira(context.Background(), []string{"PLAT-9"}, "")
	require.NotNil(t, err)
	assert.Equal(t, http.StatusGatewayTimeout, err.StatusCode)
	assert.NotContains(t, err.Error(), "jira-secret")
}

func TestDefaultLookupJiraEmptyPacketForUnknownKey(t *testing.T) {
	origGetenv := getenv
	origClient := jiraHTTPClient
	t.Cleanup(func() {
		getenv = origGetenv
		jiraHTTPClient = origClient
	})

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNotFound)
	}))
	t.Cleanup(server.Close)

	getenv = func(key string) string {
		switch key {
		case EnvJira:
			return "jira-secret"
		case EnvJiraMCPURL:
			return server.URL
		default:
			return ""
		}
	}
	jiraHTTPClient = server.Client()

	packet, err := DefaultLookupJira(context.Background(), []string{"FAKE-999"}, "")
	require.Nil(t, err)
	assert.True(t, packet.Empty())
}

func TestGuardUngroundedKeys(t *testing.T) {
	t.Parallel()

	packet := &JiraPacket{Issues: []JiraIssue{{Key: "PLAT-9"}}}
	assert.Equal(t, "PLAT-9 is open", GuardUngroundedKeys("PLAT-9 is open", packet))
	assert.Equal(t, UngroundedIssueKeyMessage, GuardUngroundedKeys("FAKE-999 is done", packet))
	assert.Equal(t, UngroundedIssueKeyMessage, GuardUngroundedKeys("invented ABC-1", &JiraPacket{}))
}

func TestRedactSecretsFromJiraErrors(t *testing.T) {
	origGetenv := getenv
	origClient := jiraHTTPClient
	t.Cleanup(func() {
		getenv = origGetenv
		jiraHTTPClient = origClient
	})

	getenv = func(key string) string {
		if key == EnvJira {
			return "jira-secret-token"
		}
		if key == EnvJiraMCPURL {
			return "http://127.0.0.1:1"
		}
		return ""
	}
	jiraHTTPClient = &http.Client{Transport: roundTripFunc(func(*http.Request) (*http.Response, error) {
		return nil, io.EOF
	})}

	_, err := DefaultLookupJira(context.Background(), []string{"PLAT-9"}, "")
	require.NotNil(t, err)
	assert.NotContains(t, err.Error(), "jira-secret-token")
	assert.NotContains(t, err.DetailedError, "jira-secret-token")
}
