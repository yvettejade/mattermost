// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package assistant

import (
	"encoding/json"
	"regexp"
	"strconv"
	"strings"
	"time"
)

// MeetingProposal is the locked schedule-meeting schema.
type MeetingProposal struct {
	Title     string   `json:"title"`
	When      string   `json:"when"`
	Attendees []string `json:"attendees"`
	Notes     string   `json:"notes"`
}

var jsonObjectRE = regexp.MustCompile(`(?s)\{.*\}`)

// NormalizeMeetingProposal extracts {title, when, attendees, notes} from model text.
func NormalizeMeetingProposal(raw string, fallbackTitle string) MeetingProposal {
	proposal := MeetingProposal{
		Title:     strings.TrimSpace(fallbackTitle),
		Attendees: []string{},
	}
	if proposal.Title == "" {
		proposal.Title = "Meeting"
	}

	blob := raw
	if loc := jsonObjectRE.FindString(raw); loc != "" {
		blob = loc
	}

	var parsed MeetingProposal
	if err := json.Unmarshal([]byte(blob), &parsed); err == nil {
		if strings.TrimSpace(parsed.Title) != "" {
			proposal.Title = parsed.Title
		}
		proposal.When = parsed.When
		proposal.Notes = parsed.Notes
		if parsed.Attendees != nil {
			proposal.Attendees = parsed.Attendees
		}
	} else {
		proposal.Notes = strings.TrimSpace(raw)
	}
	if proposal.Attendees == nil {
		proposal.Attendees = []string{}
	}
	return proposal
}

func FormatMeetingProposal(p MeetingProposal) string {
	if p.Attendees == nil {
		p.Attendees = []string{}
	}
	b, err := json.MarshalIndent(p, "", "  ")
	if err != nil {
		return `{"title":"Meeting","when":"","attendees":[],"notes":""}`
	}
	return string(b)
}

func MentionsUnavailableTools(message string) (playbook bool, canvas bool) {
	lower := strings.ToLower(message)
	return strings.Contains(lower, "playbook"), strings.Contains(lower, "canvas")
}

// ParseCatchUpSince returns a millis timestamp for catch-up post loading.
func ParseCatchUpSince(message string, lastViewedAt int64, now time.Time) int64 {
	lower := strings.ToLower(message)
	if strings.Contains(lower, "yesterday") {
		return now.Add(-24 * time.Hour).UnixMilli()
	}
	if m := durationPattern.FindStringSubmatch(lower); m != nil {
		n, err := strconv.Atoi(m[1])
		if err == nil && n > 0 {
			switch {
			case strings.HasPrefix(m[2], "h"):
				return now.Add(-time.Duration(n) * time.Hour).UnixMilli()
			case strings.HasPrefix(m[2], "d"):
				return now.Add(-time.Duration(n) * 24 * time.Hour).UnixMilli()
			default:
				return now.Add(-time.Duration(n) * time.Minute).UnixMilli()
			}
		}
	}
	if lastViewedAt > 0 {
		return lastViewedAt
	}
	return now.Add(-24 * time.Hour).UnixMilli()
}

// ParseScheduleAt returns a future millis timestamp when the utterance includes a delay.
func ParseScheduleAt(message string, now time.Time) (int64, bool) {
	lower := strings.ToLower(message)
	re := regexp.MustCompile(`\bin\s+(\d+)\s*(h|hours?|m|mins?|minutes?|d|days?)\b`)
	if m := re.FindStringSubmatch(lower); m != nil {
		n, err := strconv.Atoi(m[1])
		if err == nil && n > 0 {
			var at time.Time
			switch {
			case strings.HasPrefix(m[2], "h"):
				at = now.Add(time.Duration(n) * time.Hour)
			case strings.HasPrefix(m[2], "d"):
				at = now.Add(time.Duration(n) * 24 * time.Hour)
			default:
				at = now.Add(time.Duration(n) * time.Minute)
			}
			return at.UnixMilli(), true
		}
	}
	if strings.Contains(lower, "tomorrow") {
		at := time.Date(now.Year(), now.Month(), now.Day()+1, 9, 0, 0, 0, now.Location())
		return at.UnixMilli(), true
	}
	return 0, false
}
