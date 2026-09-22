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

function buildPermissionState(channelId: string, teamId: string, channelPermissions: string[]) {
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
                    system_role: {permissions: [] as string[]},
                    team_role: {permissions: [] as string[]},
                    channel_role: {permissions: channelPermissions},
                },
            },
        },
    };
}

describe('ChannelHeaderText', () => {
    const defaultTeamId = TestHelper.getTeamMock().id;
    const addHeaderLabel = 'Add a channel header';

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
        expect(screen.queryByRole('button', {name: addHeaderLabel})).not.toBeInTheDocument();
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
        expect(screen.queryByRole('button', {name: addHeaderLabel})).not.toBeInTheDocument();
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
        expect(screen.queryByRole('button', {name: addHeaderLabel})).not.toBeInTheDocument();
    });

    test('should show archived header text as read-only when a header is set', () => {
        const channel = TestHelper.getChannelMock({delete_at: 1, header: 'Archived header'});

        renderWithContext(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={channel}
            />,
        );

        expect(screen.getByText('Archived header')).toBeInTheDocument();
        expect(screen.queryByRole('button', {name: addHeaderLabel})).not.toBeInTheDocument();
    });

    test('should return null if its a bot DM channels and its description is empty', () => {
        const channel = TestHelper.getChannelMock({type: 'D', header: ''});
        const botDm = TestHelper.getUserMock({is_bot: true, bot_description: ''});

        const {container} = renderWithContext(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={channel}
                dmUser={botDm}
            />,
        );

        expect(container.childNodes.length).toBe(0);
        expect(screen.queryByRole('button', {name: addHeaderLabel})).not.toBeInTheDocument();
    });

    test('should never show add button for bot DM even when channel header is set', () => {
        const channel = TestHelper.getChannelMock({type: 'D', header: 'human header'});
        const botDm = TestHelper.getUserMock({is_bot: true, bot_description: ''});

        const {container} = renderWithContext(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={channel}
                dmUser={botDm}
            />,
        );

        expect(container.childNodes.length).toBe(0);
        expect(screen.queryByText('human header')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', {name: addHeaderLabel})).not.toBeInTheDocument();
    });

    test('should show add button for DM channels without header', () => {
        const channel = TestHelper.getChannelMock({type: 'D', header: ''});

        renderWithContext(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={channel}
            />,
        );

        expect(screen.getByRole('button', {name: addHeaderLabel})).toBeInTheDocument();
    });

    test('should show add button for GM channels without header', () => {
        const channel = TestHelper.getChannelMock({type: 'G', header: ''});

        renderWithContext(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={channel}
            />,
        );

        expect(screen.getByRole('button', {name: addHeaderLabel})).toBeInTheDocument();
    });

    test('should show add button for public channels when user has manage public properties', () => {
        const channel = TestHelper.getChannelMock({
            type: 'O',
            header: '',
        });
        const state = buildPermissionState(channel.id, defaultTeamId, [Permissions.MANAGE_PUBLIC_CHANNEL_PROPERTIES]);

        renderWithContext(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={channel}
            />,
            state,
        );

        expect(screen.getByRole('button', {name: addHeaderLabel})).toBeInTheDocument();
    });

    test('should hide add button for public channels without manage public properties', () => {
        const channel = TestHelper.getChannelMock({
            type: 'O',
            header: '',
        });
        const state = buildPermissionState(channel.id, defaultTeamId, []);

        const {container} = renderWithContext(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={channel}
            />,
            state,
        );

        expect(screen.queryByRole('button', {name: addHeaderLabel})).not.toBeInTheDocument();
        expect(container.childNodes.length).toBe(0);
    });

    test('should hide add button for public channels when user only has manage private properties', () => {
        const channel = TestHelper.getChannelMock({
            type: 'O',
            header: '',
        });
        const state = buildPermissionState(channel.id, defaultTeamId, [Permissions.MANAGE_PRIVATE_CHANNEL_PROPERTIES]);

        renderWithContext(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={channel}
            />,
            state,
        );

        expect(screen.queryByRole('button', {name: addHeaderLabel})).not.toBeInTheDocument();
    });

    test('should show add button for private channels when user has manage private properties', () => {
        const channel = TestHelper.getChannelMock({
            type: 'P',
            header: '',
        });
        const state = buildPermissionState(channel.id, defaultTeamId, [Permissions.MANAGE_PRIVATE_CHANNEL_PROPERTIES]);

        renderWithContext(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={channel}
            />,
            state,
        );

        expect(screen.getByRole('button', {name: addHeaderLabel})).toBeInTheDocument();
    });

    test('should hide add button for private channels when user only has manage public properties', () => {
        const channel = TestHelper.getChannelMock({
            type: 'P',
            header: '',
        });
        const state = buildPermissionState(channel.id, defaultTeamId, [Permissions.MANAGE_PUBLIC_CHANNEL_PROPERTIES]);

        renderWithContext(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={channel}
            />,
            state,
        );

        expect(screen.queryByRole('button', {name: addHeaderLabel})).not.toBeInTheDocument();
    });

    test('should hide add button for private channels without manage private properties', () => {
        const channel = TestHelper.getChannelMock({
            type: 'P',
            header: '',
        });
        const state = buildPermissionState(channel.id, defaultTeamId, []);

        renderWithContext(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={channel}
            />,
            state,
        );

        expect(screen.queryByRole('button', {name: addHeaderLabel})).not.toBeInTheDocument();
    });

    test('should treat whitespace-only headers as empty and show add when allowed', () => {
        const channel = TestHelper.getChannelMock({
            type: 'O',
            header: '   \n\t',
        });
        const state = buildPermissionState(channel.id, defaultTeamId, [Permissions.MANAGE_PUBLIC_CHANNEL_PROPERTIES]);

        renderWithContext(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={channel}
            />,
            state,
        );

        expect(screen.getByRole('button', {name: addHeaderLabel})).toBeInTheDocument();
    });

    test('should treat whitespace-only DM headers as empty and show add for any member', () => {
        const channel = TestHelper.getChannelMock({type: 'D', header: '   '});

        renderWithContext(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={channel}
            />,
        );

        expect(screen.getByRole('button', {name: addHeaderLabel})).toBeInTheDocument();
    });

    test('should keep popover for markdown that has content even if it may render visually empty', () => {
        const channel = TestHelper.getChannelMock({header: '****'});

        renderWithContext(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={channel}
            />,
        );

        expect(screen.queryByRole('button', {name: addHeaderLabel})).not.toBeInTheDocument();
        expect(document.querySelector('.header-description__text')).toBeInTheDocument();
    });

    test('should open EditChannelHeaderModal when add is clicked on a DM', async () => {
        const channel = TestHelper.getChannelMock({type: 'D', header: ''});
        const openModalSpy = jest.spyOn(modalActions, 'openModal');

        renderWithContext(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={channel}
            />,
        );

        await userEvent.click(screen.getByRole('button', {name: addHeaderLabel}));

        expect(openModalSpy).toHaveBeenCalledWith({
            modalId: ModalIdentifiers.EDIT_CHANNEL_HEADER,
            dialogType: EditChannelHeaderModal,
            dialogProps: {channel},
        });
    });

    test('should open EditChannelHeaderModal when add is clicked on a public channel', async () => {
        const channel = TestHelper.getChannelMock({
            type: 'O',
            header: '',
        });
        const state = buildPermissionState(channel.id, defaultTeamId, [Permissions.MANAGE_PUBLIC_CHANNEL_PROPERTIES]);
        const openModalSpy = jest.spyOn(modalActions, 'openModal');

        renderWithContext(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={channel}
            />,
            state,
        );

        await userEvent.click(screen.getByRole('button', {name: addHeaderLabel}));

        expect(openModalSpy).toHaveBeenCalledWith({
            modalId: ModalIdentifiers.EDIT_CHANNEL_HEADER,
            dialogType: EditChannelHeaderModal,
            dialogProps: {channel},
        });
    });
});
