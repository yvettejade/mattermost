// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package assistant

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"
)

const jiraTestToken = "yvette-jira-test-token"

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(r *http.Request) (*http.Response, error) {
	return f(r)
}

type fakeMCP struct {
	t            *testing.T
	token        string
	tools        string
	discoverBody string
	searchBody   string
	fetchBody    string
	resources    string
	sseFetch     bool
	failSearch   bool
	calls        []string
	searchArgs   map[string]any
	fetchArgs    []map[string]any
}

func (f *fakeMCP) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	f.t.Helper()
	require.NotContains(f.t, r.URL.String(), "mcp.atlassian.com")
	require.Equal(f.t, "Bearer "+f.token, r.Header.Get("Authorization"))
	require.Equal(f.t, "application/json", r.Header.Get("Content-Type"))
	require.Contains(f.t, r.Header.Get("Accept"), "application/json")
	require.Contains(f.t, r.Header.Get("Accept"), "text/event-stream")

	body, err := io.ReadAll(r.Body)
	require.NoError(f.t, err)
	var req struct {
		ID     int            `json:"id"`
		Method string         `json:"method"`
		Params map[string]any `json:"params"`
	}
	require.NoError(f.t, json.Unmarshal(body, &req))
	f.calls = append(f.calls, req.Method)

	if req.Method != "initialize" {
		require.Equal(f.t, "sess-test", r.Header.Get("Mcp-Session-Id"))
	}

	switch req.Method {
	case "initialize":
		w.Header().Set("Mcp-Session-Id", "sess-test")
		writeRPC(w, req.ID, map[string]any{
			"protocolVersion": mcpProtocolVersion,
			"capabilities":    map[string]any{"tools": map[string]any{}},
			"serverInfo":      map[string]any{"name": "fake-jira", "version": "0"},
		})
	case "notifications/initialized":
		w.WriteHeader(http.StatusAccepted)
	case "tools/list":
		writeRPC(w, req.ID, json.RawMessage(f.tools))
	case "tools/call":
		f.serveCall(w, req.ID, req.Params)
	default:
		f.t.Fatalf("unexpected mcp method %s", req.Method)
	}
}

func (f *fakeMCP) serveCall(w http.ResponseWriter, id int, params map[string]any) {
	name, _ := params["name"].(string)
	args, _ := params["arguments"].(map[string]any)
	f.calls = append(f.calls, "call:"+name)
	switch name {
	case jiraDiscoverTool:
		writeRPC(w, id, toolTextResult(f.discoverBody))
	case jiraResourcesTool:
		writeRPC(w, id, toolTextResult(f.resources))
	case jiraSearchTool:
		f.searchArgs = args
		if f.failSearch {
			writeRPC(w, id, map[string]any{
				"content": []map[string]string{{"type": "text", "text": "boom " + f.token}},
				"isError": true,
			})
			return
		}
		writeRPC(w, id, toolTextResult(f.searchBody))
	case jiraFetchTool:
		f.fetchArgs = append(f.fetchArgs, args)
		if f.sseFetch {
			w.Header().Set("Content-Type", "text/event-stream")
			_, _ = io.WriteString(w, "event: message\ndata: {\"jsonrpc\":\"2.0\",\"id\":"+itoa(id)+",\"result\":{\"content\":[{\"type\":\"text\",\"text\":"+jsonString(f.fetchBody)+"}]}}\n\n")
			return
		}
		writeRPC(w, id, toolTextResult(f.fetchBody))
	default:
		f.t.Fatalf("called tool %s that was not selected", name)
	}
}

func toolTextResult(text string) map[string]any {
	return map[string]any{
		"content": []map[string]string{{"type": "text", "text": text}},
	}
}

func writeRPC(w http.ResponseWriter, id int, result any) {
	w.Header().Set("Content-Type", "application/json")
	requireWrite(json.NewEncoder(w).Encode(map[string]any{
		"jsonrpc": "2.0",
		"id":      id,
		"result":  result,
	}))
}

func requireWrite(err error) {
	if err != nil {
		panic(err)
	}
}

func jsonString(s string) string {
	b, err := json.Marshal(s)
	if err != nil {
		panic(err)
	}
	return string(b)
}

func searchSchema(required ...string) string {
	req, err := json.Marshal(required)
	if err != nil {
		panic(err)
	}
	return `{
		"name": "` + jiraSearchTool + `",
		"inputSchema": {
			"type": "object",
			"properties": {"cloudId": {"type": "string"}, "jql": {"type": "string"}, "maxResults": {"type": "number"}},
			"required": ` + string(req) + `
		}
	}`
}

