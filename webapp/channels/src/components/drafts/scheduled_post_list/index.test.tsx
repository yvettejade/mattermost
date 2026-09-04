// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {ScheduledPost} from '@mattermost/types/schedule_post';
import type {UserProfile} from '@mattermost/types/users';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import ScheduledPostList from './index';

jest.mock('./non_virtualized_scheduled_post_list', () => () => (
    <div>{'non-virtualized-list'}</div>
));

jest.mock('./empty_scheduled_post_list', () => () => (
    <div>{'empty-scheduled-list'}</div>
));

describe('ScheduledPostList', () => {
    const scheduledPosts = [{
        id: 'sp1',
        channel_id: 'channel_id',
        user_id: 'user_id',
        root_id: '',
        message: 'later',
        scheduled_at: 1,
        create_at: 1,
        update_at: 1,
        props: {},
    }] as ScheduledPost[];

    const baseProps = {
        scheduledPosts,
        currentUser: {id: 'user_id'} as UserProfile,
        userDisplayName: 'User',
        userStatus: 'online',
    };

    const stateWithTeamError = {
        entities: {
            teams: {
                currentTeamId: 'team_id',
            },
            scheduledPosts: {
                byId: {},
                byTeamId: {},
                errorsByTeamId: {
                    team_id: ['failed_post'],
                },
                byChannelOrThreadId: {},
            },
        },
    };

    test('shows the team-wide error banner by default', () => {
        renderWithContext(
            <ScheduledPostList
                {...baseProps}
            />,
            stateWithTeamError,
        );

        expect(screen.getByText('One of your scheduled drafts cannot be sent.')).toBeInTheDocument();
    });

    test('hides the team-wide error banner when hideErrorBanner is set', () => {
        renderWithContext(
            <ScheduledPostList
                {...baseProps}
                hideErrorBanner={true}
            />,
            stateWithTeamError,
        );

        expect(screen.queryByText('One of your scheduled drafts cannot be sent.')).not.toBeInTheDocument();
        expect(screen.getByText('non-virtualized-list')).toBeInTheDocument();
    });
});
