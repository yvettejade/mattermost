// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {openModal} from 'actions/views/modals';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import {ModalIdentifiers} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import ChannelHeaderText from './channel_header_text';

jest.mock('actions/views/modals', () => ({
    openModal: jest.fn(() => ({type: 'MOCKED_OPEN_MODAL'})),
}));

function getStateWithChannelPermissions(channelId: string, teamId: string, permissions: string[]) {
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
                    [teamId]: {team_id: teamId, roles: 'team_role'},
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
    };
}

describe('ChannelHeaderText', () => {
    const defaultTeamId = TestHelper.getTeamMock().id;

    beforeEach(() => {
        (openModal as jest.Mock).mockClear();
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
        expect(screen.queryByRole('button', {name: 'Add a channel header'})).not.toBeInTheDocument();
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
        expect(screen.queryByRole('button', {name: 'Add a channel header'})).not.toBeInTheDocument();
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
        expect(screen.queryByRole('button', {name: 'Add a channel header'})).not.toBeInTheDocument();
    });

    test('should render archived header text as read-only when a header is set', () => {
        const channel = TestHelper.getChannelMock({delete_at: 1, header: 'Archived header'});

        renderWithContext(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={channel}
            />,
        );

        expect(screen.getByText('Archived header')).toBeInTheDocument();
        expect(screen.queryByRole('button', {name: 'Add a channel header'})).not.toBeInTheDocument();
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
        expect(screen.queryByRole('button', {name: 'Add a channel header'})).not.toBeInTheDocument();
    });

    test('should show add button for DM channels without header', () => {
        const channel = TestHelper.getChannelMock({type: 'D', header: ''});

        renderWithContext(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={channel}
            />,
        );

        expect(screen.getByRole('button', {name: 'Add a channel header'})).toBeInTheDocument();
    });

    test('should show add button for GM channels without header', () => {
        const channel = TestHelper.getChannelMock({type: 'G', header: ''});

        renderWithContext(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={channel}
            />,
        );

        expect(screen.getByRole('button', {name: 'Add a channel header'})).toBeInTheDocument();
    });

    test('should show add button for public channels when the user can manage public properties', () => {
        const channel = TestHelper.getChannelMock({
            type: 'O',
            header: '',
        });

        renderWithContext(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={channel}
            />,
            getStateWithChannelPermissions(channel.id, defaultTeamId, ['manage_public_channel_properties']),
        );

        expect(screen.getByRole('button', {name: 'Add a channel header'})).toBeInTheDocument();
    });

    test('should hide add button for public channels without manage public properties', () => {
        const channel = TestHelper.getChannelMock({
            type: 'O',
            header: '',
        });

        const {container} = renderWithContext(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={channel}
            />,
            getStateWithChannelPermissions(channel.id, defaultTeamId, ['manage_private_channel_properties']),
        );

        expect(container.childNodes.length).toBe(0);
    });

    test('should hide add button for private channels when the user only has public manage permission', () => {
        const channel = TestHelper.getChannelMock({
            type: 'P',
            header: '',
        });

        renderWithContext(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={channel}
            />,
            getStateWithChannelPermissions(channel.id, defaultTeamId, ['manage_public_channel_properties']),
        );

        expect(screen.queryByRole('button', {name: 'Add a channel header'})).not.toBeInTheDocument();
    });

    test('should show add button for private channels when the user can manage private properties', () => {
        const channel = TestHelper.getChannelMock({
            type: 'P',
            header: '',
        });

        renderWithContext(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={channel}
            />,
            getStateWithChannelPermissions(channel.id, defaultTeamId, ['manage_private_channel_properties']),
        );

        expect(screen.getByRole('button', {name: 'Add a channel header'})).toBeInTheDocument();
    });

    test('should treat whitespace-only headers as empty', () => {
        const channel = TestHelper.getChannelMock({
            type: 'O',
            header: '   ',
        });

        renderWithContext(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={channel}
            />,
            getStateWithChannelPermissions(channel.id, defaultTeamId, ['manage_public_channel_properties']),
        );

        expect(screen.getByRole('button', {name: 'Add a channel header'})).toBeInTheDocument();
    });

    test('should keep markdown-only headers as set headers', () => {
        const channel = TestHelper.getChannelMock({header: '****'});

        renderWithContext(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={channel}
            />,
        );

        expect(screen.queryByRole('button', {name: 'Add a channel header'})).not.toBeInTheDocument();
        expect(document.querySelector('.header-description__text')).toBeInTheDocument();
    });

    test('should open the existing edit header modal when add is clicked', async () => {
        const channel = TestHelper.getChannelMock({type: 'D', header: ''});

        renderWithContext(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={channel}
            />,
        );

        await userEvent.click(screen.getByRole('button', {name: 'Add a channel header'}));

        expect(openModal).toHaveBeenCalledWith(expect.objectContaining({
            modalId: ModalIdentifiers.EDIT_CHANNEL_HEADER,
            dialogProps: expect.objectContaining({channel}),
        }));
    });
});
