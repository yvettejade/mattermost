package integrations

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
)

type JiraConfig struct {
	BaseURL  string
	Email    string
	APIToken string
}

type Jira struct {
	cfg    JiraConfig
	client *http.Client
}

func NewJira(cfg JiraConfig, httpClient *http.Client) *Jira {
	if httpClient == nil {
		httpClient = http.DefaultClient
	}
	cfg.BaseURL = strings.TrimRight(cfg.BaseURL, "/")
	return &Jira{cfg: cfg, client: httpClient}
}

func (j *Jira) Configured() bool {
	return j != nil && j.cfg.Email != "" && j.cfg.APIToken != "" && j.cfg.BaseURL != ""
}

type JiraIssue struct {
	Key        string
	Summary    string
	Status     string
	Assignee   string
	Type       string
	Updated    string
	Description string
}

func (i JiraIssue) Card() string {
	desc := i.Description
	if len(desc) > 2000 {
		desc = desc[:2000] + "…"
	}
	return fmt.Sprintf("**%s** %s\nStatus: %s · Type: %s · Assignee: %s · Updated: %s\n\n%s",
		i.Key, i.Summary, i.Status, i.Type, i.Assignee, i.Updated, desc)
}

func (j *Jira) GetIssue(ctx context.Context, key string) (JiraIssue, error) {
	if !j.Configured() {
		return JiraIssue{}, fmt.Errorf("jira is not configured")
	}
	key = strings.TrimSpace(key)
	u, err := url.Parse(j.cfg.BaseURL + "/rest/api/3/issue/" + url.PathEscape(key))
	if err != nil {
		return JiraIssue{}, err
	}
	q := u.Query()
	q.Set("fields", "summary,status,assignee,description,updated,issuetype")
	u.RawQuery = q.Encode()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u.String(), nil)
	if err != nil {
		return JiraIssue{}, err
	}
	req.SetBasicAuth(j.cfg.Email, j.cfg.APIToken)
	req.Header.Set("Accept", "application/json")

	resp, err := j.client.Do(req)
	if err != nil {
		return JiraIssue{}, redactErr(err, j.cfg.APIToken)
	}
	defer resp.Body.Close()
	raw, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return JiraIssue{}, err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return JiraIssue{}, fmt.Errorf("jira http %d", resp.StatusCode)
	}

	var parsed struct {
		Key    string `json:"key"`
		Fields struct {
			Summary     string `json:"summary"`
			Updated     string `json:"updated"`
			Description any    `json:"description"`
			Status      struct {
				Name string `json:"name"`
			} `json:"status"`
			IssueType struct {
				Name string `json:"name"`
			} `json:"issuetype"`
			Assignee *struct {
				DisplayName string `json:"displayName"`
			} `json:"assignee"`
		} `json:"fields"`
	}
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return JiraIssue{}, err
	}
	assignee := "(unassigned)"
	if parsed.Fields.Assignee != nil && parsed.Fields.Assignee.DisplayName != "" {
		assignee = parsed.Fields.Assignee.DisplayName
	}
	return JiraIssue{
		Key:         parsed.Key,
		Summary:     parsed.Fields.Summary,
		Status:      parsed.Fields.Status.Name,
		Assignee:    assignee,
		Type:        parsed.Fields.IssueType.Name,
		Updated:     parsed.Fields.Updated,
		Description: adfPlaintext(parsed.Fields.Description),
	}, nil
}

func adfPlaintext(v any) string {
	switch t := v.(type) {
	case string:
		return t
	case map[string]any:
		if t["type"] == "text" {
			if s, ok := t["text"].(string); ok {
				return s
			}
		}
		if content, ok := t["content"].([]any); ok {
			var parts []string
			for _, c := range content {
				if s := adfPlaintext(c); s != "" {
					parts = append(parts, s)
				}
			}
			return strings.Join(parts, "\n")
		}
	case []any:
		var parts []string
		for _, c := range t {
			if s := adfPlaintext(c); s != "" {
				parts = append(parts, s)
			}
		}
		return strings.Join(parts, "\n")
	}
	return ""
}
