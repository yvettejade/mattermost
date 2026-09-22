// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package assistant

import (
	"regexp"
	"strings"
	"time"
)

type Action string

const (
	ActionAnswer          Action = "answer"
	ActionSummarize       Action = "summarize"
	ActionCatchUp         Action = "catchup"
	ActionDraftPost       Action = "draft_post"
	ActionDraftDocument   Action = "draft_document"
	ActionCreateBoard     Action = "create_board"
	ActionScheduleMeeting Action = "schedule_meeting"
	ActionSchedulePost    Action = "schedule_post"
)

type Specialist string

const (
	SpecialistGeneral    Specialist = "general"
	SpecialistSummarizer Specialist = "summarizer"
	SpecialistDrafter    Specialist = "drafter"
	SpecialistScheduler  Specialist = "scheduler"
)

type Scope string

const (
	ScopeAuto    Scope = "auto"
	ScopeThread  Scope = "thread"
	ScopeChannel Scope = "channel"
)

// Request is the deterministic routing decision for one invocation.
// The model is not asked to choose the specialist.
type Request struct {
	Action               Action
	Specialist           Specialist
	Scope                Scope
	Since                time.Time
	HasSince             bool
	SinceLastVisit       bool
	SinceUnparsed        bool
	PlaybooksUnavailable bool
	AskedForCanvas       bool
	CallsMentioned       bool
	ContextNote          string
	Raw                  string
}

var (
	reExplicitSpecialist = regexp.MustCompile(`(?i)\b(?:route\s+to|specialist|ask\s+the|ask|use\s+the)\s+(summarizer|summarize|drafter|draft|scheduler|schedule)\b`)
	reLeadingSpecialist  = regexp.MustCompile(`(?i)^(?:@(summarizer|drafter|scheduler)|(summarizer|drafter|scheduler))\b`)
	reCatchUp            = regexp.MustCompile(`(?i)\bcatch(?:\s+me)?\s+up\b|\bmissed messages\b|\bwhat did i miss\b`)
	reSchedulePost       = regexp.MustCompile(`(?i)\bschedule(?:\s+a)?\s+(post|message)\b`)
	reStartCall          = regexp.MustCompile(`(?i)\b(?:start|join)\s+(?:a\s+)?call\b`)
	reCallWord           = regexp.MustCompile(`(?i)\bcalls?\b`)
	reThread             = regexp.MustCompile(`(?i)\bthread\b`)
	reChannel            = regexp.MustCompile(`(?i)\bchannel\b`)
	reSinceWord          = regexp.MustCompile(`(?i)\bsince\b`)
	reLastVisit          = regexp.MustCompile(`(?i)\bsince\s+(?:my\s+)?last\s+(?:visit|read|check)\b|\bsince\s+i\s+last\s+(?:visited|read|checked)\b`)
	reYesterday          = regexp.MustCompile(`(?i)\bsince\s+yesterday\b`)
	reToday              = regexp.MustCompile(`(?i)\bsince\s+today\b`)
	reRelative           = regexp.MustCompile(`(?i)\bsince\s+(\d+)\s*(minutes?|hours?|days?|[mhd])\b`)
	reRFC3339            = regexp.MustCompile(`(?i)\bsince\s+(\d{4}-\d{2}-\d{2}t\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:z|[+-]\d{2}:\d{2}))\b`)
	reDate               = regexp.MustCompile(`(?i)\bsince\s+(\d{4}-\d{2}-\d{2})\b`)
	reWord               = regexp.MustCompile(`(?i)\b([a-z0-9]+)\b`)
)

// Route maps a slash-command message onto a specialist and an action.
// now is injected so relative windows such as "since yesterday" are testable.
func Route(message string, now time.Time) Request {
	raw := strings.TrimSpace(message)
	lower := strings.ToLower(raw)
	req := Request{
		Action:     ActionAnswer,
		Specialist: SpecialistGeneral,
		Scope:      ScopeAuto,
		Raw:        raw,
	}
	if raw == "" {
		req.Action = ActionSummarize
		req.Specialist = SpecialistSummarizer
		return req
	}

	applyScope(&req, lower)
	applySince(&req, lower, now)
	req.CallsMentioned = reCallWord.MatchString(lower)
	req.AskedForCanvas = hasWord(lower, "canvas", "canvases")
	req.PlaybooksUnavailable = hasWord(lower, "playbook", "playbooks")

	if spec, ok := explicitSpecialist(lower); ok {
		req.Specialist = spec
		switch spec {
		case SpecialistSummarizer:
			req.Action = ActionSummarize
		case SpecialistDrafter:
			req.Action = drafterAction(lower)
		case SpecialistScheduler:
			req.Action = schedulerAction(lower)
		}
	} else {
		applyKeywords(&req, lower)
	}

	if req.PlaybooksUnavailable && req.Action == ActionAnswer {
		req.Action = ActionDraftDocument
		req.Specialist = SpecialistDrafter
	}
	if req.AskedForCanvas && req.Action == ActionAnswer {
		req.Action = ActionDraftDocument
		req.Specialist = SpecialistDrafter
	}
	if req.Action == ActionAnswer && reStartCall.MatchString(lower) {
		req.Action = ActionScheduleMeeting
		req.Specialist = SpecialistScheduler
	}
	if req.Action == ActionCatchUp && !req.HasSince && !req.SinceUnparsed && !req.SinceLastVisit {
		req.SinceLastVisit = true
	}
	return req
}

