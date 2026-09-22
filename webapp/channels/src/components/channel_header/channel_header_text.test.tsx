// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {openModal} from 'actions/views/modals';

import EditChannelHeaderModal from 'components/edit_channel_header_modal';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import {ModalIdentifiers} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import ChannelHeaderText from './channel_header_text';

jest.mock('actions/views/modals', () => ({
    openModal: jest.fn(() => ({type: 'MOCKED_OPEN_MODAL'})),
}));

const mockedOpenModal = openModal as unknown as jest.Mock;

function getStateWithPermissions(channelId: string, teamId: string, permissions: string[]) {
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
        mockedOpenModal.mockClear();
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
        const state = getStateWithPermissions(channel.id, defaultTeamId, ['manage_public_channel_properties']);

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

    test('should show archived header text without add button', () => {
        const channel = TestHelper.getChannelMock({delete_at: 1, header: 'Archived header'});
        const state = getStateWithPermissions(channel.id, defaultTeamId, ['manage_public_channel_properties']);

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

    test('should ignore channel.header on bot DMs and never show add button', () => {
        const channel = TestHelper.getChannelMock({type: 'D', header: 'channel header should be ignored'});
        const botDm = TestHelper.getUserMock({is_bot: true, bot_description: ''});

        const {container} = renderWithContext(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={channel}
                dmUser={botDm}
            />,
        );

        expect(container.childNodes.length).toBe(0);
        expect(screen.queryByText('channel header should be ignored')).not.toBeInTheDocument();
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

    test('should not throw when dmUser is undefined on a DM', () => {
        const channel = TestHelper.getChannelMock({type: 'D', header: ''});

        expect(() => {
            renderWithContext(
                <ChannelHeaderText
                    teamId={defaultTeamId}
                    channel={channel}
                />,
            );
        }).not.toThrow();

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

    test('should return null for archived DM or GM without header', () => {
        const dmChannel = TestHelper.getChannelMock({type: 'D', header: '', delete_at: 1});
        const {container, rerender} = renderWithContext(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={dmChannel}
            />,
        );

        expect(container.childNodes.length).toBe(0);

        const gmChannel = TestHelper.getChannelMock({type: 'G', header: '', delete_at: 1});
        rerender(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={gmChannel}
            />,
        );

        expect(screen.queryByRole('button', {name: 'Add a channel header'})).not.toBeInTheDocument();
    });

    test('should show add button for public channels with manage public permission', () => {
        const channel = TestHelper.getChannelMock({
            type: 'O',
            header: '',
        });
        const state = getStateWithPermissions(channel.id, defaultTeamId, ['manage_public_channel_properties']);

        renderWithContext(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={channel}
            />,
            state,
        );

        expect(screen.getByRole('button', {name: 'Add a channel header'})).toBeInTheDocument();
    });

    test('should return null for public channels without manage public permission', () => {
        const channel = TestHelper.getChannelMock({
            type: 'O',
            header: '',
        });
        const state = getStateWithPermissions(channel.id, defaultTeamId, []);

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

    test('should show add button for private channels with manage private permission', () => {
        const channel = TestHelper.getChannelMock({
            type: 'P',
            header: '',
        });
        const state = getStateWithPermissions(channel.id, defaultTeamId, ['manage_private_channel_properties']);

        renderWithContext(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={channel}
            />,
            state,
        );

        expect(screen.getByRole('button', {name: 'Add a channel header'})).toBeInTheDocument();
    });

    test('should return null for private channels with only public manage permission', () => {
        const channel = TestHelper.getChannelMock({
            type: 'P',
            header: '',
        });
        const state = getStateWithPermissions(channel.id, defaultTeamId, ['manage_public_channel_properties']);

        const {container} = renderWithContext(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={channel}
            />,
            state,
        );

        expect(container.childNodes.length).toBe(0);
    });

    test('should return null for public channels with only private manage permission', () => {
        const channel = TestHelper.getChannelMock({
            type: 'O',
            header: '',
        });
        const state = getStateWithPermissions(channel.id, defaultTeamId, ['manage_private_channel_properties']);

        const {container} = renderWithContext(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={channel}
            />,
            state,
        );

        expect(container.childNodes.length).toBe(0);
    });

    test('should treat whitespace-only headers as empty and show add button when allowed', async () => {
        const publicChannel = TestHelper.getChannelMock({
            type: 'O',
            header: ' \n\t ',
        });
        const state = getStateWithPermissions(publicChannel.id, defaultTeamId, ['manage_public_channel_properties']);

        const {rerender} = renderWithContext(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={publicChannel}
            />,
            state,
        );

        expect(screen.getByRole('button', {name: 'Add a channel header'})).toBeInTheDocument();

        const dmChannel = TestHelper.getChannelMock({type: 'D', header: '   '});
        rerender(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={dmChannel}
            />,
        );
        expect(screen.getByRole('button', {name: 'Add a channel header'})).toBeInTheDocument();

        const gmChannel = TestHelper.getChannelMock({type: 'G', header: '\n'});
        rerender(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={gmChannel}
            />,
        );
        expect(screen.getByRole('button', {name: 'Add a channel header'})).toBeInTheDocument();
    });

    test('should treat markdown that renders empty as a set header', () => {
        const channel = TestHelper.getChannelMock({header: '****'});

        renderWithContext(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={channel}
            />,
        );

        expect(screen.queryByRole('button', {name: 'Add a channel header'})).not.toBeInTheDocument();
    });

    test('should render unicode, CJK, and emoji headers', () => {
        const channel = TestHelper.getChannelMock({header: '朝会 ☕ مرحبا'});

        renderWithContext(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={channel}
            />,
        );

        expect(screen.getByText(/朝会/)).toBeInTheDocument();
        expect(screen.getByText(/مرحبا/)).toBeInTheDocument();
        expect(screen.queryByRole('button', {name: 'Add a channel header'})).not.toBeInTheDocument();
    });

    test('should open EditChannelHeaderModal with the current channel on add click', async () => {
        const channel = TestHelper.getChannelMock({
            type: 'O',
            header: '',
        });
        const state = getStateWithPermissions(channel.id, defaultTeamId, ['manage_public_channel_properties']);

        renderWithContext(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={channel}
            />,
            state,
        );

        await userEvent.click(screen.getByRole('button', {name: 'Add a channel header'}));

        expect(mockedOpenModal).toHaveBeenCalledWith({
            modalId: ModalIdentifiers.EDIT_CHANNEL_HEADER,
            dialogType: EditChannelHeaderModal,
            dialogProps: {channel},
        });
    });

    test('should hide add button after channel header is set and restore it when cleared', () => {
        const emptyChannel = TestHelper.getChannelMock({type: 'D', header: ''});
        const {rerender} = renderWithContext(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={emptyChannel}
            />,
        );

        expect(screen.getByRole('button', {name: 'Add a channel header'})).toBeInTheDocument();

        const setChannel = {...emptyChannel, header: 'Standup at 9'};
        rerender(
            <ChannelHeaderText
                teamId={defaultTeamId}
                channel={setChannel}
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
});
