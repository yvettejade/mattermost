// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"os"
	"strings"
)

const (
	pluginID    = "com.mattermost.yvette-grok-agent"
	botUsername = "yvette-grok"
	botDisplay  = "Yvette Grok"
	botDesc     = "Workspace AI agent that answers from Mattermost history and can draft, summarize, schedule, and route work."

	slashTrigger = "yvette"

	apiKeyEnv    = "YvetteGrokAPI"
	apiKeyAltEnv = "MM_GROKAGENTSETTINGS_APIKEY"
	modelEnv     = "YvetteGrokModel"
	apiURLEnv    = "YvetteGrokAPIURL"

	defaultModel     = "grok-3"
	defaultAPIURL    = "https://api.x.ai/v1/chat/completions"
	defaultGitHub    = "https://github.com/yvettejade/mattermost"
	defaultJiraURL   = "https://fe-anysphere-demo.atlassian.net/jira/software/projects/YJIRA/"
	propFromAgent    = "from_yvette_grok_agent"
	contextPostLimit = 50
	historyMaxAge    = 7 * 24 * 60 * 60 * 1000 // 7 days in ms
	meetingWindowMs  = 8 * 60 * 60 * 1000      // 8 hours in ms
)

type configuration struct {
	GitHubRepo      string
	GitHubToken     string
	JiraURL         string
	JiraEmail       string
	JiraToken       string
	RouteWebhookURL string
	GrokModel       string
	GrokAPIURL      string
}

func (c *configuration) clone() *configuration {
	if c == nil {
		return &configuration{}
	}
	copy := *c
	return &copy
}

func (c *configuration) githubRepo() string {
	if c != nil && strings.TrimSpace(c.GitHubRepo) != "" {
		return strings.TrimSpace(c.GitHubRepo)
	}
	return defaultGitHub
}

func (c *configuration) jiraURL() string {
	if c != nil && strings.TrimSpace(c.JiraURL) != "" {
		return strings.TrimSpace(c.JiraURL)
	}
	return defaultJiraURL
}

func (c *configuration) grokModel() string {
	if model := strings.TrimSpace(os.Getenv(modelEnv)); model != "" {
		return model
	}
	if c != nil && strings.TrimSpace(c.GrokModel) != "" {
		return strings.TrimSpace(c.GrokModel)
	}
	return defaultModel
}

func (c *configuration) grokAPIURL() string {
	if apiURL := strings.TrimSpace(os.Getenv(apiURLEnv)); apiURL != "" {
		return apiURL
	}
	if c != nil && strings.TrimSpace(c.GrokAPIURL) != "" {
		return strings.TrimSpace(c.GrokAPIURL)
	}
	return defaultAPIURL
}

func grokAPIKey() string {
	if key := strings.TrimSpace(os.Getenv(apiKeyEnv)); key != "" {
		return key
	}
	return strings.TrimSpace(os.Getenv(apiKeyAltEnv))
}

func grokAPIConfigured() bool {
	return grokAPIKey() != ""
}

func (p *Plugin) getConfiguration() *configuration {
	p.configurationLock.RLock()
	defer p.configurationLock.RUnlock()
	if p.configuration == nil {
		return &configuration{}
	}
	return p.configuration
}

func (p *Plugin) setConfiguration(configuration *configuration) {
	p.configurationLock.Lock()
	defer p.configurationLock.Unlock()
	p.configuration = configuration
}

// OnConfigurationChange updates the active configuration under lock.
func (p *Plugin) OnConfigurationChange() error {
	var configuration = new(configuration)
	if p.API != nil {
		if err := p.API.LoadPluginConfiguration(configuration); err != nil {
			return err
		}
	}
	p.setConfiguration(configuration)
	return nil
}
