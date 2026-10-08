package actions

import (
	"context"

	"github.com/yvettejade/mattermost/yvette-grok-agent/server/llm"
)

func Summarize(ctx context.Context, client llm.Client, scope, history, question string) (string, error) {
	return client.Complete(ctx, llm.CompletionRequest{
		Messages: []llm.Message{
			{Role: "system", Content: llm.SystemSummarize},
			{Role: "user", Content: llm.SummarizeUserPrompt(scope, question, history)},
		},
		Temperature: 0.2,
	})
}
