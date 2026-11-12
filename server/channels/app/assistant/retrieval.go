// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package assistant

import (
	"errors"
	"fmt"
	"sort"
	"strings"
	"time"
	"unicode"

	"github.com/mattermost/mattermost/server/public/model"
)

var (
	ErrForbidden = errors.New("you do not have permission to access this content")
	ErrNotFound  = errors.New("content not found")
)

const (
	maxSources            = 80
	maxSnippetChars       = 1500
	maxContextChars       = 48000
	threadPostLimit       = 100
	channelPostLimit      = 40
	unreadPostLimit       = 150
	searchResultLimit     = 25
	recentChannelLimit    = 8
	recentPerChannel      = 20
	recentWindow          = 24 * time.Hour
	maxSearchTerms        = 8
	minSearchTermLength   = 3
	recentFallbackMinimum = 5
)

// DataSource is bound to a single user session. Implementations may return data the
// user cannot see (e.g. raw thread or search hits); the Retriever re-checks channel
// read permission for every post before it is used as grounding.
type DataSource interface {
	GetChannel(channelID string) (*model.Channel, error)
	CanReadChannel(channel *model.Channel) bool
	GetPostThread(rootID string) (*model.PostList, error)
	// GetChannelPosts returns up to limit posts created after since (0 = latest posts).
	GetChannelPosts(channelID string, since int64, limit int) (*model.PostList, error)
	GetLastViewedAt(channelID string) (int64, error)
	SearchPosts(terms string, limit int) (*model.PostList, error)
	GetRecentlyActiveChannels(limit int) ([]*model.Channel, error)
	GetUsername(userID string) string
	GetTeamName(teamID string) string
}

type Source struct {
	Index    int
	Post     *model.Post
	Channel  *model.Channel
	TeamName string
	Username string
}

func (s *Source) Snippet() string {
	return truncate(s.Post.Message, maxSnippetChars)
}

func (s *Source) Permalink() string {
	team := s.TeamName
	if team == "" {
		team = "_redirect"
	}
	return fmt.Sprintf("/%s/pl/%s", team, s.Post.Id)
}

func (s *Source) ChannelLabel() string {
	if s.Channel.DisplayName != "" {
		return s.Channel.DisplayName
	}
	return s.Channel.Name
}

func (s *Source) Citation() *model.AssistantCitation {
	return &model.AssistantCitation{
		Index:              s.Index,
		PostId:             s.Post.Id,
		ChannelId:          s.Channel.Id,
		ChannelName:        s.Channel.Name,
		ChannelDisplayName: s.ChannelLabel(),
		TeamName:           s.TeamName,
		Username:           s.Username,
		CreateAt:           s.Post.CreateAt,
		Snippet:            truncate(s.Post.Message, 280),
		Permalink:          s.Permalink(),
	}
}

type ContextBundle struct {
	Mode           string
	Description    string
	CurrentChannel *model.Channel
	RootId         string
	Sources        []*Source
}

func (b *ContextBundle) SourceByIndex(i int) *Source {
	if i < 1 || i > len(b.Sources) {
		return nil
	}
	return b.Sources[i-1]
}

type channelAccess struct {
	channel *model.Channel
	allowed bool
}

type Retriever struct {
	ds       DataSource
	now      func() time.Time
	channels map[string]*channelAccess
	seen     map[string]bool
	sources  []*Source
	chars    int
}

func NewRetriever(ds DataSource) *Retriever {
	return &Retriever{
		ds:       ds,
		now:      time.Now,
		channels: map[string]*channelAccess{},
		seen:     map[string]bool{},
	}
}

func (r *Retriever) access(channelID string) (*model.Channel, bool) {
	if channelID == "" {
		return nil, false
	}
	if ca, ok := r.channels[channelID]; ok {
		return ca.channel, ca.allowed
	}
	channel, err := r.ds.GetChannel(channelID)
	ca := &channelAccess{}
	if err == nil && channel != nil {
		ca.channel = channel
		ca.allowed = r.ds.CanReadChannel(channel)
	}
	r.channels[channelID] = ca
	return ca.channel, ca.allowed
}

