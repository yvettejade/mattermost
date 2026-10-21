package main

import (
	"time"

	"github.com/mattermost/mattermost/server/public/pluginapi"
	"github.com/pkg/errors"
)

// Session keys are plugin-owned. Never prefix with mmi_ (reserved by pluginapi).
const (
	sessionKeyPrefix = "yga_session_"
	sessionTTL       = 30 * time.Minute
)

type sessionState struct {
	UserID    string `json:"user_id"`
	ChannelID string `json:"channel_id"`
	RootID    string `json:"root_id"`
	TeamID    string `json:"team_id"`
	Kind      string `json:"kind"`
}

func sessionKey(id string) string {
	return sessionKeyPrefix + id
}

func (p *Plugin) putSession(id string, state sessionState) error {
	if p.client == nil {
		return errors.New("plugin client is not initialized")
	}
	_, err := p.client.KV.Set(sessionKey(id), state, pluginapi.SetExpiry(sessionTTL))
	return err
}

func (p *Plugin) getSession(id string) (sessionState, error) {
	var state sessionState
	if p.client == nil {
		return state, errors.New("plugin client is not initialized")
	}
	if err := p.client.KV.Get(sessionKey(id), &state); err != nil {
		return state, err
	}
	return state, nil
}

func (p *Plugin) deleteSession(id string) {
	if p.client == nil {
		return
	}
	_ = p.client.KV.Delete(sessionKey(id))
}
