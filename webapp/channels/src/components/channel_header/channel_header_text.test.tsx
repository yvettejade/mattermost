// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import EditChannelHeaderModal from 'components/edit_channel_header_modal';

import {ModalIdentifiers} from 'utils/constants';

import ChannelHeaderText from './channel_header_text';

describe('ChannelHeaderText', () => {
    const defaultTeamId = TestHelper.getTeamMock().id;

    test('should render channel header text when header exists for a channel', () => {
        const channel = TestHelper.getChannelMock({header: 'Test Header'});
        renderWithContext(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={channel}
            />,
        );

        expect(screen.getByText('Test Header')).toBeInTheDocument();
    });

    test('should render channel header of bot description for bot DM channels', () => {
        const channel = TestHelper.getChannelMock({type: 'D'});
        const botDm = TestHelper.getUserMock({is_bot: true, bot_description: 'Tranquility'});

        renderWithContext(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={channel}
                dmUser={botDm}
            />,
        );

        expect(screen.getByText('Tranquility')).toBeInTheDocument();
    });

    test('should return null if the channel has no header and is archived', () => {
        const channel = TestHelper.getChannelMock({delete_at: 1, header: ''});

        const {container} = renderWithContext(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={channel}
            />,
        );

        expect(container.childNodes.length).toBe(0);
    });

    test('should return null if its a bot DM channels and its description is empty', () => {
        const channel = TestHelper.getChannelMock({type: 'D'});
        const botDm = TestHelper.getUserMock({is_bot: true, bot_description: ''});

        const {container} = renderWithContext(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={channel}
                dmUser={botDm}
            />,
        );

        expect(container.childNodes.length).toBe(0);
    });

    function getStateWithChannelPermission(channelId: string, permission?: string) {
        return {
            entities: {
                channels: {
                    myMembers: {
                        [channelId]: {channel_id: channelId, roles: 'channel_role'},
                    },
                    roles: {
                        [channelId]: new Set(['channel_role']),
                    },
                },
                teams: {
                    myMembers: {
                        [defaultTeamId]: {team_id: defaultTeamId, roles: 'team_role'},
                    },
                },
                users: {
                    currentUserId: 'user_id',
                    profiles: {
                        user_id: {
                            id: 'user_id',
                            roles: 'system_role',
                        },
                    },
                },
                roles: {
                    roles: {
                        system_role: {permissions: ['test_system_permission']},
                        team_role: {permissions: ['test_team_permission']},
                        channel_role: {permissions: permission ? [permission] : []},
                    },
                },
            },
        };
    }

    test('should render add channel header button for DM channels without header', () => {
        const channel = TestHelper.getChannelMock({type: 'D', header: ''});

        renderWithContext(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={channel}
            />,
        );

        expect(screen.getByRole('button', {name: 'Add a channel header'})).toBeInTheDocument();
    });

    test('should render add channel header button for GM channels without header', () => {
        const channel = TestHelper.getChannelMock({type: 'G', header: ''});

        renderWithContext(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={channel}
            />,
        );

        expect(screen.getByRole('button', {name: 'Add a channel header'})).toBeInTheDocument();
    });

    test('should render add channel header button for public channels without header with manage permission', () => {
        const channel = TestHelper.getChannelMock({
            type: 'O',
            header: '',
            team_id: defaultTeamId,
        });

        renderWithContext(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={channel}
            />,
            getStateWithChannelPermission(channel.id, 'manage_public_channel_properties'),
        );

        expect(screen.getByRole('button', {name: 'Add a channel header'})).toBeInTheDocument();
    });

    test('should return null for public channels without header without manage permission', () => {
        const channel = TestHelper.getChannelMock({
            type: 'O',
            header: '',
            team_id: defaultTeamId,
        });

        const {container} = renderWithContext(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={channel}
            />,
            getStateWithChannelPermission(channel.id),
        );

        expect(container.childNodes.length).toBe(0);
    });

    test('should render add channel header button for private channels without header with manage permission', () => {
        const channel = TestHelper.getChannelMock({
            type: 'P',
            header: '',
            team_id: defaultTeamId,
        });

        renderWithContext(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={channel}
            />,
            getStateWithChannelPermission(channel.id, 'manage_private_channel_properties'),
        );

        expect(screen.getByRole('button', {name: 'Add a channel header'})).toBeInTheDocument();
    });

    test('should open edit channel header modal when clicking add channel header button', async () => {
        const channel = TestHelper.getChannelMock({type: 'D', header: ''});
        const {store} = renderWithContext(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={channel}
            />,
            {},
            {useMockedStore: true},
        );

        await userEvent.click(screen.getByRole('button', {name: 'Add a channel header'}));

        expect((store as unknown as {getActions: () => unknown[]}).getActions()).toContainEqual(expect.objectContaining({
            modalId: ModalIdentifiers.EDIT_CHANNEL_HEADER,
            dialogType: EditChannelHeaderModal,
            dialogProps: {channel},
        }));
    });
});
