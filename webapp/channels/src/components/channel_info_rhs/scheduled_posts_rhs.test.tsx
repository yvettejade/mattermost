// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Channel} from '@mattermost/types/channels';
import type {ScheduledPost} from '@mattermost/types/schedule_post';
import type {UserProfile} from '@mattermost/types/users';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import type {GlobalState} from 'types/store';

import {getScheduledPostsForChannel, ScheduledPostsRhsView} from './scheduled_posts_rhs';

jest.mock('components/drafts/scheduled_post_list', () => ({
    __esModule: true,
    default: ({scheduledPosts}: {scheduledPosts: ScheduledPost[]}) => (
        scheduledPosts.length === 0 ? (
            <div>{'No scheduled drafts at the moment'}</div>
        ) : (
            <ul>
                {scheduledPosts.map((post) => (
                    <li
                        key={post.id}
                        data-testid={`scheduled-post-${post.id}`}
                    >
                        {post.message}
                    </li>
                ))}
            </ul>
        )
    ),
}));

function makeScheduledPost(overrides: Partial<ScheduledPost> = {}): ScheduledPost {
    return {
        id: 'sp1',
        channel_id: 'channel-id',
        scheduled_at: 100,
        create_at: 50,
        update_at: 50,
        user_id: 'user-id',
        root_id: '',
        message: 'Later message',
        props: {},
        metadata: {},
        ...overrides,
    } as ScheduledPost;
}

describe('channel_info_rhs/scheduled_posts_rhs', () => {
    const channel = {
        id: 'channel-id',
        display_name: 'Town Square',
        type: 'O',
    } as Channel;
    const currentUser = TestHelper.getUserMock({id: 'user-id'});
    const goBack = jest.fn();
    const onClose = jest.fn();

    beforeEach(() => {
        goBack.mockClear();
        onClose.mockClear();
    });

    test('shows empty state when the channel has no scheduled posts', () => {
        renderWithContext(
            <ScheduledPostsRhsView
                channel={channel}
                scheduledPosts={[]}
                currentUser={currentUser as UserProfile}
                userDisplayName='User'
                userStatus='online'
                canGoBack={true}
                onClose={onClose}
                goBack={goBack}
            />,
        );

        expect(screen.getByText('No scheduled drafts at the moment')).toBeInTheDocument();
    });

    test('renders only the posts passed for the current channel', () => {
        renderWithContext(
            <ScheduledPostsRhsView
                channel={channel}
                scheduledPosts={[
                    makeScheduledPost({id: 'sp-current', message: 'This channel'}),
                ]}
                currentUser={currentUser as UserProfile}
                userDisplayName='User'
                userStatus='online'
                canGoBack={true}
                onClose={onClose}
                goBack={goBack}
            />,
        );

        expect(screen.getByTestId('scheduled-post-sp-current')).toHaveTextContent('This channel');
        expect(screen.queryByText('Other channel')).not.toBeInTheDocument();
    });

    test('getScheduledPostsForChannel returns only current-channel posts', () => {
        const state = {
            entities: {
                scheduledPosts: {
                    byId: {
                        'sp-current': makeScheduledPost({id: 'sp-current', channel_id: 'channel-id', message: 'This channel', scheduled_at: 200}),
                        'sp-other': makeScheduledPost({id: 'sp-other', channel_id: 'other-channel', message: 'Other channel', scheduled_at: 100}),
                    },
                    byChannelOrThreadId: {
                        'channel-id': ['sp-current'],
                        'other-channel': ['sp-other'],
                    },
                    byTeamId: {},
                    errorsByTeamId: {},
                },
            },
        } as unknown as GlobalState;

        expect(getScheduledPostsForChannel(state, 'channel-id').map((post) => post.id)).toEqual(['sp-current']);
    });

    test('getScheduledPostsForChannel includes thread replies and failed posts', () => {
        const state = {
            entities: {
                scheduledPosts: {
                    byId: {
                        'sp-channel': makeScheduledPost({id: 'sp-channel', channel_id: 'channel-id', scheduled_at: 200}),
                        'sp-thread': makeScheduledPost({id: 'sp-thread', channel_id: 'channel-id', root_id: 'root-post', scheduled_at: 100}),
                        'sp-failed': makeScheduledPost({id: 'sp-failed', channel_id: 'channel-id', error_code: 'unable_to_send', scheduled_at: 150}),
                        'sp-other': makeScheduledPost({id: 'sp-other', channel_id: 'other-channel', scheduled_at: 50}),
                    },
                    byChannelOrThreadId: {
                        'channel-id': ['sp-channel', 'sp-failed'],
                        'root-post': ['sp-thread'],
                        'other-channel': ['sp-other'],
                    },
                    byTeamId: {},
                    errorsByTeamId: {},
                },
            },
        } as unknown as GlobalState;

        expect(getScheduledPostsForChannel(state, 'channel-id').map((post) => post.id)).toEqual(['sp-thread', 'sp-failed', 'sp-channel']);
    });

    test('getScheduledPostsForChannel returns a stable reference when inputs are unchanged', () => {
        const state = {
            entities: {
                scheduledPosts: {
                    byId: {
                        'sp-current': makeScheduledPost({id: 'sp-current', channel_id: 'channel-id'}),
                    },
                    byChannelOrThreadId: {
                        'channel-id': ['sp-current'],
                    },
                    byTeamId: {},
                    errorsByTeamId: {},
                },
            },
        } as unknown as GlobalState;

        expect(getScheduledPostsForChannel(state, 'channel-id')).toBe(getScheduledPostsForChannel(state, 'channel-id'));
    });

    test('Back calls goBack', async () => {
        renderWithContext(
            <ScheduledPostsRhsView
                channel={channel}
                scheduledPosts={[]}
                currentUser={currentUser as UserProfile}
                userDisplayName='User'
                userStatus='online'
                canGoBack={true}
                onClose={onClose}
                goBack={goBack}
            />,
        );

        await userEvent.click(screen.getByLabelText('Back Icon'));
        expect(goBack).toHaveBeenCalled();
    });
});
