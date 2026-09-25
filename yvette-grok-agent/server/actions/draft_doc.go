package actions

import (
	"context"
	"regexp"
	"strings"

	"github.com/yvettejade/mattermost/yvette-grok-agent/server/llm"
)

func DraftDoc(ctx context.Context, client llm.Client, title, brief, history string) (string, error) {
	return client.Complete(ctx, llm.CompletionRequest{
		Messages: []llm.Message{
			{Role: "system", Content: llm.SystemDraft},
			{Role: "user", Content: llm.DraftUserPrompt(title, brief, history)},
		},
		Temperature: 0.2,
	})
}

func DraftFilename(title string, canvas bool) string {
	slug := slugify(title)
	if slug == "" {
		slug = "untitled"
	}
	if canvas {
		return "canvas-" + slug + ".md"
	}
	return slug + ".md"
}

var nonSlug = regexp.MustCompile(`[^a-z0-9]+`)

func slugify(s string) string {
	s = strings.ToLower(strings.TrimSpace(s))
	s = nonSlug.ReplaceAllString(s, "-")
	return strings.Trim(s, "-")
}
