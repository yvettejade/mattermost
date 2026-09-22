// Copyright (c) 2023-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Package grounding retrieves workspace posts as the asking user and refuses
// answers that do not cite those posts. Phase 1 is lexical search only.
package grounding

import (
	"fmt"
	"regexp"
	"strings"
	"unicode"
	"unicode/utf8"

	"github.com/mattermost/mattermost-plugin-ai/mmapi"
	"github.com/mattermost/mattermost-plugin-ai/search"
	"github.com/mattermost/mattermost/server/public/model"
)

const (
	// RefusalMessage is the only reply allowed when retrieval has no usable source.
	RefusalMessage = "Nothing in the workspace matched that question, so I can't answer it from posts you can see."

	lexicalLimit = 10
	threadLimit  = 20
	minTermRunes = 3
	maxTermRunes = 300
	maxRunes     = 500
)

// postIDPattern matches a Mattermost post id inside a permalink path.
var postIDPattern = regexp.MustCompile(`/pl/([a-z0-9]{26})`)

// Source is one post the asking user is allowed to see.
type Source struct {
	Index       int
	PostID      string
	ChannelID   string
	ChannelName string
	TeamName    string
	UserID      string
	Username    string
	Content     string
	Score       float32
	Permalink   string
}

// PostSearcher is the plugin API search that runs as a user id.
// An empty team id searches every channel that user belongs to.
type PostSearcher interface {
	SearchPostsInTeamForUser(teamID string, userID string, searchParams model.SearchParameter) (*model.PostSearchResults, *model.AppError)
}

// Service searches as the requesting user. SearchPostsInTeamForUser runs
// App.SearchPostsForUser, which drops posts outside that user's membership.
type Service struct {
	search PostSearcher
	mm     mmapi.Client
}

func New(search PostSearcher, mm mmapi.Client) *Service {
	return &Service{search: search, mm: mm}
}

// Retrieve returns lexical hits, plus the current thread when the user is allowed
// to read it. Search always uses userID, never the bot's own membership.
func (s *Service) Retrieve(userID, botUserID, botUsername string, post *model.Post, channel *model.Channel) ([]Source, error) {
	if s == nil || userID == "" || userID == botUserID {
		return nil, fmt.Errorf("lexical search must run as the requesting user")
	}

	var sources []Source
	if channel != nil && channel.Type != model.ChannelTypeDirect && post != nil && post.RootId != "" {
		if s.mm != nil && s.mm.HasPermissionToChannel(userID, channel.Id, model.PermissionReadChannel) {
			sources = append(sources, s.threadSources(userID, botUserID, post)...)
		}
	}

	hits, err := s.lexicalSources(userID, botUserID, botUsername, post)
	if err != nil {
		if s.mm != nil {
			s.mm.LogWarn("lexical search failed", "error", err.Error(), "user_id", userID)
		}
	} else {
		sources = append(sources, hits...)
	}

	return dedupe(sources), nil
}

func (s *Service) threadSources(userID, botUserID string, post *model.Post) []Source {
	if s.mm == nil || post == nil || post.RootId == "" {
		return nil
	}
	list, err := s.mm.GetPostThread(post.RootId)
	if err != nil || list == nil {
		if err != nil && s.mm != nil {
			s.mm.LogWarn("failed to read thread for grounded answer", "error", err.Error())
		}
		return nil
	}

	posts := orderedPosts(list)
	if len(posts) > threadLimit {
		posts = posts[len(posts)-threadLimit:]
	}
	return s.enrich(userID, botUserID, post.Id, posts, threadLimit)
}

func (s *Service) lexicalSources(userID, botUserID, botUsername string, post *model.Post) ([]Source, error) {
	if s.search == nil || post == nil {
		return nil, nil
	}
	terms := TermsFromMessage(post.Message, botUsername)
	if utf8.RuneCountInString(terms) < minTermRunes {
		return nil, nil
	}

	isOr := true
	page := 0
	perPage := lexicalLimit
	includeDeleted := false
	results, appErr := s.search.SearchPostsInTeamForUser("", userID, model.SearchParameter{
		Terms:                  &terms,
		IsOrSearch:             &isOr,
		Page:                   &page,
		PerPage:                &perPage,
		IncludeDeletedChannels: &includeDeleted,
	})
	if appErr != nil {
		return nil, appErr
	}
	if results == nil || results.PostList == nil {
		return nil, nil
	}

	posts := orderedPosts(results.PostList)
	currentID := ""
	if post != nil {
		currentID = post.Id
	}
	return s.enrich(userID, botUserID, currentID, posts, lexicalLimit), nil
}

