// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {ScheduledPost} from '@mattermost/types/schedule_post';

import {renderWithContext, screen} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import ChannelScheduledPostsRhsContainer from './index';

jest.mock('./channel_scheduled_posts_rhs', () => (props: {scheduledPosts: ScheduledPost[]}) => (
    <div data-testid='scheduled-rhs'>
        {props.scheduledPosts.map((post) => (
            <div key={post.id}>{post.message}</div>
        ))}
    </div>
));

describe('channel_scheduled_posts_rhs/index', () => {
    const channel = TestHelper.getChannelMock({id: 'channel_id', display_name: 'Town Square'});
    const currentUser = TestHelper.getUserMock({id: 'user_id'});

    test('passes only the current channel scheduled posts, including thread replies', () => {
        renderWithContext(
            <ChannelScheduledPostsRhsContainer/>,
            {
                entities: {
                    users: {
                        currentUserId: currentUser.id,
                        profiles: {
                            [currentUser.id]: currentUser,
                        },
                    },
                    channels: {
                        currentChannelId: channel.id,
                        channels: {
                            [channel.id]: channel,
                        },
                    },
                    scheduledPosts: {
                        byId: {
                            current: scheduledPost('current', 'channel_id', 'this channel'),
                            thread: scheduledPost('thread', 'channel_id', 'thread reply', 'root_id'),
                            other: scheduledPost('other', 'other_channel', 'other channel'),
                            otherThread: scheduledPost('other_thread', 'other_channel', 'other thread', 'other_root'),
                        },
                        byTeamId: {},
                        errorsByTeamId: {},
                        byChannelOrThreadId: {
                            channel_id: ['current'],
                            root_id: ['thread'],
                            other_channel: ['other'],
                            other_root: ['other_thread'],
                        },
                    },
                },
            },
        );

        expect(screen.getByText('this channel')).toBeInTheDocument();
        expect(screen.getByText('thread reply')).toBeInTheDocument();
        expect(screen.queryByText('other channel')).not.toBeInTheDocument();
        expect(screen.queryByText('other thread')).not.toBeInTheDocument();
    });
});

function scheduledPost(id: string, channelId: string, message: string, rootId = ''): ScheduledPost {
    return {
        id,
        channel_id: channelId,
        user_id: 'user_id',
        root_id: rootId,
        message,
        scheduled_at: 1,
        create_at: 1,
        update_at: 1,
        props: {},
    };
}
