// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package assistant

import (
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestBuildMessagesGroundsOnlyVisiblePosts(t *testing.T) {
	now := time.Date(2026, 9, 22, 18, 0, 0, 0, time.UTC)
	visible := Post{
		ID: "visible", ChannelID: "town", Author: "alice",
		CreateAt: now.UnixMilli(), Text: "Ship the billing fix Friday",
	}
	secret := Post{
		ID: "secret", ChannelID: "private-dm", Author: "mallory",
		CreateAt: now.UnixMilli(), Text: "Do not leak the private decision",
	}
	prepared := PrepareContext([]Post{visible, secret}, func(channelID string) bool {
		return channelID == "town"
	}, time.Time{}, MaxPosts)

	req := Route("summarize this thread", now)
	system, user, data := BuildMessages(req, prepared)

	require.Contains(t, system, "You may only use the posts in the context packet")
	require.Contains(t, system, "Do not invent messages, names, or decisions")
	require.Contains(t, system, "information is not in the retrieved posts")
	require.Contains(t, system, "summarizer specialist")

	require.Contains(t, user, "summarize this thread")
	require.NotContains(t, user, "Ship the billing fix Friday")
	require.Contains(t, data, "author=alice")
	require.Contains(t, data, "time=2026-09-22T18:00:00Z")
	require.Contains(t, data, "Ship the billing fix Friday")
	require.NotContains(t, data, "mallory")
	require.NotContains(t, data, "Do not leak the private decision")
	require.NotContains(t, data, "private-dm")
}

func TestBuildMessagesIncludesJiraPacket(t *testing.T) {
	req := Route("status of PLAT-9", time.Now().UTC())
	req.JiraPacket = "tool getJiraIssue:\nPLAT-9 status is Open assignee is sam\n"
	system, user, data := BuildMessages(req, nil)
	require.Contains(t, system, "Do not invent issue keys, statuses, or assignees")
	require.Contains(t, system, "Jira packet")
	require.Contains(t, user, "status of PLAT-9")
	require.NotContains(t, user, "Jira packet:")
	require.Contains(t, data, "Jira packet:")
	require.Contains(t, data, "PLAT-9 status is Open assignee is sam")
	require.Contains(t, data, "(no posts)")
	require.NotContains(t, data, "ZZ-999")
}

func TestBuildMessagesIncludesContextNote(t *testing.T) {
	req := Route("catch me up", time.Now().UTC())
	req.ContextNote = "Last visit time is not available."
	_, user, data := BuildMessages(req, []Post{{
		ID: "p", ChannelID: "town", Author: "bob", CreateAt: 1, Text: "hello",
	}})
	require.True(t, strings.Contains(user, "Last visit time is not available."))
	require.NotContains(t, user, "author=bob")
	require.Contains(t, data, "author=bob")
}
