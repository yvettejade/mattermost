// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package assistant

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

type fakeCompleter struct {
	messages []Message
	reply    string
	err      error
	called   bool
}

func (f *fakeCompleter) Complete(_ context.Context, messages []Message) (string, error) {
	f.called = true
	f.messages = messages
	return f.reply, f.err
}

func TestRunAnswersFromJiraPacketWhenPostsAreEmpty(t *testing.T) {
	req := Route("status of PLAT-9", time.Now())
	req.JiraPacket = "tool getJiraIssue:\nPLAT-9 status is Open assignee is sam\n"
	fake := &fakeCompleter{reply: "PLAT-9 is Open and assigned to sam."}
	result, err := Run(context.Background(), req, nil, fake)
	require.NoError(t, err)
	require.False(t, result.MissingContext)
	require.True(t, fake.called)
	require.Contains(t, fake.messages[0].Content, "Do not invent issue keys, statuses, or assignees")
	require.Contains(t, fake.messages[1].Content, "PLAT-9 status is Open assignee is sam")
	require.Contains(t, result.Reply, "assigned to sam")
}

func TestRunDropsInventedJiraKey(t *testing.T) {
	req := Route("status of PLAT-9", time.Now())
	req.JiraPacket = "tool getJiraIssue:\nPLAT-9 status is Open assignee is sam\n"
	fake := &fakeCompleter{reply: "PLAT-9 is Open. ZZ-999 is Done and assigned to dana."}
	result, err := Run(context.Background(), req, nil, fake)
	require.NoError(t, err)
	require.Equal(t, UngroundedJiraReply, result.Reply)
	require.NotContains(t, result.Reply, "ZZ-999")
	require.NotContains(t, result.Reply, "dana")
}

func TestRunSkipsModelWhenContextIsEmpty(t *testing.T) {
	fake := &fakeCompleter{reply: "invented answer"}
	result, err := Run(context.Background(), Route("what did we decide?", time.Now()), nil, fake)
	require.NoError(t, err)
	require.True(t, result.MissingContext)
	require.False(t, fake.called)
	require.Empty(t, result.Reply)
}

func TestRunSummarizeUsesGroundedPrompt(t *testing.T) {
	now := time.Date(2026, 9, 22, 18, 0, 0, 0, time.UTC)
	posts := PrepareContext([]Post{
		{ID: "ok", ChannelID: "town", Author: "alice", CreateAt: now.UnixMilli(), Text: "Ship Friday"},
		{ID: "nope", ChannelID: "dm", Author: "mallory", CreateAt: now.UnixMilli(), Text: "private layoff plan"},
	}, func(channelID string) bool { return channelID == "town" }, time.Time{}, MaxPosts)

	fake := &fakeCompleter{reply: "alice said ship Friday at 2026-09-22T18:00:00Z"}
	result, err := Run(context.Background(), Route("summarize this thread", now), posts, fake)
	require.NoError(t, err)
	require.Equal(t, ActionSummarize, result.Action)
	require.Equal(t, SpecialistSummarizer, result.Specialist)
	require.Contains(t, result.Reply, "ship Friday")
	require.Len(t, fake.messages, 2)
	require.Contains(t, fake.messages[0].Content, "You may only use the posts in the context packet")
	require.Contains(t, fake.messages[1].Content, "author=alice")
	require.Contains(t, fake.messages[1].Content, "time=2026-09-22T18:00:00Z")
	require.Contains(t, fake.messages[1].Content, "Ship Friday")
	require.NotContains(t, fake.messages[1].Content, "private layoff plan")
	require.NotContains(t, fake.messages[1].Content, "mallory")
}

func TestRunSchedulerDropsUngroundedProposal(t *testing.T) {
	now := time.Date(2026, 9, 22, 18, 0, 0, 0, time.UTC)
	posts := []Post{{
		ID: "p", ChannelID: "town", Author: "alice", CreateAt: now.UnixMilli(),
		Text: "Can we meet tomorrow?",
	}}
	fake := &fakeCompleter{reply: `{"title":"Sync","time":"2026-09-23T16:00:00Z","attendees":["alice","mallory"],"notes":"meet tomorrow"}`}
	result, err := Run(context.Background(), Route("schedule a meeting tomorrow", now), posts, fake)
	require.NoError(t, err)
	require.NotNil(t, result.Proposal)
	require.Equal(t, []string{"alice"}, result.Proposal.Attendees)
	require.Equal(t, []string{"mallory"}, result.DroppedAttendees)
	require.Contains(t, result.Reply, SchedulingLimitation)
	require.Contains(t, result.Reply, "mallory")
	require.NotContains(t, result.Reply, "Alice decided")
}

func TestRunSchedulerRejectsProse(t *testing.T) {
	posts := []Post{{ID: "p", ChannelID: "town", Author: "alice", CreateAt: 1, Text: "hello"}}
	fake := &fakeCompleter{reply: "Alice and Mallory agreed to ship next Friday."}
	result, err := Run(context.Background(), Route("schedule a meeting", time.Now()), posts, fake)
	require.NoError(t, err)
	require.Equal(t, UnreadableProposalReply, result.Reply)
	require.Nil(t, result.Proposal)
	require.NotContains(t, result.Reply, "Mallory")
}

func TestRunDraftParsesTitle(t *testing.T) {
	posts := []Post{{ID: "p", ChannelID: "town", Author: "alice", CreateAt: 1, Text: "billing is late"}}
	fake := &fakeCompleter{reply: "Title: Billing\nAsk alice about the late billing."}
	result, err := Run(context.Background(), Route("draft a document", time.Now()), posts, fake)
	require.NoError(t, err)
	require.Equal(t, ActionDraftDocument, result.Action)
	require.Equal(t, SpecialistDrafter, result.Specialist)
	require.Equal(t, "Billing", result.DraftTitle)
	require.Equal(t, "Ask alice about the late billing.", result.DraftBody)
	require.Contains(t, fake.messages[0].Content, "drafter specialist")
}
