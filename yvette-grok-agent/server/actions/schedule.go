package actions

import (
	"fmt"
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
)

const ScheduleCallbackID = "yvette-schedule"

func ScheduleDialog(triggerID, submitURL string) model.OpenDialogRequest {
	return model.OpenDialogRequest{
		TriggerId: triggerID,
		URL:       submitURL,
		Dialog: model.Dialog{
			CallbackId:       ScheduleCallbackID,
			Title:            "Propose a meeting",
			IntroductionText: "This posts an in-channel meeting proposal. It does not write to a calendar.",
			SubmitLabel:      "Post proposal",
			NotifyOnCancel:   false,
			Elements: []model.DialogElement{
				{DisplayName: "Title", Name: "title", Type: "text", Placeholder: "Sprint planning", MaxLength: 128},
				{DisplayName: "When", Name: "when", Type: "text", Placeholder: "Thu 10:00 PT", MaxLength: 128},
				{DisplayName: "Participants", Name: "participants", Type: "text", Placeholder: "@alice @bob", Optional: true, MaxLength: 256},
			},
		},
	}
}

func MeetingProposal(title, when, participants, proposer string) string {
	if strings.TrimSpace(title) == "" {
		title = "Untitled meeting"
	}
	if strings.TrimSpace(when) == "" {
		when = "(time not specified)"
	}
	if strings.TrimSpace(participants) == "" {
		participants = "(none listed)"
	}
	return fmt.Sprintf("## Meeting proposal\n\n**Title:** %s\n**When:** %s\n**Proposed by:** %s\n**Participants:** %s\n\nReact or reply to confirm. This is not a calendar invite.",
		title, when, proposer, participants)
}

func SubmissionString(submission map[string]any, key string) string {
	if submission == nil {
		return ""
	}
	v, ok := submission[key]
	if !ok || v == nil {
		return ""
	}
	return strings.TrimSpace(fmt.Sprint(v))
}
