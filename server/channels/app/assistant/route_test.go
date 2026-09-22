// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package assistant

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestRouteActionsAndSpecialists(t *testing.T) {
	now := time.Date(2026, 9, 22, 15, 0, 0, 0, time.UTC)
	tests := []struct {
		message    string
		action     Action
		specialist Specialist
		scope      Scope
	}{
		{message: "", action: ActionSummarize, specialist: SpecialistSummarizer, scope: ScopeAuto},
		{message: "summarize this thread", action: ActionSummarize, specialist: SpecialistSummarizer, scope: ScopeThread},
		{message: "catch me up on this channel", action: ActionCatchUp, specialist: SpecialistSummarizer, scope: ScopeChannel},
		{message: "what did I miss", action: ActionCatchUp, specialist: SpecialistSummarizer, scope: ScopeAuto},
		{message: "draft a post from the thread", action: ActionDraftPost, specialist: SpecialistDrafter, scope: ScopeThread},
		{message: "draft a document", action: ActionDraftDocument, specialist: SpecialistDrafter, scope: ScopeAuto},
		{message: "create a board from this thread", action: ActionCreateBoard, specialist: SpecialistDrafter, scope: ScopeThread},
		{message: "schedule a meeting with alice", action: ActionScheduleMeeting, specialist: SpecialistScheduler, scope: ScopeAuto},
		{message: "schedule a post for tomorrow", action: ActionSchedulePost, specialist: SpecialistScheduler, scope: ScopeAuto},
		{message: "route to summarizer", action: ActionSummarize, specialist: SpecialistSummarizer, scope: ScopeAuto},
		{message: "specialist drafter", action: ActionDraftPost, specialist: SpecialistDrafter, scope: ScopeAuto},
		{message: "ask the scheduler to propose a time", action: ActionScheduleMeeting, specialist: SpecialistScheduler, scope: ScopeAuto},
		{message: "route to drafter and make a board", action: ActionCreateBoard, specialist: SpecialistDrafter, scope: ScopeAuto},
		{message: "what did we decide?", action: ActionAnswer, specialist: SpecialistGeneral, scope: ScopeAuto},
		{message: "create a playbook", action: ActionDraftDocument, specialist: SpecialistDrafter, scope: ScopeAuto},
		{message: "start a call", action: ActionScheduleMeeting, specialist: SpecialistScheduler, scope: ScopeAuto},
	}

	for _, test := range tests {
		t.Run(test.message, func(t *testing.T) {
			got := Route(test.message, now)
			require.Equal(t, test.action, got.Action)
			require.Equal(t, test.specialist, got.Specialist)
			require.Equal(t, test.scope, got.Scope)
		})
	}
}

func TestRouteSinceWindows(t *testing.T) {
	now := time.Date(2026, 9, 22, 15, 4, 5, 0, time.UTC)

	lastVisit := Route("catch me up since my last visit", now)
	require.True(t, lastVisit.SinceLastVisit)
	require.False(t, lastVisit.HasSince)
	require.Equal(t, ActionCatchUp, lastVisit.Action)

	defaultCatchup := Route("catch me up", now)
	require.True(t, defaultCatchup.SinceLastVisit)

	dated := Route("catch me up since 2026-01-02", now)
	require.True(t, dated.HasSince)
	require.Equal(t, time.Date(2026, 1, 2, 0, 0, 0, 0, time.UTC), dated.Since)

	rfc := Route("summarize since 2026-09-01T12:00:00Z", now)
	require.True(t, rfc.HasSince)
	require.Equal(t, time.Date(2026, 9, 1, 12, 0, 0, 0, time.UTC), rfc.Since)

	yesterday := Route("catch me up since yesterday", now)
	require.Equal(t, now.AddDate(0, 0, -1).UTC(), yesterday.Since)

	hours := Route("catch me up since 2h", now)
	require.Equal(t, now.Add(-2*time.Hour).UTC(), hours.Since)

	unparsed := Route("catch me up since the deployment", now)
	require.True(t, unparsed.SinceUnparsed)
	require.False(t, unparsed.SinceLastVisit)
}

func TestRouteFeatureFlags(t *testing.T) {
	now := time.Date(2026, 9, 22, 15, 0, 0, 0, time.UTC)
	playbook := Route("create a playbook from this thread", now)
	require.True(t, playbook.PlaybooksUnavailable)
	require.Equal(t, ActionDraftDocument, playbook.Action)

	canvas := Route("turn this thread into a canvas", now)
	require.True(t, canvas.AskedForCanvas)
	require.Equal(t, ActionDraftDocument, canvas.Action)

	call := Route("start a call with the team", now)
	require.True(t, call.CallsMentioned)
	require.Equal(t, ActionScheduleMeeting, call.Action)
}
