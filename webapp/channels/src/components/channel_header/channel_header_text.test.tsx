// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {DeepPartial} from '@mattermost/types/utilities';

import * as modalActions from 'actions/views/modals';

import EditChannelHeaderModal from 'components/edit_channel_header_modal';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import {ModalIdentifiers} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import type {GlobalState} from 'types/store';

import ChannelHeaderText from './channel_header_text';

function stateWithChannelPermissions(
    channelId: string,
    teamId: string,
    channelPermissions: string[],
): DeepPartial<GlobalState> {
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
                    channel_role: {permissions: channelPermissions},
                },
            },
        },
    };
}

describe('ChannelHeaderText', () => {
    const defaultTeamId = TestHelper.getTeamMock().id;

    beforeEach(() => {
        jest.spyOn(modalActions, 'openModal');
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
        expect(screen.queryByRole('button', {name: 'Add a channel header'})).not.toBeInTheDocument();
    });

    test('should render exact header text including emoji and CJK', () => {
        const channel = TestHelper.getChannelMock({header: 'Standup at 9 🚀 会議'});
        renderWithContext(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={channel}
            />,
        );

        expect(document.querySelector('.header-description__text')).toHaveTextContent('Standup at 9');
        expect(document.querySelector('.header-description__text')).toHaveTextContent('会議');
        expect(screen.queryByRole('button', {name: 'Add a channel header'})).not.toBeInTheDocument();
    });

    test('should treat markdown-only header as a set header', () => {
        const channel = TestHelper.getChannelMock({header: '****'});
        renderWithContext(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={channel}
            />,
        );

        expect(document.querySelector('.header-description__text')).toBeInTheDocument();
        expect(screen.queryByRole('button', {name: 'Add a channel header'})).not.toBeInTheDocument();
    });

    test('should render channel header of bot description for bot DM channels', () => {
        const channel = TestHelper.getChannelMock({type: 'D', header: 'ignored channel header'});
        const botDm = TestHelper.getUserMock({is_bot: true, bot_description: 'Tranquility'});

        renderWithContext(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={channel}
                dmUser={botDm}
            />,
        );

        expect(screen.getByText('Tranquility')).toBeInTheDocument();
        expect(screen.queryByText('ignored channel header')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', {name: 'Add a channel header'})).not.toBeInTheDocument();
    });

    test('should return null if the channel has no header and is archived', () => {
        const channel = TestHelper.getChannelMock({
            delete_at: 1,
            header: '',
            type: 'O',
        });

        const {container} = renderWithContext(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={channel}
            />,
            stateWithChannelPermissions(channel.id, defaultTeamId, ['manage_public_channel_properties']),
        );

        expect(container.childNodes.length).toBe(0);
        expect(screen.queryByRole('button', {name: 'Add a channel header'})).not.toBeInTheDocument();
    });

    test('should show existing header for archived channels without add button', () => {
        const channel = TestHelper.getChannelMock({delete_at: 1, header: 'Legacy header'});

        renderWithContext(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={channel}
            />,
            stateWithChannelPermissions(channel.id, defaultTeamId, ['manage_public_channel_properties']),
        );

        expect(screen.getByText('Legacy header')).toBeInTheDocument();
        expect(screen.queryByRole('button', {name: 'Add a channel header'})).not.toBeInTheDocument();
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
        expect(screen.queryByRole('button', {name: 'Add a channel header'})).not.toBeInTheDocument();
    });

    test('should return null for archived DM and GM channels without header', () => {
        const archivedDM = TestHelper.getChannelMock({type: 'D', header: '', delete_at: 1});
        const {container: dmContainer, unmount} = renderWithContext(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={archivedDM}
            />,
        );
        expect(dmContainer.childNodes.length).toBe(0);
        unmount();

        const archivedGM = TestHelper.getChannelMock({type: 'G', header: '', delete_at: 1});
        const {container: gmContainer} = renderWithContext(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={archivedGM}
            />,
        );
        expect(gmContainer.childNodes.length).toBe(0);
    });

    test('should show add header button for DM channels without header', async () => {
        const channel = TestHelper.getChannelMock({type: 'D', header: ''});

        renderWithContext(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={channel}
            />,
        );

        const addButton = screen.getByRole('button', {name: 'Add a channel header'});
        expect(addButton).toBeInTheDocument();

        await userEvent.click(addButton);
        expect(modalActions.openModal).toHaveBeenCalledWith({
            modalId: ModalIdentifiers.EDIT_CHANNEL_HEADER,
            dialogType: EditChannelHeaderModal,
            dialogProps: {channel},
        });
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

    test('should show popover and hide add button when human DM or GM header is set', () => {
        const dmChannel = TestHelper.getChannelMock({type: 'D', header: 'DM header'});
        const {unmount} = renderWithContext(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={dmChannel}
            />,
        );
        expect(screen.getByText('DM header')).toBeInTheDocument();
        expect(screen.queryByRole('button', {name: 'Add a channel header'})).not.toBeInTheDocument();
        unmount();

        const gmChannel = TestHelper.getChannelMock({type: 'G', header: 'GM header'});
        renderWithContext(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={gmChannel}
            />,
        );
        expect(screen.getByText('GM header')).toBeInTheDocument();
        expect(screen.queryByRole('button', {name: 'Add a channel header'})).not.toBeInTheDocument();
    });

    test('should treat undefined dmUser on a DM as a non-bot', () => {
        const channel = TestHelper.getChannelMock({type: 'D', header: ''});

        renderWithContext(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={channel}
            />,
        );

        expect(screen.getByRole('button', {name: 'Add a channel header'})).toBeInTheDocument();
    });

    test('should not show add header button when user lacks permission and channel does not have header', () => {
        const channel = TestHelper.getChannelMock({
            type: 'O',
            header: '',
        });

        renderWithContext(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={channel}
            />,
            stateWithChannelPermissions(channel.id, defaultTeamId, []),
        );

        expect(screen.queryByRole('button', {name: 'Add a channel header'})).not.toBeInTheDocument();
    });

    test('should show add header button when user has public permission and public channel does not have header', async () => {
        const channel = TestHelper.getChannelMock({
            type: 'O',
            header: '',
        });

        renderWithContext(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={channel}
            />,
            stateWithChannelPermissions(channel.id, defaultTeamId, ['manage_public_channel_properties']),
        );

        const addButton = screen.getByRole('button', {name: 'Add a channel header'});
        expect(addButton).toBeInTheDocument();

        await userEvent.click(addButton);
        expect(modalActions.openModal).toHaveBeenCalledWith({
            modalId: ModalIdentifiers.EDIT_CHANNEL_HEADER,
            dialogType: EditChannelHeaderModal,
            dialogProps: {channel},
        });
    });

    test('should show add header button when user has private permission and private channel does not have header', () => {
        const channel = TestHelper.getChannelMock({
            type: 'P',
            header: '',
        });

        renderWithContext(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={channel}
            />,
            stateWithChannelPermissions(channel.id, defaultTeamId, ['manage_private_channel_properties']),
        );

        expect(screen.getByRole('button', {name: 'Add a channel header'})).toBeInTheDocument();
    });

    test('should not show add header button when private channel has only public permission', () => {
        const channel = TestHelper.getChannelMock({
            type: 'P',
            header: '',
        });

        renderWithContext(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={channel}
            />,
            stateWithChannelPermissions(channel.id, defaultTeamId, ['manage_public_channel_properties']),
        );

        expect(screen.queryByRole('button', {name: 'Add a channel header'})).not.toBeInTheDocument();
    });

    test('should not show add header button when public channel has only private permission', () => {
        const channel = TestHelper.getChannelMock({
            type: 'O',
            header: '',
        });

        renderWithContext(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={channel}
            />,
            stateWithChannelPermissions(channel.id, defaultTeamId, ['manage_private_channel_properties']),
        );

        expect(screen.queryByRole('button', {name: 'Add a channel header'})).not.toBeInTheDocument();
    });

    test('should not show add header button for private channel without permission', () => {
        const channel = TestHelper.getChannelMock({
            type: 'P',
            header: '',
        });

        renderWithContext(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={channel}
            />,
            stateWithChannelPermissions(channel.id, defaultTeamId, []),
        );

        expect(screen.queryByRole('button', {name: 'Add a channel header'})).not.toBeInTheDocument();
    });

    test.each(['   ', '\t\n', ' \n\t '])('should treat whitespace-only header %j as empty', (header) => {
        const publicChannel = TestHelper.getChannelMock({type: 'O', header});
        const {unmount} = renderWithContext(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={publicChannel}
            />,
            stateWithChannelPermissions(publicChannel.id, defaultTeamId, ['manage_public_channel_properties']),
        );
        expect(screen.getByRole('button', {name: 'Add a channel header'})).toBeInTheDocument();
        unmount();

        const dmChannel = TestHelper.getChannelMock({type: 'D', header});
        renderWithContext(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={dmChannel}
            />,
        );
        expect(screen.getByRole('button', {name: 'Add a channel header'})).toBeInTheDocument();
    });

    test('should replace add button with popover when channel header is set after render', () => {
        const emptyChannel = TestHelper.getChannelMock({type: 'O', header: ''});
        const {rerender} = renderWithContext(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={emptyChannel}
            />,
            stateWithChannelPermissions(emptyChannel.id, defaultTeamId, ['manage_public_channel_properties']),
        );

        expect(screen.getByRole('button', {name: 'Add a channel header'})).toBeInTheDocument();

        rerender(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={{...emptyChannel, header: 'Standup at 9'}}
            />,
        );

        expect(screen.getByText('Standup at 9')).toBeInTheDocument();
        expect(screen.queryByRole('button', {name: 'Add a channel header'})).not.toBeInTheDocument();
    });

    test('should replace popover with add button when channel header is cleared', () => {
        const channel = TestHelper.getChannelMock({type: 'O', header: 'Standup at 9'});
        const {rerender} = renderWithContext(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={channel}
            />,
            stateWithChannelPermissions(channel.id, defaultTeamId, ['manage_public_channel_properties']),
        );

        expect(screen.getByText('Standup at 9')).toBeInTheDocument();

        rerender(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={{...channel, header: ''}}
            />,
        );

        expect(screen.getByRole('button', {name: 'Add a channel header'})).toBeInTheDocument();
        expect(screen.queryByText('Standup at 9')).not.toBeInTheDocument();
    });
});
