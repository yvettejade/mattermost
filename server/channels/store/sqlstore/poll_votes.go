// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	sq "github.com/mattermost/squirrel"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/model"
)

// deletePollVotesForPosts removes the poll vote KV rows for the given posts.
// It runs inside the caller's transaction so votes never outlive their post.
func deletePollVotesForPosts(transaction *sqlxTxWrapper, builder sq.StatementBuilderType, postIds []string) error {
	if len(postIds) == 0 {
		return nil
	}

	keys := make([]string, len(postIds))
	for i, id := range postIds {
		keys[i] = model.PollVotesKVKey(id)
	}

	query := builder.
		Delete("PluginKeyValueStore").
		Where(sq.Eq{"PluginId": model.PollKVNamespace}).
		Where(sq.Eq{"PKey": keys})
	if _, err := transaction.ExecBuilder(query); err != nil {
		return errors.Wrap(err, "failed to delete poll votes")
	}

	return nil
}

// deletePollVotesForThreads removes poll votes for the given posts and any
// poll replies in their threads.
func deletePollVotesForThreads(transaction *sqlxTxWrapper, builder sq.StatementBuilderType, postIds []string) error {
	if len(postIds) == 0 {
		return nil
	}

	pollIds := []string{}
	query := builder.
		Select("Id").
		From("Posts").
		Where(sq.Or{sq.Eq{"Id": postIds}, sq.Eq{"RootId": postIds}}).
		Where(sq.Eq{"Type": model.PostTypePoll})
	if err := transaction.SelectBuilder(&pollIds, query); err != nil {
		return errors.Wrap(err, "failed to find poll posts")
	}

	return deletePollVotesForPosts(transaction, builder, pollIds)
}
