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

type GitHubConfig struct {
	Token   string
	Owner   string
	Repo    string
	BaseURL string
}

type GitHub struct {
	cfg    GitHubConfig
	client *http.Client
}

func NewGitHub(cfg GitHubConfig, httpClient *http.Client) *GitHub {
	if httpClient == nil {
		httpClient = http.DefaultClient
	}
	if cfg.BaseURL == "" {
		cfg.BaseURL = "https://api.github.com"
	}
	cfg.BaseURL = strings.TrimRight(cfg.BaseURL, "/")
	return &GitHub{cfg: cfg, client: httpClient}
}

func (g *GitHub) Configured() bool {
	return g != nil && strings.TrimSpace(g.cfg.Token) != ""
}

type GitHubItem struct {
	Title   string
	State   string
	Body    string
	HTMLURL string
	Number  int
	Kind    string
	Path    string
}

func (i GitHubItem) Card() string {
	body := i.Body
	if len(body) > 2000 {
		body = body[:2000] + "…"
	}
	if i.Kind == "file" {
		return fmt.Sprintf("**GitHub file** `%s`\n%s\n\n%s", i.Path, i.HTMLURL, body)
	}
	kind := i.Kind
	if kind == "" {
		kind = "item"
	}
	return fmt.Sprintf("**GitHub %s #%d** %s (%s)\n%s\n\n%s", kind, i.Number, i.Title, i.State, i.HTMLURL, body)
}

func (g *GitHub) GetIssue(ctx context.Context, n int) (GitHubItem, error) {
	var raw struct {
		Title   string `json:"title"`
		State   string `json:"state"`
		Body    string `json:"body"`
		HTMLURL string `json:"html_url"`
		Number  int    `json:"number"`
	}
	path := fmt.Sprintf("/repos/%s/%s/issues/%d", g.cfg.Owner, g.cfg.Repo, n)
	if err := g.get(ctx, path, &raw); err != nil {
		return GitHubItem{}, err
	}
	return GitHubItem{Title: raw.Title, State: raw.State, Body: raw.Body, HTMLURL: raw.HTMLURL, Number: raw.Number, Kind: "issue"}, nil
}

func (g *GitHub) GetPull(ctx context.Context, n int) (GitHubItem, error) {
	var raw struct {
		Title   string `json:"title"`
		State   string `json:"state"`
		Body    string `json:"body"`
		HTMLURL string `json:"html_url"`
		Number  int    `json:"number"`
	}
	path := fmt.Sprintf("/repos/%s/%s/pulls/%d", g.cfg.Owner, g.cfg.Repo, n)
	if err := g.get(ctx, path, &raw); err != nil {
		return GitHubItem{}, err
	}
	return GitHubItem{Title: raw.Title, State: raw.State, Body: raw.Body, HTMLURL: raw.HTMLURL, Number: raw.Number, Kind: "PR"}, nil
}

func (g *GitHub) GetContents(ctx context.Context, filePath string) (GitHubItem, error) {
	var raw struct {
		Name        string `json:"name"`
		Path        string `json:"path"`
		HTMLURL     string `json:"html_url"`
		DownloadURL string `json:"download_url"`
		Content     string `json:"content"`
	}
	path := fmt.Sprintf("/repos/%s/%s/contents/%s", g.cfg.Owner, g.cfg.Repo, strings.TrimPrefix(filePath, "/"))
	if err := g.get(ctx, path, &raw); err != nil {
		return GitHubItem{}, err
	}
	body := raw.DownloadURL
	if raw.Content != "" && len(raw.Content) < 2000 {
		body = raw.Content
	}
	return GitHubItem{Title: raw.Name, Path: raw.Path, HTMLURL: raw.HTMLURL, Body: body, Kind: "file"}, nil
}

func (g *GitHub) get(ctx context.Context, path string, dest any) error {
	if !g.Configured() {
		return fmt.Errorf("github token is not configured")
	}
	u, err := url.JoinPath(g.cfg.BaseURL, path)
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+g.cfg.Token)
	req.Header.Set("Accept", "application/vnd.github+json")
	resp, err := g.client.Do(req)
	if err != nil {
		return redactErr(err, g.cfg.Token)
	}
	defer resp.Body.Close()
	raw, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("github http %d", resp.StatusCode)
	}
	if err := json.Unmarshal(raw, dest); err != nil {
		return err
	}
	return nil
}

func redactErr(err error, secret string) error {
	if err == nil || secret == "" {
		return err
	}
	return fmt.Errorf("%s", strings.ReplaceAll(err.Error(), secret, "[redacted]"))
}
