// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package assistant

import (
	"encoding/json"
	"regexp"
	"strconv"
	"strings"
	"time"
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

// PayloadConfirmed is the publish gate for assistant writes.
// The payload must appear in the caller's own message. Channel posts are not
// a source: another member can plant wording that a corpus overlap check would accept.
func PayloadConfirmed(payload, userMessage string) bool {
	payload = strings.TrimSpace(payload)
	userMessage = strings.TrimSpace(userMessage)
	if payload == "" || userMessage == "" || utf8.RuneCountInString(payload) < 8 {
		return false
	}
	return strings.Contains(strings.ToLower(userMessage), strings.ToLower(payload))
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

var (
	reCallerRFC3339  = regexp.MustCompile(`(?i)\d{4}-\d{2}-\d{2}t\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:z|[+-]\d{2}:\d{2})`)
	reCallerDate     = regexp.MustCompile(`\b(\d{4}-\d{2}-\d{2})\b`)
	reCallerClock    = regexp.MustCompile(`(?i)\b(\d{1,2}):(\d{2})(?::\d{2})?\s*([ap]m)?\b`)
	reCallerHour     = regexp.MustCompile(`(?i)\b(\d{1,2})\s*([ap]m)\b`)
	reCallerTomorrow = regexp.MustCompile(`(?i)\btomorrow\b`)
	reCallerToday    = regexp.MustCompile(`(?i)\btoday\b`)
)

// ScheduledAtFromCaller reads a timestamp from the caller's own message.
// A loose hint such as "am" or "tomorrow" in channel posts is not a time.
// The earliest RFC3339, clock, or date in the message wins so a later note
// cannot override an explicit schedule such as "tomorrow at 3pm".
func ScheduledAtFromCaller(userMessage string, now time.Time) (time.Time, bool) {
	userMessage = strings.TrimSpace(userMessage)
	if userMessage == "" {
		return time.Time{}, false
	}
	rfcIdx := -1
	var rfcTime time.Time
	if loc := reCallerRFC3339.FindStringIndex(userMessage); loc != nil {
		if parsed, err := time.Parse(time.RFC3339Nano, strings.ToUpper(userMessage[loc[0]:loc[1]])); err == nil {
			rfcIdx = loc[0]
			rfcTime = parsed.UTC()
		}
	}
	clockIdx, hour, minute, clockOK := callerClock(userMessage)
	if rfcIdx >= 0 && (!clockOK || rfcIdx <= clockIdx) {
		return rfcTime, true
	}
	if !clockOK {
		return time.Time{}, false
	}
	now = now.UTC()
	year, month, day, ok := callerDate(userMessage, now)
	if !ok {
		return time.Time{}, false
	}
	return time.Date(year, month, day, hour, minute, 0, 0, time.UTC), true
}

func callerClock(message string) (idx, hour, minute int, ok bool) {
	idx = -1
	consider := func(at, h, m int, valid bool) {
		if !valid || at < 0 {
			return
		}
		if !ok || at < idx {
			idx, hour, minute, ok = at, h, m, true
		}
	}
	for _, match := range reCallerClock.FindAllStringSubmatchIndex(message, -1) {
		ampm := ""
		if len(match) >= 8 && match[6] >= 0 {
			ampm = message[match[6]:match[7]]
		}
		h, m, valid := clockParts(message[match[2]:match[3]], message[match[4]:match[5]], ampm)
		consider(match[0], h, m, valid)
	}
	for _, match := range reCallerHour.FindAllStringSubmatchIndex(message, -1) {
		h, m, valid := clockParts(message[match[2]:match[3]], "0", message[match[4]:match[5]])
		consider(match[0], h, m, valid)
	}
	return idx, hour, minute, ok
}

func callerDate(message string, now time.Time) (int, time.Month, int, bool) {
	bestIdx := -1
	var year int
	var month time.Month
	var day int
	consider := func(at, y int, mo time.Month, d int, valid bool) {
		if !valid || at < 0 {
			return
		}
		if bestIdx < 0 || at < bestIdx {
			bestIdx, year, month, day = at, y, mo, d
		}
	}
	if loc := reCallerDate.FindStringSubmatchIndex(message); loc != nil {
		parsed, err := time.Parse("2006-01-02", message[loc[2]:loc[3]])
		consider(loc[0], parsed.Year(), parsed.Month(), parsed.Day(), err == nil)
	}
	if loc := reCallerTomorrow.FindStringIndex(message); loc != nil {
		next := now.AddDate(0, 0, 1)
		consider(loc[0], next.Year(), next.Month(), next.Day(), true)
	}
	if loc := reCallerToday.FindStringIndex(message); loc != nil {
		consider(loc[0], now.Year(), now.Month(), now.Day(), true)
	}
	if bestIdx < 0 {
		return 0, 0, 0, false
	}
	return year, month, day, true
}

func clockParts(hourText, minuteText, ampm string) (int, int, bool) {
	hour, errH := strconv.Atoi(hourText)
	minute, errM := strconv.Atoi(minuteText)
	if errH != nil || errM != nil || minute < 0 || minute > 59 || hour < 0 || hour > 23 {
		return 0, 0, false
	}
	switch strings.ToLower(ampm) {
	case "pm":
		if hour < 1 || hour > 12 {
			return 0, 0, false
		}
		if hour != 12 {
			hour += 12
		}
	case "am":
		if hour < 1 || hour > 12 {
			return 0, 0, false
		}
		if hour == 12 {
			hour = 0
		}
	case "":
	default:
		return 0, 0, false
	}
	return hour, minute, true
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
