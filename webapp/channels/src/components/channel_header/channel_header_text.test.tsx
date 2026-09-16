// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import * as modalActions from 'actions/views/modals';

import EditChannelHeaderModal from 'components/edit_channel_header_modal';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import {ModalIdentifiers} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import ChannelHeaderText from './channel_header_text';

function getPermissionState(channelId: string, teamId: string, channelPermissions: string[]) {
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

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('C3: should render channel header text when header exists for a channel', () => {
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

    test('C13: should render bot description for bot DM channels', () => {
        const channel = TestHelper.getChannelMock({type: 'D', header: ''});
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

    test('C14: bot DM ignores channel.header and never shows add button', () => {
        const channel = TestHelper.getChannelMock({type: 'D', header: 'Should not appear'});
        const botDm = TestHelper.getUserMock({is_bot: true, bot_description: 'Bot copy'});

        renderWithContext(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={channel}
                dmUser={botDm}
            />,
        );

        expect(screen.getByText('Bot copy')).toBeInTheDocument();
        expect(screen.queryByText('Should not appear')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', {name: 'Add a channel header'})).not.toBeInTheDocument();
    });

    test('C15: should return null if the channel has no header and is archived', () => {
        const channel = TestHelper.getChannelMock({delete_at: 1, header: '', type: 'O'});
        const state = getPermissionState(channel.id, defaultTeamId, ['manage_public_channel_properties']);

        const {container} = renderWithContext(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={channel}
            />,
            state,
        );

        expect(container.childNodes.length).toBe(0);
        expect(screen.queryByRole('button', {name: 'Add a channel header'})).not.toBeInTheDocument();
    });

    test('C16: archived public with header shows popover and no add button', () => {
        const channel = TestHelper.getChannelMock({delete_at: 1, header: 'Archived header', type: 'O'});
        const state = getPermissionState(channel.id, defaultTeamId, ['manage_public_channel_properties']);

        renderWithContext(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={channel}
            />,
            state,
        );

        expect(screen.getByText('Archived header')).toBeInTheDocument();
        expect(screen.queryByRole('button', {name: 'Add a channel header'})).not.toBeInTheDocument();
    });

    test('C12: should return null if its a bot DM channel and its description is empty', () => {
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

    test('C8: should show add header button for human DM channels without header', () => {
        const channel = TestHelper.getChannelMock({type: 'D', header: ''});

        renderWithContext(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={channel}
            />,
        );

        expect(screen.getByRole('button', {name: 'Add a channel header'})).toBeInTheDocument();
    });

    test('C9: human DM with header shows popover and no add button', () => {
        const channel = TestHelper.getChannelMock({type: 'D', header: 'DM header'});

        renderWithContext(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={channel}
            />,
        );

        expect(screen.getByText('DM header')).toBeInTheDocument();
        expect(screen.queryByRole('button', {name: 'Add a channel header'})).not.toBeInTheDocument();
    });

    test('C10: should show add header button for GM channels without header', () => {
        const channel = TestHelper.getChannelMock({type: 'G', header: ''});

        renderWithContext(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={channel}
            />,
        );

        expect(screen.getByRole('button', {name: 'Add a channel header'})).toBeInTheDocument();
    });

    test('C11: GM with header shows popover and no add button', () => {
        const channel = TestHelper.getChannelMock({type: 'G', header: 'GM header'});

        renderWithContext(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={channel}
            />,
        );

        expect(screen.getByText('GM header')).toBeInTheDocument();
        expect(screen.queryByRole('button', {name: 'Add a channel header'})).not.toBeInTheDocument();
    });

    test('C17: archived DM/GM with empty header returns null', () => {
        const dm = TestHelper.getChannelMock({type: 'D', header: '', delete_at: 1});
        const gm = TestHelper.getChannelMock({type: 'G', header: '', delete_at: 1});

        const {container: dmContainer, unmount} = renderWithContext(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={dm}
            />,
        );
        expect(dmContainer.childNodes.length).toBe(0);
        unmount();

        const {container: gmContainer} = renderWithContext(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={gm}
            />,
        );
        expect(gmContainer.childNodes.length).toBe(0);
    });

    test('C2: should return null for public channels without header when user lacks permissions', () => {
        const channel = TestHelper.getChannelMock({
            type: 'O',
            header: '',
        });

        renderWithContext(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={channel}
            />,
            getPermissionState(channel.id, defaultTeamId, []),
        );

        expect(screen.queryByRole('button', {name: 'Add a channel header'})).not.toBeInTheDocument();
    });

    test('C1: should show add header button for public channels without header when user has permissions', () => {
        const channel = TestHelper.getChannelMock({
            type: 'O',
            header: '',
        });

        renderWithContext(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={channel}
            />,
            getPermissionState(channel.id, defaultTeamId, ['manage_public_channel_properties']),
        );

        expect(screen.getByRole('button', {name: 'Add a channel header'})).toBeInTheDocument();
    });

    test('C4: should show add header button for private channels without header when user has private permissions', () => {
        const channel = TestHelper.getChannelMock({
            type: 'P',
            header: '',
        });

        renderWithContext(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={channel}
            />,
            getPermissionState(channel.id, defaultTeamId, ['manage_private_channel_properties']),
        );

        expect(screen.getByRole('button', {name: 'Add a channel header'})).toBeInTheDocument();
    });

    test('C5: private empty with no permissions hides add button', () => {
        const channel = TestHelper.getChannelMock({
            type: 'P',
            header: '',
        });

        renderWithContext(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={channel}
            />,
            getPermissionState(channel.id, defaultTeamId, []),
        );

        expect(screen.queryByRole('button', {name: 'Add a channel header'})).not.toBeInTheDocument();
    });

    test('C6: private empty with public permission only hides add button', () => {
        const channel = TestHelper.getChannelMock({
            type: 'P',
            header: '',
        });

        renderWithContext(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={channel}
            />,
            getPermissionState(channel.id, defaultTeamId, ['manage_public_channel_properties']),
        );

        expect(screen.queryByRole('button', {name: 'Add a channel header'})).not.toBeInTheDocument();
    });

    test('C7: public empty with private permission only hides add button', () => {
        const channel = TestHelper.getChannelMock({
            type: 'O',
            header: '',
        });

        renderWithContext(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={channel}
            />,
            getPermissionState(channel.id, defaultTeamId, ['manage_private_channel_properties']),
        );

        expect(screen.queryByRole('button', {name: 'Add a channel header'})).not.toBeInTheDocument();
    });

    test('C18: whitespace-only headers are treated as empty', () => {
        const publicChannel = TestHelper.getChannelMock({type: 'O', header: '   '});
        const {unmount} = renderWithContext(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={publicChannel}
            />,
            getPermissionState(publicChannel.id, defaultTeamId, ['manage_public_channel_properties']),
        );
        expect(screen.getByRole('button', {name: 'Add a channel header'})).toBeInTheDocument();
        unmount();

        const dm = TestHelper.getChannelMock({type: 'D', header: '\n\t'});
        renderWithContext(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={dm}
            />,
        );
        expect(screen.getByRole('button', {name: 'Add a channel header'})).toBeInTheDocument();
    });

    test('C19: markdown that renders empty is still a set header', () => {
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

    test('should render unicode, CJK, and emoji header text', () => {
        const channel = TestHelper.getChannelMock({header: 'standup こんにちは 👋'});

        renderWithContext(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={channel}
            />,
        );

        expect(screen.getByText('standup こんにちは 👋')).toBeInTheDocument();
    });

    test('undefined dmUser on a DM is treated as a non-bot', () => {
        const channel = TestHelper.getChannelMock({type: 'D', header: ''});

        renderWithContext(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={channel}
            />,
        );

        expect(screen.getByRole('button', {name: 'Add a channel header'})).toBeInTheDocument();
    });

    test('channel switch from empty to set header replaces add button with popover', () => {
        const emptyChannel = TestHelper.getChannelMock({header: '', type: 'D'});
        const {rerender} = renderWithContext(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={emptyChannel}
            />,
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

        rerender(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={emptyChannel}
            />,
        );

        expect(screen.getByRole('button', {name: 'Add a channel header'})).toBeInTheDocument();
        expect(screen.queryByText('Standup at 9')).not.toBeInTheDocument();
    });

    test('clicking add header dispatches openModal with the current channel', async () => {
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