func fetchSchema() string {
	return `{
		"name": "` + jiraFetchTool + `",
		"inputSchema": {
			"type": "object",
			"properties": {"cloudId": {"type": "string"}, "issueIdOrKey": {"type": "string"}},
			"required": ["issueIdOrKey"]
		}
	}`
}

func resourcesSchema() string {
	return `{
		"name": "` + jiraResourcesTool + `",
		"inputSchema": {"type": "object", "properties": {}}
	}`
}

func discoverSchema() string {
	return `{
		"name": "` + jiraDiscoverTool + `",
		"inputSchema": {
			"type": "object",
			"properties": {"query": {"type": "string"}},
			"required": ["query"]
		}
	}`
}

func newFake(t *testing.T, fake *fakeMCP) (*JiraClient, *httptest.Server) {
	t.Helper()
	fake.t = t
	if fake.token == "" {
		fake.token = jiraTestToken
	}
	server := httptest.NewServer(fake)
	t.Cleanup(server.Close)
	client := NewJiraClient(server.Client())
	client.URL = server.URL
	client.Token = fake.token
	return client, server
}

func TestJiraLookupMissingTokenDoesNotDial(t *testing.T) {
	t.Setenv(JiraTokenEnv, "")
	dialed := false
	client := NewJiraClient(&http.Client{Transport: roundTripFunc(func(*http.Request) (*http.Response, error) {
		dialed = true
		return nil, errors.New("should not dial")
	})})
	_, err := client.Lookup(context.Background(), "open jira tickets", nil)
	require.ErrorIs(t, err, ErrJiraNotConfigured)
	require.False(t, dialed)
}

func TestJiraLookupReadsTokenAndURLAfterClientIsCreated(t *testing.T) {
	t.Setenv(JiraTokenEnv, "")
	t.Setenv(JiraURLEnv, "")
	fake := &fakeMCP{
		tools:      `{"tools":[` + searchSchema("jql") + `]}`,
		searchBody: "PLAT-2 status is Open assignee is sam",
	}
	client, server := newFake(t, fake)
	client.Token = ""
	client.URL = ""
	_, err := client.Lookup(context.Background(), "open jira tickets", nil)
	require.ErrorIs(t, err, ErrJiraNotConfigured)

	t.Setenv(JiraTokenEnv, jiraTestToken)
	t.Setenv(JiraURLEnv, server.URL)
	packet, err := client.Lookup(context.Background(), "open jira tickets", nil)
	require.NoError(t, err)
	require.Contains(t, packet, "PLAT-2 status is Open assignee is sam")
	require.Contains(t, packet, "tool "+jiraSearchTool)
	require.NotContains(t, fake.calls, "call:"+jiraFetchTool)
	require.Contains(t, fake.searchArgs["jql"], `text ~ "open"`)
	require.NotContains(t, fake.searchArgs, "cloudId")
}

func TestJiraLookupFetchesListedIssueAndSkipsSearch(t *testing.T) {
	fake := &fakeMCP{
		tools:     `{"tools":[` + fetchSchema() + `,` + searchSchema("jql") + `]}`,
		fetchBody: "PLAT-9 status is Open assignee is sam",
		sseFetch:  true,
	}
	client, _ := newFake(t, fake)
	packet, err := client.Lookup(context.Background(), "status of plat-9", []string{"plat-9"})
	require.NoError(t, err)
	require.Contains(t, packet, "PLAT-9 status is Open assignee is sam")
	require.Contains(t, fake.calls, "call:"+jiraFetchTool)
	require.NotContains(t, fake.calls, "call:"+jiraSearchTool)
	require.Equal(t, "PLAT-9", fake.fetchArgs[0]["issueIdOrKey"])
	require.NotContains(t, packet, jiraTestToken)
}

func TestJiraLookupUsesBothListedTools(t *testing.T) {
	fake := &fakeMCP{
		tools:      `{"tools":[` + fetchSchema() + `,` + searchSchema("jql") + `]}`,
		fetchBody:  "PLAT-9 status is Open assignee is sam",
		searchBody: "PLAT-10 status is In Progress assignee is riley",
	}
	client, _ := newFake(t, fake)
	packet, err := client.Lookup(context.Background(), "PLAT-9 and open billing bugs", []string{"PLAT-9"})
	require.NoError(t, err)
	require.Contains(t, packet, "PLAT-9 status is Open assignee is sam")
	require.Contains(t, packet, "PLAT-10 status is In Progress assignee is riley")
	require.Contains(t, fake.searchArgs["jql"], `key in ("PLAT-9")`)
	require.Contains(t, fake.searchArgs["jql"], "billing bugs")
	require.Equal(t, float64(10), fake.searchArgs["maxResults"])
}

