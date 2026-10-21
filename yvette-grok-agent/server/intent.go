package main

import (
	"regexp"
	"strconv"
	"strings"
	"time"
	"unicode"
)

type IntentKind string

const (
	IntentQA        IntentKind = "qa"
	IntentSummarize IntentKind = "summarize"
	IntentDraft     IntentKind = "draft"
	IntentSchedule  IntentKind = "schedule"
	IntentCanvas    IntentKind = "canvas"
	IntentRoute     IntentKind = "route"
	IntentGitHub    IntentKind = "github"
	IntentJira      IntentKind = "jira"
	IntentHelp      IntentKind = "help"
)

type SummarizeScope string

const (
	ScopeThread  SummarizeScope = "thread"
	ScopeChannel SummarizeScope = "channel"
	ScopeMeeting SummarizeScope = "meeting"
	ScopeMissed  SummarizeScope = "missed"
)

type GitHubRefKind string

const (
	GitHubPull   GitHubRefKind = "pr"
	GitHubIssue  GitHubRefKind = "issue"
	GitHubPath   GitHubRefKind = "path"
	GitHubNumber GitHubRefKind = "number"
)

type GitHubRef struct {
	Kind   GitHubRefKind
	Number int
	Path   string
}

type Intent struct {
	Kind     IntentKind
	Query    string
	Title    string
	Scope    SummarizeScope
	Duration time.Duration
	IssueKey string
	GitHub   *GitHubRef
	Agent    string
	Brief    string
}

var (
	jiraKeyRE = regexp.MustCompile(`(?i)\b([A-Z][A-Z0-9]+-\d+)\b`)
	ghURLRE   = regexp.MustCompile(`(?i)github\.com/[\w.-]+/[\w.-]+/(pull|issues)/(\d+)`)
	ghPrefRE  = regexp.MustCompile(`(?i)\b(?:pr|pull(?:\s+request)?|issue)\s*#?(\d+)\b`)
	ghHashRE  = regexp.MustCompile(`(?:^|[\s(])#(\d+)\b`)
	ghPathRE  = regexp.MustCompile(`(?i)^(?:path:)?((?:[A-Za-z0-9_.-]+/)+\.?[A-Za-z0-9_.-]+)$`)
)

func Classify(text, jiraProject, githubOwner, githubRepo string) Intent {
	raw := strings.TrimSpace(text)
	lower := strings.ToLower(raw)
	in := Intent{Kind: IntentQA, Query: raw}

	if key := FirstJiraKey(raw, jiraProject); key != "" {
		in.IssueKey = key
	}
	if ref := FirstGitHubRef(raw, githubOwner, githubRepo); ref != nil {
		in.GitHub = ref
	}

	switch {
	case isHelp(lower):
		in.Kind = IntentHelp
	case hasAny(lower, "schedule a meeting", "schedule meeting") || lower == "schedule" || strings.HasPrefix(lower, "schedule "):
		in.Kind = IntentSchedule
	case strings.HasPrefix(lower, "route ") || strings.HasPrefix(lower, "handoff "):
		in.Kind = IntentRoute
		in.Agent, in.Brief = parseRoute(raw)
	case strings.HasPrefix(lower, "canvas ") || strings.HasPrefix(lower, "build canvas") || strings.HasPrefix(lower, "make a canvas"):
		in.Kind = IntentCanvas
		in.Title = titleAfter(raw, []string{"canvas", "build canvas", "make a canvas"})
		in.Query = in.Title
	case strings.HasPrefix(lower, "draft ") || strings.HasPrefix(lower, "write a") || strings.HasPrefix(lower, "write an"):
		in.Kind = IntentDraft
		in.Title = titleAfter(raw, []string{"draft", "write a", "write an"})
		in.Query = in.Title
	case isSummarize(lower):
		in.Kind = IntentSummarize
		in.Scope, in.Duration = parseSummarize(lower)
	case in.IssueKey != "" && looksLikeJiraOnly(lower):
		in.Kind = IntentJira
	case in.GitHub != nil && looksLikeGitHubOnly(lower):
		in.Kind = IntentGitHub
	default:
		in.Kind = IntentQA
	}
	return in
}

