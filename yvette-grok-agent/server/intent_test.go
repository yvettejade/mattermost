package main

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestClassify(t *testing.T) {
	tests := []struct {
		name string
		text string
		kind IntentKind
		want func(*testing.T, Intent)
	}{
		{"summarize thread", "summarize this thread", IntentSummarize, func(t *testing.T, in Intent) {
			require.Equal(t, ScopeThread, in.Scope)
		}},
		{"summarize channel", "summarize this channel please", IntentSummarize, func(t *testing.T, in Intent) {
			require.Equal(t, ScopeChannel, in.Scope)
		}},
		{"meeting", "summarize the meeting", IntentSummarize, func(t *testing.T, in Intent) {
			require.Equal(t, ScopeMeeting, in.Scope)
		}},
		{"standup", "recap standup", IntentSummarize, func(t *testing.T, in Intent) {
			require.Equal(t, ScopeMeeting, in.Scope)
		}},
		{"catch up", "catch me up", IntentSummarize, func(t *testing.T, in Intent) {
			require.Equal(t, ScopeMissed, in.Scope)
		}},
		{"draft", "draft ADR for plugin auth", IntentDraft, func(t *testing.T, in Intent) {
			require.Contains(t, in.Title, "ADR for plugin auth")
		}},
		{"canvas", "canvas Sprint goals", IntentCanvas, func(t *testing.T, in Intent) {
			require.Contains(t, in.Title, "Sprint goals")
		}},
		{"schedule", "schedule a meeting", IntentSchedule, nil},
		{"jira key", "look at YJIRA-26", IntentJira, func(t *testing.T, in Intent) {
			require.Equal(t, "YJIRA-26", in.IssueKey)
		}},
		{"github pr", "what's in PR #42", IntentGitHub, func(t *testing.T, in Intent) {
			require.NotNil(t, in.GitHub)
			require.Equal(t, 42, in.GitHub.Number)
			require.Equal(t, GitHubPull, in.GitHub.Kind)
		}},
		{"route", "route qa-bugbot investigate flaky test", IntentRoute, func(t *testing.T, in Intent) {
			require.Equal(t, "qa-bugbot", in.Agent)
			require.Equal(t, "investigate flaky test", in.Brief)
		}},
		{"qa default", "what happened yesterday?", IntentQA, nil},
		{"help", "help", IntentHelp, nil},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			in := Classify(tc.text, "YJIRA", "yvettejade", "mattermost")
			require.Equal(t, tc.kind, in.Kind)
			if tc.want != nil {
				tc.want(t, in)
			}
		})
	}
}

func TestParseSlash(t *testing.T) {
	t.Run("summarize meeting duration", func(t *testing.T) {
		in := ParseSlash("/yvette summarize meeting 30m", "YJIRA", "yvettejade", "mattermost")
		require.Equal(t, IntentSummarize, in.Kind)
		require.Equal(t, ScopeMeeting, in.Scope)
		require.Equal(t, 30*time.Minute, in.Duration)
	})
	t.Run("jira", func(t *testing.T) {
		in := ParseSlash("/yvette jira YJIRA-26", "YJIRA", "yvettejade", "mattermost")
		require.Equal(t, IntentJira, in.Kind)
		require.Equal(t, "YJIRA-26", in.IssueKey)
	})
	t.Run("github path", func(t *testing.T) {
		in := ParseSlash("/yvette github server/public/plugin/api.go", "YJIRA", "yvettejade", "mattermost")
		require.Equal(t, IntentGitHub, in.Kind)
		require.NotNil(t, in.GitHub)
		require.Equal(t, GitHubPath, in.GitHub.Kind)
		require.Equal(t, "server/public/plugin/api.go", in.GitHub.Path)
	})
	t.Run("help empty", func(t *testing.T) {
		in := ParseSlash("/yvette", "YJIRA", "yvettejade", "mattermost")
		require.Equal(t, IntentHelp, in.Kind)
	})
	t.Run("ask", func(t *testing.T) {
		in := ParseSlash("/yvette ask what did we decide about auth?", "YJIRA", "yvettejade", "mattermost")
		require.Equal(t, IntentQA, in.Kind)
		require.True(t, NeedsTeamSearch(in.Query))
	})
}

func TestFirstJiraKeyPrefersProject(t *testing.T) {
	require.Equal(t, "YJIRA-26", FirstJiraKey("see MM-1 and YJIRA-26", "YJIRA"))
}

func TestNeedsTeamSearch(t *testing.T) {
	require.True(t, NeedsTeamSearch("what did we decide about X?"))
	require.False(t, NeedsTeamSearch("summarize this thread"))
}

func TestSessionKeyNeverMMI(t *testing.T) {
	key := sessionKey("abc")
	require.True(t, len(key) > 0)
	require.NotContains(t, key, "mmi_")
	require.True(t, len(sessionKeyPrefix) >= 4)
	require.NotEqual(t, "mmi_", sessionKeyPrefix[:4])
}
