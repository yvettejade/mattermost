// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package assistant

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestPrepareContextFiltersChannelsAndWindow(t *testing.T) {
	since := time.Date(2026, 9, 1, 0, 0, 0, 0, time.UTC)
	posts := []Post{
		{ID: "old", ChannelID: "town", Author: "alice", CreateAt: since.Add(-time.Hour).UnixMilli(), Text: "old note"},
		{ID: "secret", ChannelID: "private", Author: "mallory", CreateAt: since.Add(time.Hour).UnixMilli(), Text: "secret plan"},
		{ID: "blank", ChannelID: "", Author: "ghost", CreateAt: since.Add(time.Hour).UnixMilli(), Text: "no channel"},
		{ID: "new", ChannelID: "town", Author: "bob", CreateAt: since.Add(2 * time.Hour).UnixMilli(), Text: "ship Friday"},
		{ID: "mid", ChannelID: "town", Author: "alice", CreateAt: since.Add(time.Hour).UnixMilli(), Text: "review the doc"},
	}

	got := PrepareContext(posts, func(channelID string) bool {
		return channelID == "town"
	}, since, 10)

	require.Len(t, got, 2)
	require.Equal(t, "mid", got[0].ID)
	require.Equal(t, "new", got[1].ID)

	denied := PrepareContext(posts, nil, time.Time{}, 10)
	require.Empty(t, denied)
}

func TestPrepareContextKeepsNewest(t *testing.T) {
	posts := []Post{
		{ID: "a", ChannelID: "town", Author: "alice", CreateAt: 1, Text: "one"},
		{ID: "b", ChannelID: "town", Author: "alice", CreateAt: 2, Text: "two"},
		{ID: "c", ChannelID: "town", Author: "alice", CreateAt: 3, Text: "three"},
	}
	got := PrepareContext(posts, func(string) bool { return true }, time.Time{}, 2)
	require.Equal(t, []string{"b", "c"}, []string{got[0].ID, got[1].ID})
}

func TestFormatContextIncludesAuthorTimeAndText(t *testing.T) {
	post := Post{
		ID:        "p1",
		ChannelID: "town",
		Author:    "alice",
		CreateAt:  time.Date(2026, 9, 22, 18, 0, 0, 0, time.UTC).UnixMilli(),
		Text:      "We decided to ship Friday",
	}
	packet := FormatContext([]Post{post})
	require.Contains(t, packet, "author=alice")
	require.Contains(t, packet, "time=2026-09-22T18:00:00Z")
	require.Contains(t, packet, "We decided to ship Friday")
	require.NotContains(t, packet, "secret plan")
}

func TestFormatContextTruncatesAndMarksMissingText(t *testing.T) {
	long := stringsRepeat("x", MaxMessageRunes+20)
	packet := FormatContext([]Post{{
		ID: "p", ChannelID: "town", Author: "", CreateAt: 0, Text: long,
	}})
	require.Contains(t, packet, "(author not resolved)")
	require.Contains(t, packet, "[truncated]")

	empty := FormatContext([]Post{{ID: "p", ChannelID: "town", Author: "alice", CreateAt: 0, Text: "  "}})
	require.Contains(t, empty, "(no text)")
	require.Equal(t, "(no posts)\n", FormatContext(nil))
}

func stringsRepeat(s string, n int) string {
	out := make([]byte, 0, len(s)*n)
	for range n {
		out = append(out, s...)
	}
	return string(out)
}
