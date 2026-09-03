// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSessionCanUpdatePost(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	th.AddUserToChannel(t, th.BasicUser2, th.BasicChannel)

	ownerSession := model.Session{UserId: th.BasicUser.Id, Roles: th.BasicUser.GetRawRoles()}
	otherSession := model.Session{UserId: th.BasicUser2.Id, Roles: th.BasicUser2.GetRawRoles()}
	adminSession := model.Session{UserId: th.SystemAdminUser.Id, Roles: th.SystemAdminUser.GetRawRoles()}
	post := th.BasicPost

	t.Run("owner with edit_post", func(t *testing.T) {
		ok, _, perm := th.App.SessionCanUpdatePost(th.Context, ownerSession, post)
		require.True(t, ok)
		require.Equal(t, model.PermissionEditPost, perm)
	})

	t.Run("channel_user cannot edit others", func(t *testing.T) {
		ok, _, perm := th.App.SessionCanUpdatePost(th.Context, otherSession, post)
		require.False(t, ok)
		require.Equal(t, model.PermissionEditOthersPosts, perm)
	})

	t.Run("system admin can edit others via manage_system", func(t *testing.T) {
		ok, _, _ := th.App.SessionCanUpdatePost(th.Context, adminSession, post)
		require.True(t, ok)
	})

	t.Run("edit_others_posts allows non-owner", func(t *testing.T) {
		th.AddPermissionToRole(t, model.PermissionEditOthersPosts.Id, model.ChannelUserRoleId)
		defer th.RemovePermissionFromRole(t, model.PermissionEditOthersPosts.Id, model.ChannelUserRoleId)

		ok, _, perm := th.App.SessionCanUpdatePost(th.Context, otherSession, post)
		require.True(t, ok)
		require.Equal(t, model.PermissionEditOthersPosts, perm)
	})

	t.Run("card with IntegratedBoards allows non-owner with edit_post", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.IntegratedBoards = true
		})
		t.Cleanup(func() {
			th.App.UpdateConfig(func(cfg *model.Config) {
				cfg.FeatureFlags.IntegratedBoards = false
			})
		})

		card := post.Clone()
		card.Type = model.PostTypeCard
		ok, _, perm := th.App.SessionCanUpdatePost(th.Context, otherSession, card)
		require.True(t, ok)
		require.Equal(t, model.PermissionEditPost, perm)
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
