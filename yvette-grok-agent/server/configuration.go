package main

import (
	"encoding/json"
	"os"
	"strings"

	"github.com/pkg/errors"
)

const (
	defaultGrokBaseURL        = "https://api.x.ai/v1"
	defaultGrokModel          = "grok-4"
	defaultGitHubOwner        = "yvettejade"
	defaultGitHubRepo         = "mattermost"
	defaultJiraBaseURL        = "https://fe-anysphere-demo.atlassian.net"
	defaultJiraProjectKey     = "YJIRA"
	defaultHistoryWindowDays  = 7
	defaultHistoryMaxPosts    = 50
	hardCapHistoryMaxPosts    = 100
)

// configuration is the plugin settings_schema plus resolved env fallbacks.
// Treat the pointer returned by getConfiguration as immutable.
type configuration struct {
	YvetteGrokAPI     string
	GrokModel         string
	GrokBaseURL       string
	GitHubToken       string
	GitHubOwner       string
	GitHubRepo        string
	JiraBaseURL       string
	JiraEmail         string
	JiraAPIToken      string
	JiraProjectKey    string
	HistoryWindowDays float64
	HistoryMaxPosts   float64
	AgentWebhooks     string
}

func (c *configuration) Clone() *configuration {
	copyCfg := *c
	return &copyCfg
}

func (c *configuration) applyDefaultsAndEnv() {
	c.YvetteGrokAPI = firstNonEmpty(c.YvetteGrokAPI, os.Getenv("YvetteGrokAPI"), os.Getenv("YVETTE_GROK_API"))
	c.GitHubToken = firstNonEmpty(c.GitHubToken, os.Getenv("GitHubToken"), os.Getenv("GITHUB_TOKEN"))
	c.JiraEmail = firstNonEmpty(c.JiraEmail, os.Getenv("JiraEmail"), os.Getenv("JIRA_EMAIL"))
	c.JiraAPIToken = firstNonEmpty(c.JiraAPIToken, os.Getenv("JiraAPIToken"), os.Getenv("JIRA_API_TOKEN"))
	c.JiraBaseURL = firstNonEmpty(c.JiraBaseURL, os.Getenv("JiraBaseURL"), os.Getenv("JIRA_BASE_URL"), defaultJiraBaseURL)
	c.GrokModel = firstNonEmpty(c.GrokModel, defaultGrokModel)
	c.GrokBaseURL = strings.TrimRight(firstNonEmpty(c.GrokBaseURL, defaultGrokBaseURL), "/")
	c.GitHubOwner = firstNonEmpty(c.GitHubOwner, defaultGitHubOwner)
	c.GitHubRepo = firstNonEmpty(c.GitHubRepo, defaultGitHubRepo)
	c.JiraProjectKey = firstNonEmpty(c.JiraProjectKey, defaultJiraProjectKey)
	if c.HistoryWindowDays <= 0 {
		c.HistoryWindowDays = defaultHistoryWindowDays
	}
	if c.HistoryMaxPosts <= 0 {
		c.HistoryMaxPosts = defaultHistoryMaxPosts
	}
	if c.HistoryMaxPosts > hardCapHistoryMaxPosts {
		c.HistoryMaxPosts = hardCapHistoryMaxPosts
	}
}

func (c *configuration) HistoryWindowDaysInt() int {
	return int(c.HistoryWindowDays)
}

func (c *configuration) HistoryMaxPostsInt() int {
	n := int(c.HistoryMaxPosts)
	if n > hardCapHistoryMaxPosts {
		return hardCapHistoryMaxPosts
	}
	if n <= 0 {
		return defaultHistoryMaxPosts
	}
	return n
}

func (c *configuration) AgentWebhookMap() map[string]string {
	raw := strings.TrimSpace(c.AgentWebhooks)
	if raw == "" {
		return map[string]string{}
	}
	out := map[string]string{}
	if err := json.Unmarshal([]byte(raw), &out); err != nil {
		return map[string]string{}
	}
	return out
}

func firstNonEmpty(values ...string) string {
	for _, v := range values {
		if strings.TrimSpace(v) != "" {
			return strings.TrimSpace(v)
		}
	}
	return ""
}

func (p *Plugin) getConfiguration() *configuration {
	p.configurationLock.RLock()
	defer p.configurationLock.RUnlock()

	if p.configuration == nil {
		cfg := &configuration{}
		cfg.applyDefaultsAndEnv()
		return cfg
	}
	return p.configuration
}

func (p *Plugin) setConfiguration(configuration *configuration) {
	p.configurationLock.Lock()
	defer p.configurationLock.Unlock()
	p.configuration = configuration
}

func (p *Plugin) OnConfigurationChange() error {
	var configuration = new(configuration)

	if p.API != nil {
		if err := p.API.LoadPluginConfiguration(configuration); err != nil {
			return errors.Wrap(err, "failed to load plugin configuration")
		}
	}
	configuration.applyDefaultsAndEnv()
	p.setConfiguration(configuration)
	p.rebuildClients(configuration)
	return nil
}
