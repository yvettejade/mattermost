// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ScheduledPost} from '@mattermost/types/schedule_post';
import type {GlobalState} from '@mattermost/types/store';
import type {DeepPartial} from '@mattermost/types/utilities';

import {makeGetScheduledPostsForChannel} from './scheduled_posts';

function makeScheduledPost(overrides: Partial<ScheduledPost>): ScheduledPost {
    return {
        id: 'sp',
        scheduled_at: 1000,
        create_at: 1,
        update_at: 1,
        user_id: 'user_id',
        channel_id: 'channel_id',
        root_id: '',
        message: 'scheduled',
        props: {},
        ...overrides,
    };
}

describe('makeGetScheduledPostsForChannel', () => {
    const getScheduledPostsForChannel = makeGetScheduledPostsForChannel();

    const channelPost = makeScheduledPost({id: 'sp-channel', message: 'channel post', scheduled_at: 3000});
    const threadReply = makeScheduledPost({
        id: 'sp-thread',
        message: 'thread reply',
        root_id: 'root_post_id',
        scheduled_at: 2000,
    });
    const errorPost = makeScheduledPost({
        id: 'sp-error',
        message: 'failed post',
        error_code: 'unable_to_send',
        scheduled_at: 1000,
    });
    const otherChannelPost = makeScheduledPost({
        id: 'sp-other',
        channel_id: 'other_channel',
        message: 'other channel',
        scheduled_at: 4000,
    });

    const state = {
        entities: {
            scheduledPosts: {
                byId: {
                    [channelPost.id]: channelPost,
                    [threadReply.id]: threadReply,
                    [errorPost.id]: errorPost,
                    [otherChannelPost.id]: otherChannelPost,
                },
                byChannelOrThreadId: {
                    channel_id: [channelPost.id, errorPost.id],
                    root_post_id: [threadReply.id],
                    other_channel: [otherChannelPost.id],
                },
            },
        },
    } as DeepPartial<GlobalState> as GlobalState;

    test('includes channel posts, thread replies keyed by root_id, and error_code posts', () => {
        const posts = getScheduledPostsForChannel(state, 'channel_id');

        expect(posts.map((post) => post.id)).toEqual(['sp-error', 'sp-thread', 'sp-channel']);
        expect(posts).toHaveLength(3);
        expect(posts.some((post) => post.root_id === 'root_post_id')).toBe(true);
        expect(posts.some((post) => post.error_code === 'unable_to_send')).toBe(true);
    });

    test('does not include scheduled posts from other channels', () => {
        const posts = getScheduledPostsForChannel(state, 'channel_id');

        expect(posts.find((post) => post.id === 'sp-other')).toBeUndefined();
        expect(getScheduledPostsForChannel(state, 'other_channel')).toHaveLength(1);
    });

    test('returns an empty list when the channel has no scheduled posts', () => {
        expect(getScheduledPostsForChannel(state, 'missing_channel')).toEqual([]);
    });
});
