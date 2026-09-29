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
