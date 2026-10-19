// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package assistant

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"net"
	"net/http"
	"strings"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
)

const jiraLookupTimeout = 20 * time.Second

var jiraHTTPClient = &http.Client{Timeout: jiraLookupTimeout}

// JiraIssue is one grounded issue from MCP.
type JiraIssue struct {
	Key         string `json:"key"`
	Summary     string `json:"summary"`
	Status      string `json:"status"`
	Description string `json:"description"`
	URL         string `json:"url"`
}

// JiraPacket is the lookup result passed into prompts and the ungrounded-key guard.
type JiraPacket struct {
	Site   string      `json:"site"`
	Issues []JiraIssue `json:"issues"`
}

func (p *JiraPacket) Empty() bool {
	return p == nil || len(p.Issues) == 0
}

func (p *JiraPacket) KeySet() map[string]struct{} {
	out := make(map[string]struct{})
	if p == nil {
		return out
	}
	for _, issue := range p.Issues {
		if issue.Key != "" {
			out[issue.Key] = struct{}{}
		}
	}
	return out
}

// LookupJiraFunc fetches a Jira grounding packet for issue keys / a free-text query.
type LookupJiraFunc func(ctx context.Context, keys []string, query string) (*JiraPacket, *model.AppError)

// LookupJira is the Jira MCP entry point. Tests replace this.
var LookupJira LookupJiraFunc = DefaultLookupJira

type mcpRequest struct {
	JSONRPC string         `json:"jsonrpc"`
	ID      int            `json:"id"`
	Method  string         `json:"method"`
	Params  map[string]any `json:"params"`
}

type mcpResponse struct {
	Result json.RawMessage `json:"result"`
	Error  *struct {
		Message string `json:"message"`
	} `json:"error"`
	Issues []JiraIssue `json:"issues"`
}

// DefaultLookupJira calls Atlassian MCP with YvetteJira. Site is hard-coded.
func DefaultLookupJira(ctx context.Context, keys []string, query string) (*JiraPacket, *model.AppError) {
	token := strings.TrimSpace(getenv(EnvJira))
	if token == "" {
		return nil, model.NewAppError("assistant.DefaultLookupJira", "api.assistant.jira_config_missing", nil, "", http.StatusNotImplemented)
	}

	mcpURL := strings.TrimSpace(getenv(EnvJiraMCPURL))
	if mcpURL == "" {
		mcpURL = DefaultJiraMCPURL
	}

	ctx, cancel := context.WithTimeout(ctx, jiraLookupTimeout)
	defer cancel()

	packet := &JiraPacket{Site: JiraSiteHost}
	if len(keys) == 0 {
		issue, appErr := lookupOne(ctx, mcpURL, token, "", query)
		if appErr != nil {
			return nil, appErr
		}
		if issue != nil {
			packet.Issues = append(packet.Issues, *issue)
		}
		return packet, nil
	}

	for _, key := range keys {
		issue, appErr := lookupOne(ctx, mcpURL, token, key, query)
		if appErr != nil {
			return nil, appErr
		}
		if issue != nil {
			packet.Issues = append(packet.Issues, *issue)
		}
	}
	return packet, nil
}

