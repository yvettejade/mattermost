//go:build ignore

// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"context"
	"fmt"
	"os"

	"github.com/mattermost/mattermost/server/v8/channels/app/assistant"
)

func main() {
	key := os.Getenv(assistant.APIKeyEnv)
	client := assistant.NewGrokClient(nil)
	reply, err := client.Complete(context.Background(), []assistant.Message{
		{Role: "system", Content: assistant.GroundingRules + "\nReply with one short sentence."},
		{Role: "user", Content: "User request:\nWhat did alice say?\n\nContext packet:\n[1] id=p1 channel=town author=alice time=2026-09-22T18:00:00Z\nThe deploy is Friday.\n"},
	})
	if err != nil {
		fmt.Println("status=error")
		fmt.Println(assistant.Redact(err.Error(), key))
		os.Exit(1)
	}
	fmt.Println("status=ok")
	fmt.Println(assistant.Redact(reply, key))
}