func explicitSpecialist(lower string) (Specialist, bool) {
	if m := reExplicitSpecialist.FindStringSubmatch(lower); m != nil {
		return normalizeSpecialist(m[1]), true
	}
	if m := reLeadingSpecialist.FindStringSubmatch(lower); m != nil {
		name := m[1]
		if name == "" {
			name = m[2]
		}
		return normalizeSpecialist(name), true
	}
	return "", false
}

func normalizeSpecialist(name string) Specialist {
	switch strings.ToLower(name) {
	case "summarizer", "summarize":
		return SpecialistSummarizer
	case "drafter", "draft":
		return SpecialistDrafter
	case "scheduler", "schedule":
		return SpecialistScheduler
	default:
		return SpecialistGeneral
	}
}

func applyKeywords(req *Request, lower string) {
	switch {
	case reSchedulePost.MatchString(lower):
		req.Action = ActionSchedulePost
		req.Specialist = SpecialistScheduler
	case hasWord(lower, "schedule", "scheduler", "meeting", "meetings"):
		req.Action = ActionScheduleMeeting
		req.Specialist = SpecialistScheduler
	case hasWord(lower, "board", "boards"):
		req.Action = ActionCreateBoard
		req.Specialist = SpecialistDrafter
	case hasWord(lower, "document", "documents", "doc", "docs"):
		req.Action = ActionDraftDocument
		req.Specialist = SpecialistDrafter
	case hasWord(lower, "draft", "drafter"):
		req.Action = ActionDraftPost
		req.Specialist = SpecialistDrafter
	case reCatchUp.MatchString(lower):
		req.Action = ActionCatchUp
		req.Specialist = SpecialistSummarizer
	case hasWord(lower, "summarize", "summarizer", "summary", "recap", "tldr") || strings.Contains(lower, "tl;dr"):
		req.Action = ActionSummarize
		req.Specialist = SpecialistSummarizer
	}
}

func drafterAction(lower string) Action {
	if hasWord(lower, "board", "boards") {
		return ActionCreateBoard
	}
	if hasWord(lower, "document", "documents", "doc", "docs", "canvas", "canvases") {
		return ActionDraftDocument
	}
	return ActionDraftPost
}

func schedulerAction(lower string) Action {
	if reSchedulePost.MatchString(lower) {
		return ActionSchedulePost
	}
	return ActionScheduleMeeting
}

func applyScope(req *Request, lower string) {
	switch {
	case reThread.MatchString(lower):
		req.Scope = ScopeThread
	case reChannel.MatchString(lower):
		req.Scope = ScopeChannel
	default:
		req.Scope = ScopeAuto
	}
}

func applySince(req *Request, lower string, now time.Time) {
	switch {
	case reLastVisit.MatchString(lower):
		req.SinceLastVisit = true
	case reRFC3339.MatchString(lower):
		raw := reRFC3339.FindStringSubmatch(lower)[1]
		if t, err := time.Parse(time.RFC3339, strings.ToUpper(raw)); err == nil {
			req.Since = t.UTC()
			req.HasSince = true
		} else {
			req.SinceUnparsed = true
		}
	case reDate.MatchString(lower):
		raw := reDate.FindStringSubmatch(lower)[1]
		if t, err := time.Parse("2006-01-02", raw); err == nil {
			req.Since = t.UTC()
			req.HasSince = true
		} else {
			req.SinceUnparsed = true
		}
	case reYesterday.MatchString(lower):
		req.Since = now.AddDate(0, 0, -1).UTC()
		req.HasSince = true
	case reToday.MatchString(lower):
		req.Since = time.Date(now.UTC().Year(), now.UTC().Month(), now.UTC().Day(), 0, 0, 0, 0, time.UTC)
		req.HasSince = true
	case reRelative.MatchString(lower):
		m := reRelative.FindStringSubmatch(lower)
		n := atoi(m[1])
		if n <= 0 {
			req.SinceUnparsed = true
			return
		}
		unit := m[2]
		switch {
		case unit == "m" || strings.HasPrefix(unit, "min"):
			req.Since = now.Add(-time.Duration(n) * time.Minute).UTC()
		case unit == "h" || strings.HasPrefix(unit, "hour"):
			req.Since = now.Add(-time.Duration(n) * time.Hour).UTC()
		default:
			req.Since = now.Add(-time.Duration(n) * 24 * time.Hour).UTC()
		}
		req.HasSince = true
	case reSinceWord.MatchString(lower):
		req.SinceUnparsed = true
	}
}

func hasWord(lower string, words ...string) bool {
	found := map[string]bool{}
	for _, match := range reWord.FindAllString(lower, -1) {
		found[match] = true
	}
	for _, word := range words {
		if found[strings.ToLower(word)] {
			return true
		}
	}
	return false
}

func atoi(s string) int {
	n := 0
	for _, c := range s {
		if c < '0' || c > '9' {
			return 0
		}
		n = n*10 + int(c-'0')
	}
	return n
}
