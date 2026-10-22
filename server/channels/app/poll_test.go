// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"
	"sync"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

func createTestPollPost(t *testing.T, th *TestHelper) *model.Post {
	t.Helper()

	post := &model.Post{
		UserId:    th.BasicUser.Id,
		ChannelId: th.BasicChannel.Id,
		Message:   "Poll: Lunch?",
		Type:      model.PostTypePoll,
	}
	post.AddProp(model.PostPropsPoll, map[string]any{
		"question": "Lunch?",
		"options": []any{
			map[string]any{"id": "a", "text": "Tacos"},
			map[string]any{"id": "b", "text": "Pizza"},
		},
	})

	created, _, appErr := th.App.CreatePostAsUser(th.Context, post, "", true)
	require.Nil(t, appErr)
	return created
}

func TestVotePoll(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("empty results before any votes", func(t *testing.T) {
		post := createTestPollPost(t, th)

		results, appErr := th.App.GetPollResults(th.Context, post.Id)
		require.Nil(t, appErr)
		assert.Equal(t, 0, results.TotalVotes)
		assert.Equal(t, map[string][]string{"a": {}, "b": {}}, results.Votes)
	})

	t.Run("vote, change vote, retract", func(t *testing.T) {
		post := createTestPollPost(t, th)

		results, appErr := th.App.VotePoll(th.Context, post.Id, th.BasicUser.Id, "a")
		require.Nil(t, appErr)
		assert.Equal(t, []string{th.BasicUser.Id}, results.Votes["a"])

		results, appErr = th.App.VotePoll(th.Context, post.Id, th.BasicUser2.Id, "a")
		require.Nil(t, appErr)
		assert.Equal(t, 2, results.TotalVotes)

		results, appErr = th.App.VotePoll(th.Context, post.Id, th.BasicUser.Id, "b")
		require.Nil(t, appErr)
		assert.Equal(t, []string{th.BasicUser2.Id}, results.Votes["a"])
		assert.Equal(t, []string{th.BasicUser.Id}, results.Votes["b"])

		_, appErr = th.App.VotePoll(th.Context, post.Id, th.BasicUser.Id, "")
		require.Nil(t, appErr)

		persisted, appErr := th.App.GetPollResults(th.Context, post.Id)
		require.Nil(t, appErr)
		assert.Equal(t, 1, persisted.TotalVotes)
		assert.Empty(t, persisted.Votes["b"])
	})

	t.Run("concurrent votes are all recorded", func(t *testing.T) {
		post := createTestPollPost(t, th)

		userIDs := []string{model.NewId(), model.NewId(), model.NewId(), model.NewId()}
		var wg sync.WaitGroup
		for _, userID := range userIDs {
			wg.Go(func() {
				_, appErr := th.App.VotePoll(th.Context, post.Id, userID, "a")
				assert.Nil(t, appErr)
			})
		}
		wg.Wait()

		results, appErr := th.App.GetPollResults(th.Context, post.Id)
		require.Nil(t, appErr)
		assert.ElementsMatch(t, userIDs, results.Votes["a"])
	})

	t.Run("rejects unknown option", func(t *testing.T) {
		post := createTestPollPost(t, th)

		_, appErr := th.App.VotePoll(th.Context, post.Id, th.BasicUser.Id, "nope")
		require.NotNil(t, appErr)
		assert.Equal(t, http.StatusBadRequest, appErr.StatusCode)
	})

	t.Run("rejects non-poll posts", func(t *testing.T) {
		_, appErr := th.App.VotePoll(th.Context, th.BasicPost.Id, th.BasicUser.Id, "a")
		require.NotNil(t, appErr)
		assert.Equal(t, "app.poll.not_a_poll.app_error", appErr.Id)
	})
}
