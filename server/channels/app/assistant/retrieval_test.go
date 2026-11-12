// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package assistant

import (
	"errors"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

type fakeDataSource struct {
	channels   map[string]*model.Channel
	readable   map[string]bool
	posts      []*model.Post
	lastViewed map[string]int64
	searchHits []*model.Post
	searched   []string
}

func newFakeDataSource() *fakeDataSource {
	return &fakeDataSource{
		channels:   map[string]*model.Channel{},
		readable:   map[string]bool{},
		lastViewed: map[string]int64{},
	}
}

func (f *fakeDataSource) addChannel(name string, readable bool) *model.Channel {
	ch := &model.Channel{Id: model.NewId(), Name: name, DisplayName: name, TeamId: "team1", Type: model.ChannelTypeOpen}
	f.channels[ch.Id] = ch
	f.readable[ch.Id] = readable
	return ch
}

func (f *fakeDataSource) addPost(ch *model.Channel, msg string, createAt int64, rootID string) *model.Post {
	p := &model.Post{Id: model.NewId(), ChannelId: ch.Id, UserId: "u1", Message: msg, CreateAt: createAt, RootId: rootID}
	f.posts = append(f.posts, p)
	return p
}

func listOf(posts []*model.Post) *model.PostList {
	l := model.NewPostList()
	for _, p := range posts {
		l.AddPost(p)
		l.AddOrder(p.Id)
	}
	return l
}

func (f *fakeDataSource) GetChannel(id string) (*model.Channel, error) {
	if ch, ok := f.channels[id]; ok {
		return ch, nil
	}
	return nil, errors.New("not found")
}

func (f *fakeDataSource) CanReadChannel(ch *model.Channel) bool { return f.readable[ch.Id] }

func (f *fakeDataSource) GetPostThread(rootID string) (*model.PostList, error) {
	var out []*model.Post
	for _, p := range f.posts {
		if p.Id == rootID || p.RootId == rootID {
			out = append(out, p)
		}
	}
	if len(out) == 0 {
		return nil, errors.New("not found")
	}
	return listOf(out), nil
}

func (f *fakeDataSource) GetChannelPosts(channelID string, since int64, limit int) (*model.PostList, error) {
	var out []*model.Post
	for _, p := range f.posts {
		if p.ChannelId == channelID && p.CreateAt > since {
			out = append(out, p)
		}
	}
	if len(out) > limit {
		out = out[len(out)-limit:]
	}
	return listOf(out), nil
}

func (f *fakeDataSource) GetLastViewedAt(channelID string) (int64, error) {
	return f.lastViewed[channelID], nil
}

func (f *fakeDataSource) SearchPosts(terms string, limit int) (*model.PostList, error) {
	f.searched = append(f.searched, terms)
	return listOf(f.searchHits), nil
}

func (f *fakeDataSource) GetRecentlyActiveChannels(limit int) ([]*model.Channel, error) {
	var out []*model.Channel
	for _, ch := range f.channels {
		out = append(out, ch)
	}
	return out, nil
}

func (f *fakeDataSource) GetUsername(string) string { return "alice" }
func (f *fakeDataSource) GetTeamName(string) string { return "team-one" }

func sourceIDs(b *ContextBundle) []string {
	ids := make([]string, 0, len(b.Sources))
	for _, s := range b.Sources {
		ids = append(ids, s.Post.Id)
	}
	return ids
}

func TestRetrieveAskFiltersSearchResultsByPermission(t *testing.T) {
	ds := newFakeDataSource()
	public := ds.addChannel("town-square", true)
	secret := ds.addChannel("secret", false)
	allowed := ds.addPost(public, "launch is on friday", 100, "")
	leaked := ds.addPost(secret, "secret launch plans", 200, "")
	ds.searchHits = []*model.Post{allowed, leaked}

	bundle, err := NewRetriever(ds).Retrieve(&model.AssistantChatRequest{Message: "When is the launch?"})
	require.NoError(t, err)

	assert.Equal(t, []string{allowed.Id}, sourceIDs(bundle))
	assert.Equal(t, []string{"launch"}, ds.searched)
	assert.Equal(t, 1, bundle.Sources[0].Index)
	assert.Equal(t, "/team-one/pl/"+allowed.Id, bundle.Sources[0].Permalink())
}

func TestRetrieveRejectsUnreadableCurrentChannel(t *testing.T) {
	ds := newFakeDataSource()
	secret := ds.addChannel("secret", false)
	ds.addPost(secret, "do not leak", 100, "")

	_, err := NewRetriever(ds).Retrieve(&model.AssistantChatRequest{Message: "hi", ChannelId: secret.Id})
	assert.ErrorIs(t, err, ErrForbidden)

	_, err = NewRetriever(ds).Retrieve(&model.AssistantChatRequest{Message: "hi", ChannelId: model.NewId()})
	assert.ErrorIs(t, err, ErrNotFound)
}

func TestRetrieveThreadRequiresPermissionOnRootChannel(t *testing.T) {
	ds := newFakeDataSource()
	public := ds.addChannel("public", true)
	secret := ds.addChannel("secret", false)
	root := ds.addPost(secret, "root", 100, "")
	ds.addPost(secret, "reply", 200, root.Id)

	// Passing a readable channel must not unlock a thread that lives elsewhere.
	_, err := NewRetriever(ds).Retrieve(&model.AssistantChatRequest{Mode: model.AssistantModeSummarizeThread, ChannelId: public.Id, RootId: root.Id})
	assert.ErrorIs(t, err, ErrForbidden)

	ds.readable[secret.Id] = true
	bundle, err := NewRetriever(ds).Retrieve(&model.AssistantChatRequest{Mode: model.AssistantModeSummarizeThread, RootId: root.Id})
	require.NoError(t, err)
	assert.Len(t, bundle.Sources, 2)
	assert.Equal(t, root.Id, bundle.Sources[0].Post.Id, "sources are chronological")
}

func TestRetrieveUnreadOnlyIncludesPostsAfterLastViewed(t *testing.T) {
	ds := newFakeDataSource()
	ch := ds.addChannel("dev", true)
	ds.addPost(ch, "old", 100, "")
	unread := ds.addPost(ch, "new", 300, "")
	ds.lastViewed[ch.Id] = 200

	bundle, err := NewRetriever(ds).Retrieve(&model.AssistantChatRequest{Mode: model.AssistantModeSummarizeUnread, ChannelId: ch.Id})
	require.NoError(t, err)
	assert.Equal(t, []string{unread.Id}, sourceIDs(bundle))
}

func TestRetrieveRecentAcrossChannelsSkipsUnreadable(t *testing.T) {
	ds := newFakeDataSource()
	now := time.Now()
	pub := ds.addChannel("pub", true)
	priv := ds.addChannel("priv", false)
	visible := ds.addPost(pub, "visible", now.Add(-time.Hour).UnixMilli(), "")
	ds.addPost(priv, "hidden", now.Add(-time.Hour).UnixMilli(), "")
	ds.addPost(pub, "too old", now.Add(-48*time.Hour).UnixMilli(), "")

	bundle, err := NewRetriever(ds).Retrieve(&model.AssistantChatRequest{Mode: model.AssistantModeSummarizeRecent})
	require.NoError(t, err)
	assert.Equal(t, []string{visible.Id}, sourceIDs(bundle))
}

func TestRetrieveSkipsDeletedSystemAndBurnOnReadPosts(t *testing.T) {
	ds := newFakeDataSource()
	ch := ds.addChannel("dev", true)
	keep := ds.addPost(ch, "keep", 100, "")
	ds.addPost(ch, "deleted", 200, "").DeleteAt = 1
	ds.addPost(ch, "joined", 300, "").Type = model.PostTypeJoinChannel
	ds.addPost(ch, "ephemeral secret", 400, "").Type = model.PostTypeBurnOnRead

	bundle, err := NewRetriever(ds).Retrieve(&model.AssistantChatRequest{Message: "zz", ChannelId: ch.Id})
	require.NoError(t, err)
	assert.Equal(t, []string{keep.Id}, sourceIDs(bundle))
}

func TestSearchTerms(t *testing.T) {
	assert.Equal(t, "deploy schedule q3-release", SearchTerms("What is the deploy schedule for the Q3-release??"))
	assert.Equal(t, "", SearchTerms("what is it?"))
}
