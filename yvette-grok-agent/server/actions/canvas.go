package actions

import (
	"context"
	"strings"

	"github.com/yvettejade/mattermost/yvette-grok-agent/server/llm"
)

func CanvasTitle(title string) string {
	title = strings.TrimSpace(title)
	if title == "" {
		title = "Untitled"
	}
	if strings.HasPrefix(strings.ToLower(title), "canvas:") {
		return title
	}
	return "Canvas: " + title
}

func BuildCanvas(ctx context.Context, client llm.Client, title, brief, history string) (string, error) {
	return client.Complete(ctx, llm.CompletionRequest{
		Messages: []llm.Message{
			{Role: "system", Content: llm.SystemCanvas},
			{Role: "user", Content: llm.CanvasUserPrompt(CanvasTitle(title), brief, history)},
		},
		Temperature: 0.2,
	})
}

func CanvasTemplate(title string) string {
	return "# " + CanvasTitle(title) + `

## Goals

## Decisions

## Action items

## Notes
`
}
