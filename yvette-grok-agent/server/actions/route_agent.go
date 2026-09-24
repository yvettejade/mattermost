package actions

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"
)

type RoutePayload struct {
	Source    string   `json:"source"`
	UserID    string   `json:"user_id"`
	ChannelID string   `json:"channel_id"`
	Brief     string   `json:"brief"`
	Agent     string   `json:"agent,omitempty"`
	Links     []string `json:"links,omitempty"`
}

func HandoffCard(agent, brief, userID, channelID string) string {
	if strings.TrimSpace(agent) == "" {
		agent = "(unspecified agent)"
	}
	if strings.TrimSpace(brief) == "" {
		brief = "(no brief)"
	}
	return fmt.Sprintf("## Agent handoff\n\n**To:** `%s`\n**From:** `%s`\n**Channel:** `%s`\n**Brief:** %s\n",
		agent, userID, channelID, brief)
}

func PostWebhook(ctx context.Context, hookURL string, payload RoutePayload) error {
	if strings.TrimSpace(hookURL) == "" {
		return nil
	}
	if payload.Source == "" {
		payload.Source = "mattermost"
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, hookURL, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		return fmt.Errorf("agent webhook http %d", resp.StatusCode)
	}
	return nil
}
