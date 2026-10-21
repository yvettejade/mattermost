package integrations

import (
	"context"
	"encoding/base64"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestJiraGetIssue(t *testing.T) {
	var sawAuth, lastPath, fields string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		sawAuth = r.Header.Get("Authorization")
		lastPath = r.URL.Path
		fields = r.URL.Query().Get("fields")
		_, _ = w.Write([]byte(`{
			"key":"YJIRA-26",
			"fields":{
				"summary":"In-Mattermost AI agent",
				"updated":"2026-09-24T00:00:00.000Z",
				"status":{"name":"In Progress"},
				"issuetype":{"name":"Story"},
				"assignee":{"displayName":"Yvette Copeland"},
				"description":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Build a Slackbot-like agent."}]}]}
			}
		}`))
	}))
	defer srv.Close()

	c := NewJira(JiraConfig{BaseURL: srv.URL, Email: "dev@example.com", APIToken: "jira-secret"}, srv.Client())
	issue, err := c.GetIssue(context.Background(), "YJIRA-26")
	require.NoError(t, err)
	require.Equal(t, "YJIRA-26", issue.Key)
	require.Equal(t, "In-Mattermost AI agent", issue.Summary)
	require.Equal(t, "In Progress", issue.Status)
	require.Equal(t, "Yvette Copeland", issue.Assignee)
	require.Contains(t, issue.Description, "Slackbot-like")
	require.Equal(t, "/rest/api/3/issue/YJIRA-26", lastPath)
	require.Contains(t, fields, "summary")
	expected := "Basic " + base64.StdEncoding.EncodeToString([]byte("dev@example.com:jira-secret"))
	require.Equal(t, expected, sawAuth)
	require.Contains(t, issue.Card(), "YJIRA-26")
}

func TestJiraMissingConfig(t *testing.T) {
	c := NewJira(JiraConfig{BaseURL: "https://example.atlassian.net"}, nil)
	_, err := c.GetIssue(context.Background(), "YJIRA-1")
	require.Error(t, err)
	require.Contains(t, err.Error(), "not configured")
}

func TestJiraHTTPError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNotFound)
	}))
	defer srv.Close()
	c := NewJira(JiraConfig{BaseURL: srv.URL, Email: "a@b.c", APIToken: "t"}, srv.Client())
	_, err := c.GetIssue(context.Background(), "YJIRA-1")
	require.EqualError(t, err, "jira http 404")
}
