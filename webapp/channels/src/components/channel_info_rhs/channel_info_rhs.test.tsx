// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Channel, ChannelStats} from '@mattermost/types/channels';
import type {Team} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';

import {act, renderWithContext, screen} from 'tests/react_testing_utils';
import {ModalIdentifiers} from 'utils/constants';

import ChannelInfoRHS from './channel_info_rhs';

const mockAboutArea = jest.fn();
jest.mock('./about_area', () => (props: any) => {
    mockAboutArea(props);
    return <div>{'test-about-area'}</div>;
});

describe('channel_info_rhs', () => {
    const OriginalProps = {
        channel: {display_name: 'my channel title', type: 'O'} as Channel,
        isArchived: false,
        channelStats: {} as ChannelStats,
        currentUser: {} as UserProfile,
        currentTeam: {} as Team,
        isFavorite: false,
        isMuted: false,
        isInvitingPeople: false,
        isMobile: false,
        isInManagedCategory: false,
        canManageMembers: true,
        canManageProperties: true,
        channelMembers: [],
        unreadCount: {messages: 7, mentions: 2, showUnread: true, hasUrgent: false},
        bookmarksCount: 4,
        isBookmarksEnabled: true,
        scheduledPostsCount: 3,
        isScheduledPostsEnabled: true,
        actions: {
            closeRightHandSide: jest.fn(),
            unfavoriteChannel: jest.fn(),
            favoriteChannel: jest.fn(),
            unmuteChannel: jest.fn(),
            muteChannel: jest.fn(),
            openModal: jest.fn(),
            showChannelFiles: jest.fn(),
            showPinnedPosts: jest.fn(),
            showChannelMembers: jest.fn(),
            getChannelStats: jest.fn().mockImplementation(() => Promise.resolve({data: {}})),
            fetchChannelBookmarks: jest.fn(),
        },
    };
    let props = {...OriginalProps};

    beforeEach(() => {
        props = {...OriginalProps};
        mockAboutArea.mockClear();
    });

    describe('about area', () => {
        test('should be editable', async () => {
            renderWithContext(
                <ChannelInfoRHS
                    {...props}
                />,
            );

            await act(async () => {
                props.actions.getChannelStats();
            });

            expect(mockAboutArea).toHaveBeenCalledWith(
                expect.objectContaining({
                    canEditChannelProperties: true,
                }),
            );
        });
        test('should not be editable in archived channel', async () => {
            props.isArchived = true;

            renderWithContext(
                <ChannelInfoRHS
                    {...props}
                />,
            );

            await act(async () => {
                props.actions.getChannelStats();
            });

            expect(mockAboutArea).toHaveBeenCalledWith(
                expect.objectContaining({
                    canEditChannelProperties: false,
                }),
            );
        });
    });

    test('editChannelName opens Rename Channel modal', () => {
        props.currentTeam = {name: 'team-1'} as Team;
        renderWithContext(
            <ChannelInfoRHS
                {...props}
            />,
        );

        // Invoke the handler passed into the mocked AboutArea
        const lastArgs = mockAboutArea.mock.calls[mockAboutArea.mock.calls.length - 1][0];
        lastArgs.actions.editChannelName();

        expect(props.actions.openModal).toHaveBeenCalledWith(
            expect.objectContaining({
                modalId: ModalIdentifiers.RENAME_CHANNEL,
                dialogProps: expect.objectContaining({
                    channel: props.channel,
                    teamName: 'team-1',
                }),
            }),
        );
    });

    describe('menu props', () => {
        test('should pass unread, bookmark and scheduled post data to the menu', async () => {
            props.currentTeam = {name: 'team-1'} as Team;
            props.channel = {id: 'channel1', display_name: 'my channel title', type: 'O'} as Channel;

            renderWithContext(
                <ChannelInfoRHS
                    {...props}
                />,
            );

            await act(async () => {
                props.actions.getChannelStats();
            });

            expect(screen.getByRole('group', {name: '7 unread messages, 2 mentions'})).toBeInTheDocument();
            expect(screen.getByRole('button', {name: 'Bookmarks'})).toHaveTextContent('4');
            expect(screen.getByRole('link', {name: 'Scheduled posts'})).toHaveAttribute('href', '/team-1/scheduled_posts');
            expect(props.actions.fetchChannelBookmarks).toHaveBeenCalledWith('channel1');
        });

        test('should hide the bookmarks and scheduled posts rows when disabled', async () => {
            props.currentTeam = {name: 'team-1'} as Team;
            props.isBookmarksEnabled = false;
            props.isScheduledPostsEnabled = false;

            renderWithContext(
                <ChannelInfoRHS
                    {...props}
                />,
            );

            await act(async () => {
                props.actions.getChannelStats();
            });

            expect(screen.queryByText('Bookmarks')).not.toBeInTheDocument();
            expect(screen.queryByText('Scheduled posts')).not.toBeInTheDocument();
        });
    });
});
