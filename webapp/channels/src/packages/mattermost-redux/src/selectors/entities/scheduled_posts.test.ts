// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ScheduledPost} from '@mattermost/types/schedule_post';
import type {GlobalState} from '@mattermost/types/store';
import type {DeepPartial} from '@mattermost/types/utilities';

import {makeGetScheduledPostsForChannel} from './scheduled_posts';

describe('makeGetScheduledPostsForChannel', () => {
    const getScheduledPostsForChannel = makeGetScheduledPostsForChannel();

    const channelPost = scheduledPost({
        id: 'channel_post',
        channel_id: 'channel_id',
        root_id: '',
        message: 'channel level',
        scheduled_at: 20,
    });
    const threadPost = scheduledPost({
        id: 'thread_post',
        channel_id: 'channel_id',
        root_id: 'root_id',
        message: 'thread reply',
        scheduled_at: 10,
    });
    const otherChannelPost = scheduledPost({
        id: 'other_post',
        channel_id: 'other_channel',
        root_id: '',
        message: 'other channel',
        scheduled_at: 15,
    });
    const otherThreadPost = scheduledPost({
        id: 'other_thread',
        channel_id: 'other_channel',
        root_id: 'other_root',
        message: 'other thread',
        scheduled_at: 5,
    });

    const state = {
        entities: {
            scheduledPosts: {
                byId: {
                    [channelPost.id]: channelPost,
                    [threadPost.id]: threadPost,
                    [otherChannelPost.id]: otherChannelPost,
                    [otherThreadPost.id]: otherThreadPost,
                },
                byTeamId: {},
                errorsByTeamId: {},
                byChannelOrThreadId: {
                    channel_id: [channelPost.id],
                    root_id: [threadPost.id],
                    other_channel: [otherChannelPost.id],
                    other_root: [otherThreadPost.id],
                },
            },
        },
    } as DeepPartial<GlobalState> as GlobalState;

    test('includes channel-level posts and thread replies for the channel', () => {
        const posts = getScheduledPostsForChannel(state, 'channel_id');

        expect(posts.map((post) => post.id)).toEqual(['thread_post', 'channel_post']);
    });

    test('excludes scheduled posts from other channels', () => {
        const posts = getScheduledPostsForChannel(state, 'channel_id');

        expect(posts.map((post) => post.message)).not.toContain('other channel');
        expect(posts.map((post) => post.message)).not.toContain('other thread');
    });

    test('returns an empty list when the channel has no scheduled posts', () => {
        expect(getScheduledPostsForChannel(state, 'missing_channel')).toEqual([]);
    });

    test('ignores already-sent posts that remain only in byId after index rebuild', () => {
        const staleSentPost = scheduledPost({
            id: 'stale_sent',
            channel_id: 'channel_id',
            root_id: '',
            message: 'already sent',
            scheduled_at: 5,
        });
        const staleThreadPost = scheduledPost({
            id: 'stale_thread',
            channel_id: 'channel_id',
            root_id: 'old_root',
            message: 'already sent thread',
            scheduled_at: 1,
        });

        const reconnectState = {
            entities: {
                scheduledPosts: {
                    byId: {
                        ...state.entities.scheduledPosts.byId,
                        [staleSentPost.id]: staleSentPost,
                        [staleThreadPost.id]: staleThreadPost,
                    },
                    byTeamId: {
                        team_id: [channelPost.id, threadPost.id],
                    },
                    errorsByTeamId: {},
                    byChannelOrThreadId: {
                        channel_id: [channelPost.id],
                        root_id: [threadPost.id],
                        other_channel: [otherChannelPost.id],
                        other_root: [otherThreadPost.id],
                    },
                },
            },
        } as DeepPartial<GlobalState> as GlobalState;

        const posts = getScheduledPostsForChannel(reconnectState, 'channel_id');

        expect(posts.map((post) => post.id)).toEqual(['thread_post', 'channel_post']);
        expect(posts.map((post) => post.message)).not.toContain('already sent');
        expect(posts.map((post) => post.message)).not.toContain('already sent thread');
    });
});

function scheduledPost(overrides: Partial<ScheduledPost> & Pick<ScheduledPost, 'id' | 'channel_id' | 'message' | 'scheduled_at'>): ScheduledPost {
    return {
        user_id: 'user_id',
        root_id: '',
        create_at: 1,
        update_at: 1,
        props: {},
        ...overrides,
    };
}
