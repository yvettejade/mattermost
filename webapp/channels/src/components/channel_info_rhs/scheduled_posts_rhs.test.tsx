// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Channel} from '@mattermost/types/channels';
import type {ScheduledPost} from '@mattermost/types/schedule_post';
import type {UserProfile} from '@mattermost/types/users';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import {RHSStates} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import ChannelScheduledPostsRhsContainer, {ChannelScheduledPostsRhs} from './scheduled_posts_rhs';

jest.mock('components/drafts/draft_row', () => ({
    __esModule: true,
    default: ({item}: {item: ScheduledPost}) => (
        <div data-testid={`scheduled-post-${item.id}`}>{item.message}</div>
    ),
}));

describe('channel_info_rhs/scheduled_posts_rhs', () => {
    const channel = {
        id: 'channel_id',
        display_name: 'Town Square',
        type: 'O',
    } as Channel;

    const currentUser = TestHelper.getUserMock({id: 'user_id'}) as UserProfile;

    const currentChannelPost: ScheduledPost = {
        id: 'sp-current',
        scheduled_at: 2000,
        create_at: 1,
        update_at: 1,
        user_id: 'user_id',
        channel_id: 'channel_id',
        root_id: '',
        message: 'Current channel scheduled post',
        props: {},
    };

    const otherChannelPost: ScheduledPost = {
        id: 'sp-other',
        scheduled_at: 3000,
        create_at: 2,
        update_at: 2,
        user_id: 'user_id',
        channel_id: 'other_channel',
        root_id: '',
        message: 'Other channel scheduled post',
        props: {},
    };

    const defaultActions = {
        closeRightHandSide: jest.fn(),
        goBack: jest.fn(),
    };

    beforeEach(() => {
        defaultActions.closeRightHandSide.mockClear();
        defaultActions.goBack.mockClear();
    });

    test('shows the empty state when the channel has no scheduled posts', () => {
        renderWithContext(
            <ChannelScheduledPostsRhs
                channel={channel}
                canGoBack={true}
                scheduledPosts={[]}
                currentUser={currentUser}
                userDisplayName='User'
                userStatus='online'
                actions={defaultActions}
            />,
        );

        expect(screen.getByText('Scheduled posts')).toBeInTheDocument();
        expect(screen.getByText('No scheduled drafts at the moment')).toBeInTheDocument();
    });

    test('lists scheduled posts for the current channel only', () => {
        renderWithContext(
            <ChannelScheduledPostsRhsContainer/>,
            {
                entities: {
                    channels: {
                        currentChannelId: channel.id,
                        channels: {
                            [channel.id]: channel,
                        },
                    },
                    users: {
                        currentUserId: currentUser.id,
                        profiles: {
                            [currentUser.id]: currentUser,
                        },
                    },
                    scheduledPosts: {
                        byId: {
                            [currentChannelPost.id]: currentChannelPost,
                            [otherChannelPost.id]: otherChannelPost,
                        },
                        byChannelOrThreadId: {
                            [channel.id]: [currentChannelPost.id],
                            other_channel: [otherChannelPost.id],
                        },
                    },
                },
                views: {
                    rhs: {
                        previousRhsStates: [RHSStates.CHANNEL_INFO],
                    },
                },
            },
        );

        expect(screen.getByTestId('scheduled-post-sp-current')).toBeInTheDocument();
        expect(screen.getByText('Current channel scheduled post')).toBeInTheDocument();
        expect(screen.queryByText('Other channel scheduled post')).not.toBeInTheDocument();
        expect(screen.queryByTestId('scheduled-post-sp-other')).not.toBeInTheDocument();
    });

    test('calls goBack when Back is clicked', async () => {
        renderWithContext(
            <ChannelScheduledPostsRhs
                channel={channel}
                canGoBack={true}
                scheduledPosts={[]}
                currentUser={currentUser}
                userDisplayName='User'
                userStatus='online'
                actions={defaultActions}
            />,
        );

        await userEvent.click(screen.getByLabelText('Back Icon'));
        expect(defaultActions.goBack).toHaveBeenCalled();
    });
});
