// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"errors"
	"sort"
	"strings"
	"unicode/utf8"
)

const (
	PostTypePoll  = PostCustomTypePrefix + "poll"
	PostPropsPoll = "poll"

	// PollKVNamespace is the plugin KV store namespace polls are persisted under.
	// It is reverse-DNS like a plugin ID so it cannot clash with core keys.
	PollKVNamespace = "com.mattermost.polls"

	PollMinOptions        = 2
	PollMaxOptions        = 10
	PollQuestionMaxRunes  = 300
	PollOptionMaxRunes    = 100
)

type PollOption struct {
	ID   string `json:"id"`
	Text string `json:"text"`
}

type Poll struct {
	Question string       `json:"question"`
	Options  []PollOption `json:"options"`
}

type PollVote struct {
	OptionID string `json:"option_id"`
	VotedAt  int64  `json:"voted_at"`
}

// PollVotes maps a user ID to that user's single current vote.
type PollVotes map[string]PollVote

type PollResults struct {
	PostID     string              `json:"post_id"`
	Votes      map[string][]string `json:"votes"`
	TotalVotes int                 `json:"total_votes"`
}

type PollVoteRequest struct {
	OptionID string `json:"option_id"`
}

func PollVotesKVKey(postID string) string {
	return "votes_" + postID
}

func PollFromPost(post *Post) (*Poll, error) {
	if post == nil || post.Type != PostTypePoll {
		return nil, errors.New("post is not a poll")
	}

	raw := post.GetProp(PostPropsPoll)
	if raw == nil {
		return nil, errors.New("poll props missing")
	}

	b, err := json.Marshal(raw)
	if err != nil {
		return nil, err
	}

	var poll Poll
	if err := json.Unmarshal(b, &poll); err != nil {
		return nil, err
	}

	if err := poll.IsValid(); err != nil {
		return nil, err
	}

	return &poll, nil
}

func (p *Poll) IsValid() error {
	question := strings.TrimSpace(p.Question)
	if question == "" {
		return errors.New("poll question is required")
	}
	if utf8.RuneCountInString(question) > PollQuestionMaxRunes {
		return errors.New("poll question is too long")
	}
	if len(p.Options) < PollMinOptions || len(p.Options) > PollMaxOptions {
		return errors.New("poll must have between 2 and 10 options")
	}

	seen := make(map[string]bool, len(p.Options))
	for _, o := range p.Options {
		if o.ID == "" || seen[o.ID] {
			return errors.New("poll option ids must be unique and non-empty")
		}
		seen[o.ID] = true

		text := strings.TrimSpace(o.Text)
		if text == "" || utf8.RuneCountInString(text) > PollOptionMaxRunes {
			return errors.New("poll option text is empty or too long")
		}
	}

	return nil
}

func (p *Poll) HasOption(optionID string) bool {
	for _, o := range p.Options {
		if o.ID == optionID {
			return true
		}
	}
	return false
}

// WithVote returns a copy of the votes with userID's vote set to optionID,
// replacing any previous vote. An empty optionID retracts the vote.
// The receiver is never mutated so callers can compare-and-set safely.
func (v PollVotes) WithVote(userID, optionID string, now int64) PollVotes {
	next := make(PollVotes, len(v)+1)
	for k, vote := range v {
		next[k] = vote
	}

	if optionID == "" {
		delete(next, userID)
		return next
	}

	if prev, ok := next[userID]; ok && prev.OptionID == optionID {
		return next
	}

	next[userID] = PollVote{OptionID: optionID, VotedAt: now}
	return next
}

// Results aggregates votes per option, ordered by vote time so the earliest
// voter is first. Votes for options no longer on the poll are ignored.
func (v PollVotes) Results(poll *Poll, postID string) *PollResults {
	results := &PollResults{
		PostID: postID,
		Votes:  make(map[string][]string, len(poll.Options)),
	}
	for _, o := range poll.Options {
		results.Votes[o.ID] = []string{}
	}

	userIDs := make([]string, 0, len(v))
	for userID := range v {
		userIDs = append(userIDs, userID)
	}
	sort.Slice(userIDs, func(i, j int) bool {
		a, b := v[userIDs[i]], v[userIDs[j]]
		if a.VotedAt != b.VotedAt {
			return a.VotedAt < b.VotedAt
		}
		return userIDs[i] < userIDs[j]
	})

	for _, userID := range userIDs {
		optionID := v[userID].OptionID
		if voters, ok := results.Votes[optionID]; ok {
			results.Votes[optionID] = append(voters, userID)
			results.TotalVotes++
		}
	}

	return results
}
