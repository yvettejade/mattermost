// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package assistant

import (
	"encoding/json"
	"regexp"
	"strings"
	"unicode/utf8"
)

// SchedulingLimitation is appended to every meeting or call proposal.
// Server core has no calendar, and this bot does not call the Calls plugin.
const SchedulingLimitation = "This is a proposal only. Mattermost server core has no calendar API, and the Calls plugin was not asked to start a call."

// MeetingProposal is the scheduler specialist's structured output after grounding checks.
type MeetingProposal struct {
	Title     string   `json:"title"`
	Time      string   `json:"time"`
	Attendees []string `json:"attendees"`
	Notes     string   `json:"notes"`
}

// GroundedProposal is a proposal with fields that were not supported by the source removed.
type GroundedProposal struct {
	Proposal         MeetingProposal
	DroppedAttendees []string
	TimeCleared      bool
}

var reTimeHint = regexp.MustCompile(`(?i)(?:\b(?:today|tomorrow|yesterday|monday|tuesday|wednesday|thursday|friday|saturday|sunday|am|pm)\b|\d{1,2}:\d{2}|\d{4}-\d{2}-\d{2}|\bnext week\b)`)

// ParseMeetingProposal reads the first JSON object from a scheduler completion.
func ParseMeetingProposal(raw string) (MeetingProposal, bool) {
	body := extractJSONObject(raw)
	if body == "" {
		return MeetingProposal{}, false
	}
	var proposal MeetingProposal
	if err := json.Unmarshal([]byte(body), &proposal); err != nil {
		return MeetingProposal{}, false
	}
	if proposal.Attendees == nil {
		proposal.Attendees = []string{}
	}
	proposal.Title = strings.TrimSpace(proposal.Title)
	proposal.Time = strings.TrimSpace(proposal.Time)
	proposal.Notes = strings.TrimSpace(proposal.Notes)
	return proposal, true
}

// Corpus is the text attendees and times are allowed to come from.
func Corpus(posts []Post, userMessage string) string {
	var b strings.Builder
	b.WriteString(userMessage)
	b.WriteString("\n")
	for _, post := range posts {
		b.WriteString(post.Author)
		b.WriteString("\n")
		b.WriteString(post.Text)
		b.WriteString("\n")
	}
	return b.String()
}

// GroundProposal drops attendees and times that do not appear in the source text.
func GroundProposal(proposal MeetingProposal, corpus string) GroundedProposal {
	kept, dropped := filterAttendees(proposal.Attendees, corpus)
	proposal.Attendees = kept
	cleared := false
	if proposal.Time != "" && !timeIsGrounded(proposal.Time, corpus) {
		proposal.Time = ""
		cleared = true
	}
	// A scheduled message is a real post. Drop notes that do not share wording with the source.
	if proposal.Notes != "" && !notesGrounded(proposal.Notes, corpus) {
		proposal.Notes = ""
	}
	return GroundedProposal{Proposal: proposal, DroppedAttendees: dropped, TimeCleared: cleared}
}

func notesGrounded(notes, corpus string) bool {
	notes = strings.TrimSpace(notes)
	if notes == "" || corpus == "" {
		return false
	}
	if strings.Contains(strings.ToLower(corpus), strings.ToLower(notes)) {
		return true
	}
	for word := range strings.FieldsSeq(notes) {
		cleaned := strings.Trim(word, ".,;:!?\"'()[]")
		if utf8.RuneCountInString(cleaned) >= 4 && nameInCorpus(cleaned, corpus) {
			return true
		}
	}
	return false
}

