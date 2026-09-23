// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

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
	"regexp"
	"strings"
	"time"
)

const (
	// JiraTokenEnv is read on every lookup. The value is never written into
	// source, logs, or errors.
	JiraTokenEnv = "YvetteJiraMCP"
	// JiraURLEnv overrides the official Atlassian Rovo MCP endpoint.
	JiraURLEnv = "JIRA_MCP_URL"
	// defaultJiraMCPURL is the current official remote MCP endpoint
	// (https://mcp.atlassian.com/v2/mcp). /v1/sse is deprecated.
	defaultJiraMCPURL = "https://mcp.atlassian.com/v2/mcp"

	mcpProtocolVersion = "2025-03-26"

	// Official Jira tool names. A call is made only when tools/list or a
	// discover result includes that exact name.
	jiraSearchTool    = "searchJiraIssuesUsingJql"
	jiraFetchTool     = "getJiraIssue"
	jiraDiscoverTool  = "discover"
	jiraResourcesTool = "getAccessibleAtlassianResources"
)

// ErrJiraNotConfigured is returned when YvetteJiraMCP is unset or blank.
var ErrJiraNotConfigured = errors.New("YvetteJiraMCP is not set")

// ErrJiraLookup is returned when the MCP call fails or lists no Jira tool.
var ErrJiraLookup = errors.New("jira lookup failed")

// JiraClient calls a remote MCP server for Jira issue data.
type JiraClient struct {
	HTTP *http.Client
	// URL overrides JIRA_MCP_URL. Production leaves it empty.
	URL string
	// Token overrides YvetteJiraMCP. Production leaves it empty so the
	// token is read on each lookup.
	Token string
}

// NewJiraClient returns a client that reads YvetteJiraMCP at lookup time.
func NewJiraClient(httpClient *http.Client) *JiraClient {
	if httpClient == nil {
		httpClient = &http.Client{
			Timeout: 20 * time.Second,
			CheckRedirect: func(*http.Request, []*http.Request) error {
				return http.ErrUseLastResponse
			},
		}
	}
	return &JiraClient{HTTP: httpClient}
}

type toolDef struct {
	Name      string
	Props     map[string]bool
	Required  map[string]bool
	HasSchema bool
}

type mcpSession struct {
	httpClient *http.Client
	url        string
	token      string
	sessionID  string
	protocol   string
	nextID     int
}

type rpcRequest struct {
	JSONRPC string `json:"jsonrpc"`
	ID      int    `json:"id,omitempty"`
	Method  string `json:"method"`
	Params  any    `json:"params,omitempty"`
}

// Lookup runs the MCP handshake and returns tool text for the grounded prompt.
// issueKeys come from Route. Names that tools/list does not include are not called.
func (c *JiraClient) Lookup(ctx context.Context, question string, issueKeys []string) (string, error) {
	if c == nil {
		return "", ErrJiraLookup
	}
	token := c.token()
	if token == "" {
		return "", ErrJiraNotConfigured
	}
	packet, err := c.lookup(ctx, token, question, sanitizeKeys(issueKeys))
	if err != nil {
		if errors.Is(err, ErrJiraNotConfigured) {
			return "", ErrJiraNotConfigured
		}
		return "", fmt.Errorf("%w: %s", ErrJiraLookup, Redact(err.Error(), token))
	}
	return Redact(packet, token), nil
}

func (c *JiraClient) token() string {
	if strings.TrimSpace(c.Token) != "" {
		return strings.TrimSpace(c.Token)
	}
	return strings.TrimSpace(os.Getenv(JiraTokenEnv))
}

func (c *JiraClient) endpoint() string {
	if strings.TrimSpace(c.URL) != "" {
		return strings.TrimSpace(c.URL)
	}
	if env := strings.TrimSpace(os.Getenv(JiraURLEnv)); env != "" {
		return env
	}
	return defaultJiraMCPURL
}

