// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package assistant

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestRedact(t *testing.T) {
	origGetenv := getenv
	t.Cleanup(func() { getenv = origGetenv })

	getenv = func(key string) string {
		switch key {
		case EnvGrokAPI:
			return "grok-secret"
		case EnvJira:
			return "jira-secret"
		default:
			return ""
		}
	}

	in := "key grok-secret and jira-secret Authorization: Bearer abcdefghijklmnop"
	out := Redact(in)
	assert.NotContains(t, out, "grok-secret")
	assert.NotContains(t, out, "jira-secret")
	assert.NotContains(t, out, "abcdefghijklmnop")
	assert.Contains(t, out, "[REDACTED]")
}
