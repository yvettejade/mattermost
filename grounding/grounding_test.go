// Copyright (c) 2023-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package grounding

import (
	"testing"

	"github.com/mattermost/mattermost-plugin-ai/mmapi"
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/require"
)

const (
	askingUserID = "user0000000000000000000001"
	botUserID    = "botuser0000000000000000001"
	visiblePost  = "abc123def456ghij789klmno01"
	foreignPost  = "zzz999yyy888xxx777www666vv"
	threadRoot   = "rootpost000000000000000001"
	channelID    = "channel0000000000000000001"
	teamID       = "team0000000000000000000001"
)

type searchStub struct {
	userID  string
	teamID  string
	results *model.PostSearchResults
	calls   int
}

func (s *searchStub) SearchPostsInTeamForUser(teamID, userID string, _ model.SearchParameter) (*model.PostSearchResults, *model.AppError) {
	s.calls++
	s.userID = userID
	s.teamID = teamID
	return s.results, nil
}

type mmStub struct {
	mmapi.Client
	allowUserID string
	thread      *model.PostList
	threadCalls int
}

func (m *mmStub) HasPermissionToChannel(userID, _ string, _ *model.Permission) bool {
	return userID == m.allowUserID
}

func (m *mmStub) GetConfig() *model.Config {
	siteURL := "https://chat.example.com"
	return &model.Config{ServiceSettings: model.ServiceSettings{SiteURL: &siteURL}}
}

func (m *mmStub) GetChannel(id string) (*model.Channel, error) {
	return &model.Channel{Id: id, DisplayName: "Town Square", Type: model.ChannelTypeOpen, TeamId: teamID, Name: "town-square"}, nil
}

func (m *mmStub) GetTeam(string) (*model.Team, error) {
	return &model.Team{Id: teamID, Name: "engineering"}, nil
}

func (m *mmStub) GetUser(id string) (*model.User, error) {
	return &model.User{Id: id, Username: "alice"}, nil
}

func (m *mmStub) GetPostThread(rootID string) (*model.PostList, error) {
	m.threadCalls++
	return m.thread, nil
}

func (m *mmStub) LogWarn(string, ...interface{}) {}

func postList(posts ...*model.Post) *model.PostList {
	list := model.NewPostList()
	for _, post := range posts {
		list.AddPost(post)
		list.AddOrder(post.Id)
	}
	return list
}

func TestRetrieveSearchesAsAskingUser(t *testing.T) {
	post := &model.Post{Id: "question000000000000000001", UserId: askingUserID, ChannelId: channelID, Message: "database migration plan"}
	hit := &model.Post{Id: visiblePost, UserId: "someone", ChannelId: channelID, Message: "We will migrate the database on Friday"}
	searcher := &searchStub{results: &model.PostSearchResults{PostList: postList(hit)}}
	mm := &mmStub{allowUserID: askingUserID}
	svc := New(searcher, mm)

	sources, err := svc.Retrieve(askingUserID, botUserID, "mattermostbot", post, &model.Channel{Id: channelID, Type: model.ChannelTypeOpen})
	require.NoError(t, err)
	require.Equal(t, askingUserID, searcher.userID)
	require.NotEqual(t, botUserID, searcher.userID)
	require.Empty(t, searcher.teamID)
	require.Len(t, sources, 1)
	require.Equal(t, visiblePost, sources[0].PostID)
	require.Equal(t, "engineering", sources[0].TeamName)
	require.Equal(t, "https://chat.example.com/engineering/pl/"+visiblePost+"?view=citation", sources[0].Permalink)
}

func TestRetrieveDropsPostsTheUserCannotRead(t *testing.T) {
	post := &model.Post{Id: "question000000000000000001", UserId: askingUserID, ChannelId: channelID, Message: "secret roadmap"}
	hidden := &model.Post{Id: visiblePost, UserId: "someone", ChannelId: "privatechannel00000000000001", Message: "the secret roadmap is blue"}
	searcher := &searchStub{results: &model.PostSearchResults{PostList: postList(hidden)}}
	// The search API is supposed to omit this post. If it doesn't, the permission check still drops it.
	mm := &mmStub{allowUserID: "somebody-else"}
	svc := New(searcher, mm)

	sources, err := svc.Retrieve(askingUserID, botUserID, "mattermostbot", post, &model.Channel{Id: channelID, Type: model.ChannelTypeOpen})
	require.NoError(t, err)
	require.Empty(t, sources)
	require.Equal(t, askingUserID, searcher.userID)
}

