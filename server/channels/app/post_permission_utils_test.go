// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/assert"
)

func TestUpdatePostChangesContent(t *testing.T) {
	oldPost := &model.Post{
		Message:      "hello",
		FileIds:      model.StringArray{"file-a"},
		HasReactions: false,
	}
	oldPost.SetProps(model.StringInterface{"k": "v"})

	t.Run("message change is content", func(t *testing.T) {
		received := oldPost.Clone()
		received.Message = "changed"
		assert.True(t, updatePostChangesContent(oldPost, received, nil))
	})

	t.Run("IsPinned-only is not content", func(t *testing.T) {
		received := oldPost.Clone()
		received.IsPinned = true
		assert.False(t, updatePostChangesContent(oldPost, received, nil))
	})

	t.Run("file change is content", func(t *testing.T) {
		received := oldPost.Clone()
		received.FileIds = model.StringArray{"file-b"}
		assert.True(t, updatePostChangesContent(oldPost, received, nil))
	})

	t.Run("props change is content", func(t *testing.T) {
		received := oldPost.Clone()
		received.SetProps(model.StringInterface{"k": "other"})
		assert.True(t, updatePostChangesContent(oldPost, received, nil))
	})

	t.Run("SafeUpdate ignores non-message fields", func(t *testing.T) {
		received := oldPost.Clone()
		received.FileIds = model.StringArray{"file-b"}
		received.IsPinned = true
		assert.False(t, updatePostChangesContent(oldPost, received, &model.UpdatePostOptions{SafeUpdate: true}))
	})
}

func TestPostCardTypeCheckWithApp(t *testing.T) {
	mainHelper.Parallel(t)

	t.Run("returns error for card post when IntegratedBoards is disabled", func(t *testing.T) {
		th := SetupConfig(t, func(cfg *model.Config) {
			cfg.FeatureFlags.IntegratedBoards = false
		})

		appErr := PostCardTypeCheckWithApp("test", th.App, model.PostTypeCard)
		assert.NotNil(t, appErr)
		assert.Equal(t, "api.post.create_post.card_type_disabled.app_error", appErr.Id)
	})

	t.Run("returns nil for card post when IntegratedBoards is enabled", func(t *testing.T) {
		th := SetupConfig(t, func(cfg *model.Config) {
			cfg.FeatureFlags.IntegratedBoards = true
		})

		appErr := PostCardTypeCheckWithApp("test", th.App, model.PostTypeCard)
		assert.Nil(t, appErr)
	})

	t.Run("returns nil for non-card post when IntegratedBoards is disabled", func(t *testing.T) {
		th := SetupConfig(t, func(cfg *model.Config) {
			cfg.FeatureFlags.IntegratedBoards = false
		})

		appErr := PostCardTypeCheckWithApp("test", th.App, "")
		assert.Nil(t, appErr)
	})
}