// requireChannel fails closed: missing and unreadable channels are indistinguishable to the caller.
func (r *Retriever) requireChannel(channelID string) (*model.Channel, error) {
	channel, ok := r.access(channelID)
	if channel == nil {
		return nil, ErrNotFound
	}
	if !ok {
		return nil, ErrForbidden
	}
	return channel, nil
}

func usablePost(p *model.Post) bool {
	if p == nil || p.DeleteAt != 0 || strings.TrimSpace(p.Message) == "" {
		return false
	}
	if p.Type == model.PostTypeBurnOnRead || strings.HasPrefix(p.Type, model.PostSystemMessagePrefix) {
		return false
	}
	return true
}

func (r *Retriever) add(p *model.Post) {
	if !usablePost(p) || r.seen[p.Id] || len(r.sources) >= maxSources || r.chars >= maxContextChars {
		return
	}
	channel, ok := r.access(p.ChannelId)
	if !ok {
		return
	}
	r.seen[p.Id] = true
	r.chars += min(len(p.Message), maxSnippetChars)
	r.sources = append(r.sources, &Source{
		Post:     p,
		Channel:  channel,
		TeamName: r.ds.GetTeamName(channel.TeamId),
		Username: r.ds.GetUsername(p.UserId),
	})
}

func (r *Retriever) addList(list *model.PostList) {
	if list == nil {
		return
	}
	posts := make([]*model.Post, 0, len(list.Posts))
	for _, p := range list.Posts {
		posts = append(posts, p)
	}
	// Newest first so truncation drops the oldest posts.
	sort.Slice(posts, func(i, j int) bool { return posts[i].CreateAt > posts[j].CreateAt })
	for _, p := range posts {
		r.add(p)
	}
}

func (r *Retriever) addThread(rootID string) error {
	list, err := r.ds.GetPostThread(rootID)
	if err != nil || list == nil {
		return ErrNotFound
	}
	root, ok := list.Posts[rootID]
	if !ok {
		return ErrNotFound
	}
	if _, err := r.requireChannel(root.ChannelId); err != nil {
		return err
	}
	r.addList(list)
	return nil
}

func (r *Retriever) Retrieve(req *model.AssistantChatRequest) (*ContextBundle, error) {
	bundle := &ContextBundle{Mode: req.Mode, RootId: req.RootId}
	if bundle.Mode == "" {
		bundle.Mode = model.AssistantModeAsk
	}

	if req.ChannelId != "" {
		channel, err := r.requireChannel(req.ChannelId)
		if err != nil {
			return nil, err
		}
		bundle.CurrentChannel = channel
	}

	switch bundle.Mode {
	case model.AssistantModeSummarizeThread:
		if err := r.addThread(req.RootId); err != nil {
			return nil, err
		}
		bundle.Description = "All posts in the requested thread."

	case model.AssistantModeSummarizeUnread:
		if bundle.CurrentChannel == nil {
			return nil, ErrNotFound
		}
		lastViewed, err := r.ds.GetLastViewedAt(bundle.CurrentChannel.Id)
		if err != nil {
			return nil, ErrNotFound
		}
		list, err := r.ds.GetChannelPosts(bundle.CurrentChannel.Id, lastViewed, unreadPostLimit)
		if err != nil {
			return nil, err
		}
		r.addList(list)
		bundle.Description = fmt.Sprintf("Posts in ~%s the user has not read yet (created after %s).",
			bundle.CurrentChannel.Name, time.UnixMilli(lastViewed).UTC().Format(time.RFC3339))

	case model.AssistantModeSummarizeRecent:
		since := r.now().Add(-recentWindow).UnixMilli()
		if bundle.CurrentChannel != nil {
			if err := r.addRecentForChannel(bundle.CurrentChannel.Id, since, unreadPostLimit); err != nil {
				return nil, err
			}
			bundle.Description = fmt.Sprintf("Recent activity in ~%s (last 24 hours, or the latest posts if it was quiet).", bundle.CurrentChannel.Name)
		} else {
			channels, err := r.ds.GetRecentlyActiveChannels(recentChannelLimit)
			if err != nil {
				return nil, err
			}
			for _, ch := range channels {
				if _, ok := r.access(ch.Id); !ok {
					continue
				}
				list, err := r.ds.GetChannelPosts(ch.Id, since, recentPerChannel)
				if err != nil {
					continue
				}
				r.addList(list)
			}
			bundle.Description = "Recent activity (last 24 hours) across the user's most active channels."
		}

	default:
		if req.RootId != "" {
			if err := r.addThread(req.RootId); err != nil {
				return nil, err
			}
		}
		if terms := SearchTerms(req.Message); terms != "" {
			if list, err := r.ds.SearchPosts(terms, searchResultLimit); err == nil {
				r.addList(list)
			}
		}
		if bundle.CurrentChannel != nil {
			if list, err := r.ds.GetChannelPosts(bundle.CurrentChannel.Id, 0, channelPostLimit); err == nil {
				r.addList(list)
			}
		}
		bundle.Description = "Search results for the question plus recent posts from the user's current channel/thread."
	}

	sort.SliceStable(r.sources, func(i, j int) bool { return r.sources[i].Post.CreateAt < r.sources[j].Post.CreateAt })
	for i, s := range r.sources {
		s.Index = i + 1
	}
	bundle.Sources = r.sources
	return bundle, nil
}

