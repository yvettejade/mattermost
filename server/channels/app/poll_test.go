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

func newPollPost(channelID, userID string) *model.Post {
	post := &model.Post{
		UserId:    userID,
		ChannelId: channelID,
		Message:   "Poll: Lunch?",
		Type:      model.PostTypePoll,
	}
	post.AddProp(model.PostPropsPoll, map[string]any{
		"question": "Lunch?",
		"options": []any{
			map[string]any{"id": "client-a", "text": "Tacos"},
			map[string]any{"id": "client-b", "text": "Pizza"},
		},
	})
	return post
}

// createTestPollPost returns the saved poll post and its server-assigned option IDs.
func createTestPollPost(t *testing.T, th *TestHelper) (*model.Post, string, string) {
	t.Helper()

	created, _, appErr := th.App.CreatePostAsUser(th.Context, newPollPost(th.BasicChannel.Id, th.BasicUser.Id), "", true)
	require.Nil(t, appErr)

	poll, err := model.PollFromPost(created)
	require.NoError(t, err)
	return created, poll.Options[0].ID, poll.Options[1].ID
}

func hasPollVotes(t *testing.T, th *TestHelper, postID string) bool {
	t.Helper()

	value, appErr := th.App.GetPluginKey(model.PollKVNamespace, model.PollVotesKVKey(postID))
	require.Nil(t, appErr)
	return value != nil
}

func TestCreatePollPost(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("normalizes options and assigns server ids", func(t *testing.T) {
		post, a, b := createTestPollPost(t, th)

		assert.NotEqual(t, "client-a", a)
		assert.True(t, model.IsValidId(a))
		assert.NotEqual(t, a, b)

		stored, appErr := th.App.GetSinglePost(th.Context, post.Id, false)
		require.Nil(t, appErr)
		poll, err := model.PollFromPost(stored)
		require.NoError(t, err)
		assert.Equal(t, a, poll.Options[0].ID)
	})

	t.Run("rejects an invalid poll payload", func(t *testing.T) {
		post := newPollPost(th.BasicChannel.Id, th.BasicUser.Id)
		post.AddProp(model.PostPropsPoll, map[string]any{"question": "Lunch?", "options": []any{map[string]any{"text": "Only one"}}})

		_, _, appErr := th.App.CreatePostAsUser(th.Context, post, "", true)
		require.NotNil(t, appErr)
		assert.Equal(t, http.StatusBadRequest, appErr.StatusCode)
		assert.Equal(t, "app.poll.invalid.app_error", appErr.Id)
	})
}

func TestUpdatePollPost(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("allows editing the message", func(t *testing.T) {
		post, _, _ := createTestPollPost(t, th)

		edited := post.Clone()
		edited.Message = "Poll: Lunch today?"
		updated, _, appErr := th.App.UpdatePost(th.Context, edited, nil)
		require.Nil(t, appErr)
		assert.Equal(t, "Poll: Lunch today?", updated.Message)
	})

	t.Run("rejects changing the options via update", func(t *testing.T) {
		post, a, b := createTestPollPost(t, th)

		edited := post.Clone()
		edited.AddProp(model.PostPropsPoll, model.Poll{Question: "Lunch?", Options: []model.PollOption{{ID: a, Text: "Tacos"}, {ID: b, Text: "Sushi"}}})
		_, _, appErr := th.App.UpdatePost(th.Context, edited, nil)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.poll.immutable.app_error", appErr.Id)
	})

	t.Run("rejects removing the poll via patch", func(t *testing.T) {
		post, _, _ := createTestPollPost(t, th)

		_, _, appErr := th.App.PatchPost(th.Context, post.Id, &model.PostPatch{Props: &model.StringInterface{}}, nil)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.poll.immutable.app_error", appErr.Id)
	})

	t.Run("allows patching only the message", func(t *testing.T) {
		post, _, _ := createTestPollPost(t, th)

		_, _, appErr := th.App.PatchPost(th.Context, post.Id, &model.PostPatch{Message: model.NewPointer("Poll: Dinner?")}, nil)
		require.Nil(t, appErr)
	})

	t.Run("rejects turning a regular post into a poll", func(t *testing.T) {
		edited := th.BasicPost.Clone()
		edited.Type = model.PostTypePoll
		_, _, appErr := th.App.UpdatePost(th.Context, edited, nil)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.poll.immutable.app_error", appErr.Id)
	})
}