func ParseSlash(commandLine, jiraProject, githubOwner, githubRepo string) Intent {
	fields := strings.Fields(strings.TrimSpace(commandLine))
	if len(fields) == 0 {
		return Intent{Kind: IntentHelp}
	}
	// "/yvette" or "yvette"
	if strings.HasPrefix(fields[0], "/") {
		fields = fields[1:]
	}
	if len(fields) > 0 && strings.EqualFold(fields[0], commandTrigger) {
		fields = fields[1:]
	}
	if len(fields) == 0 {
		return Intent{Kind: IntentHelp}
	}

	sub := strings.ToLower(fields[0])
	rest := strings.TrimSpace(strings.TrimPrefix(strings.TrimSpace(commandLine), fields[0]))
	if i := indexFold(commandLine, fields[0]); i >= 0 {
		rest = strings.TrimSpace(commandLine[i+len(fields[0]):])
	}

	switch sub {
	case "help":
		return Intent{Kind: IntentHelp}
	case "ask":
		in := Classify(rest, jiraProject, githubOwner, githubRepo)
		in.Kind = IntentQA
		in.Query = rest
		return in
	case "summarize":
		scope, dur := parseSummarize(strings.ToLower(rest))
		if scope == "" {
			scope = ScopeThread
		}
		return Intent{Kind: IntentSummarize, Scope: scope, Duration: dur, Query: rest}
	case "draft":
		title := rest
		if title == "" {
			title = "Untitled draft"
		}
		return Intent{Kind: IntentDraft, Title: title, Query: title}
	case "canvas":
		title := rest
		if title == "" {
			title = "Untitled canvas"
		}
		return Intent{Kind: IntentCanvas, Title: title, Query: title}
	case "schedule":
		return Intent{Kind: IntentSchedule}
	case "jira":
		key := FirstJiraKey(rest, jiraProject)
		if key == "" && rest != "" {
			key = strings.ToUpper(strings.Fields(rest)[0])
		}
		return Intent{Kind: IntentJira, IssueKey: key, Query: rest}
	case "github":
		ref := parseGitHubArg(rest)
		return Intent{Kind: IntentGitHub, GitHub: ref, Query: rest}
	case "route":
		agent, brief := parseRoute(rest)
		return Intent{Kind: IntentRoute, Agent: agent, Brief: brief, Query: rest}
	default:
		return Classify(strings.TrimSpace(strings.Join(fields, " ")), jiraProject, githubOwner, githubRepo)
	}
}

func FirstJiraKey(text, project string) string {
	matches := jiraKeyRE.FindAllString(text, -1)
	project = strings.ToUpper(strings.TrimSpace(project))
	for _, m := range matches {
		up := strings.ToUpper(m)
		if project == "" || strings.HasPrefix(up, project+"-") {
			return up
		}
	}
	if len(matches) > 0 {
		return strings.ToUpper(matches[0])
	}
	return ""
}

func FirstGitHubRef(text, owner, repo string) *GitHubRef {
	if m := ghURLRE.FindStringSubmatch(text); len(m) == 3 {
		n, _ := strconv.Atoi(m[2])
		kind := GitHubNumber
		if strings.EqualFold(m[1], "pull") {
			kind = GitHubPull
		} else {
			kind = GitHubIssue
		}
		return &GitHubRef{Kind: kind, Number: n}
	}
	if m := ghPrefRE.FindStringSubmatch(text); len(m) == 2 {
		n, _ := strconv.Atoi(m[1])
		kind := GitHubNumber
		low := strings.ToLower(m[0])
		if strings.Contains(low, "pr") || strings.Contains(low, "pull") {
			kind = GitHubPull
		} else if strings.Contains(low, "issue") {
			kind = GitHubIssue
		}
		return &GitHubRef{Kind: kind, Number: n}
	}
	if m := ghHashRE.FindStringSubmatch(text); len(m) == 2 {
		n, _ := strconv.Atoi(m[1])
		return &GitHubRef{Kind: GitHubNumber, Number: n}
	}
	_ = owner
	_ = repo
	return nil
}

