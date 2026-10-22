// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func newTestPoll() *Poll {
	return &Poll{
		Question: "Lunch?",
		Options: []PollOption{
			{ID: "a", Text: "Tacos"},
			{ID: "b", Text: "Pizza"},
			{ID: "c", Text: "Salad"},
		},
	}
}

func TestPollIsValid(t *testing.T) {
	t.Run("valid", func(t *testing.T) {
		require.NoError(t, newTestPoll().IsValid())
	})

	for name, mutate := range map[string]func(p *Poll){
		"empty question":    func(p *Poll) { p.Question = "   " },
		"long question":     func(p *Poll) { p.Question = strings.Repeat("q", PollQuestionMaxRunes+1) },
		"too few options":   func(p *Poll) { p.Options = p.Options[:1] },
		"too many options":  func(p *Poll) { p.Options = make([]PollOption, PollMaxOptions+1) },
		"duplicate id":      func(p *Poll) { p.Options[1].ID = "a" },
		"empty id":          func(p *Poll) { p.Options[0].ID = "" },
		"empty option text": func(p *Poll) { p.Options[0].Text = " " },
		"long option text":  func(p *Poll) { p.Options[0].Text = strings.Repeat("o", PollOptionMaxRunes+1) },
	} {
		t.Run(name, func(t *testing.T) {
			p := newTestPoll()
			mutate(p)
			assert.Error(t, p.IsValid())
		})
	}
}

func TestPollFromPost(t *testing.T) {
	t.Run("parses props", func(t *testing.T) {
		post := &Post{Type: PostTypePoll}
		post.AddProp(PostPropsPoll, map[string]any{
			"question": "Lunch?",
			"options": []any{
				map[string]any{"id": "a", "text": "Tacos"},
				map[string]any{"id": "b", "text": "Pizza"},
			},
		})

		poll, err := PollFromPost(post)
		require.NoError(t, err)
		assert.Equal(t, "Lunch?", poll.Question)
		assert.True(t, poll.HasOption("b"))
		assert.False(t, poll.HasOption("z"))
	})

	t.Run("rejects non-poll posts", func(t *testing.T) {
		_, err := PollFromPost(&Post{Type: PostTypeDefault})
		assert.Error(t, err)
	})

	t.Run("rejects missing props", func(t *testing.T) {
		_, err := PollFromPost(&Post{Type: PostTypePoll})
		assert.Error(t, err)
	})
}

func TestNormalizePollPost(t *testing.T) {
	newPost := func(poll any) *Post {
		post := &Post{Type: PostTypePoll}
		post.AddProp(PostPropsPoll, poll)
		return post
	}

	t.Run("trims text and replaces client option ids", func(t *testing.T) {
		post := newPost(map[string]any{
			"question": "  Lunch?  ",
			"options": []any{
				map[string]any{"id": "a", "text": " Tacos "},
				map[string]any{"id": "a", "text": "Pizza"},
			},
		})

		require.NoError(t, NormalizePollPost(post))
		poll, err := PollFromPost(post)
		require.NoError(t, err)
		assert.Equal(t, "Lunch?", poll.Question)
		assert.Equal(t, "Tacos", poll.Options[0].Text)
		assert.True(t, IsValidId(poll.Options[0].ID))
		assert.NotEqual(t, poll.Options[0].ID, poll.Options[1].ID)
	})

	for name, poll := range map[string]any{
		"missing":         nil,
		"wrong type":      "not a poll",
		"numeric text":    map[string]any{"question": "Q", "options": []any{map[string]any{"text": 1}, map[string]any{"text": "b"}}},
		"one option":      map[string]any{"question": "Q", "options": []any{map[string]any{"text": "a"}}},
		"blank option":    map[string]any{"question": "Q", "options": []any{map[string]any{"text": "a"}, map[string]any{"text": "  "}}},
		"unknown field":   map[string]any{"question": "Q", "extra": true, "options": []any{map[string]any{"text": "a"}, map[string]any{"text": "b"}}},
		"oversized props": map[string]any{"question": "Q", "options": []any{map[string]any{"text": "a"}, map[string]any{"text": strings.Repeat("b", PollPropsMaxBytes)}}},
		"long question":   map[string]any{"question": strings.Repeat("q", PollQuestionMaxRunes+1), "options": []any{map[string]any{"text": "a"}, map[string]any{"text": "b"}}},
	} {
		t.Run("rejects "+name, func(t *testing.T) {
			assert.Error(t, NormalizePollPost(newPost(poll)))
		})
	}
}

