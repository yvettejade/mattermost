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

    describe('menu rows', () => {
        test('passes the unread, bookmarks and scheduled posts data to the menu', async () => {
            props.currentTeam = {name: 'team-1'} as Team;
            props.channelStats = {member_count: 8, pinnedpost_count: 2, files_count: 0} as ChannelStats;
            const fetchChannelBookmarks = jest.fn();

            renderWithContext(
                <ChannelInfoRHS
                    {...props}
                    unreadCount={{messages: 6, mentions: 2}}
                    isBookmarksEnabled={true}
                    bookmarksCount={4}
                    isScheduledPostsEnabled={true}
                    scheduledPostsCount={3}
                    actions={{...props.actions, fetchChannelBookmarks}}
                />,
            );

            await act(async () => {
                props.actions.getChannelStats();
            });

            expect(screen.getByTestId('channelInfoRHSUnreadMessages')).toHaveTextContent('6');
            expect(screen.getByTestId('channelInfoRHSUnreadMentions')).toHaveTextContent('2');
            expect(screen.getByText('Members').parentElement).toHaveTextContent('8');
            expect(screen.getByText('Pinned messages').parentElement).toHaveTextContent('2');
            expect(screen.getByText('Bookmarks').parentElement).toHaveTextContent('4');
            expect(screen.getByText('Scheduled posts').parentElement).toHaveTextContent('3');
            expect(fetchChannelBookmarks).toHaveBeenCalled();
        });

        test('omits the bookmarks and scheduled posts rows when they are disabled', async () => {
            props.currentTeam = {name: 'team-1'} as Team;

            renderWithContext(
                <ChannelInfoRHS
                    {...props}
                    unreadCount={{messages: 0, mentions: 0}}
                    isBookmarksEnabled={false}
                    isScheduledPostsEnabled={false}
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