func parseGitHubArg(rest string) *GitHubRef {
	rest = strings.TrimSpace(rest)
	if rest == "" {
		return nil
	}
	if ref := FirstGitHubRef(rest, "", ""); ref != nil {
		return ref
	}
	low := strings.ToLower(rest)
	fields := strings.Fields(rest)
	if len(fields) >= 2 && (fields[0] == "pr" || fields[0] == "issue" || fields[0] == "pull") {
		n, err := strconv.Atoi(strings.TrimPrefix(fields[1], "#"))
		if err == nil {
			kind := GitHubNumber
			if fields[0] == "pr" || fields[0] == "pull" {
				kind = GitHubPull
			} else {
				kind = GitHubIssue
			}
			return &GitHubRef{Kind: kind, Number: n}
		}
	}
	if n, err := strconv.Atoi(strings.TrimPrefix(fields[0], "#")); err == nil {
		return &GitHubRef{Kind: GitHubNumber, Number: n}
	}
	if ghPathRE.MatchString(rest) || strings.Contains(rest, "/") {
		return &GitHubRef{Kind: GitHubPath, Path: strings.TrimPrefix(low, "path:")}
	}
	return &GitHubRef{Kind: GitHubPath, Path: rest}
}

func parseRoute(rest string) (agent, brief string) {
	rest = strings.TrimSpace(rest)
	rest = strings.TrimPrefix(rest, "route ")
	rest = strings.TrimPrefix(rest, "Route ")
	rest = strings.TrimPrefix(rest, "handoff ")
	fields := strings.Fields(rest)
	if len(fields) == 0 {
		return "", ""
	}
	return fields[0], strings.TrimSpace(strings.TrimPrefix(rest, fields[0]))
}

func parseSummarize(lower string) (SummarizeScope, time.Duration) {
	switch {
	case strings.Contains(lower, "meeting") || strings.Contains(lower, "standup") || strings.Contains(lower, "stand-up"):
		return ScopeMeeting, parseDuration(lower)
	case strings.Contains(lower, "catch me up") || strings.Contains(lower, "missed") || strings.Contains(lower, "catch-up") || strings.Contains(lower, "catchup"):
		return ScopeMissed, 0
	case strings.Contains(lower, "channel"):
		return ScopeChannel, 0
	case strings.Contains(lower, "thread"):
		return ScopeThread, 0
	default:
		return ScopeThread, 0
	}
}

func parseDuration(s string) time.Duration {
	re := regexp.MustCompile(`(\d+)\s*(h|hr|hrs|hour|hours|m|min|mins|minute|minutes)`)
	m := re.FindStringSubmatch(s)
	if len(m) != 3 {
		return time.Hour
	}
	n, _ := strconv.Atoi(m[1])
	switch {
	case strings.HasPrefix(m[2], "h"):
		return time.Duration(n) * time.Hour
	default:
		return time.Duration(n) * time.Minute
	}
}

func isSummarize(lower string) bool {
	return hasAny(lower,
		"summarize", "summarise", "recap", "catch me up", "catch-up", "catchup",
		"what happened in this thread", "what happened in this channel",
		"summarize the meeting", "recap standup",
	)
}

func isHelp(lower string) bool {
	return lower == "help" || lower == "/yvette help" || strings.HasPrefix(lower, "help ")
}

func looksLikeJiraOnly(lower string) bool {
	return hasAny(lower, "jira", "ticket", "issue yjira", "yjira-") && !isSummarize(lower)
}

func looksLikeGitHubOnly(lower string) bool {
	return hasAny(lower, "github", "pull request", " pr ", "issue #", "what's in pr", "whats in pr")
}

func NeedsTeamSearch(query string) bool {
	q := strings.ToLower(query)
	return hasAny(q,
		"what did we decide",
		"where did we",
		"across the team",
		"in other channels",
		"across channels",
	)
}

func hasAny(s string, needles ...string) bool {
	for _, n := range needles {
		if strings.Contains(s, n) {
			return true
		}
	}
	return false
}

func titleAfter(raw string, prefixes []string) string {
	trimmed := strings.TrimSpace(raw)
	lower := strings.ToLower(trimmed)
	for _, p := range prefixes {
		if strings.HasPrefix(lower, p) {
			rest := strings.TrimSpace(trimmed[len(p):])
			rest = strings.TrimLeftFunc(rest, func(r rune) bool { return r == ':' || unicode.IsSpace(r) })
			if rest == "" {
				return "Untitled"
			}
			return rest
		}
	}
	if trimmed == "" {
		return "Untitled"
	}
	return trimmed
}

func indexFold(s, sep string) int {
	return strings.Index(strings.ToLower(s), strings.ToLower(sep))
}