func TestVotePoll(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("empty results before any votes", func(t *testing.T) {
		post, a, b := createTestPollPost(t, th)

		results, appErr := th.App.GetPollResults(th.Context, post.Id)
		require.Nil(t, appErr)
		assert.Equal(t, 0, results.TotalVotes)
		assert.Equal(t, map[string][]string{a: {}, b: {}}, results.Votes)
	})

	t.Run("vote, change vote, retract", func(t *testing.T) {
		post, a, b := createTestPollPost(t, th)

		results, appErr := th.App.VotePoll(th.Context, post.Id, th.BasicUser.Id, a)
		require.Nil(t, appErr)
		assert.Equal(t, []string{th.BasicUser.Id}, results.Votes[a])
		firstUpdate := results.UpdateAt

		results, appErr = th.App.VotePoll(th.Context, post.Id, th.BasicUser2.Id, a)
		require.Nil(t, appErr)
		assert.Equal(t, 2, results.TotalVotes)
		assert.Greater(t, results.UpdateAt, firstUpdate)

		results, appErr = th.App.VotePoll(th.Context, post.Id, th.BasicUser.Id, b)
		require.Nil(t, appErr)
		assert.Equal(t, []string{th.BasicUser2.Id}, results.Votes[a])
		assert.Equal(t, []string{th.BasicUser.Id}, results.Votes[b])

		_, appErr = th.App.VotePoll(th.Context, post.Id, th.BasicUser.Id, "")
		require.Nil(t, appErr)

		persisted, appErr := th.App.GetPollResults(th.Context, post.Id)
		require.Nil(t, appErr)
		assert.Equal(t, 1, persisted.TotalVotes)
		assert.Empty(t, persisted.Votes[b])
	})

	t.Run("no-op votes do not write", func(t *testing.T) {
		post, a, _ := createTestPollPost(t, th)

		_, appErr := th.App.VotePoll(th.Context, post.Id, th.BasicUser.Id, "")
		require.Nil(t, appErr)
		assert.False(t, hasPollVotes(t, th, post.Id))

		first, appErr := th.App.VotePoll(th.Context, post.Id, th.BasicUser.Id, a)
		require.Nil(t, appErr)
		again, appErr := th.App.VotePoll(th.Context, post.Id, th.BasicUser.Id, a)
		require.Nil(t, appErr)
		assert.Equal(t, first.UpdateAt, again.UpdateAt)
	})

	t.Run("concurrent votes are all recorded", func(t *testing.T) {
		post, a, _ := createTestPollPost(t, th)

		userIDs := []string{model.NewId(), model.NewId(), model.NewId(), model.NewId()}
		var wg sync.WaitGroup
		for _, userID := range userIDs {
			wg.Go(func() {
				_, appErr := th.App.VotePoll(th.Context, post.Id, userID, a)
				assert.Nil(t, appErr)
			})
		}
		wg.Wait()

		results, appErr := th.App.GetPollResults(th.Context, post.Id)
		require.Nil(t, appErr)
		assert.ElementsMatch(t, userIDs, results.Votes[a])
	})

	t.Run("rejects unknown option", func(t *testing.T) {
		post, _, _ := createTestPollPost(t, th)

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

func TestPollVotesDeletedWithPost(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	votedPoll := func(t *testing.T, channelID, rootID string) *model.Post {
		t.Helper()

		post := newPollPost(channelID, th.BasicUser.Id)
		post.RootId = rootID
		created, _, appErr := th.App.CreatePostAsUser(th.Context, post, "", true)
		require.Nil(t, appErr)
		poll, err := model.PollFromPost(created)
		require.NoError(t, err)
		_, appErr = th.App.VotePoll(th.Context, created.Id, th.BasicUser.Id, poll.Options[0].ID)
		require.Nil(t, appErr)
		require.True(t, hasPollVotes(t, th, created.Id))
		return created
	}

	t.Run("delete", func(t *testing.T) {
		post := votedPoll(t, th.BasicChannel.Id, "")

		_, appErr := th.App.DeletePost(th.Context, post.Id, th.BasicUser.Id)
		require.Nil(t, appErr)
		assert.False(t, hasPollVotes(t, th, post.Id))
	})

	t.Run("deleting a thread root removes votes on poll replies", func(t *testing.T) {
		reply := votedPoll(t, th.BasicChannel.Id, th.BasicPost.Id)
		root := th.CreatePost(t, th.BasicChannel)
		replyInOtherThread := votedPoll(t, th.BasicChannel.Id, root.Id)

		_, appErr := th.App.DeletePost(th.Context, root.Id, th.BasicUser.Id)
		require.Nil(t, appErr)
		assert.False(t, hasPollVotes(t, th, replyInOtherThread.Id))
		assert.True(t, hasPollVotes(t, th, reply.Id))
	})

	t.Run("permanent delete", func(t *testing.T) {
		post := votedPoll(t, th.BasicChannel.Id, "")

		appErr := th.App.PermanentDeletePost(th.Context, post.Id, th.BasicUser.Id)
		require.Nil(t, appErr)
		assert.False(t, hasPollVotes(t, th, post.Id))
	})

	t.Run("channel permanent delete", func(t *testing.T) {
		channel := th.CreateChannel(t, th.BasicTeam)
		post := votedPoll(t, channel.Id, "")

		appErr := th.App.PermanentDeleteChannel(th.Context, channel)
		require.Nil(t, appErr)
		assert.False(t, hasPollVotes(t, th, post.Id))
	})

	t.Run("data retention", func(t *testing.T) {
		post := newPollPost(th.BasicChannel.Id, th.BasicUser.Id)
		post.CreateAt = 1
		created, _, appErr := th.App.CreatePostAsUser(th.Context, post, "", true)
		require.Nil(t, appErr)
		poll, err := model.PollFromPost(created)
		require.NoError(t, err)
		_, appErr = th.App.VotePoll(th.Context, created.Id, th.BasicUser.Id, poll.Options[0].ID)
		require.Nil(t, appErr)

		_, _, err = th.App.Srv().Store().Post().PermanentDeleteBatchForRetentionPolicies(model.RetentionPolicyBatchConfigs{
			GlobalPolicyEndTime: 2,
			Limit:               1000,
		}, model.RetentionPolicyCursor{})
		require.NoError(t, err)
		assert.False(t, hasPollVotes(t, th, created.Id))
	})
}