func (c *JiraClient) lookup(ctx context.Context, token, question string, keys []string) (string, error) {
	client := c.HTTP
	if client == nil {
		client = http.DefaultClient
	}
	session := &mcpSession{
		httpClient: client,
		url:        c.endpoint(),
		token:      token,
		protocol:   mcpProtocolVersion,
	}
	if err := session.initialize(ctx); err != nil {
		return "", err
	}
	if err := session.notify(ctx, "notifications/initialized"); err != nil {
		return "", err
	}
	tools, err := session.listTools(ctx)
	if err != nil {
		return "", err
	}
	search, fetch, err := session.selectJiraTools(ctx, tools, question)
	if err != nil {
		return "", err
	}

	wantFetch := fetch.Name != "" && len(keys) > 0
	wantSearch := search.Name != "" && (len(keys) == 0 || !wantFetch || jiraQuestionNeedsSearch(question, keys))
	if !wantFetch && !wantSearch {
		if search.Name != "" {
			wantSearch = true
		} else {
			return "", errors.New("jira search tool was not listed and the question has no issue key")
		}
	}

	needCloud := (wantFetch && fetch.Required["cloudId"]) || (wantSearch && search.Required["cloudId"])
	cloudID, err := session.resolveCloudID(ctx, tools, needCloud)
	if err != nil {
		return "", err
	}

	var parts []string
	if wantFetch {
		for _, key := range keys {
			args, argErr := buildArgs(fetch, fetchOffer(fetch, key, cloudID))
			if argErr != nil {
				return "", argErr
			}
			text, callErr := session.callTool(ctx, fetch.Name, args)
			if callErr != nil {
				return "", callErr
			}
			parts = append(parts, "tool "+fetch.Name+":\n"+truncate(text, 8000, "\n[truncated]"))
		}
	}
	if wantSearch {
		args, argErr := buildArgs(search, searchOffer(search, question, jqlFor(question, keys), cloudID))
		if argErr != nil {
			return "", argErr
		}
		text, callErr := session.callTool(ctx, search.Name, args)
		if callErr != nil {
			return "", callErr
		}
		parts = append(parts, "tool "+search.Name+":\n"+truncate(text, 8000, "\n[truncated]"))
	}
	if len(parts) == 0 {
		return "", errors.New("jira lookup produced no tool output")
	}
	return truncate(strings.Join(parts, "\n"), 16000, "\n[truncated]"), nil
}

func (s *mcpSession) selectJiraTools(ctx context.Context, tools map[string]toolDef, question string) (toolDef, toolDef, error) {
	search := tools[jiraSearchTool]
	fetch := tools[jiraFetchTool]
	if search.Name == "" && fetch.Name == "" {
		disc, ok := tools[jiraDiscoverTool]
		if !ok {
			return toolDef{}, toolDef{}, errors.New("jira search and fetch tools were not listed")
		}
		discovered, err := s.discoverJiraTools(ctx, disc, question)
		if err != nil {
			return toolDef{}, toolDef{}, err
		}
		if found, ok := discovered[jiraSearchTool]; ok {
			search = found
		}
		if found, ok := discovered[jiraFetchTool]; ok {
			fetch = found
		}
	}
	if search.Name == "" && fetch.Name == "" {
		return toolDef{}, toolDef{}, errors.New("jira search and fetch tools were not listed")
	}
	return search, fetch, nil
}

func (s *mcpSession) initialize(ctx context.Context) error {
	result, err := s.call(ctx, "initialize", map[string]any{
		"protocolVersion": mcpProtocolVersion,
		"capabilities":    map[string]any{},
		"clientInfo": map[string]any{
			"name":    "mattermost-assistant",
			"version": "0.1.0",
		},
	})
	if err != nil {
		return err
	}
	var parsed struct {
		ProtocolVersion string `json:"protocolVersion"`
	}
	if json.Unmarshal(result, &parsed) == nil && parsed.ProtocolVersion != "" {
		s.protocol = parsed.ProtocolVersion
	}
	return nil
}

func (s *mcpSession) listTools(ctx context.Context) (map[string]toolDef, error) {
	tools := map[string]toolDef{}
	cursor := ""
	for page := 0; page < 5; page++ {
		params := map[string]any{}
		if cursor != "" {
			params["cursor"] = cursor
		}
		result, err := s.call(ctx, "tools/list", params)
		if err != nil {
			return nil, err
		}
		var listed struct {
			Tools []struct {
				Name        string          `json:"name"`
				InputSchema json.RawMessage `json:"inputSchema"`
			} `json:"tools"`
			NextCursor string `json:"nextCursor"`
		}
		if json.Unmarshal(result, &listed) != nil {
			return nil, errors.New("mcp tools/list was unreadable")
		}
		for _, tool := range listed.Tools {
			if tool.Name == "" {
				continue
			}
			tools[tool.Name] = parseTool(tool.Name, tool.InputSchema)
		}
		if listed.NextCursor == "" || listed.NextCursor == cursor {
			break
		}
		cursor = listed.NextCursor
	}
	return tools, nil
}