func (r *Retriever) addRecentForChannel(channelID string, since int64, limit int) error {
	list, err := r.ds.GetChannelPosts(channelID, since, limit)
	if err != nil {
		return err
	}
	if list == nil || len(list.Posts) < recentFallbackMinimum {
		if latest, err := r.ds.GetChannelPosts(channelID, 0, channelPostLimit); err == nil {
			r.addList(latest)
		}
	}
	r.addList(list)
	return nil
}

var stopWords = map[string]bool{
	"the": true, "and": true, "for": true, "are": true, "but": true, "not": true, "you": true, "all": true,
	"any": true, "can": true, "had": true, "her": true, "was": true, "one": true, "our": true, "out": true,
	"has": true, "have": true, "what": true, "when": true, "where": true, "which": true, "who": true, "whom": true,
	"why": true, "how": true, "this": true, "that": true, "these": true, "those": true, "with": true, "from": true,
	"about": true, "into": true, "than": true, "then": true, "them": true, "they": true, "their": true, "there": true,
	"been": true, "being": true, "were": true, "will": true, "would": true, "could": true, "should": true, "does": true,
	"did": true, "doing": true, "just": true, "also": true, "some": true, "such": true, "only": true, "very": true,
	"tell": true, "please": true, "know": true, "anyone": true, "someone": true, "said": true, "say": true,
	"its": true, "it's": true, "is": true, "me": true, "my": true, "we": true, "us": true, "an": true, "a": true,
	"summarize": true, "summary": true, "latest": true, "recent": true, "give": true, "show": true, "find": true,
}

// SearchTerms extracts keywords from a natural-language question for an OR post search.
func SearchTerms(question string) string {
	fields := strings.FieldsFunc(strings.ToLower(question), func(r rune) bool {
		return !unicode.IsLetter(r) && !unicode.IsNumber(r) && r != '-' && r != '_'
	})
	terms := make([]string, 0, maxSearchTerms)
	seen := map[string]bool{}
	for _, f := range fields {
		f = strings.Trim(f, "-_")
		if len(f) < minSearchTermLength || stopWords[f] || seen[f] {
			continue
		}
		seen[f] = true
		terms = append(terms, f)
		if len(terms) == maxSearchTerms {
			break
		}
	}
	return strings.Join(terms, " ")
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	cut := n
	for cut > 0 && !isRuneStart(s[cut]) {
		cut--
	}
	return s[:cut] + "…"
}

func isRuneStart(b byte) bool { return b&0xC0 != 0x80 }
