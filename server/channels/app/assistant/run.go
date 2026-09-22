// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package assistant

import (
	"context"
	"strings"
)

// Message is one chat-completions message.
type Message struct {
	Role    string
	Content string
}

// Completer produces a grounded reply. Tests substitute a fake.
type Completer interface {
	Complete(ctx context.Context, messages []Message) (string, error)
}

// Result is the assistant reply plus fields the slash command uses for side effects.
type Result struct {
	Reply            string
	MissingContext   bool
	Action           Action
	Specialist       Specialist
	DraftTitle       string
	DraftBody        string
	Proposal         *MeetingProposal
	DroppedAttendees []string
	TimeCleared      bool
}

// Run sends prepared posts to the selected specialist.
// posts must already be permission-filtered. An empty slice does not call the model.
func Run(ctx context.Context, req Request, posts []Post, completer Completer) (Result, error) {
	result := Result{Action: req.Action, Specialist: req.Specialist}
	if len(posts) == 0 {
		result.MissingContext = true
		return result, nil
	}
	if completer == nil {
		return result, errNoCompleter
	}

	system, user := BuildMessages(req, posts)
	reply, err := completer.Complete(ctx, []Message{
		{Role: "system", Content: system},
		{Role: "user", Content: user},
	})
	if err != nil {
		return result, err
	}
	reply = strings.TrimSpace(reply)
	if reply == "" {
		return result, errEmptyCompletion
	}

	switch req.Action {
	case ActionScheduleMeeting, ActionSchedulePost:
		proposal, ok := ParseMeetingProposal(reply)
		if !ok {
			result.Reply = UnreadableProposalReply
			return result, nil
		}
		grounded := GroundProposal(proposal, Corpus(posts, req.Raw))
		result.Proposal = &grounded.Proposal
		result.DroppedAttendees = grounded.DroppedAttendees
		result.TimeCleared = grounded.TimeCleared
		result.Reply = FormatProposal(grounded, req.Action == ActionSchedulePost)
		return result, nil
	case ActionDraftPost, ActionDraftDocument, ActionCreateBoard:
		title, body := ParseDraft(reply)
		result.DraftTitle = title
		result.DraftBody = body
		if body == "" {
			result.DraftBody = reply
		}
		result.Reply = reply
		return result, nil
	default:
		result.Reply = reply
		return result, nil
	}
}
