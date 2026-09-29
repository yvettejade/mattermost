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

// UngroundedJiraReply replaces a completion that names a Jira issue the lookup did not return.
const UngroundedJiraReply = "I can't answer with issue keys that were not in the Jira lookup."

// Run sends prepared posts to the selected specialist.
// posts must already be permission-filtered. An empty slice does not call the model
// unless a Jira packet is present to answer from.
func Run(ctx context.Context, req Request, posts []Post, completer Completer) (Result, error) {
	result := Result{Action: req.Action, Specialist: req.Specialist}
	if len(posts) == 0 && strings.TrimSpace(req.JiraPacket) == "" {
		result.MissingContext = true
		return result, nil
	}
	if completer == nil {
		return result, errNoCompleter
	}

	system, instruction, data := BuildMessages(req, posts)
	reply, err := completer.Complete(ctx, []Message{
		{Role: "system", Content: system},
		{Role: "user", Content: data},
		{Role: "assistant", Content: UntrustedDataBoundary},
		{Role: "user", Content: instruction},
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
		// A scheduled post is published. Notes copied from channel posts are not confirmed.
		if req.Action == ActionSchedulePost && !PayloadConfirmed(grounded.Proposal.Notes, req.Raw) {
			grounded.Proposal.Notes = ""
		}
		result.Proposal = &grounded.Proposal
		result.DroppedAttendees = grounded.DroppedAttendees
		result.TimeCleared = grounded.TimeCleared
		result.Reply = FormatProposal(grounded, req.Action == ActionSchedulePost)
		return finishRun(req, result), nil
	case ActionDraftPost, ActionDraftDocument, ActionCreateBoard:
		title, body := ParseDraft(reply)
		result.DraftTitle = title
		result.DraftBody = body
		if body == "" {
			result.DraftBody = reply
		}
		result.Reply = reply
		return finishRun(req, result), nil
	default:
		result.Reply = reply
		return finishRun(req, result), nil
	}
}

// finishRun keeps only issue keys the Jira lookup returned.
// LookupFixed does not search req.Raw or channel posts, so those keys are not grounded.
func finishRun(req Request, result Result) Result {
	if !req.WantsJira && strings.TrimSpace(req.JiraPacket) == "" {
		return result
	}
	allowed := map[string]bool{}
	for _, key := range collectIssueKeys(req.JiraPacket, 0) {
		allowed[key] = true
	}
	for _, key := range collectIssueKeys(result.Reply, 0) {
		if !allowed[key] {
			result.Action = ActionAnswer
			result.Reply = UngroundedJiraReply
			result.Proposal = nil
			result.DraftTitle = ""
			result.DraftBody = ""
			result.DroppedAttendees = nil
			result.TimeCleared = false
			return result
		}
	}
	return result
}
