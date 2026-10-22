// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"bytes"
	"encoding/json"
	"errors"
	"reflect"
	"sort"
	"strings"
	"unicode/utf8"
)

const (
	PostTypePoll  = PostCustomTypePrefix + "poll"
	PostPropsPoll = "poll"

	// PollKVNamespace is the plugin KV store namespace polls are persisted under.
	// It is reserved so that no installed plugin can share it, see IsReservedPluginId.
	PollKVNamespace = "com.mattermost.polls"

	PollMinOptions       = 2
	PollMaxOptions       = 10
	PollQuestionMaxRunes = 300
	PollOptionMaxRunes   = 100

	// PollPropsMaxBytes bounds the raw props.poll payload accepted from clients,
	// comfortably above the largest valid poll (all limits at max, 4-byte runes).
	PollPropsMaxBytes = 8 * 1024
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

// PollState is the value persisted in the KV store for a poll.
// UpdateAt strictly increases on every write so clients can drop stale results.
type PollState struct {
	Votes    PollVotes `json:"votes"`
	UpdateAt int64     `json:"update_at"`
}

type PollResults struct {
	PostID     string              `json:"post_id"`
	Votes      map[string][]string `json:"votes"`
	TotalVotes int                 `json:"total_votes"`
	UpdateAt   int64               `json:"update_at"`
}

type PollVoteRequest struct {
	OptionID string `json:"option_id"`
}

func PollVotesKVKey(postID string) string {
	return "votes_" + postID
}

func IsReservedPluginId(id string) bool {
	return strings.EqualFold(id, PollKVNamespace)
}

func decodePollProp(raw any) (*Poll, error) {
	if raw == nil {
		return nil, errors.New("poll props missing")
	}

	b, err := json.Marshal(raw)
	if err != nil {
		return nil, err
	}
	if len(b) > PollPropsMaxBytes {
		return nil, errors.New("poll props are too large")
	}

	dec := json.NewDecoder(bytes.NewReader(b))
	dec.DisallowUnknownFields()
	var poll Poll
	if err := dec.Decode(&poll); err != nil {
		return nil, err
	}

	return &poll, nil
}

func PollFromPost(post *Post) (*Poll, error) {
	if post == nil || post.Type != PostTypePoll {
		return nil, errors.New("post is not a poll")
	}

	poll, err := decodePollProp(post.GetProp(PostPropsPoll))
	if err != nil {
		return nil, err
	}

	if err := poll.IsValid(); err != nil {
		return nil, err
	}

	return poll, nil
}

// NormalizePollPost validates a new poll post and rewrites props.poll to its
// canonical form: trimmed text and server-generated option IDs.
func NormalizePollPost(post *Post) error {
	poll, err := decodePollProp(post.GetProp(PostPropsPoll))
	if err != nil {
		return err
	}

	normalized := Poll{
		Question: strings.TrimSpace(poll.Question),
		Options:  make([]PollOption, len(poll.Options)),
	}
	for i, o := range poll.Options {
		normalized.Options[i] = PollOption{ID: NewId(), Text: strings.TrimSpace(o.Text)}
	}

	if err := normalized.IsValid(); err != nil {
		return err
	}

	post.AddProp(PostPropsPoll, normalized)
	return nil
}

// PollPropsEqual reports whether two posts carry the same props.poll value,
// regardless of whether it is held as a Poll struct or a decoded JSON map.
func PollPropsEqual(a, b *Post) bool {
	aVal, aErr := canonicalJSONValue(a.GetProp(PostPropsPoll))
	bVal, bErr := canonicalJSONValue(b.GetProp(PostPropsPoll))
	return aErr == nil && bErr == nil && reflect.DeepEqual(aVal, bVal)
}

func canonicalJSONValue(v any) (any, error) {
	b, err := json.Marshal(v)
	if err != nil {
		return nil, err
	}
	var out any
	err = json.Unmarshal(b, &out)
	return out, err
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
// replacing any previous vote, and whether anything changed. An empty
// optionID retracts the vote. The receiver is never mutated so callers can
// compare-and-set safely.
func (v PollVotes) WithVote(userID, optionID string, now int64) (PollVotes, bool) {
	prev, hadVote := v[userID]
	if optionID == "" && !hadVote {
		return v, false
	}
	if hadVote && prev.OptionID == optionID {
		return v, false
	}

	next := make(PollVotes, len(v)+1)
	for k, vote := range v {
		next[k] = vote
	}

	if optionID == "" {
		delete(next, userID)
	} else {
		next[userID] = PollVote{OptionID: optionID, VotedAt: now}
	}
	return next, true
}

// Results aggregates votes per option, ordered by vote time so the earliest
// voter is first. Votes for options no longer on the poll are ignored.
func (s PollState) Results(poll *Poll, postID string) *PollResults {
	results := &PollResults{
		PostID:   postID,
		Votes:    make(map[string][]string, len(poll.Options)),
		UpdateAt: s.UpdateAt,
	}
	for _, o := range poll.Options {
		results.Votes[o.ID] = []string{}
	}

	userIDs := make([]string, 0, len(s.Votes))
	for userID := range s.Votes {
		userIDs = append(userIDs, userID)
	}
	sort.Slice(userIDs, func(i, j int) bool {
		a, b := s.Votes[userIDs[i]], s.Votes[userIDs[j]]
		if a.VotedAt != b.VotedAt {
			return a.VotedAt < b.VotedAt
		}
		return userIDs[i] < userIDs[j]
	})

	for _, userID := range userIDs {
		optionID := s.Votes[userID].OptionID
		if voters, ok := results.Votes[optionID]; ok {
			results.Votes[optionID] = append(voters, userID)
			results.TotalVotes++
		}
	}

	return results
}
