// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Channel} from '@mattermost/types/channels';
import type {ScheduledPost} from '@mattermost/types/schedule_post';
import type {UserProfile} from '@mattermost/types/users';
import type {DeepPartial} from '@mattermost/types/utilities';

import {
    renderWithContext,
    screen,
    userEvent,
} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import type {GlobalState} from 'types/store';

import {getChannelScheduledPosts, ScheduledPostsRhs} from './scheduled_posts_rhs';

jest.mock('components/drafts/scheduled_post_list', () => ({
    __esModule: true,
    default: ({scheduledPosts}: {scheduledPosts: ScheduledPost[]}) => (
        <div>
            {scheduledPosts.length === 0 ? 'No scheduled drafts at the moment' : scheduledPosts.map((post) => (
                <div key={post.id}>{post.message}</div>
            ))}
        </div>
    ),
}));

function makeScheduledPost(overrides: Partial<ScheduledPost> = {}): ScheduledPost {
    return {
        id: 'sp1',
        channel_id: 'channel-id',
        user_id: 'user-id',
        root_id: '',
        message: 'Later message',
        create_at: 1,
        update_at: 1,
        scheduled_at: 100,
        props: {},
        ...overrides,
    };
}

describe('scheduled_posts_rhs', () => {
    const channel = TestHelper.getChannelMock({
        id: 'channel-id',
        display_name: 'Town Square',
    }) as Channel;
    const currentUser = TestHelper.getUserMock({id: 'user-id'}) as UserProfile;

    const defaultProps = {
        channel,
        scheduledPosts: [] as ScheduledPost[],
        currentUser,
        userDisplayName: 'Cursor Admin',
        userStatus: 'online',
        canGoBack: true,
        onClose: jest.fn(),
        onBack: jest.fn(),
    };

    beforeEach(() => {
        defaultProps.onClose = jest.fn();
        defaultProps.onBack = jest.fn();
    });

    test('shows empty state when the channel has no scheduled posts', () => {
        renderWithContext(
            <ScheduledPostsRhs
                {...defaultProps}
            />,
        );

        expect(screen.getByText('No scheduled drafts at the moment')).toBeInTheDocument();
    });

    test('renders scheduled posts for the current channel', () => {
        renderWithContext(
            <ScheduledPostsRhs
                {...defaultProps}
                scheduledPosts={[makeScheduledPost()]}
            />,
        );

        expect(screen.getByText('Later message')).toBeInTheDocument();
    });

    test('Back calls goBack', async () => {
        renderWithContext(
            <ScheduledPostsRhs
                {...defaultProps}
            />,
        );

        await userEvent.click(screen.getByLabelText('Back Icon'));
        expect(defaultProps.onBack).toHaveBeenCalled();
    });

    test('filters scheduled posts to the current channel', () => {
        const currentChannelPost = makeScheduledPost({id: 'sp-current', message: 'Current channel'});
        const otherChannelPost = makeScheduledPost({
            id: 'sp-other',
            channel_id: 'other-channel',
            message: 'Other channel',
        });
        const state = {
            entities: {
                scheduledPosts: {
                    byId: {
                        [currentChannelPost.id]: currentChannelPost,
                        [otherChannelPost.id]: otherChannelPost,
                    },
                    byChannelOrThreadId: {
                        [channel.id]: [currentChannelPost.id, otherChannelPost.id],
                    },
                },
            },
        } as DeepPartial<GlobalState> as GlobalState;

        const posts = getChannelScheduledPosts(state, channel.id);

        expect(posts).toHaveLength(1);
        expect(posts[0].id).toBe('sp-current');
    });
});
