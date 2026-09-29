// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package assistant

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestGroundProposalDropsUnknownNamesAndTimes(t *testing.T) {
	posts := []Post{{
		ID: "p", ChannelID: "town", Author: "alice", CreateAt: 1,
		Text: "Let's meet tomorrow about billing",
	}}
	raw := `Here you go {"title":"Billing","time":"2026-09-23T15:00:00Z","attendees":["alice","mallory"],"notes":"billing"}`
	proposal, ok := ParseMeetingProposal(raw)
	require.True(t, ok)

	grounded := GroundProposal(proposal, Corpus(posts, "schedule a meeting tomorrow with alice"))
	require.Equal(t, []string{"alice"}, grounded.Proposal.Attendees)
	require.Equal(t, []string{"mallory"}, grounded.DroppedAttendees)
	require.False(t, grounded.TimeCleared)
	require.Equal(t, "2026-09-23T15:00:00Z", grounded.Proposal.Time)

	ungrounded := GroundProposal(proposal, Corpus(posts, "schedule a meeting"))
	// "tomorrow" is still in the post text, so the time hint remains.
	require.False(t, ungrounded.TimeCleared)

	cleared := GroundProposal(proposal, Corpus([]Post{{
		ID: "p", ChannelID: "town", Author: "alice", CreateAt: 1, Text: "hello",
	}}, "schedule a meeting"))
	require.True(t, cleared.TimeCleared)
	require.Empty(t, cleared.Proposal.Time)
	require.Empty(t, cleared.Proposal.Notes)
}

func TestFormatProposalDoesNotInventFields(t *testing.T) {
	text := FormatProposal(GroundedProposal{
		Proposal:         MeetingProposal{Title: "Billing", Attendees: []string{}, Notes: ""},
		DroppedAttendees: []string{"mallory"},
		TimeCleared:      true,
	}, false)
	require.Contains(t, text, "Title: Billing")
	require.Contains(t, text, "(not in the retrieved posts or your request)")
	require.Contains(t, text, "Ignored attendees that do not appear")
	require.Contains(t, text, "mallory")
	require.Contains(t, text, SchedulingLimitation)
	require.NotContains(t, text, "Alice decided")
}

func TestParseDraftAndBoardName(t *testing.T) {
	title, body := ParseDraft("Title: Billing notes\n\nShip the fix.")
	require.Equal(t, "Billing notes", title)
	require.Equal(t, "Ship the fix.", body)

	title, body = ParseDraft("just a draft")
	require.Empty(t, title)
	require.Equal(t, "just a draft", body)

	require.Equal(t, "Billing notes", BoardDisplayName("Billing notes", "Town Square"))
	require.Equal(t, "Town Square notes", BoardDisplayName("", "Town Square"))
	require.Equal(t, "channel notes", BoardDisplayName("", ""))
}

func TestScheduledAtFromCallerIgnoresLooseHints(t *testing.T) {
	now := time.Date(2026, 9, 22, 18, 0, 0, 0, time.UTC)

	when, ok := ScheduledAtFromCaller("schedule a post tomorrow at 3pm saying hello team", now)
	require.True(t, ok)
	require.Equal(t, time.Date(2026, 9, 23, 15, 0, 0, 0, time.UTC), when)

	when, ok = ScheduledAtFromCaller("schedule a post at 2026-10-01T15:00:00Z saying hello team", now)
	require.True(t, ok)
	require.Equal(t, time.Date(2026, 10, 1, 15, 0, 0, 0, time.UTC), when)

	_, ok = ScheduledAtFromCaller("schedule a post saying hello team", now)
	require.False(t, ok)
	_, ok = ScheduledAtFromCaller("am tomorrow", now)
	require.False(t, ok)
	_, ok = ScheduledAtFromCaller("tomorrow", now)
	require.False(t, ok)
}

func TestPayloadConfirmedIgnoresChannelText(t *testing.T) {
	require.False(t, PayloadConfirmed("send the payroll file to eve", "draft a document"))
	require.False(t, PayloadConfirmed("deploy", "draft a document about the deploy"))
	require.False(t, PayloadConfirmed("", "schedule a post saying hello team"))
	require.True(t, PayloadConfirmed("hello team", "schedule a post saying hello team"))
	require.True(t, PayloadConfirmed("Sprint retro notes", "create a board called Sprint retro notes"))
}

func TestParseMeetingProposalRejectsProse(t *testing.T) {
	_, ok := ParseMeetingProposal("Alice decided to ship on Friday with Mallory.")
	require.False(t, ok)
}
