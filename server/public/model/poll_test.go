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

func TestPollVotesWithVote(t *testing.T) {
	t.Run("casts a vote without mutating the original", func(t *testing.T) {
		original := PollVotes{}
		next := original.WithVote("u1", "a", 100)

		assert.Empty(t, original)
		assert.Equal(t, PollVote{OptionID: "a", VotedAt: 100}, next["u1"])
	})

	t.Run("changing a vote replaces it", func(t *testing.T) {
		votes := PollVotes{}.WithVote("u1", "a", 100).WithVote("u1", "b", 200)

		require.Len(t, votes, 1)
		assert.Equal(t, PollVote{OptionID: "b", VotedAt: 200}, votes["u1"])
	})

	t.Run("re-voting the same option keeps the original timestamp", func(t *testing.T) {
		votes := PollVotes{}.WithVote("u1", "a", 100).WithVote("u1", "a", 200)
		assert.Equal(t, int64(100), votes["u1"].VotedAt)
	})

	t.Run("empty option retracts", func(t *testing.T) {
		votes := PollVotes{}.WithVote("u1", "a", 100).WithVote("u1", "", 200)
		assert.Empty(t, votes)
	})
}

func TestPollVotesResults(t *testing.T) {
	poll := newTestPoll()

	t.Run("no votes", func(t *testing.T) {
		results := PollVotes{}.Results(poll, "post1")

		assert.Equal(t, "post1", results.PostID)
		assert.Equal(t, 0, results.TotalVotes)
		assert.Equal(t, map[string][]string{"a": {}, "b": {}, "c": {}}, results.Votes)
	})

	t.Run("groups voters by option in vote order", func(t *testing.T) {
		votes := PollVotes{
			"u3": {OptionID: "a", VotedAt: 300},
			"u1": {OptionID: "a", VotedAt: 100},
			"u2": {OptionID: "b", VotedAt: 200},
			"u0": {OptionID: "a", VotedAt: 300},
		}
		results := votes.Results(poll, "post1")

		assert.Equal(t, 4, results.TotalVotes)
		assert.Equal(t, []string{"u1", "u0", "u3"}, results.Votes["a"])
		assert.Equal(t, []string{"u2"}, results.Votes["b"])
		assert.Equal(t, []string{}, results.Votes["c"])
	})

	t.Run("ignores votes for removed options", func(t *testing.T) {
		votes := PollVotes{
			"u1": {OptionID: "a", VotedAt: 100},
			"u2": {OptionID: "gone", VotedAt: 200},
		}
		results := votes.Results(poll, "post1")

		assert.Equal(t, 1, results.TotalVotes)
		assert.NotContains(t, results.Votes, "gone")
	})
}
