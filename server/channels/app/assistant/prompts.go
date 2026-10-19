// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package assistant

import (
	"fmt"
	"sort"
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
)

const maxPromptPosts = 50

// ChannelPost is a groundable post excerpt for the model.
type ChannelPost struct {
	UserID    string
	Message   string
	CreateAt  int64
	RootID    string
}

func IsGroundablePost(p *model.Post) bool {
	if p == nil || p.DeleteAt != 0 {
		return false
	}
	if strings.HasPrefix(p.Type, model.PostSystemMessagePrefix) {
		return false
	}
	return strings.TrimSpace(p.Message) != ""
}

func CollectGroundablePosts(list *model.PostList) []ChannelPost {
	if list == nil {
		return nil
	}
	seen := make(map[string]struct{})
	posts := make([]ChannelPost, 0, len(list.Posts))
	for _, p := range list.Posts {
		if p == nil || !IsGroundablePost(p) {
			continue
		}
		if _, ok := seen[p.Id]; ok {
			continue
		}
		seen[p.Id] = struct{}{}
		posts = append(posts, ChannelPost{
			UserID:   p.UserId,
			Message:  p.Message,
			CreateAt: p.CreateAt,
			RootID:   p.RootId,
		})
	}
	sort.Slice(posts, func(i, j int) bool {
		return posts[i].CreateAt < posts[j].CreateAt
	})
	if len(posts) > maxPromptPosts {
		posts = posts[len(posts)-maxPromptPosts:]
	}
	return posts
}

func SystemPrompt(intent string, hasJira bool) string {
	var b strings.Builder
	b.WriteString("You are MatterBot, a workspace assistant inside Mattermost. ")
	b.WriteString("Answer only from the provided channel posts")
	if hasJira {
		b.WriteString(" and the Jira lookup packet")
	}
	b.WriteString(". Do not invent facts, users, or issue keys. ")
	b.WriteString("If the context is insufficient, say so. Reply in markdown.\n")
	switch intent {
	case model.AssistantIntentSummarize:
		b.WriteString("Summarize the conversation clearly.")
	case model.AssistantIntentCatchUp:
		b.WriteString("Catch the user up on what they missed in the loaded window.")
	case model.AssistantIntentDraft:
		b.WriteString("Draft the requested document from the channel context.")
	case model.AssistantIntentBoard:
		b.WriteString("Draft a board or card from the channel context.")
	case model.AssistantIntentScheduleMeeting:
		b.WriteString("Propose a meeting. Return only a JSON object with keys title, when, attendees (array of strings), and notes.")
	case model.AssistantIntentSchedulePost:
		b.WriteString("Draft the scheduled post body from the user's request and channel context.")
	case model.AssistantIntentJira:
		b.WriteString("Answer Jira questions using only the lookup packet. Never mention issue keys that are not in the packet.")
	default:
		b.WriteString("Answer the question using only the provided posts.")
	}
	return b.String()
}

func UserPrompt(message string, posts []ChannelPost, packet *JiraPacket) string {
	var b strings.Builder
	b.WriteString("User request:\n")
	if strings.TrimSpace(message) == "" {
		b.WriteString("(summarize the channel)\n")
	} else {
		b.WriteString(message)
		b.WriteString("\n")
	}
	b.WriteString("\nChannel posts:\n")
	if len(posts) == 0 {
		b.WriteString("(none)\n")
	} else {
		for i, p := range posts {
			fmt.Fprintf(&b, "%d. user=%s create_at=%d root_id=%s\n%s\n", i+1, p.UserID, p.CreateAt, p.RootID, p.Message)
		}
	}
	if packet != nil {
		b.WriteString("\nJira lookup (site ")
		b.WriteString(packet.Site)
		b.WriteString("):\n")
		if packet.Empty() {
			b.WriteString("(empty — do not invent issue keys)\n")
		} else {
			for _, issue := range packet.Issues {
				fmt.Fprintf(&b, "- %s: %s [%s] %s\n%s\n", issue.Key, issue.Summary, issue.Status, issue.URL, issue.Description)
			}
		}
	}
	return Redact(b.String())
}
