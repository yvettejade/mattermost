// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package assistant

import (
	"sort"
	"strings"
	"time"
	"unicode/utf8"
)

const (
	// MaxPosts bounds how much channel history is sent to the model.
	MaxPosts = 50
	// MaxMessageRunes keeps a single post from dominating the context packet.
	MaxMessageRunes = 1500
	// MaxReplyRunes stays under the legacy post length limit once headers are added.
	MaxReplyRunes = 3500
)

// Post is one workspace message the requester is allowed to see.
// Author is a username or, when the username cannot be resolved, the user id.
type Post struct {
	ID        string
	ChannelID string
	Author    string
	CreateAt  int64
	Text      string
}

// PrepareContext keeps posts the reader can access, optionally drops anything
// older than since, and returns the newest limit posts in chronological order.
// A nil canRead function denies every post. An empty ChannelID is denied too,
// because access cannot be checked.
func PrepareContext(posts []Post, canRead func(channelID string) bool, since time.Time, limit int) []Post {
	readable := make([]Post, 0, len(posts))
	for _, post := range posts {
		if post.ChannelID == "" || canRead == nil || !canRead(post.ChannelID) {
			continue
		}
		if !since.IsZero() && post.CreateAt < since.UnixMilli() {
			continue
		}
		readable = append(readable, post)
	}

	sort.SliceStable(readable, func(i, j int) bool {
		if readable[i].CreateAt == readable[j].CreateAt {
			return readable[i].ID < readable[j].ID
		}
		return readable[i].CreateAt < readable[j].CreateAt
	})

	if limit > 0 && len(readable) > limit {
		readable = readable[len(readable)-limit:]
	}
	return readable
}

// FormatContext renders the packet the model is allowed to read.
// Every entry includes the author, a UTC timestamp, and the post text.
func FormatContext(posts []Post) string {
	if len(posts) == 0 {
		return "(no posts)\n"
	}

	var b strings.Builder
	for i, post := range posts {
		author := post.Author
		if author == "" {
			author = "(author not resolved)"
		}
		text := strings.TrimSpace(post.Text)
		if text == "" {
			text = "(no text)"
		}
		text = truncate(text, MaxMessageRunes, " [truncated]")
		stamp := time.UnixMilli(post.CreateAt).UTC().Format(time.RFC3339)
		b.WriteString("[")
		b.WriteString(itoa(i + 1))
		b.WriteString("] id=")
		b.WriteString(post.ID)
		b.WriteString(" channel=")
		b.WriteString(post.ChannelID)
		b.WriteString(" author=")
		b.WriteString(author)
		b.WriteString(" time=")
		b.WriteString(stamp)
		b.WriteString("\n")
		b.WriteString(text)
		b.WriteString("\n")
	}
	return b.String()
}

func truncate(s string, limit int, suffix string) string {
	if limit <= 0 || utf8.RuneCountInString(s) <= limit {
		return s
	}
	runes := []rune(s)
	return string(runes[:limit]) + suffix
}

// TruncateReply caps user-visible assistant text.
func TruncateReply(s string) string {
	return truncate(strings.TrimSpace(s), MaxReplyRunes, "\n\n[truncated]")
}

func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	var buf [12]byte
	i := len(buf)
	for n > 0 {
		i--
		buf[i] = byte('0' + n%10)
		n /= 10
	}
	return string(buf[i:])
}