func (s *mcpSession) discoverJiraTools(ctx context.Context, disc toolDef, question string) (map[string]toolDef, error) {
	args, err := buildArgs(disc, discoverOffer(disc, question))
	if err != nil {
		return nil, err
	}
	raw, err := s.callToolRaw(ctx, disc.Name, args)
	if err != nil {
		return nil, err
	}
	found := toolsFromDiscover(raw)
	if len(found) == 0 {
		return nil, errors.New("discover did not list a jira search or fetch tool")
	}
	return found, nil
}

func (s *mcpSession) resolveCloudID(ctx context.Context, tools map[string]toolDef, needed bool) (string, error) {
	if !needed {
		return "", nil
	}
	// cloudId is required by the listed Jira tool. Take it only from a listed
	// resources tool. Do not invent a site.
	res, ok := tools[jiraResourcesTool]
	if !ok {
		return "", errors.New("jira tool requires cloudId and getAccessibleAtlassianResources was not listed")
	}
	if res.HasSchema && len(res.Required) > 0 {
		return "", errors.New("jira tool requires cloudId and the resources tool needs unknown arguments")
	}
	text, err := s.callTool(ctx, res.Name, map[string]any{})
	if err != nil {
		return "", err
	}
	ids := cloudIDsFromResources(text)
	if len(ids) == 0 {
		return "", errors.New("jira tool requires cloudId and the server returned no site")
	}
	return ids[0], nil
}

func (s *mcpSession) call(ctx context.Context, method string, params any) (json.RawMessage, error) {
	s.nextID++
	payload, err := json.Marshal(rpcRequest{JSONRPC: "2.0", ID: s.nextID, Method: method, Params: params})
	if err != nil {
		return nil, err
	}
	body, status, header, err := s.post(ctx, payload)
	if err != nil {
		return nil, err
	}
	if status < 200 || status >= 300 {
		return nil, fmt.Errorf("mcp %s failed: %d", method, status)
	}
	result, err := decodeRPC(body, header.Get("Content-Type"))
	if err != nil {
		return nil, fmt.Errorf("mcp %s: %s", method, err.Error())
	}
	return result, nil
}

func (s *mcpSession) notify(ctx context.Context, method string) error {
	payload, err := json.Marshal(rpcRequest{JSONRPC: "2.0", Method: method})
	if err != nil {
		return err
	}
	_, status, _, err := s.post(ctx, payload)
	if err != nil {
		return err
	}
	if status == http.StatusAccepted || status == http.StatusNoContent || (status >= 200 && status < 300) {
		return nil
	}
	return fmt.Errorf("mcp %s failed: %d", method, status)
}

func (s *mcpSession) post(ctx context.Context, payload []byte) ([]byte, int, http.Header, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, s.url, bytes.NewReader(payload))
	if err != nil {
		return nil, 0, nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json, text/event-stream")
	req.Header.Set("Authorization", "Bearer "+s.token)
	req.Header.Set("MCP-Protocol-Version", s.protocol)
	if s.sessionID != "" {
		req.Header.Set("Mcp-Session-Id", s.sessionID)
	}
	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, 0, nil, err
	}
	body, readErr := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if cerr := resp.Body.Close(); cerr != nil && readErr == nil {
		readErr = cerr
	}
	if sid := resp.Header.Get("Mcp-Session-Id"); sid != "" {
		s.sessionID = sid
	}
	if readErr != nil {
		return nil, resp.StatusCode, resp.Header, readErr
	}
	return body, resp.StatusCode, resp.Header, nil
}

func (s *mcpSession) callTool(ctx context.Context, name string, args map[string]any) (string, error) {
	raw, err := s.callToolRaw(ctx, name, args)
	if err != nil {
		return "", err
	}
	text, isErr, err := toolPayloadText(raw)
	if err != nil {
		return "", err
	}
	if isErr {
		return "", errors.New("jira tool " + name + " failed")
	}
	if strings.TrimSpace(text) == "" {
		return "", errors.New("jira tool " + name + " returned no data")
	}
	return text, nil
}

