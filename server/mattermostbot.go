// Copyright (c) 2023-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"github.com/mattermost/mattermost-plugin-ai/bots"
	"github.com/mattermost/mattermost-plugin-ai/config"
	"github.com/mattermost/mattermost-plugin-ai/llm"
)

// ensureMattermostBotConfig adds the default MattermostBot and its Grok service
// when they are missing. The xAI key is not written here; it is read from the
// environment when the client is created.
func ensureMattermostBotConfig(cfg config.Config) (config.Config, bool) {
	changed := false

	if _, ok := cfg.GetServiceByID(bots.GrokServiceID); !ok {
		cfg.Services = append(cfg.Services, bots.GrokServiceConfig())
		changed = true
	}

	addedBot := false
	if !hasBotNamed(cfg.Bots, bots.MattermostBotUsername) {
		// Append so an existing bot stays in the single slot a non-E20 license
		// keeps. A fresh config has no bots, so MattermostBot is that slot.
		cfg.Bots = append(cfg.Bots, bots.MattermostBotConfig())
		addedBot = true
		changed = true
	}

	if addedBot || cfg.DefaultBotName == "" {
		if cfg.DefaultBotName != bots.MattermostBotUsername {
			cfg.DefaultBotName = bots.MattermostBotUsername
			changed = true
		}
	}

	return cfg, changed
}

func hasBotNamed(botCfgs []llm.BotConfig, name string) bool {
	for _, botCfg := range botCfgs {
		if botCfg.Name == name {
			return true
		}
	}
	return false
}
