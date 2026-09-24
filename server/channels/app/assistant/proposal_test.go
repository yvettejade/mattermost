// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package assistant

import (
	"testing"

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

func TestParseMeetingProposalRejectsProse(t *testing.T) {
	_, ok := ParseMeetingProposal("Alice decided to ship on Friday with Mallory.")
	require.False(t, ok)
}
