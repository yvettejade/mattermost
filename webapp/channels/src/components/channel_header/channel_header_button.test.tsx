// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import * as modalActions from 'actions/views/modals';

import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';
import {ModalIdentifiers} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import ChannelHeaderButton, {CHANNEL_HEADER_POPOVER_BUTTON_ID, CHANNEL_HEADER_POPOVER_ID} from './channel_header_button';

jest.mock('actions/views/modals', () => ({
    openModal: jest.fn(() => ({type: 'MOCK_OPEN_MODAL'})),
}));

function permissionState(channelId: string, teamId: string, permissions: string[]) {
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

describe('ChannelHeaderButton', () => {
    const channel = TestHelper.getChannelMock({
        id: 'channel_id',
        team_id: 'team_id',
        header: 'Standup at 9 · [notes](https://example.com)',
    });

    test('renders an accessible header button with tooltip and aria-label', async () => {
        renderWithContext(
            <ChannelHeaderButton channel={channel}/>,
        );

        const button = screen.getByRole('button', {name: 'Channel header'});
        expect(button).toHaveAttribute('id', CHANNEL_HEADER_POPOVER_BUTTON_ID);
        expect(button).toHaveAttribute('aria-expanded', 'false');
        expect(button).toHaveAttribute('aria-controls', CHANNEL_HEADER_POPOVER_ID);
        expect(button).toHaveAttribute('aria-haspopup', 'dialog');
        expect(screen.queryByText('Channel header')).not.toBeInTheDocument();

        await userEvent.hover(button);
        expect(await screen.findByText('Channel header')).toBeInTheDocument();
    });

    test('toggles a popover with the full formatted header', async () => {
        renderWithContext(
            <ChannelHeaderButton channel={channel}/>,
        );

        await userEvent.click(screen.getByRole('button', {name: 'Channel header'}));

        const popover = screen.getByRole('dialog');
        expect(popover).toHaveAttribute('id', CHANNEL_HEADER_POPOVER_ID);
        expect(screen.getByText(/Standup at 9/)).toBeInTheDocument();
        expect(screen.getByRole('link', {name: 'notes'})).toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'Channel header'})).toHaveAttribute('aria-expanded', 'true');
        expect(screen.getByRole('button', {name: 'Channel header'})).toHaveClass('channel-header__icon--active');

        await userEvent.click(screen.getByRole('button', {name: 'Channel header'}));
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'Channel header'})).toHaveAttribute('aria-expanded', 'false');
    });

    test('closes the popover on Escape and returns focus to the button', async () => {
        renderWithContext(
            <ChannelHeaderButton channel={channel}/>,
        );

        const button = screen.getByRole('button', {name: 'Channel header'});
        await userEvent.click(button);
        expect(screen.getByRole('dialog')).toBeInTheDocument();

        await userEvent.keyboard('{Escape}');
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        await waitFor(() => {
            expect(button).toHaveFocus();
        });
    });

    test('closes the popover on outside click', async () => {
        renderWithContext(
            <>
                <button type='button'>{'outside'}</button>
                <ChannelHeaderButton channel={channel}/>
            </>,
        );

        await userEvent.click(screen.getByRole('button', {name: 'Channel header'}));
        expect(screen.getByRole('dialog')).toBeInTheDocument();

        await userEvent.click(screen.getByRole('button', {name: 'outside'}));
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    test('closes the popover when the channel changes', async () => {
        const {rerender} = renderWithContext(
            <ChannelHeaderButton channel={channel}/>,
        );

        await userEvent.click(screen.getByRole('button', {name: 'Channel header'}));
        expect(screen.getByRole('dialog')).toBeInTheDocument();

        rerender(
            <ChannelHeaderButton
                channel={TestHelper.getChannelMock({
                    id: 'other_channel',
                    team_id: 'team_id',
                    header: 'Other header',
                })}
            />,
        );

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    test('shows an empty state without add or edit when the user cannot manage properties', async () => {
        renderWithContext(
            <ChannelHeaderButton
                channel={TestHelper.getChannelMock({id: 'channel_id', team_id: 'team_id', header: ''})}
            />,
            permissionState('channel_id', 'team_id', []),
        );

        await userEvent.click(screen.getByRole('button', {name: 'Channel header'}));

        expect(screen.getByText('No channel header yet')).toBeInTheDocument();
        expect(screen.queryByRole('button', {name: 'Add a channel header'})).not.toBeInTheDocument();
        expect(screen.queryByRole('button', {name: 'Edit'})).not.toBeInTheDocument();
    });

    test('shows a permission-gated add action that opens channel settings', async () => {
        renderWithContext(
            <ChannelHeaderButton
                channel={TestHelper.getChannelMock({id: 'channel_id', team_id: 'team_id', type: 'O', header: ''})}
            />,
            permissionState('channel_id', 'team_id', ['manage_public_channel_properties']),
        );

        await userEvent.click(screen.getByRole('button', {name: 'Channel header'}));

        expect(screen.getByText('No channel header yet')).toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', {name: 'Add a channel header'}));

        expect(modalActions.openModal).toHaveBeenCalledWith(expect.objectContaining({
            modalId: ModalIdentifiers.CHANNEL_SETTINGS,
            dialogProps: expect.objectContaining({
                channelId: 'channel_id',
                isOpen: true,
            }),
        }));
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    test('shows a permission-gated edit action that opens channel settings', async () => {
        renderWithContext(
            <ChannelHeaderButton
                channel={TestHelper.getChannelMock({
                    id: 'channel_id',
                    team_id: 'team_id',
                    type: 'O',
                    header: 'Standup at 9',
                })}
            />,
            permissionState('channel_id', 'team_id', ['manage_public_channel_properties']),
        );

        await userEvent.click(screen.getByRole('button', {name: 'Channel header'}));

        expect(screen.getByText('Standup at 9')).toBeInTheDocument();
        expect(screen.queryByRole('button', {name: 'Add a channel header'})).not.toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', {name: 'Edit'}));

        expect(modalActions.openModal).toHaveBeenCalledWith(expect.objectContaining({
            modalId: ModalIdentifiers.CHANNEL_SETTINGS,
            dialogProps: expect.objectContaining({
                channelId: 'channel_id',
                isOpen: true,
            }),
        }));
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    test('hides edit when the user cannot manage properties', async () => {
        renderWithContext(
            <ChannelHeaderButton
                channel={TestHelper.getChannelMock({
                    id: 'channel_id',
                    team_id: 'team_id',
                    type: 'O',
                    header: 'Standup at 9',
                })}
            />,
            permissionState('channel_id', 'team_id', []),
        );

        await userEvent.click(screen.getByRole('button', {name: 'Channel header'}));

        expect(screen.getByText('Standup at 9')).toBeInTheDocument();
        expect(screen.queryByRole('button', {name: 'Edit'})).not.toBeInTheDocument();
    });

    test('hides add and edit in DM and GM channels', async () => {
        const {rerender} = renderWithContext(
            <ChannelHeaderButton
                channel={TestHelper.getChannelMock({id: 'dm_id', type: 'D', header: ''})}
            />,
            permissionState('dm_id', 'team_id', ['manage_public_channel_properties']),
        );

        await userEvent.click(screen.getByRole('button', {name: 'Channel header'}));
        expect(screen.getByText('No channel header yet')).toBeInTheDocument();
        expect(screen.queryByRole('button', {name: 'Add a channel header'})).not.toBeInTheDocument();
        expect(screen.queryByRole('button', {name: 'Edit'})).not.toBeInTheDocument();

        rerender(
            <ChannelHeaderButton
                channel={TestHelper.getChannelMock({id: 'gm_id', type: 'G', header: ''})}
            />,
        );

        await userEvent.click(screen.getByRole('button', {name: 'Channel header'}));
        expect(screen.queryByRole('button', {name: 'Add a channel header'})).not.toBeInTheDocument();
        expect(screen.queryByRole('button', {name: 'Edit'})).not.toBeInTheDocument();
    });

    test('hides add and edit for archived channels', async () => {
        renderWithContext(
            <ChannelHeaderButton
                channel={TestHelper.getChannelMock({id: 'channel_id', team_id: 'team_id', type: 'O', header: '', delete_at: 1234})}
            />,
            permissionState('channel_id', 'team_id', ['manage_public_channel_properties']),
        );

        await userEvent.click(screen.getByRole('button', {name: 'Channel header'}));

        expect(screen.getByText('No channel header yet')).toBeInTheDocument();
        expect(screen.queryByRole('button', {name: 'Add a channel header'})).not.toBeInTheDocument();
        expect(screen.queryByRole('button', {name: 'Edit'})).not.toBeInTheDocument();
    });

    test('renders a bot description for bot DM channels and hides add and edit', async () => {
        renderWithContext(
            <ChannelHeaderButton
                channel={TestHelper.getChannelMock({type: 'D', header: 'ignored'})}
                dmUser={TestHelper.getUserMock({is_bot: true, bot_description: 'I schedule standups'})}
            />,
        );

        await userEvent.click(screen.getByRole('button', {name: 'Channel header'}));

        expect(screen.getByText('I schedule standups')).toBeInTheDocument();
        expect(screen.queryByText('ignored')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', {name: 'Add a channel header'})).not.toBeInTheDocument();
        expect(screen.queryByRole('button', {name: 'Edit'})).not.toBeInTheDocument();
    });
});
