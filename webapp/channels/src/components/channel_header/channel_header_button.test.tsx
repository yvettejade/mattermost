// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Channel} from '@mattermost/types/channels';

import {openModal} from 'actions/views/modals';

import {act, renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';
import {ModalIdentifiers} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import ChannelHeaderButton, {CHANNEL_HEADER_BUTTON_ID} from './channel_header_button';

jest.mock('actions/views/modals', () => ({
    openModal: jest.fn(() => ({type: 'OPEN_MODAL'})),
}));

const mockedOpenModal = openModal as unknown as jest.Mock;

const teamId = 'team_id';
const userId = 'user_id';

function makeState(channel: Channel, channelPermissions: string[] = []) {
    return {
        entities: {
            channels: {
                channels: {[channel.id]: channel},
                myMembers: {
                    [channel.id]: {channel_id: channel.id, user_id: userId, roles: 'channel_role'},
                },
                roles: {
                    [channel.id]: new Set(['channel_role']),
                },
            },
            teams: {
                currentTeamId: teamId,
                teams: {[teamId]: TestHelper.getTeamMock({id: teamId, name: 'team-name'})},
                myMembers: {
                    [teamId]: {team_id: teamId, roles: 'team_role'},
                },
            },
            users: {
                currentUserId: userId,
                profiles: {
                    [userId]: TestHelper.getUserMock({id: userId, roles: 'system_role'}),
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

function getButton() {
    return screen.getByRole('button', {name: 'Channel header'});
}

describe('components/channel_header/ChannelHeaderButton', () => {
    beforeEach(() => {
        mockedOpenModal.mockClear();
    });

    test('should render an icon button with an aria label, closed by default', () => {
        const channel = TestHelper.getChannelMock({team_id: teamId, header: 'Hello'});
        renderWithContext(<ChannelHeaderButton channel={channel}/>, makeState(channel));

        const button = getButton();
        expect(button).toHaveAttribute('id', CHANNEL_HEADER_BUTTON_ID);
        expect(button).toHaveAttribute('aria-expanded', 'false');
        expect(button).not.toHaveClass('channel-header__icon--active');
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    test('should show a tooltip on hover', async () => {
        const channel = TestHelper.getChannelMock({team_id: teamId, header: 'Hello'});
        renderWithContext(<ChannelHeaderButton channel={channel}/>, makeState(channel));

        await userEvent.hover(getButton());

        await waitFor(() => {
            expect(screen.getByRole('tooltip')).toHaveTextContent('Channel header');
        });
    });

    test('should toggle the popover on click and show the active state', async () => {
        const channel = TestHelper.getChannelMock({team_id: teamId, header: 'Hello world'});
        renderWithContext(<ChannelHeaderButton channel={channel}/>, makeState(channel));

        await userEvent.click(getButton());

        expect(screen.getByRole('dialog')).toHaveTextContent('Hello world');
        expect(getButton()).toHaveAttribute('aria-expanded', 'true');
        expect(getButton()).toHaveClass('channel-header__icon--active');

        await userEvent.click(getButton());

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(getButton()).not.toHaveClass('channel-header__icon--active');
    });

    test.each(['{Enter}', ' '])('should open the popover from the keyboard with %p', async (key) => {
        const channel = TestHelper.getChannelMock({team_id: teamId, header: 'Hello world'});
        renderWithContext(<ChannelHeaderButton channel={channel}/>, makeState(channel));

        getButton().focus();
        await userEvent.keyboard(key);

        expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    test('should close on Escape and return focus to the button', async () => {
        const channel = TestHelper.getChannelMock({team_id: teamId, header: 'Hello world'});
        renderWithContext(<ChannelHeaderButton channel={channel}/>, makeState(channel));

        await userEvent.click(getButton());
        expect(screen.getByRole('dialog')).toBeInTheDocument();

        await userEvent.keyboard('{Escape}');

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        await waitFor(() => expect(getButton()).toHaveFocus());
    });

    test('should close on outside click and return focus to the button', async () => {
        const channel = TestHelper.getChannelMock({team_id: teamId, header: 'Hello world'});
        renderWithContext(
            <>
                <ChannelHeaderButton channel={channel}/>
                <div data-testid='outside'/>
            </>,
            makeState(channel),
        );

        await userEvent.click(getButton());
        expect(screen.getByRole('dialog')).toBeInTheDocument();

        await userEvent.click(screen.getByTestId('outside'));

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        await waitFor(() => expect(getButton()).toHaveFocus());
    });

    test('should not steal focus when the outside click focuses another element', async () => {
        const channel = TestHelper.getChannelMock({team_id: teamId, header: 'Hello world'});
        renderWithContext(
            <>
                <ChannelHeaderButton channel={channel}/>
                <input data-testid='message-box'/>
            </>,
            makeState(channel),
        );

        await userEvent.click(getButton());
        await userEvent.click(screen.getByTestId('message-box'));

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(screen.getByTestId('message-box')).toHaveFocus();
    });

    test('should close when the channel changes', async () => {
        const channel = TestHelper.getChannelMock({id: 'channel1', team_id: teamId, header: 'First'});
        const otherChannel = TestHelper.getChannelMock({id: 'channel2', team_id: teamId, header: 'Second'});
        const {rerender} = renderWithContext(<ChannelHeaderButton channel={channel}/>, makeState(channel));

        await userEvent.click(getButton());
        expect(screen.getByRole('dialog')).toHaveTextContent('First');

        act(() => {
            rerender(<ChannelHeaderButton channel={otherChannel}/>);
        });

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        await waitFor(() => expect(getButton()).toHaveFocus());
    });

    test('should render the full header as multi-line markdown with channel mentions', async () => {
        const channel = TestHelper.getChannelMock({
            team_id: teamId,
            header: '**Bold line**\n\nSecond paragraph in ~town-square :smile:',
            props: {
                channel_mentions: {
                    'town-square': {display_name: 'Town Square'},
                },
            },
        });
        renderWithContext(<ChannelHeaderButton channel={channel}/>, makeState(channel));

        await userEvent.click(getButton());

        const dialog = screen.getByRole('dialog');
        expect(dialog.querySelector('strong')).toHaveTextContent('Bold line');
        expect(dialog.querySelectorAll('p')).toHaveLength(2);
        expect(dialog.querySelector('.mention-link')).toHaveTextContent('~Town Square');
        expect(dialog.querySelector('.emoticon')).toBeInTheDocument();
    });

    test('should show the bot description for bot DMs', async () => {
        const channel = TestHelper.getChannelMock({type: 'D', team_id: '', header: 'ignored header'});
        const bot = TestHelper.getUserMock({is_bot: true, bot_description: 'I am a helpful bot'});
        renderWithContext(
            <ChannelHeaderButton
                channel={channel}
                dmUser={bot}
            />,
            makeState(channel),
        );

        await userEvent.click(screen.getByRole('button', {name: 'Bot description'}));

        const dialog = screen.getByRole('dialog');
        expect(dialog).toHaveTextContent('I am a helpful bot');
        expect(dialog).not.toHaveTextContent('ignored header');
    });

    test('should show a bot empty state for bot DMs without a description', async () => {
        const channel = TestHelper.getChannelMock({type: 'D', team_id: '', header: ''});
        const bot = TestHelper.getUserMock({is_bot: true, bot_description: ''});
        renderWithContext(
            <ChannelHeaderButton
                channel={channel}
                dmUser={bot}
            />,
            makeState(channel),
        );

        await userEvent.click(screen.getByRole('button', {name: 'Bot description'}));

        expect(screen.getByText('This bot has no description.')).toBeInTheDocument();
        expect(screen.queryByRole('button', {name: 'Add a channel header'})).not.toBeInTheDocument();
    });

    test('should show the empty state without an add action when the user cannot manage the channel', async () => {
        const channel = TestHelper.getChannelMock({type: 'O', team_id: teamId, header: ''});
        renderWithContext(<ChannelHeaderButton channel={channel}/>, makeState(channel));

        await userEvent.click(getButton());

        expect(screen.getByText('No channel header yet.')).toBeInTheDocument();
        expect(screen.queryByRole('button', {name: 'Add a channel header'})).not.toBeInTheDocument();
    });

    test.each([
        ['O', 'manage_public_channel_properties'],
        ['P', 'manage_private_channel_properties'],
    ] as const)('should open channel settings from the add action for type %s with %s', async (type, permission) => {
        const channel = TestHelper.getChannelMock({id: 'channel_id', type, team_id: teamId, header: ''});
        renderWithContext(<ChannelHeaderButton channel={channel}/>, makeState(channel, [permission]));

        await userEvent.click(getButton());
        await userEvent.click(screen.getByRole('button', {name: 'Add a channel header'}));

        expect(mockedOpenModal).toHaveBeenCalledWith(expect.objectContaining({
            modalId: ModalIdentifiers.CHANNEL_SETTINGS,
            dialogProps: expect.objectContaining({
                channelId: 'channel_id',
                focusOriginElement: CHANNEL_HEADER_BUTTON_ID,
            }),
        }));
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    test('should not offer the add action with the wrong permission for the channel type', async () => {
        const channel = TestHelper.getChannelMock({type: 'P', team_id: teamId, header: ''});
        renderWithContext(<ChannelHeaderButton channel={channel}/>, makeState(channel, ['manage_public_channel_properties']));

        await userEvent.click(getButton());

        expect(screen.queryByRole('button', {name: 'Add a channel header'})).not.toBeInTheDocument();
    });

    test('should hide the add action for archived channels', async () => {
        const channel = TestHelper.getChannelMock({type: 'O', team_id: teamId, header: '', delete_at: 1234});
        renderWithContext(<ChannelHeaderButton channel={channel}/>, makeState(channel, ['manage_public_channel_properties']));

        await userEvent.click(getButton());

        expect(screen.getByText('No channel header yet.')).toBeInTheDocument();
        expect(screen.queryByRole('button', {name: 'Add a channel header'})).not.toBeInTheDocument();
    });

    test.each(['D', 'G'] as const)('should show the header but hide the add action for %s channels', async (type) => {
        const withHeader = TestHelper.getChannelMock({id: 'with_header', type, team_id: '', header: 'Group header'});
        const {unmount} = renderWithContext(<ChannelHeaderButton channel={withHeader}/>, makeState(withHeader, ['manage_public_channel_properties', 'manage_private_channel_properties']));

        await userEvent.click(getButton());
        expect(screen.getByRole('dialog')).toHaveTextContent('Group header');
        unmount();

        const empty = TestHelper.getChannelMock({id: 'empty', type, team_id: '', header: ''});
        renderWithContext(<ChannelHeaderButton channel={empty}/>, makeState(empty, ['manage_public_channel_properties', 'manage_private_channel_properties']));

        await userEvent.click(getButton());
        expect(screen.getByText('No channel header yet.')).toBeInTheDocument();
        expect(screen.queryByRole('button', {name: 'Add a channel header'})).not.toBeInTheDocument();
    });
});