func TestJiraLookupRedactsTokenFromToolFailure(t *testing.T) {
	fake := &fakeMCP{
		tools:      `{"tools":[` + searchSchema("jql") + `]}`,
		failSearch: true,
	}
	client, _ := newFake(t, fake)
	_, err := client.Lookup(context.Background(), "jira tickets", nil)
	require.ErrorIs(t, err, ErrJiraLookup)
	require.NotContains(t, err.Error(), jiraTestToken)
}

func TestJiraLookupFailsWhenJiraToolsAreNotListed(t *testing.T) {
	fake := &fakeMCP{
		tools: `{"tools":[{"name":"searchConfluenceUsingCql","inputSchema":{"type":"object","properties":{"cql":{"type":"string"}},"required":["cql"]}}]}`,
	}
	client, _ := newFake(t, fake)
	_, err := client.Lookup(context.Background(), "open jira tickets", nil)
	require.ErrorIs(t, err, ErrJiraLookup)
	require.NotContains(t, fake.calls, "call:searchConfluenceUsingCql")
	require.NotContains(t, fake.calls, "call:"+jiraSearchTool)
}

func TestJiraLookupUsesDiscoverResultNamesOnly(t *testing.T) {
	discovered := `{"tools":[` + searchSchema("jql") + `,{"name":"searchConfluenceUsingCql","inputSchema":{"type":"object","properties":{"cql":{"type":"string"}},"required":["cql"]}}]}`
	fake := &fakeMCP{
		tools:        `{"tools":[` + discoverSchema() + `]}`,
		discoverBody: discovered,
		searchBody:   "PLAT-4 status is Done assignee is sam",
	}
	client, _ := newFake(t, fake)
	packet, err := client.Lookup(context.Background(), "jira project PLAT bugs", nil)
	require.NoError(t, err)
	require.Contains(t, packet, "PLAT-4 status is Done assignee is sam")
	require.Contains(t, fake.calls, "call:"+jiraDiscoverTool)
	require.Contains(t, fake.calls, "call:"+jiraSearchTool)
	require.NotContains(t, fake.calls, "call:searchConfluenceUsingCql")
	require.Contains(t, fake.searchArgs["jql"], `project = "PLAT"`)
	require.Contains(t, fake.searchArgs["jql"], "bugs")
}

func TestJiraLookupCloudIDComesFromListedResourcesTool(t *testing.T) {
	fake := &fakeMCP{
		tools:      `{"tools":[` + searchSchema("cloudId", "jql") + `,` + resourcesSchema() + `]}`,
		resources:  `[{"id":"site-123","url":"https://example.atlassian.net","name":"Example","scopes":["read:jira-work"]}]`,
		searchBody: "PLAT-1 status is Open assignee is sam",
	}
	client, _ := newFake(t, fake)
	packet, err := client.Lookup(context.Background(), "open jira tickets", nil)
	require.NoError(t, err)
	require.Contains(t, packet, "PLAT-1 status is Open")
	require.Equal(t, "site-123", fake.searchArgs["cloudId"])
	require.Contains(t, fake.calls, "call:"+jiraResourcesTool)
}

func TestJiraLookupFailsWhenCloudIDRequiredAndUnknown(t *testing.T) {
	fake := &fakeMCP{
		tools: `{"tools":[` + searchSchema("cloudId", "jql") + `]}`,
	}
	client, _ := newFake(t, fake)
	_, err := client.Lookup(context.Background(), "open jira tickets", nil)
	require.ErrorIs(t, err, ErrJiraLookup)
	require.NotContains(t, fake.calls, "call:"+jiraSearchTool)
	require.NotContains(t, err.Error(), "site-")
}

func TestJiraDefaultURLIsOfficialEndpoint(t *testing.T) {
	t.Setenv(JiraURLEnv, "")
	t.Setenv(JiraTokenEnv, jiraTestToken)
	var got string
	client := NewJiraClient(&http.Client{Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
		got = r.URL.String()
		require.Equal(t, "Bearer "+jiraTestToken, r.Header.Get("Authorization"))
		return nil, errors.New("stopped before dial")
	})})
	_, err := client.Lookup(context.Background(), "jira tickets", nil)
	require.Error(t, err)
	require.Equal(t, defaultJiraMCPURL, got)
	require.NotContains(t, err.Error(), jiraTestToken)
}

func TestJiraRPCErrorRedactsToken(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(w, `{"jsonrpc":"2.0","id":1,"error":{"code":-32000,"message":"bad `+jiraTestToken+`"}}`)
	}))
	t.Cleanup(server.Close)
	client := NewJiraClient(server.Client())
	client.URL = server.URL
	client.Token = jiraTestToken
	_, err := client.Lookup(context.Background(), "jira tickets", nil)
	require.ErrorIs(t, err, ErrJiraLookup)
	require.NotContains(t, err.Error(), jiraTestToken)
	require.Contains(t, err.Error(), "[redacted]")
}
