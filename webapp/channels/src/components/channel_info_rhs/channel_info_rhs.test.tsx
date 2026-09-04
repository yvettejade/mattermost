// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Channel, ChannelStats} from '@mattermost/types/channels';
import type {Team} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';

import {act, renderWithContext} from 'tests/react_testing_utils';
import {ModalIdentifiers} from 'utils/constants';

import ChannelInfoRHS from './channel_info_rhs';

const mockAboutArea = jest.fn();
jest.mock('./about_area', () => (props: any) => {
    mockAboutArea(props);
    return <div>{'test-about-area'}</div>;
});

const mockMenu = jest.fn();
jest.mock('./menu', () => (props: any) => {
    mockMenu(props);
    return <div>{'test-menu'}</div>;
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
            showChannelBookmarks: jest.fn(),
            showChannelScheduledPosts: jest.fn(),
            getChannelStats: jest.fn().mockImplementation(() => Promise.resolve({data: {}})),
        },
    };
    let props = {...OriginalProps};

    beforeEach(() => {
        props = {...OriginalProps};
        mockAboutArea.mockClear();
        mockMenu.mockClear();
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

    test('passes bookmark and scheduled post actions to the menu', async () => {
        renderWithContext(
            <ChannelInfoRHS
                {...props}
            />,
        );

        await act(async () => {
            props.actions.getChannelStats();
        });

        expect(mockMenu).toHaveBeenCalledWith(
            expect.objectContaining({
                actions: expect.objectContaining({
                    showChannelBookmarks: props.actions.showChannelBookmarks,
                    showChannelScheduledPosts: props.actions.showChannelScheduledPosts,
                    showChannelMembers: props.actions.showChannelMembers,
                    showPinnedPosts: props.actions.showPinnedPosts,
                    showChannelFiles: props.actions.showChannelFiles,
                }),
            }),
        );
    });
});
