package integrations

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestGitHubGetPullAndIssue(t *testing.T) {
	var sawAuth, sawAccept, lastPath string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		sawAuth = r.Header.Get("Authorization")
		sawAccept = r.Header.Get("Accept")
		lastPath = r.URL.Path
		switch r.URL.Path {
		case "/repos/yvettejade/mattermost/pulls/12":
			_, _ = w.Write([]byte(`{"number":12,"title":"Fix bot","state":"open","body":"details","html_url":"https://github.com/yvettejade/mattermost/pull/12"}`))
		case "/repos/yvettejade/mattermost/issues/9":
			_, _ = w.Write([]byte(`{"number":9,"title":"Bug","state":"open","body":"repro","html_url":"https://github.com/yvettejade/mattermost/issues/9"}`))
		case "/repos/yvettejade/mattermost/contents/README.md":
			_, _ = w.Write([]byte(`{"name":"README.md","path":"README.md","html_url":"https://github.com/yvettejade/mattermost/blob/master/README.md","content":"# hi"}`))
		default:
			http.NotFound(w, r)
		}
	}))
	defer srv.Close()

	c := NewGitHub(GitHubConfig{Token: "gh-token", Owner: "yvettejade", Repo: "mattermost", BaseURL: srv.URL}, srv.Client())
	pr, err := c.GetPull(context.Background(), 12)
	require.NoError(t, err)
	require.Equal(t, "Fix bot", pr.Title)
	require.Equal(t, "Bearer gh-token", sawAuth)
	require.Equal(t, "application/vnd.github+json", sawAccept)
	require.Contains(t, pr.Card(), "PR #12")

	issue, err := c.GetIssue(context.Background(), 9)
	require.NoError(t, err)
	require.Equal(t, "Bug", issue.Title)
	require.Equal(t, "/repos/yvettejade/mattermost/issues/9", lastPath)

	file, err := c.GetContents(context.Background(), "README.md")
	require.NoError(t, err)
	require.Equal(t, "README.md", file.Path)
}

func TestGitHubMissingToken(t *testing.T) {
	c := NewGitHub(GitHubConfig{Owner: "yvettejade", Repo: "mattermost", BaseURL: "http://example"}, nil)
	_, err := c.GetIssue(context.Background(), 1)
	require.Error(t, err)
	require.Contains(t, err.Error(), "not configured")
}

func TestGitHubHTTPError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNotFound)
	}))
	defer srv.Close()
	c := NewGitHub(GitHubConfig{Token: "t", Owner: "o", Repo: "r", BaseURL: srv.URL}, srv.Client())
	_, err := c.GetPull(context.Background(), 1)
	require.EqualError(t, err, "github http 404")
}
