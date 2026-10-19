package main

import (
	"testing"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/require"
)

func TestFilterAndCapIgnoresBotAndPluginPosts(t *testing.T) {
	bot := "bot-user"
	now := time.Now().UnixMilli()
	posts := []*model.Post{
		{Id: "1", UserId: "alice", Message: "hello", CreateAt: now - 1000},
		{Id: "2", UserId: bot, Message: "I am the bot", CreateAt: now - 900},
		{Id: "3", UserId: "bob", Message: "plugin echo", CreateAt: now - 800, Props: map[string]any{sentByPluginProp: true}},
		{Id: "4", UserId: "carol", Message: "keep me", CreateAt: now - 700},
		{Id: "5", UserId: "dave", Message: "", CreateAt: now - 600},
	}

	got := FilterAndCap(posts, bot, 0, 50)
	require.Len(t, got, 2)
	require.Equal(t, "1", got[0].Id)
	require.Equal(t, "4", got[1].Id)
}

func TestFilterAndCapWindowAndMax(t *testing.T) {
	now := time.Date(2026, 9, 24, 12, 0, 0, 0, time.UTC)
	windowStart := WindowStart(now, 7)
	require.Equal(t, now.Add(-7*24*time.Hour).UnixMilli(), windowStart)

	old := now.Add(-10 * 24 * time.Hour).UnixMilli()
	recent := now.Add(-2 * 24 * time.Hour).UnixMilli()
	posts := []*model.Post{
		{Id: "old", UserId: "a", Message: "too old", CreateAt: old},
		{Id: "a", UserId: "a", Message: "a", CreateAt: recent},
		{Id: "b", UserId: "b", Message: "b", CreateAt: recent + 1},
		{Id: "c", UserId: "c", Message: "c", CreateAt: recent + 2},
	}
	got := FilterAndCap(posts, "", windowStart, 2)
	require.Len(t, got, 2)
	require.Equal(t, "b", got[0].Id)
	require.Equal(t, "c", got[1].Id)
}

func TestFilterAndCapHardCap(t *testing.T) {
	now := time.Now().UnixMilli()
	posts := make([]*model.Post, 0, 120)
	for i := 0; i < 120; i++ {
		posts = append(posts, &model.Post{Id: model.NewId(), UserId: "u", Message: "m", CreateAt: now + int64(i)})
	}
	got := FilterAndCap(posts, "", 0, 500)
	require.Len(t, got, hardCapHistoryMaxPosts)
}

func TestPermalink(t *testing.T) {
	require.Equal(t, "https://mm.example/team/pl/abc", Permalink("https://mm.example/", "team", "abc"))
	require.Equal(t, "https://mm.example/pl/abc", Permalink("https://mm.example", "", "abc"))
}

func TestIncludePostDeleted(t *testing.T) {
	require.False(t, includePost(&model.Post{Id: "x", UserId: "u", Message: "hi", DeleteAt: 1}, "", 0))
}
