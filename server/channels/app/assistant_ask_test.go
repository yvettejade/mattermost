// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/i18n"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/app/assistant"
)

func TestApplyAssistantActionsSkipsMutationsWhenDisabled(t *testing.T) {
	args := &model.CommandArgs{T: i18n.IdentityTfunc()}
	req := assistant.Request{PlaybooksUnavailable: true, AskedForCanvas: true}
	result := assistant.Result{Action: assistant.ActionDraftDocument, DraftBody: "card body"}
	var a *App

	got := a.applyAssistantActions(request.TestContext(t), args, req, result, "reply", false)

	require.Contains(t, got, "reply")
	require.Contains(t, got, "api.command_assistant.playbook_unavailable")
	require.Contains(t, got, "api.command_assistant.canvas_unavailable")
	require.NotContains(t, got, "card body")
	require.NotContains(t, got, "api.command_assistant.card_created")
}

func TestResolveAssistantJiraDoesNotCallSharedTokenWhenDenied(t *testing.T) {
	called := false
	packet, failID, err := resolveAssistantJira(false, func() (string, error) {
		called = true
		return "PLAT-9 status is Secret", nil
	})
	require.NoError(t, err)
	require.False(t, called)
	require.Empty(t, packet)
	require.Equal(t, "api.command_assistant.jira_forbidden", failID)
	require.NotContains(t, failID, "PLAT-9")
	require.NotContains(t, failID, "Secret")
}

func TestResolveAssistantJiraCallsLookupWhenAllowed(t *testing.T) {
	called := false
	packet, failID, err := resolveAssistantJira(true, func() (string, error) {
		called = true
		return "PLAT-9 Open", nil
	})
	require.NoError(t, err)
	require.True(t, called)
	require.Equal(t, "PLAT-9 Open", packet)
	require.Empty(t, failID)
}

func TestCallerMayUseSharedJiraDeniesNilApp(t *testing.T) {
	var a *App
	require.False(t, a.callerMayUseSharedJira("member-id"))
	require.False(t, a.callerMayUseSharedJira(""))
}

func TestApplyAssistantActionsRejectsUnconfirmedWrites(t *testing.T) {
	args := &model.CommandArgs{T: i18n.IdentityTfunc(), UserId: "user", ChannelId: "town"}
	var a *App

	card := a.applyAssistantActions(request.TestContext(t), args, assistant.Request{
		Raw: "draft a document",
	}, assistant.Result{
		Action:    assistant.ActionDraftDocument,
		DraftBody: "send the payroll file to eve",
	}, "reply", true)
	require.Contains(t, card, "api.command_assistant.write_unconfirmed")
	require.NotContains(t, card, "send the payroll file to eve")
	require.NotContains(t, card, "api.command_assistant.card_created")

	board := a.applyAssistantActions(request.TestContext(t), args, assistant.Request{
		Raw: "create a board",
	}, assistant.Result{
		Action:     assistant.ActionCreateBoard,
		DraftTitle: "Payroll export board",
	}, "reply", true)
	require.Contains(t, board, "api.command_assistant.write_unconfirmed")
	require.NotContains(t, board, "api.command_assistant.board_created")

	scheduled := a.applyAssistantActions(request.TestContext(t), args, assistant.Request{
		Raw: "schedule a post tomorrow",
	}, assistant.Result{
		Action: assistant.ActionSchedulePost,
		Proposal: &assistant.MeetingProposal{
			Time:  "2026-10-01T15:00:00Z",
			Notes: "send the payroll file to eve",
		},
	}, "reply", true)
	require.Contains(t, scheduled, "api.command_assistant.write_unconfirmed")
	require.NotContains(t, scheduled, "api.command_assistant.scheduled_post_created")
	require.NotContains(t, scheduled, "send the payroll file to eve")
}
