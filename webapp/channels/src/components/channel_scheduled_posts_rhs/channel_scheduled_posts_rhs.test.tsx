// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Channel} from '@mattermost/types/channels';
import type {ScheduledPost} from '@mattermost/types/schedule_post';
import type {UserProfile} from '@mattermost/types/users';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import ChannelScheduledPostsRhs from './channel_scheduled_posts_rhs';

jest.mock('components/drafts/scheduled_post_list', () => (props: {scheduledPosts: ScheduledPost[]; hideErrorBanner?: boolean}) => (
    <div data-testid='scheduled-post-list'>
        {`hideErrorBanner:${Boolean(props.hideErrorBanner)}`}
        {props.scheduledPosts.length === 0 ? 'empty-scheduled-list' : props.scheduledPosts.map((post) => (
            <div key={post.id}>{post.message}</div>
        ))}
    </div>
));

describe('channel_scheduled_posts_rhs', () => {
    const channel = TestHelper.getChannelMock({
        id: 'channel_id',
        display_name: 'Town Square',
    });
    const otherChannelPost = scheduledPost('other_channel', 'other message');
    const currentChannelPosts = [
        scheduledPost('channel_id', 'later today'),
        scheduledPost('channel_id', 'tomorrow morning'),
    ];

    const baseProps = {
        channel: channel as Channel,
        canGoBack: true,
        scheduledPosts: [] as ScheduledPost[],
        currentUser: {id: 'user_id'} as UserProfile,
        userDisplayName: 'User',
        userStatus: 'online',
        actions: {
            closeRightHandSide: jest.fn(),
            goBack: jest.fn(),
        },
    };

    beforeEach(() => {
        baseProps.actions = {
            closeRightHandSide: jest.fn(),
            goBack: jest.fn(),
        };
    });

    test('shows the empty scheduled list for the current channel', () => {
        renderWithContext(
            <ChannelScheduledPostsRhs
                {...baseProps}
            />,
        );

        expect(screen.getByText('Scheduled posts')).toBeInTheDocument();
        expect(screen.getByTestId('scheduled-post-list')).toHaveTextContent('empty-scheduled-list');
    });

    test('lists only the current channel scheduled posts when populated', () => {
        renderWithContext(
            <ChannelScheduledPostsRhs
                {...baseProps}
                scheduledPosts={currentChannelPosts}
            />,
        );

        expect(screen.getByText('later today')).toBeInTheDocument();
        expect(screen.getByText('tomorrow morning')).toBeInTheDocument();
        expect(screen.queryByText(otherChannelPost.message)).not.toBeInTheDocument();
        expect(screen.queryByText('empty-scheduled-list')).not.toBeInTheDocument();
        expect(screen.getByTestId('scheduled-post-list')).toHaveTextContent('hideErrorBanner:true');
    });

    test('hides the team-wide failed scheduled posts banner', () => {
        renderWithContext(
            <ChannelScheduledPostsRhs
                {...baseProps}
                scheduledPosts={currentChannelPosts}
            />,
        );

        expect(screen.getByTestId('scheduled-post-list')).toHaveTextContent('hideErrorBanner:true');
        expect(screen.queryByText('One of your scheduled drafts cannot be sent.')).not.toBeInTheDocument();
    });

    test('calls goBack when the back button is clicked', async () => {
        renderWithContext(
            <ChannelScheduledPostsRhs
                {...baseProps}
            />,
        );

        await userEvent.click(screen.getByLabelText('Back Icon'));
        expect(baseProps.actions.goBack).toHaveBeenCalled();
    });
});

function scheduledPost(channelId: string, message: string): ScheduledPost {
    return {
        id: `sp_${channelId}_${message}`,
        channel_id: channelId,
        user_id: 'user_id',
        root_id: '',
        message,
        scheduled_at: 1,
        create_at: 1,
        update_at: 1,
        props: {},
    };
}
