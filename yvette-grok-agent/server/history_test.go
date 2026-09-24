// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestPostPermalink(t *testing.T) {
	assert.Equal(t, "https://mm.example/team/pl/abc", postPermalink("https://mm.example/", "team", "abc"))
	assert.Equal(t, "https://mm.example/pl/abc", postPermalink("https://mm.example", "", "abc"))
	assert.Equal(t, "", postPermalink("https://mm.example", "team", ""))
}

func TestWithinHistoryWindow(t *testing.T) {
	now := time.Date(2026, 9, 24, 12, 0, 0, 0, time.UTC).UnixMilli()
	sixDays := now - 6*24*60*60*1000
	eightDays := now - 8*24*60*60*1000
	require.True(t, withinHistoryWindow(sixDays, now, historyMaxAge))
	require.False(t, withinHistoryWindow(eightDays, now, historyMaxAge))
	require.False(t, withinHistoryWindow(0, now, historyMaxAge))

	nineHours := now - 9*60*60*1000
	sevenHours := now - 7*60*60*1000
	require.True(t, withinHistoryWindow(sevenHours, now, meetingWindowMs))
	require.False(t, withinHistoryWindow(nineHours, now, meetingWindowMs))
}

func TestBuildWorkspaceContextText(t *testing.T) {
	ctx := workspaceContext{
		ChannelName: "town-square",
		TeamName:    "cursorteam",
		Posts: []contextPost{{
			Username:  "alice",
			Message:   "ship it",
			CreateAt:  time.Date(2026, 9, 24, 15, 4, 0, 0, time.UTC).UnixMilli(),
			Permalink: "https://mm.example/cursorteam/pl/p1",
		}},
	}
	text := buildWorkspaceContextText(ctx)
	assert.Contains(t, text, "Scope: channel")
	assert.Contains(t, text, "Team: cursorteam")
	assert.Contains(t, text, "@alice: ship it")
	assert.Contains(t, text, "https://mm.example/cursorteam/pl/p1")

	empty := buildWorkspaceContextText(workspaceContext{IsThread: true})
	assert.True(t, strings.Contains(empty, "thread"))
	assert.Contains(t, empty, "(no recent messages)")
}

func TestCitePermalinks(t *testing.T) {
	ctx := workspaceContext{Posts: []contextPost{
		{Permalink: "https://mm.example/t/pl/1"},
		{Permalink: "https://mm.example/t/pl/2"},
		{Permalink: ""},
	}}
	cites := citePermalinks(ctx, 3)
	assert.Contains(t, cites, "Sources:")
	assert.Contains(t, cites, "/pl/1")
	assert.Contains(t, cites, "/pl/2")
	assert.Equal(t, "", citePermalinks(workspaceContext{}, 3))
}

func TestTruncateSnippet(t *testing.T) {
	assert.Equal(t, "short", truncateSnippet("short", 10))
	got := truncateSnippet(strings.Repeat("a", 20), 8)
	assert.True(t, strings.HasSuffix(got, "…"))
	assert.LessOrEqual(t, len(got), 12)
}