func (s *Service) enrich(userID, botUserID, skipPostID string, posts []*model.Post, limit int) []Source {
	siteURL := ""
	if s.mm != nil {
		if cfg := s.mm.GetConfig(); cfg != nil && cfg.ServiceSettings.SiteURL != nil {
			siteURL = *cfg.ServiceSettings.SiteURL
		}
	}

	channels := map[string]*model.Channel{}
	teams := map[string]*model.Team{}
	users := map[string]*model.User{}

	var sources []Source
	for _, post := range posts {
		if post == nil || post.Id == "" || post.Id == skipPostID || post.UserId == botUserID || post.IsSystemMessage() {
			continue
		}
		if !s.userCanReadChannel(userID, post.ChannelId) {
			continue
		}

		channelName, teamName := s.namesForChannel(post.ChannelId, channels, teams)
		username := s.username(post.UserId, users)
		content := strings.TrimSpace(post.Message)
		if content == "" {
			continue
		}

		sources = append(sources, Source{
			PostID:      post.Id,
			ChannelID:   post.ChannelId,
			ChannelName: channelName,
			TeamName:    teamName,
			UserID:      post.UserId,
			Username:    username,
			Content:     truncate(content, maxRunes),
			Permalink:   search.Permalink(siteURL, teamName, post.Id),
		})
		if limit > 0 && len(sources) >= limit {
			break
		}
	}
	for i := range sources {
		sources[i].Index = i + 1
	}
	return sources
}

func (s *Service) userCanReadChannel(userID, channelID string) bool {
	if s.mm == nil || channelID == "" {
		return false
	}
	return s.mm.HasPermissionToChannel(userID, channelID, model.PermissionReadChannel)
}

func (s *Service) namesForChannel(channelID string, channels map[string]*model.Channel, teams map[string]*model.Team) (string, string) {
	if s.mm == nil {
		return "", ""
	}
	channel, ok := channels[channelID]
	if !ok {
		loaded, err := s.mm.GetChannel(channelID)
		if err != nil {
			channels[channelID] = nil
			return "", ""
		}
		channels[channelID] = loaded
		channel = loaded
	}
	if channel == nil {
		return "", ""
	}

	channelName := channel.DisplayName
	switch channel.Type {
	case model.ChannelTypeDirect:
		channelName = "Direct Message"
	case model.ChannelTypeGroup:
		channelName = "Group Message"
	}

	if channel.TeamId == "" {
		return channelName, ""
	}
	team, ok := teams[channel.TeamId]
	if !ok {
		loaded, err := s.mm.GetTeam(channel.TeamId)
		if err != nil {
			teams[channel.TeamId] = nil
			return channelName, ""
		}
		teams[channel.TeamId] = loaded
		team = loaded
	}
	if team == nil {
		return channelName, ""
	}
	return channelName, team.Name
}

func (s *Service) username(userID string, users map[string]*model.User) string {
	if s.mm == nil || userID == "" {
		return ""
	}
	user, ok := users[userID]
	if !ok {
		loaded, err := s.mm.GetUser(userID)
		if err != nil {
			users[userID] = nil
			return ""
		}
		users[userID] = loaded
		user = loaded
	}
	if user == nil {
		return ""
	}
	return user.Username
}

func orderedPosts(list *model.PostList) []*model.Post {
	if list == nil {
		return nil
	}
	if len(list.Order) > 0 {
		posts := make([]*model.Post, 0, len(list.Order))
		for _, id := range list.Order {
			if post := list.Posts[id]; post != nil {
				posts = append(posts, post)
			}
		}
		return posts
	}
	posts := make([]*model.Post, 0, len(list.Posts))
	for _, post := range list.Posts {
		posts = append(posts, post)
	}
	return posts
}

func dedupe(sources []Source) []Source {
	seen := make(map[string]bool, len(sources))
	out := make([]Source, 0, len(sources))
	for _, source := range sources {
		if source.PostID == "" || seen[source.PostID] {
			continue
		}
		seen[source.PostID] = true
		source.Index = len(out) + 1
		out = append(out, source)
	}
	return out
}

// TermsFromMessage keeps searchable words and drops a leading @mention.
// botUsername may be empty; @mentions of any length are removed when passed separately.
func TermsFromMessage(message, botUsername string) string {
	if botUsername != "" {
		message = strings.ReplaceAll(message, "@"+botUsername, " ")
	}
	var b strings.Builder
	for _, r := range message {
		if unicode.IsLetter(r) || unicode.IsNumber(r) || unicode.IsSpace(r) {
			b.WriteRune(r)
		} else {
			b.WriteRune(' ')
		}
	}
	term := strings.Join(strings.Fields(b.String()), " ")
	runes := []rune(term)
	if len(runes) > maxTermRunes {
		term = strings.TrimSpace(string(runes[:maxTermRunes]))
	}
	return term
}

func truncate(s string, n int) string {
	runes := []rune(s)
	if len(runes) <= n {
		return s
	}
	return string(runes[:n-3]) + "..."
}

// EnforceCitedAnswer keeps an answer only when every permalink post id it
// contains was retrieved, and it contains at least one. The refusal sentence
// is always allowed. Anything else is replaced with the refusal.
func EnforceCitedAnswer(answer string, sources []Source) string {
	trimmed := strings.TrimSpace(answer)
	if trimmed == RefusalMessage || len(sources) == 0 {
		return RefusalMessage
	}

	allowed := make(map[string]bool, len(sources))
	for _, source := range sources {
		allowed[source.PostID] = true
	}

	matches := postIDPattern.FindAllStringSubmatch(answer, -1)
	if len(matches) == 0 {
		return RefusalMessage
	}
	for _, match := range matches {
		if !allowed[match[1]] {
			return RefusalMessage
		}
	}
	return answer
}