func (s *mcpSession) callToolRaw(ctx context.Context, name string, args map[string]any) (json.RawMessage, error) {
	if args == nil {
		args = map[string]any{}
	}
	return s.call(ctx, "tools/call", map[string]any{
		"name":      name,
		"arguments": args,
	})
}

func parseTool(name string, schema json.RawMessage) toolDef {
	def := toolDef{Name: name, Props: map[string]bool{}, Required: map[string]bool{}}
	if len(bytes.TrimSpace(schema)) == 0 || bytes.Equal(bytes.TrimSpace(schema), []byte("null")) {
		return def
	}
	var parsed struct {
		Properties map[string]json.RawMessage `json:"properties"`
		Required   []string                   `json:"required"`
	}
	if json.Unmarshal(schema, &parsed) != nil {
		return def
	}
	def.HasSchema = true
	for key := range parsed.Properties {
		def.Props[key] = true
	}
	for _, key := range parsed.Required {
		def.Required[key] = true
	}
	return def
}

func buildArgs(def toolDef, offered map[string]any) (map[string]any, error) {
	if !def.HasSchema {
		return nil, fmt.Errorf("tool %s has no input schema", def.Name)
	}
	args := map[string]any{}
	for key, val := range offered {
		if !def.Props[key] || val == nil || val == "" {
			continue
		}
		args[key] = val
	}
	for key := range def.Required {
		if _, ok := args[key]; !ok {
			return nil, fmt.Errorf("tool %s requires %s", def.Name, key)
		}
	}
	return args, nil
}

func searchOffer(def toolDef, question, jql, cloudID string) map[string]any {
	offered := map[string]any{}
	if cloudID != "" {
		offered["cloudId"] = cloudID
	}
	if def.Props["maxResults"] {
		offered["maxResults"] = 10
	}
	switch {
	case def.Props["jql"]:
		offered["jql"] = jql
	case def.Props["query"]:
		offered["query"] = question
	case def.Props["text"]:
		offered["text"] = question
	case def.Props["question"]:
		offered["question"] = question
	}
	return offered
}

func fetchOffer(def toolDef, key, cloudID string) map[string]any {
	offered := map[string]any{}
	if cloudID != "" {
		offered["cloudId"] = cloudID
	}
	switch {
	case def.Props["issueIdOrKey"]:
		offered["issueIdOrKey"] = key
	case def.Props["issueKey"]:
		offered["issueKey"] = key
	case def.Props["key"]:
		offered["key"] = key
	}
	return offered
}

func discoverOffer(def toolDef, question string) map[string]any {
	query := "search and fetch Jira issues: " + question
	offered := map[string]any{}
	switch {
	case def.Props["query"]:
		offered["query"] = query
	case def.Props["question"]:
		offered["question"] = query
	case def.Props["text"]:
		offered["text"] = query
	case def.Props["description"]:
		offered["description"] = query
	case def.Props["goal"]:
		offered["goal"] = query
	}
	return offered
}

func toolPayloadText(raw json.RawMessage) (string, bool, error) {
	var parsed struct {
		Content []struct {
			Type string `json:"type"`
			Text string `json:"text"`
		} `json:"content"`
		IsError           bool            `json:"isError"`
		StructuredContent json.RawMessage `json:"structuredContent"`
	}
	if json.Unmarshal(raw, &parsed) != nil {
		return "", false, errors.New("mcp tool result was unreadable")
	}
	var b strings.Builder
	for _, part := range parsed.Content {
		if strings.TrimSpace(part.Text) == "" {
			continue
		}
		if b.Len() > 0 {
			b.WriteString("\n")
		}
		b.WriteString(part.Text)
	}
	if b.Len() == 0 && len(bytes.TrimSpace(parsed.StructuredContent)) > 0 && !bytes.Equal(bytes.TrimSpace(parsed.StructuredContent), []byte("null")) {
		b.WriteString(string(parsed.StructuredContent))
	}
	return b.String(), parsed.IsError, nil
}

func toolsFromDiscover(raw json.RawMessage) map[string]toolDef {
	found := map[string]toolDef{}
	collectDiscoverTools(raw, found)
	if text, _, err := toolPayloadText(raw); err == nil {
		payload := jsonPayload(text)
		if payload != nil {
			encoded, err := json.Marshal(payload)
			if err == nil {
				collectDiscoverTools(encoded, found)
			}
		}
	}
	return found
}