func TestRetrieveRefusesBotUserID(t *testing.T) {
	searcher := &searchStub{}
	svc := New(searcher, &mmStub{allowUserID: botUserID})
	_, err := svc.Retrieve(botUserID, botUserID, "mattermostbot", &model.Post{Message: "database migration"}, &model.Channel{Type: model.ChannelTypeOpen})
	require.Error(t, err)
	require.Zero(t, searcher.calls)
}

func TestRetrievePrependsThreadTheUserCanRead(t *testing.T) {
	mention := &model.Post{Id: "mention0000000000000000001", UserId: askingUserID, ChannelId: channelID, RootId: threadRoot, Message: "@mattermostbot what did we decide"}
	older := &model.Post{Id: visiblePost, UserId: "someone", ChannelId: channelID, Message: "We decided to ship Friday"}
	searcher := &searchStub{results: &model.PostSearchResults{PostList: model.NewPostList()}}
	mm := &mmStub{allowUserID: askingUserID, thread: postList(older, mention)}
	svc := New(searcher, mm)

	sources, err := svc.Retrieve(askingUserID, botUserID, "mattermostbot", mention, &model.Channel{Id: channelID, Type: model.ChannelTypeOpen})
	require.NoError(t, err)
	require.Equal(t, 1, mm.threadCalls)
	require.Len(t, sources, 1)
	require.Equal(t, visiblePost, sources[0].PostID)
	require.NotEqual(t, mention.Id, sources[0].PostID)
}

func TestRetrieveSkipsThreadWithoutPermissionOrInDM(t *testing.T) {
	mention := &model.Post{Id: "mention0000000000000000001", RootId: threadRoot, ChannelId: channelID, Message: "what did we decide about the database"}
	searcher := &searchStub{results: &model.PostSearchResults{PostList: model.NewPostList()}}
	mm := &mmStub{allowUserID: "nobody", thread: postList(&model.Post{Id: visiblePost, ChannelId: channelID, Message: "secret"})}
	svc := New(searcher, mm)

	sources, err := svc.Retrieve(askingUserID, botUserID, "mattermostbot", mention, &model.Channel{Id: channelID, Type: model.ChannelTypeOpen})
	require.NoError(t, err)
	require.Zero(t, mm.threadCalls)
	require.Empty(t, sources)

	dm := &mmStub{allowUserID: askingUserID, thread: postList(&model.Post{Id: visiblePost, ChannelId: channelID, Message: "hello"})}
	svc = New(searcher, dm)
	_, err = svc.Retrieve(askingUserID, botUserID, "mattermostbot", mention, &model.Channel{Id: channelID, Type: model.ChannelTypeDirect})
	require.NoError(t, err)
	require.Zero(t, dm.threadCalls)
}

func TestEnforceCitedAnswer(t *testing.T) {
	sources := []Source{{
		PostID:    visiblePost,
		Permalink: "https://chat.example.com/engineering/pl/" + visiblePost + "?view=citation",
	}}
	cited := "Ship Friday. [permalink](https://chat.example.com/engineering/pl/" + visiblePost + "?view=citation)"
	require.Equal(t, cited, EnforceCitedAnswer(cited, sources))

	require.Equal(t, RefusalMessage, EnforceCitedAnswer("Ship Friday, I think.", sources))
	foreign := "Ship Friday. [permalink](https://chat.example.com/engineering/pl/" + foreignPost + "?view=citation)"
	require.Equal(t, RefusalMessage, EnforceCitedAnswer(foreign, sources))
	require.Equal(t, RefusalMessage, EnforceCitedAnswer(cited, nil))
	require.Equal(t, RefusalMessage, EnforceCitedAnswer(RefusalMessage, sources))
}

func TestTermsFromMessage(t *testing.T) {
	got := TermsFromMessage("@mattermostbot what did we decide?", "mattermostbot")
	require.Equal(t, "what did we decide", got)
	require.Less(t, len(TermsFromMessage("ab", "mattermostbot")), minTermRunes)
}
