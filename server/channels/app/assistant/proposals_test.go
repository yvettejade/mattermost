// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package assistant

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNormalizeMeetingProposal(t *testing.T) {
	t.Parallel()

	p := NormalizeMeetingProposal(`{"title":"Sync","when":"tomorrow 9am","attendees":["ada"],"notes":"bring docs"}`, "fallback")
	assert.Equal(t, "Sync", p.Title)
	assert.Equal(t, "tomorrow 9am", p.When)
	assert.Equal(t, []string{"ada"}, p.Attendees)
	assert.Equal(t, "bring docs", p.Notes)

	raw := FormatMeetingProposal(p)
	var again MeetingProposal
	require.NoError(t, json.Unmarshal([]byte(raw), &again))
	assert.Equal(t, p, again)
}

func TestParseCatchUpSince(t *testing.T) {
	t.Parallel()
	now := time.Date(2026, 9, 25, 12, 0, 0, 0, time.UTC)
	assert.Equal(t, now.Add(-24*time.Hour).UnixMilli(), ParseCatchUpSince("since yesterday", 0, now))
	assert.Equal(t, now.Add(-2*time.Hour).UnixMilli(), ParseCatchUpSince("since 2h", 0, now))
	assert.Equal(t, int64(111), ParseCatchUpSince("catch me up", 111, now))
}

func TestParseScheduleAt(t *testing.T) {
	t.Parallel()
	now := time.Date(2026, 9, 25, 12, 0, 0, 0, time.UTC)
	at, ok := ParseScheduleAt("schedule a post in 1 hour", now)
	assert.True(t, ok)
	assert.Equal(t, now.Add(time.Hour).UnixMilli(), at)

	_, ok = ParseScheduleAt("schedule a post later", now)
	assert.False(t, ok)
}
