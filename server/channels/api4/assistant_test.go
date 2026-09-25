// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

func TestNormalizeAssistantMessage(t *testing.T) {
	message, ok := normalizeAssistantMessage("  summarize this channel  ")
	require.True(t, ok)
	require.Equal(t, "summarize this channel", message)

	_, ok = normalizeAssistantMessage("   ")
	require.False(t, ok)

	_, ok = normalizeAssistantMessage(strings.Repeat("a", model.PostMessageMaxRunesV2+1))
	require.False(t, ok)

	message, ok = normalizeAssistantMessage(strings.Repeat("a", model.PostMessageMaxRunesV2))
	require.True(t, ok)
	require.Len(t, message, model.PostMessageMaxRunesV2)
}
