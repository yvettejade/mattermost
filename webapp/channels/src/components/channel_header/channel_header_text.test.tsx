// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {Permissions} from 'mattermost-redux/constants';

import * as modalActions from 'actions/views/modals';
import EditChannelHeaderModal from 'components/edit_channel_header_modal';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import {Constants, ModalIdentifiers} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import ChannelHeaderText from './channel_header_text';

const ADD_HEADER = 'Add a channel header';

function makePermissionState(channelId: string, teamId: string, permissions: string[]) {
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
                    channel_role: {permissions},
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
        expect(screen.queryByRole('button', {name: ADD_HEADER})).not.toBeInTheDocument();
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
        expect(screen.queryByRole('button', {name: ADD_HEADER})).not.toBeInTheDocument();
    });

    test('should return null if the channel has no header and is archived', () => {
        const channel = TestHelper.getChannelMock({delete_at: 1, header: ''});
        const state = makePermissionState(channel.id, defaultTeamId, [Permissions.MANAGE_PUBLIC_CHANNEL_PROPERTIES]);

        const {container} = renderWithContext(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={channel}
            />,
            state,
        );

        expect(container.childNodes.length).toBe(0);
        expect(screen.queryByRole('button', {name: ADD_HEADER})).not.toBeInTheDocument();
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
        expect(screen.queryByRole('button', {name: ADD_HEADER})).not.toBeInTheDocument();
    });

    test('should show add button for public channel with empty header and manage public permission', () => {
        const channel = TestHelper.getChannelMock({type: Constants.OPEN_CHANNEL, header: ''});
        const state = makePermissionState(channel.id, defaultTeamId, [Permissions.MANAGE_PUBLIC_CHANNEL_PROPERTIES]);

        renderWithContext(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={channel}
            />,
            state,
        );

        expect(screen.getByRole('button', {name: ADD_HEADER})).toBeInTheDocument();
    });

    test('should not show add button for public channel with empty header and no permission', () => {
        const channel = TestHelper.getChannelMock({type: Constants.OPEN_CHANNEL, header: ''});
        const state = makePermissionState(channel.id, defaultTeamId, []);

        const {container} = renderWithContext(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={channel}
            />,
            state,
        );

        expect(container.childNodes.length).toBe(0);
        expect(screen.queryByRole('button', {name: ADD_HEADER})).not.toBeInTheDocument();
    });

    test('should not show add button for public channel with empty header and only private permission', () => {
        const channel = TestHelper.getChannelMock({type: Constants.OPEN_CHANNEL, header: ''});
        const state = makePermissionState(channel.id, defaultTeamId, [Permissions.MANAGE_PRIVATE_CHANNEL_PROPERTIES]);

        renderWithContext(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={channel}
            />,
            state,
        );

        expect(screen.queryByRole('button', {name: ADD_HEADER})).not.toBeInTheDocument();
    });

    test('should show add button for private channel with empty header and manage private permission', () => {
        const channel = TestHelper.getChannelMock({type: Constants.PRIVATE_CHANNEL, header: ''});
        const state = makePermissionState(channel.id, defaultTeamId, [Permissions.MANAGE_PRIVATE_CHANNEL_PROPERTIES]);

        renderWithContext(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={channel}
            />,
            state,
        );

        expect(screen.getByRole('button', {name: ADD_HEADER})).toBeInTheDocument();
    });

    test('should not show add button for private channel with empty header and no permission', () => {
        const channel = TestHelper.getChannelMock({type: Constants.PRIVATE_CHANNEL, header: ''});
        const state = makePermissionState(channel.id, defaultTeamId, []);

        renderWithContext(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={channel}
            />,
            state,
        );

        expect(screen.queryByRole('button', {name: ADD_HEADER})).not.toBeInTheDocument();
    });

    test('should not show add button for private channel with empty header and only public permission', () => {
        const channel = TestHelper.getChannelMock({type: Constants.PRIVATE_CHANNEL, header: ''});
        const state = makePermissionState(channel.id, defaultTeamId, [Permissions.MANAGE_PUBLIC_CHANNEL_PROPERTIES]);

        renderWithContext(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={channel}
            />,
            state,
        );

        expect(screen.queryByRole('button', {name: ADD_HEADER})).not.toBeInTheDocument();
    });

    test('should open edit header modal with current channel when add button is clicked', async () => {
        const channel = TestHelper.getChannelMock({type: Constants.OPEN_CHANNEL, header: ''});
        const state = makePermissionState(channel.id, defaultTeamId, [Permissions.MANAGE_PUBLIC_CHANNEL_PROPERTIES]);

        renderWithContext(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={channel}
            />,
            state,
        );

        await userEvent.click(screen.getByRole('button', {name: ADD_HEADER}));

        expect(modalActions.openModal).toHaveBeenCalledWith({
            modalId: ModalIdentifiers.EDIT_CHANNEL_HEADER,
            dialogType: EditChannelHeaderModal,
            dialogProps: {channel},
        });
    });

    test('should show add button for human DM without manage-properties permission', () => {
        const channel = TestHelper.getChannelMock({type: Constants.DM_CHANNEL, header: ''});

        renderWithContext(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={channel}
                dmUser={TestHelper.getUserMock({is_bot: false})}
            />,
        );

        expect(screen.getByRole('button', {name: ADD_HEADER})).toBeInTheDocument();
    });

    test('should show popover and no add button for human DM with header set', () => {
        const channel = TestHelper.getChannelMock({type: Constants.DM_CHANNEL, header: 'DM header'});

        renderWithContext(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={channel}
                dmUser={TestHelper.getUserMock({is_bot: false})}
            />,
        );

        expect(screen.getByText('DM header')).toBeInTheDocument();
        expect(screen.queryByRole('button', {name: ADD_HEADER})).not.toBeInTheDocument();
    });

    test('should show add button for GM without manage-properties permission', () => {
        const channel = TestHelper.getChannelMock({type: Constants.GM_CHANNEL, header: ''});

        renderWithContext(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={channel}
            />,
        );

        expect(screen.getByRole('button', {name: ADD_HEADER})).toBeInTheDocument();
    });

    test('should show popover and no add button for GM with header set', () => {
        const channel = TestHelper.getChannelMock({type: Constants.GM_CHANNEL, header: 'GM header'});

        renderWithContext(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={channel}
            />,
        );

        expect(screen.getByText('GM header')).toBeInTheDocument();
        expect(screen.queryByRole('button', {name: ADD_HEADER})).not.toBeInTheDocument();
    });

    test('should ignore channel.header on bot DMs and never show add button', () => {
        const channel = TestHelper.getChannelMock({type: Constants.DM_CHANNEL, header: 'should not show'});
        const botDm = TestHelper.getUserMock({is_bot: true, bot_description: 'bot description'});

        renderWithContext(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={channel}
                dmUser={botDm}
            />,
        );

        expect(screen.getByText('bot description')).toBeInTheDocument();
        expect(screen.queryByText('should not show')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', {name: ADD_HEADER})).not.toBeInTheDocument();
    });

    test('should return null for bot DM with empty description even if channel.header is set', () => {
        const channel = TestHelper.getChannelMock({type: Constants.DM_CHANNEL, header: 'channel header'});
        const botDm = TestHelper.getUserMock({is_bot: true, bot_description: ''});

        const {container} = renderWithContext(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={channel}
                dmUser={botDm}
            />,
        );

        expect(container.childNodes.length).toBe(0);
        expect(screen.queryByText('channel header')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', {name: ADD_HEADER})).not.toBeInTheDocument();
    });

    test('should show popover and no add button for archived public channel with header', () => {
        const channel = TestHelper.getChannelMock({
            type: Constants.OPEN_CHANNEL,
            header: 'Archived header',
            delete_at: 1,
        });
        const state = makePermissionState(channel.id, defaultTeamId, [Permissions.MANAGE_PUBLIC_CHANNEL_PROPERTIES]);

        renderWithContext(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={channel}
            />,
            state,
        );

        expect(screen.getByText('Archived header')).toBeInTheDocument();
        expect(screen.queryByRole('button', {name: ADD_HEADER})).not.toBeInTheDocument();
    });

    test('should return null for archived DM or GM with empty header', () => {
        const dm = TestHelper.getChannelMock({type: Constants.DM_CHANNEL, header: '', delete_at: 1});
        const {container: dmContainer, unmount} = renderWithContext(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={dm}
                dmUser={TestHelper.getUserMock({is_bot: false})}
            />,
        );

        expect(dmContainer.childNodes.length).toBe(0);
        unmount();

        const gm = TestHelper.getChannelMock({type: Constants.GM_CHANNEL, header: '', delete_at: 1});
        const {container: gmContainer} = renderWithContext(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={gm}
            />,
        );

        expect(gmContainer.childNodes.length).toBe(0);
    });

    test('should treat whitespace-only headers as empty', () => {
        const publicChannel = TestHelper.getChannelMock({type: Constants.OPEN_CHANNEL, header: '   \n\t'});
        const state = makePermissionState(publicChannel.id, defaultTeamId, [Permissions.MANAGE_PUBLIC_CHANNEL_PROPERTIES]);

        const {unmount} = renderWithContext(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={publicChannel}
            />,
            state,
        );

        expect(screen.getByRole('button', {name: ADD_HEADER})).toBeInTheDocument();
        unmount();

        const dm = TestHelper.getChannelMock({type: Constants.DM_CHANNEL, header: ' \n '});
        renderWithContext(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={dm}
            />,
        );

        expect(screen.getByRole('button', {name: ADD_HEADER})).toBeInTheDocument();
    });

    test('should treat markdown that renders empty as a set header', () => {
        const channel = TestHelper.getChannelMock({header: '****'});

        renderWithContext(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={channel}
            />,
        );

        expect(screen.queryByRole('button', {name: ADD_HEADER})).not.toBeInTheDocument();
        expect(document.querySelector('.header-description__text')).toBeInTheDocument();
    });

    test('should render unicode, CJK, and emoji headers', () => {
        const channel = TestHelper.getChannelMock({header: 'スタンドアップ 🎉 مرحبا'});

        renderWithContext(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={channel}
            />,
        );

        expect(screen.getByText('スタンドアップ 🎉 مرحبا')).toBeInTheDocument();
        expect(screen.queryByRole('button', {name: ADD_HEADER})).not.toBeInTheDocument();
    });

    test('should render exact header text in the popover', () => {
        const channel = TestHelper.getChannelMock({header: 'Standup at 9'});

        renderWithContext(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={channel}
            />,
        );

        expect(screen.getByText('Standup at 9')).toBeInTheDocument();
    });

    test('should update from add button to popover when the channel header is set', () => {
        const emptyChannel = TestHelper.getChannelMock({type: Constants.OPEN_CHANNEL, header: ''});
        const state = makePermissionState(emptyChannel.id, defaultTeamId, [Permissions.MANAGE_PUBLIC_CHANNEL_PROPERTIES]);

        const {rerender} = renderWithContext(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={emptyChannel}
            />,
            state,
        );

        expect(screen.getByRole('button', {name: ADD_HEADER})).toBeInTheDocument();

        rerender(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={{...emptyChannel, header: 'Standup at 9'}}
            />,
        );

        expect(screen.getByText('Standup at 9')).toBeInTheDocument();
        expect(screen.queryByRole('button', {name: ADD_HEADER})).not.toBeInTheDocument();
    });

    test('should not throw when dmUser is undefined on a DM channel', () => {
        const channel = TestHelper.getChannelMock({type: Constants.DM_CHANNEL, header: ''});

        expect(() => {
            renderWithContext(
                <ChannelHeaderText
                    teamId={defaultTeamId}
                    channel={channel}
                />,
            );
        }).not.toThrow();

        expect(screen.getByRole('button', {name: ADD_HEADER})).toBeInTheDocument();
    });
});