func TestPollPropsEqual(t *testing.T) {
	a := &Post{}
	a.AddProp(PostPropsPoll, map[string]any{"question": "Q", "options": []any{map[string]any{"id": "1", "text": "a"}}})
	b := a.Clone()
	assert.True(t, PollPropsEqual(a, b))

	b.AddProp(PostPropsPoll, map[string]any{"question": "Q2", "options": []any{map[string]any{"id": "1", "text": "a"}}})
	assert.False(t, PollPropsEqual(a, b))

	b.DelProp(PostPropsPoll)
	assert.False(t, PollPropsEqual(a, b))

	c := &Post{}
	c.AddProp(PostPropsPoll, Poll{Question: "Q", Options: []PollOption{{ID: "1", Text: "a"}}})
	assert.True(t, PollPropsEqual(a, c))
}

func TestIsReservedPluginId(t *testing.T) {
	assert.True(t, IsReservedPluginId(PollKVNamespace))
	assert.True(t, IsReservedPluginId("COM.mattermost.Polls"))
	assert.False(t, IsReservedPluginId("com.mattermost.calls"))

	m := &Manifest{Id: PollKVNamespace, Name: "polls", Version: "1.0.0"}
	assert.ErrorContains(t, m.IsValid(), "reserved")
}

func TestPollVotesWithVote(t *testing.T) {
	t.Run("casts a vote without mutating the original", func(t *testing.T) {
		original := PollVotes{}
		next, changed := original.WithVote("u1", "a", 100)

		assert.True(t, changed)
		assert.Empty(t, original)
		assert.Equal(t, PollVote{OptionID: "a", VotedAt: 100}, next["u1"])
	})

	t.Run("changing a vote replaces it", func(t *testing.T) {
		votes, _ := PollVotes{}.WithVote("u1", "a", 100)
		votes, changed := votes.WithVote("u1", "b", 200)

		assert.True(t, changed)
		require.Len(t, votes, 1)
		assert.Equal(t, PollVote{OptionID: "b", VotedAt: 200}, votes["u1"])
	})

	t.Run("re-voting the same option is a no-op", func(t *testing.T) {
		votes, _ := PollVotes{}.WithVote("u1", "a", 100)
		votes, changed := votes.WithVote("u1", "a", 200)

		assert.False(t, changed)
		assert.Equal(t, int64(100), votes["u1"].VotedAt)
	})

	t.Run("empty option retracts", func(t *testing.T) {
		votes, _ := PollVotes{}.WithVote("u1", "a", 100)
		votes, changed := votes.WithVote("u1", "", 200)

		assert.True(t, changed)
		assert.Empty(t, votes)
	})

	t.Run("retracting without a vote is a no-op", func(t *testing.T) {
		_, changed := PollVotes{}.WithVote("u1", "", 200)
		assert.False(t, changed)
	})
}

func TestPollStateResults(t *testing.T) {
	poll := newTestPoll()

	t.Run("no votes", func(t *testing.T) {
		results := PollState{}.Results(poll, "post1")

		assert.Equal(t, "post1", results.PostID)
		assert.Equal(t, 0, results.TotalVotes)
		assert.Equal(t, map[string][]string{"a": {}, "b": {}, "c": {}}, results.Votes)
	})

	t.Run("groups voters by option in vote order", func(t *testing.T) {
		state := PollState{UpdateAt: 42, Votes: PollVotes{
			"u3": {OptionID: "a", VotedAt: 300},
			"u1": {OptionID: "a", VotedAt: 100},
			"u2": {OptionID: "b", VotedAt: 200},
			"u0": {OptionID: "a", VotedAt: 300},
		}}
		results := state.Results(poll, "post1")

		assert.Equal(t, int64(42), results.UpdateAt)
		assert.Equal(t, 4, results.TotalVotes)
		assert.Equal(t, []string{"u1", "u0", "u3"}, results.Votes["a"])
		assert.Equal(t, []string{"u2"}, results.Votes["b"])
		assert.Equal(t, []string{}, results.Votes["c"])
	})

	t.Run("ignores votes for removed options", func(t *testing.T) {
		state := PollState{Votes: PollVotes{
			"u1": {OptionID: "a", VotedAt: 100},
			"u2": {OptionID: "gone", VotedAt: 200},
		}}
		results := state.Results(poll, "post1")

		assert.Equal(t, 1, results.TotalVotes)
		assert.NotContains(t, results.Votes, "gone")
	})
}