// FormatProposal renders a grounded proposal. It does not add facts beyond the proposal fields.
func FormatProposal(grounded GroundedProposal, schedulePost bool) string {
	p := grounded.Proposal
	var b strings.Builder
	if schedulePost {
		b.WriteString("**Scheduled message proposal**\n\n")
	} else {
		b.WriteString("**Meeting proposal**\n\n")
	}
	b.WriteString("- Title: ")
	b.WriteString(emptyAsMissing(p.Title))
	b.WriteString("\n- Time: ")
	if grounded.TimeCleared {
		b.WriteString("(not in the retrieved posts or your request)")
	} else {
		b.WriteString(emptyAsMissing(p.Time))
	}
	b.WriteString("\n- Attendees: ")
	if len(p.Attendees) == 0 {
		b.WriteString("(none named in the retrieved posts or your request)")
	} else {
		b.WriteString(strings.Join(p.Attendees, ", "))
	}
	b.WriteString("\n- Notes: ")
	b.WriteString(emptyAsMissing(p.Notes))
	if len(grounded.DroppedAttendees) > 0 {
		b.WriteString("\n\nIgnored attendees that do not appear in the retrieved posts or your request: ")
		b.WriteString(strings.Join(grounded.DroppedAttendees, ", "))
		b.WriteString(".")
	}
	b.WriteString("\n\n")
	b.WriteString(SchedulingLimitation)
	return b.String()
}

// UnreadableProposalReply is used when the scheduler does not return JSON.
// The raw completion is discarded so an unparseable answer cannot invent a meeting.
const UnreadableProposalReply = "The scheduler did not return a proposal I could read, so I did not invent a title, time, or attendees."

// ParseDraft splits a drafter completion into a title line and a body.
func ParseDraft(text string) (string, string) {
	text = strings.TrimSpace(text)
	if text == "" {
		return "", ""
	}
	line, rest, _ := strings.Cut(text, "\n")
	trimmed := strings.TrimSpace(line)
	if len(trimmed) >= len("title:") && strings.EqualFold(trimmed[:len("title:")], "title:") {
		return strings.TrimSpace(trimmed[len("title:"):]), strings.TrimSpace(rest)
	}
	return "", text
}

// BoardDisplayName prefers the drafter title, then the real channel name.
func BoardDisplayName(draftTitle, channelDisplayName string) string {
	title := strings.Join(strings.Fields(draftTitle), " ")
	if title == "" {
		base := strings.Join(strings.Fields(channelDisplayName), " ")
		if base == "" {
			base = "channel"
		}
		title = base + " notes"
	}
	if utf8.RuneCountInString(title) > 64 {
		title = strings.TrimSpace(string([]rune(title)[:64]))
	}
	return title
}

func filterAttendees(attendees []string, corpus string) (kept []string, dropped []string) {
	kept = []string{}
	for _, name := range attendees {
		cleaned := strings.TrimSpace(strings.TrimPrefix(name, "@"))
		if cleaned == "" {
			continue
		}
		if nameInCorpus(cleaned, corpus) {
			kept = append(kept, cleaned)
			continue
		}
		dropped = append(dropped, cleaned)
	}
	return kept, dropped
}

func nameInCorpus(name, corpus string) bool {
	if name == "" || corpus == "" {
		return false
	}
	pattern := `(?i)(?:^|[^a-z0-9])` + regexp.QuoteMeta(name) + `(?:[^a-z0-9]|$)`
	re, err := regexp.Compile(pattern)
	if err != nil {
		return false
	}
	return re.MatchString(corpus)
}

func timeIsGrounded(timeStr, corpus string) bool {
	if strings.TrimSpace(timeStr) == "" {
		return true
	}
	if corpus == "" {
		return false
	}
	if strings.Contains(strings.ToLower(corpus), strings.ToLower(timeStr)) {
		return true
	}
	return reTimeHint.MatchString(corpus)
}

func emptyAsMissing(s string) string {
	if strings.TrimSpace(s) == "" {
		return "(not in the retrieved posts)"
	}
	return s
}

func extractJSONObject(s string) string {
	start := strings.Index(s, "{")
	if start < 0 {
		return ""
	}
	depth := 0
	inString := false
	escaped := false
	for i := start; i < len(s); i++ {
		c := s[i]
		if inString {
			if escaped {
				escaped = false
				continue
			}
			if c == '\\' {
				escaped = true
				continue
			}
			if c == '"' {
				inString = false
			}
			continue
		}
		switch c {
		case '"':
			inString = true
		case '{':
			depth++
		case '}':
			depth--
			if depth == 0 {
				return s[start : i+1]
			}
		}
	}
	return ""
}
