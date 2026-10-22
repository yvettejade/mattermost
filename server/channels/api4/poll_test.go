// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

func newPollPostForChannel(channelID string, options ...string) *model.Post {
	post := &model.Post{
		ChannelId: channelID,
		Message:   "Poll: Lunch?",
		Type:      model.PostTypePoll,
	}
	poll := model.Poll{Question: "Lunch?"}
	for _, text := range options {
		poll.Options = append(poll.Options, model.PollOption{ID: "client", Text: text})
	}
	post.AddProp(model.PostPropsPoll, poll)
	return post
}

// createPollPostWithClient returns the created post and its server-assigned option IDs.
func createPollPostWithClient(t *testing.T, client *model.Client4, channelID string) (*model.Post, string, string) {
	t.Helper()

	created, _, err := client.CreatePost(context.Background(), newPollPostForChannel(channelID, "Tacos", "Pizza"))
	require.NoError(t, err)
	require.Equal(t, model.PostTypePoll, created.Type)

	poll, err := model.PollFromPost(created)
	require.NoError(t, err)
	return created, poll.Options[0].ID, poll.Options[1].ID
}

func TestPollVoting(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("vote and change vote over the API", func(t *testing.T) {
		post, a, b := createPollPostWithClient(t, th.Client, th.BasicChannel.Id)

		results, _, err := th.Client.GetPollResults(context.Background(), post.Id)
		require.NoError(t, err)
		assert.Equal(t, 0, results.TotalVotes)

		results, _, err = th.Client.VotePoll(context.Background(), post.Id, a)
		require.NoError(t, err)
		assert.Equal(t, []string{th.BasicUser.Id}, results.Votes[a])

		results, _, err = th.Client.VotePoll(context.Background(), post.Id, b)
		require.NoError(t, err)
		assert.Empty(t, results.Votes[a])
		assert.Equal(t, []string{th.BasicUser.Id}, results.Votes[b])

		results, _, err = th.Client.RetractPollVote(context.Background(), post.Id)
		require.NoError(t, err)
		assert.Equal(t, 0, results.TotalVotes)
	})

	t.Run("broadcasts poll_updated to channel members", func(t *testing.T) {
		post, a, _ := createPollPostWithClient(t, th.Client, th.BasicChannel.Id)

		client2 := th.CreateClient()
		th.LoginBasic2WithClient(t, client2)
		wsClient := th.CreateConnectedWebSocketClientWithClient(t, client2)

		_, _, err := th.Client.VotePoll(context.Background(), post.Id, a)
		require.NoError(t, err)

		timeout := time.After(5 * time.Second)
		for {
			select {
			case ev := <-wsClient.EventChannel:
				if ev.EventType() != model.WebsocketEventPollUpdated {
					continue
				}
				var results model.PollResults
				require.NoError(t, json.Unmarshal([]byte(ev.GetData()["results"].(string)), &results))
				if results.PostID != post.Id {
					continue
				}
				assert.Equal(t, th.BasicChannel.Id, ev.GetBroadcast().ChannelId)
				assert.Equal(t, []string{th.BasicUser.Id}, results.Votes[a])
				return
			case <-timeout:
				require.Fail(t, "did not receive poll_updated event")
			}
		}
	})

	t.Run("rejects invalid option", func(t *testing.T) {
		post, _, _ := createPollPostWithClient(t, th.Client, th.BasicChannel.Id)

		_, resp, err := th.Client.VotePoll(context.Background(), post.Id, "missing")
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("non-members of a private channel cannot read or vote", func(t *testing.T) {
		private := th.CreatePrivateChannel(t)
		post, a, _ := createPollPostWithClient(t, th.Client, private.Id)

		client2 := th.CreateClient()
		th.LoginBasic2WithClient(t, client2)

		_, resp, err := client2.GetPollResults(context.Background(), post.Id)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)

		_, resp, err = client2.VotePoll(context.Background(), post.Id, a)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})
}

func TestPollPostValidation(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("create rejects an invalid poll", func(t *testing.T) {
		_, resp, err := th.Client.CreatePost(context.Background(), newPollPostForChannel(th.BasicChannel.Id, "Only one"))
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("create rejects malformed options", func(t *testing.T) {
		post := newPollPostForChannel(th.BasicChannel.Id)
		post.AddProp(model.PostPropsPoll, map[string]any{"question": "Q", "options": []any{map[string]any{"text": 1}, "b"}})

		_, resp, err := th.Client.CreatePost(context.Background(), post)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("update rejects option changes", func(t *testing.T) {
		post, a, b := createPollPostWithClient(t, th.Client, th.BasicChannel.Id)

		post.AddProp(model.PostPropsPoll, model.Poll{Question: "Lunch?", Options: []model.PollOption{{ID: a, Text: "Tacos"}, {ID: b, Text: "Ramen"}}})
		_, resp, err := th.Client.UpdatePost(context.Background(), post.Id, post)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("update allows message edits", func(t *testing.T) {
		post, _, _ := createPollPostWithClient(t, th.Client, th.BasicChannel.Id)

		post.Message = "Poll: Lunch tomorrow?"
		_, _, err := th.Client.UpdatePost(context.Background(), post.Id, post)
		require.NoError(t, err)
	})

	t.Run("patch rejects replacing poll props", func(t *testing.T) {
		post, _, _ := createPollPostWithClient(t, th.Client, th.BasicChannel.Id)

		props := model.StringInterface{model.PostPropsPoll: map[string]any{"question": "Hijacked"}}
		_, resp, err := th.Client.PatchPost(context.Background(), post.Id, &model.PostPatch{Props: &props})
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("patch allows message edits", func(t *testing.T) {
		post, _, _ := createPollPostWithClient(t, th.Client, th.BasicChannel.Id)

		_, _, err := th.Client.PatchPost(context.Background(), post.Id, &model.PostPatch{Message: model.NewPointer("Poll: Dinner?")})
		require.NoError(t, err)
	})
}