func collectDiscoverTools(raw json.RawMessage, found map[string]toolDef) {
	if len(raw) == 0 {
		return
	}
	var node any
	if json.Unmarshal(raw, &node) != nil {
		return
	}
	var walk func(any)
	walk = func(n any) {
		switch t := n.(type) {
		case map[string]any:
			name, _ := t["name"].(string)
			if name == jiraSearchTool || name == jiraFetchTool {
				schema, _ := json.Marshal(t["inputSchema"])
				if t["inputSchema"] == nil {
					if inputs, ok := t["inputs"]; ok {
						schema, _ = json.Marshal(inputs)
					}
				}
				def := parseTool(name, schema)
				if _, ok := found[name]; !ok || (def.HasSchema && !found[name].HasSchema) {
					found[name] = def
				}
			}
			for _, child := range t {
				walk(child)
			}
		case []any:
			for _, child := range t {
				walk(child)
			}
		}
	}
	walk(node)
}

func decodeRPC(body []byte, contentType string) (json.RawMessage, error) {
	trimmed := bytes.TrimSpace(body)
	if strings.Contains(strings.ToLower(contentType), "text/event-stream") || bytes.HasPrefix(trimmed, []byte("data:")) || bytes.HasPrefix(trimmed, []byte("event:")) {
		return decodeSSE(trimmed)
	}
	result, skip, err := decodeJSONRPC(trimmed)
	if err != nil {
		return nil, err
	}
	if skip {
		return nil, errors.New("mcp response had no result")
	}
	return result, nil
}

func decodeJSONRPC(body []byte) (json.RawMessage, bool, error) {
	var msg struct {
		Method string          `json:"method"`
		Result json.RawMessage `json:"result"`
		Error  *struct {
			Message string `json:"message"`
		} `json:"error"`
	}
	if json.Unmarshal(body, &msg) != nil {
		return nil, false, errors.New("mcp response was not json")
	}
	if msg.Error != nil {
		text := msg.Error.Message
		if text == "" {
			text = "mcp error"
		}
		return nil, false, errors.New(text)
	}
	if msg.Method != "" && len(bytes.TrimSpace(msg.Result)) == 0 {
		return nil, true, nil
	}
	if len(bytes.TrimSpace(msg.Result)) == 0 || bytes.Equal(bytes.TrimSpace(msg.Result), []byte("null")) {
		return nil, false, errors.New("mcp response had no result")
	}
	return msg.Result, false, nil
}

func decodeSSE(body []byte) (json.RawMessage, error) {
	var data strings.Builder
	var last json.RawMessage
	flush := func() error {
		line := strings.TrimSpace(data.String())
		data.Reset()
		if line == "" {
			return nil
		}
		result, skip, err := decodeJSONRPC([]byte(line))
		if err != nil {
			return err
		}
		if skip {
			return nil
		}
		last = result
		return nil
	}
	for _, line := range strings.Split(string(body), "\n") {
		line = strings.TrimRight(line, "\r")
		if line == "" {
			if err := flush(); err != nil {
				return nil, err
			}
			continue
		}
		if strings.HasPrefix(line, ":") || strings.HasPrefix(line, "event:") || strings.HasPrefix(line, "id:") || strings.HasPrefix(line, "retry:") {
			continue
		}
		if rest, ok := strings.CutPrefix(line, "data:"); ok {
			data.WriteString(strings.TrimPrefix(rest, " "))
		}
	}
	if err := flush(); err != nil {
		return nil, err
	}
	if last == nil {
		return nil, errors.New("mcp event stream had no result")
	}
	return last, nil
}

func cloudIDsFromResources(text string) []string {
	payload := jsonPayload(text)
	if payload == nil {
		return nil
	}
	var ids []string
	var walk func(any)
	walk = func(n any) {
		switch t := n.(type) {
		case map[string]any:
			if id, ok := firstString(t, "cloudId", "cloud_id"); ok && validCloudID(id) {
				ids = append(ids, id)
			} else if id, ok := t["id"].(string); ok && validCloudID(id) && siteObject(t) {
				ids = append(ids, id)
			}
			for _, child := range t {
				walk(child)
			}
		case []any:
			for _, child := range t {
				walk(child)
			}
		}
	}
	walk(payload)
	return dedupeStrings(ids)
}

