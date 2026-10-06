// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {Permissions} from 'mattermost-redux/constants';

import * as modalActions from 'actions/views/modals';

import EditChannelHeaderModal from 'components/edit_channel_header_modal';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import {ModalIdentifiers} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import ChannelHeaderText from './channel_header_text';

describe('ChannelHeaderText', () => {
    const defaultTeamId = TestHelper.getTeamMock().id;

    const getStateWithChannelPermissions = (channelId: string, permissions: string[]) => ({
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
                    system_role: {permissions: []},
                    team_role: {permissions: []},
                    channel_role: {permissions},
                },
            },
        },
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

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

    test('should show add header button for DM channels without header', () => {
        const channel = TestHelper.getChannelMock({type: 'D', header: ''});

        renderWithContext(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={channel}
            />,
        );

        expect(screen.getByRole('button', {name: 'Add a channel header'})).toBeInTheDocument();
    });

    test('should show add header button for GM channels without header', () => {
        const channel = TestHelper.getChannelMock({type: 'G', header: ''});

        renderWithContext(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={channel}
            />,
        );

        expect(screen.getByRole('button', {name: 'Add a channel header'})).toBeInTheDocument();
    });

    test('should return null for public channels without header when user lacks permissions', () => {
        const channel = TestHelper.getChannelMock({
            type: 'O',
            header: '',
        });

        const {container} = renderWithContext(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={channel}
            />,
            getStateWithChannelPermissions(channel.id, []),
        );

        expect(screen.queryByRole('button', {name: 'Add a channel header'})).not.toBeInTheDocument();
        expect(container.childNodes.length).toBe(0);
    });

    test('should show add header button for public channels without header when user has permissions', () => {
        const channel = TestHelper.getChannelMock({
            type: 'O',
            header: '',
        });

        renderWithContext(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={channel}
            />,
            getStateWithChannelPermissions(channel.id, [Permissions.MANAGE_PUBLIC_CHANNEL_PROPERTIES]),
        );

        expect(screen.getByRole('button', {name: 'Add a channel header'})).toBeInTheDocument();
    });

    test('should show add header button for private channels without header when user has permissions', () => {
        const channel = TestHelper.getChannelMock({
            type: 'P',
            header: '',
        });

        renderWithContext(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={channel}
            />,
            getStateWithChannelPermissions(channel.id, [Permissions.MANAGE_PRIVATE_CHANNEL_PROPERTIES]),
        );

        expect(screen.getByRole('button', {name: 'Add a channel header'})).toBeInTheDocument();
    });

    test('should return null for private channels without header when user lacks permissions', () => {
        const channel = TestHelper.getChannelMock({
            type: 'P',
            header: '',
        });

        const {container} = renderWithContext(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={channel}
            />,
            getStateWithChannelPermissions(channel.id, []),
        );

        expect(screen.queryByRole('button', {name: 'Add a channel header'})).not.toBeInTheDocument();
        expect(container.childNodes.length).toBe(0);
    });

    test('should open edit channel header modal when add header button is clicked', async () => {
        const channel = TestHelper.getChannelMock({type: 'G', header: ''});
        const openModal = jest.spyOn(modalActions, 'openModal');

        renderWithContext(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={channel}
            />,
        );

        await userEvent.click(screen.getByRole('button', {name: 'Add a channel header'}));

        expect(openModal).toHaveBeenCalledWith({
            modalId: ModalIdentifiers.EDIT_CHANNEL_HEADER,
            dialogType: EditChannelHeaderModal,
            dialogProps: {channel},
        });
    });
});