func lookupOne(ctx context.Context, mcpURL, token, key, query string) (*JiraIssue, *model.AppError) {
	args := map[string]any{
		"cloudId": JiraSiteHost,
	}
	if key != "" {
		args["issueIdOrKey"] = key
	}
	if query != "" {
		args["query"] = query
	}

	body, err := json.Marshal(mcpRequest{
		JSONRPC: "2.0",
		ID:      1,
		Method:  "tools/call",
		Params: map[string]any{
			"name":      "getJiraIssue",
			"arguments": args,
		},
	})
	if err != nil {
		return nil, model.NewAppError("assistant.lookupOne", "api.assistant.upstream_error", nil, Redact(err.Error()), http.StatusInternalServerError)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, mcpURL, bytes.NewReader(body))
	if err != nil {
		return nil, model.NewAppError("assistant.lookupOne", "api.assistant.upstream_error", nil, Redact(err.Error()), http.StatusBadGateway)
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")

	resp, err := jiraHTTPClient.Do(req)
	if err != nil {
		if isTimeout(ctx, err) {
			return nil, model.NewAppError("assistant.lookupOne", "api.assistant.timeout", nil, "", http.StatusGatewayTimeout)
		}
		return nil, model.NewAppError("assistant.lookupOne", "api.assistant.upstream_error", nil, Redact(err.Error()), http.StatusBadGateway)
	}
	defer resp.Body.Close()

	raw, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		if resp.StatusCode == http.StatusNotFound {
			return nil, nil
		}
		return nil, model.NewAppError("assistant.lookupOne", "api.assistant.upstream_error", nil, Redact(string(raw)), http.StatusBadGateway)
	}

	return parseJiraIssue(raw, key), nil
}

func parseJiraIssue(raw []byte, fallbackKey string) *JiraIssue {
	var direct JiraIssue
	if err := json.Unmarshal(raw, &direct); err == nil && direct.Key != "" {
		if direct.URL == "" {
			direct.URL = "https://" + JiraSiteHost + "/browse/" + direct.Key
		}
		return &direct
	}

	var envelope struct {
		Issues []JiraIssue     `json:"issues"`
		Result json.RawMessage `json:"result"`
		Error  *struct {
			Message string `json:"message"`
		} `json:"error"`
	}
	if err := json.Unmarshal(raw, &envelope); err != nil {
		return nil
	}
	if envelope.Error != nil {
		return nil
	}
	if len(envelope.Issues) > 0 && envelope.Issues[0].Key != "" {
		issue := envelope.Issues[0]
		if issue.URL == "" {
			issue.URL = "https://" + JiraSiteHost + "/browse/" + issue.Key
		}
		return &issue
	}

	if len(envelope.Result) > 0 {
		var resultIssue JiraIssue
		if err := json.Unmarshal(envelope.Result, &resultIssue); err == nil && resultIssue.Key != "" {
			if resultIssue.URL == "" {
				resultIssue.URL = "https://" + JiraSiteHost + "/browse/" + resultIssue.Key
			}
			return &resultIssue
		}
		var resultWrapped struct {
			Issues []JiraIssue `json:"issues"`
			Content []struct {
				Text string `json:"text"`
			} `json:"content"`
		}
		if err := json.Unmarshal(envelope.Result, &resultWrapped); err == nil {
			if len(resultWrapped.Issues) > 0 && resultWrapped.Issues[0].Key != "" {
				issue := resultWrapped.Issues[0]
				if issue.URL == "" {
					issue.URL = "https://" + JiraSiteHost + "/browse/" + issue.Key
				}
				return &issue
			}
			for _, block := range resultWrapped.Content {
				if parsed := parseJiraIssue([]byte(block.Text), fallbackKey); parsed != nil {
					return parsed
				}
			}
		}
	}

	if fallbackKey != "" && bytes.Contains(bytes.ToLower(raw), bytes.ToLower([]byte(fallbackKey))) {
		// MCP acknowledged the key but did not return a structured issue — still empty for grounding.
		return nil
	}
	return nil
}

func isTimeout(ctx context.Context, err error) bool {
	if ctx.Err() != nil || errors.Is(err, context.DeadlineExceeded) {
		return true
	}
	var nerr net.Error
	return errors.As(err, &nerr) && nerr.Timeout()
}

// GuardUngroundedKeys replaces the model reply when it cites issue keys absent from the lookup packet.
func GuardUngroundedKeys(reply string, packet *JiraPacket) string {
	emitted := ExtractIssueKeys(reply)
	if len(emitted) == 0 {
		return reply
	}
	known := packet.KeySet()
	for _, key := range emitted {
		if _, ok := known[key]; !ok {
			return UngroundedIssueKeyMessage
		}
	}
	return reply
}