func jsonPayload(text string) any {
	text = strings.TrimSpace(text)
	var payload any
	if json.Unmarshal([]byte(text), &payload) == nil {
		return payload
	}
	startObj := strings.IndexAny(text, "{[")
	if startObj < 0 {
		return nil
	}
	if json.Unmarshal([]byte(text[startObj:]), &payload) != nil {
		return nil
	}
	return payload
}

func firstString(m map[string]any, keys ...string) (string, bool) {
	for _, key := range keys {
		if val, ok := m[key].(string); ok && strings.TrimSpace(val) != "" {
			return strings.TrimSpace(val), true
		}
	}
	return "", false
}

func siteObject(m map[string]any) bool {
	url, _ := m["url"].(string)
	if strings.Contains(strings.ToLower(url), "atlassian.net") {
		return true
	}
	_, hasName := m["name"].(string)
	_, hasScopes := m["scopes"]
	return hasName && hasScopes
}

func validCloudID(id string) bool {
	id = strings.TrimSpace(id)
	return id != "" && len(id) <= 200 && !strings.ContainsAny(id, " \t\r\n")
}

func dedupeStrings(in []string) []string {
	seen := map[string]bool{}
	out := make([]string, 0, len(in))
	for _, item := range in {
		if seen[item] {
			continue
		}
		seen[item] = true
		out = append(out, item)
	}
	return out
}

func sanitizeKeys(keys []string) []string {
	return issueKeys(strings.Join(keys, " "))
}

var reProjectKey = regexp.MustCompile(`\b[Pp]roject\s+([A-Z][A-Z0-9]{1,9})\b`)

func projectKey(question string) string {
	match := reProjectKey.FindStringSubmatch(question)
	if match == nil || nonJiraKeyPrefixes[match[1]] {
		return ""
	}
	return match[1]
}

func jqlFor(question string, keys []string) string {
	var parts []string
	if len(keys) > 0 {
		quoted := make([]string, len(keys))
		for i, key := range keys {
			quoted[i] = `"` + escapeJQL(key) + `"`
		}
		parts = append(parts, "key in ("+strings.Join(quoted, ", ")+")")
	}
	if project := projectKey(question); project != "" {
		parts = append(parts, `project = "`+escapeJQL(project)+`"`)
	}
	if text := jiraTextTerms(question, keys); text != "" {
		parts = append(parts, `text ~ "`+escapeJQL(text)+`"`)
	}
	if len(parts) == 0 {
		return "order by updated DESC"
	}
	return strings.Join(parts, " AND ") + " ORDER BY updated DESC"
}

func jiraQuestionNeedsSearch(question string, keys []string) bool {
	return jiraTextTerms(question, keys) != "" || projectKey(question) != ""
}

func jiraTextTerms(question string, keys []string) string {
	known := map[string]bool{}
	for _, key := range keys {
		known[strings.ToUpper(key)] = true
	}
	project := projectKey(question)
	var terms []string
	for _, word := range strings.Fields(question) {
		clean := strings.Trim(word, ".,!?:;\"'`()[]{}")
		if clean == "" || jiraFiller[strings.ToLower(clean)] || strings.EqualFold(clean, "project") {
			continue
		}
		upper := strings.ToUpper(clean)
		if known[upper] || (project != "" && upper == project) {
			continue
		}
		terms = append(terms, clean)
	}
	text := strings.Join(terms, " ")
	if len(text) > 180 {
		text = text[:180]
	}
	return strings.TrimSpace(text)
}

func escapeJQL(value string) string {
	value = strings.ReplaceAll(value, `\`, `\\`)
	value = strings.ReplaceAll(value, `"`, `\"`)
	value = strings.Map(func(r rune) rune {
		if r < 32 {
			return -1
		}
		return r
	}, value)
	return value
}

var jiraFiller = map[string]bool{
	"a": true, "about": true, "an": true, "and": true, "any": true, "are": true,
	"can": true, "fetch": true, "find": true, "for": true, "from": true, "get": true,
	"give": true, "in": true, "is": true, "issue": true, "issues": true, "jira": true,
	"key": true, "keys": true, "list": true, "look": true, "lookup": true, "me": true,
	"my": true, "of": true, "on": true, "our": true, "please": true, "show": true,
	"status": true, "tell": true, "that": true, "the": true, "there": true, "this": true,
	"ticket": true, "tickets": true, "to": true, "up": true, "what": true, "with": true,
	"you": true,
}
