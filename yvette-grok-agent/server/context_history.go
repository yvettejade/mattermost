package main

import (
	"sort"
	"strings"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
)

type GatherMode int

const (
	GatherChannel GatherMode = iota
	GatherThread
	GatherSince
	GatherMissed
)

type GatherOptions struct {
	ChannelID   string
	RootID      string
	UserID      string
	TeamID      string
	BotUserID   string
	MaxPosts    int
	WindowDays  int
	Since       int64
	SiteURL     string
	TeamName    string
	Query       string
	TeamSearch  bool
	SearchLimit int
	Mode        GatherMode
}

type HistoryPost struct {
	ID        string
	UserID    string
	Message   string
	ChannelID string
	CreateAt  int64
	Permalink string
}

func FilterAndCap(posts []*model.Post, botUserID string, windowStart int64, maxPosts int) []*model.Post {
	filtered := make([]*model.Post, 0, len(posts))
	for _, post := range posts {
		if post == nil {
			continue
		}
		if !includePost(post, botUserID, windowStart) {
			continue
		}
		filtered = append(filtered, post)
	}
	sort.Slice(filtered, func(i, j int) bool {
		return filtered[i].CreateAt < filtered[j].CreateAt
	})
	if maxPosts <= 0 {
		maxPosts = defaultHistoryMaxPosts
	}
	if maxPosts > hardCapHistoryMaxPosts {
		maxPosts = hardCapHistoryMaxPosts
	}
	if len(filtered) > maxPosts {
		filtered = filtered[len(filtered)-maxPosts:]
	}
	return filtered
}

func includePost(post *model.Post, botUserID string, windowStart int64) bool {
	if post.DeleteAt != 0 {
		return false
	}
	if botUserID != "" && post.UserId == botUserID {
		return false
	}
	if sent, _ := post.GetProp(sentByPluginProp).(bool); sent {
		return false
	}
	if windowStart > 0 && post.CreateAt < windowStart {
		return false
	}
	if strings.TrimSpace(post.Message) == "" {
		return false
	}
	return true
}

func WindowStart(now time.Time, windowDays int) int64 {
	if windowDays <= 0 {
		return 0
	}
	return now.Add(-time.Duration(windowDays) * 24 * time.Hour).UnixMilli()
}

func Permalink(siteURL, teamName, postID string) string {
	siteURL = strings.TrimRight(siteURL, "/")
	if siteURL == "" || postID == "" {
		return postID
	}
	if teamName == "" {
		return siteURL + "/pl/" + postID
	}
	return siteURL + "/" + teamName + "/pl/" + postID
}

func (p *Plugin) gatherHistory(opts GatherOptions) ([]HistoryPost, error) {
	if opts.MaxPosts <= 0 {
		opts.MaxPosts = defaultHistoryMaxPosts
	}
	windowStart := WindowStart(time.Now(), opts.WindowDays)
	teamName := opts.TeamName
	if teamName == "" && opts.TeamID != "" {
		if team, err := p.API.GetTeam(opts.TeamID); err == nil && team != nil {
			teamName = team.Name
		}
	}

	var raw []*model.Post
	switch opts.Mode {
	case GatherThread:
		id := opts.RootID
		if id == "" {
			break
		}
		list, err := p.API.GetPostThread(id)
		if err != nil {
			return nil, err
		}
		raw = list.ToSlice()
	case GatherSince, GatherMissed:
		since := opts.Since
		if opts.Mode == GatherMissed {
			member, err := p.API.GetChannelMember(opts.ChannelID, opts.UserID)
			if err != nil {
				return nil, err
			}
			since = member.LastViewedAt
		}
		list, err := p.API.GetPostsSince(opts.ChannelID, since)
		if err != nil {
			return nil, err
		}
		raw = list.ToSlice()
	default:
		list, err := p.API.GetPostsForChannel(opts.ChannelID, 0, opts.MaxPosts)
		if err != nil {
			return nil, err
		}
		raw = list.ToSlice()
	}

	if opts.TeamSearch && opts.TeamID != "" && opts.UserID != "" && strings.TrimSpace(opts.Query) != "" {
		limit := opts.SearchLimit
		if limit <= 0 {
			limit = 20
		}
		terms := opts.Query
		results, err := p.API.SearchPostsInTeamForUser(opts.TeamID, opts.UserID, model.SearchParameter{
			Terms:   &terms,
			PerPage: &limit,
		})
		if err != nil {
			p.logErr("team search", err)
		} else if results != nil && results.PostList != nil {
			raw = append(raw, results.ToSlice()...)
		}
	}

	filtered := FilterAndCap(raw, opts.BotUserID, windowStart, opts.MaxPosts)
	out := make([]HistoryPost, 0, len(filtered))
	seen := map[string]bool{}
	for _, post := range filtered {
		if seen[post.Id] {
			continue
		}
		seen[post.Id] = true
		out = append(out, HistoryPost{
			ID:        post.Id,
			UserID:    post.UserId,
			Message:   post.Message,
			ChannelID: post.ChannelId,
			CreateAt:  post.CreateAt,
			Permalink: Permalink(opts.SiteURL, teamName, post.Id),
		})
	}
	return out, nil
}

func formatHistory(posts []HistoryPost) string {
	if len(posts) == 0 {
		return "(no recent visible posts in this window)"
	}
	var b strings.Builder
	for _, post := range posts {
		b.WriteString("POST_ID=")
		b.WriteString(post.ID)
		b.WriteString(" USER=")
		b.WriteString(post.UserID)
		b.WriteString(" PERMALINK=")
		b.WriteString(post.Permalink)
		b.WriteString("\n")
		b.WriteString(post.Message)
		b.WriteString("\n\n")
	}
	return b.String()
}
