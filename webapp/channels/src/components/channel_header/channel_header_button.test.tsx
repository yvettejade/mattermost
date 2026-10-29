// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import * as modalActions from 'actions/views/modals';

import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';
import {ModalIdentifiers} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import ChannelHeaderButton, {CHANNEL_HEADER_BUTTON_ID, CHANNEL_HEADER_BUTTON_PANEL_ID} from './channel_header_button';

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
        type: 'O',
        header: 'Standup at 9 · [notes](https://example.com)',
    });

    test('renders for open, private, and group channels', () => {
        const {rerender} = renderWithContext(
            <ChannelHeaderButton channel={channel}/>,
        );
        expect(screen.getByRole('button', {name: 'Channel header'})).toHaveAttribute('id', CHANNEL_HEADER_BUTTON_ID);

        rerender(
            <ChannelHeaderButton
                channel={TestHelper.getChannelMock({id: 'private_id', type: 'P', header: 'Private header'})}
            />,
        );
        expect(screen.getByRole('button', {name: 'Channel header'})).toBeInTheDocument();

        rerender(
            <ChannelHeaderButton
                channel={TestHelper.getChannelMock({id: 'gm_id', type: 'G', header: 'Group header'})}
            />,
        );
        expect(screen.getByRole('button', {name: 'Channel header'})).toBeInTheDocument();
    });

    test('does not render for a direct message', () => {
        const {container} = renderWithContext(
            <ChannelHeaderButton
                channel={TestHelper.getChannelMock({type: 'D', header: 'DM header'})}
            />,
        );

        expect(container).toBeEmptyDOMElement();
        expect(screen.queryByRole('button', {name: 'Channel header'})).not.toBeInTheDocument();
    });

    test('click opens the panel with the header text and a second click closes it', async () => {
        renderWithContext(
            <ChannelHeaderButton channel={channel}/>,
        );

        const button = screen.getByRole('button', {name: 'Channel header'});
        expect(button).toHaveAttribute('aria-expanded', 'false');
        expect(button).toHaveAttribute('aria-controls', CHANNEL_HEADER_BUTTON_PANEL_ID);

        await userEvent.click(button);

        const panel = screen.getByRole('dialog');
        expect(panel).toHaveAttribute('id', CHANNEL_HEADER_BUTTON_PANEL_ID);
        expect(screen.getByText(/Standup at 9/)).toBeInTheDocument();
        expect(screen.getByRole('link', {name: 'notes'})).toBeInTheDocument();
        expect(button).toHaveAttribute('aria-expanded', 'true');

        await userEvent.click(button);
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(button).toHaveAttribute('aria-expanded', 'false');
    });

    test('Escape closes the panel and returns focus to the button', async () => {
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

    test('outside press closes the panel without moving focus to the header button', async () => {
        const composeName = 'Compose';
        renderWithContext(
            <>
                <ChannelHeaderButton channel={channel}/>
                <button
                    type='button'
                    aria-label={composeName}
                />
            </>,
        );

        const button = screen.getByRole('button', {name: 'Channel header'});
        await userEvent.click(button);
        expect(screen.getByRole('dialog')).toBeInTheDocument();

        const compose = screen.getByRole('button', {name: composeName});
        compose.focus();
        const focus = jest.spyOn(button, 'focus');

        await userEvent.pointer({
            target: compose,
            keys: '[MouseLeft>]',
        });

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(focus).not.toHaveBeenCalled();
        await waitFor(() => {
            expect(compose).toHaveFocus();
        });
    });

    test('shows an empty state without add when the user cannot manage properties', async () => {
        renderWithContext(
            <ChannelHeaderButton
                channel={TestHelper.getChannelMock({id: 'channel_id', team_id: 'team_id', type: 'O', header: ''})}
            />,
            permissionState('channel_id', 'team_id', []),
        );

        await userEvent.click(screen.getByRole('button', {name: 'Channel header'}));

        expect(screen.getByText('No channel header yet')).toBeInTheDocument();
        expect(screen.queryByRole('button', {name: 'Add a channel header'})).not.toBeInTheDocument();
        expect(screen.queryByRole('button', {name: 'Edit'})).not.toBeInTheDocument();
    });

    test('shows add only with manage-properties permission and delete_at === 0', async () => {
        renderWithContext(
            <ChannelHeaderButton
                channel={TestHelper.getChannelMock({id: 'channel_id', team_id: 'team_id', type: 'O', header: ''})}
            />,
            permissionState('channel_id', 'team_id', ['manage_public_channel_properties']),
        );

        await userEvent.click(screen.getByRole('button', {name: 'Channel header'}));

        expect(screen.getByText('No channel header yet')).toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'Add a channel header'})).toBeInTheDocument();
    });

    test('hides add when delete_at > 0 even with manage-properties permission', async () => {
        renderWithContext(
            <ChannelHeaderButton
                channel={TestHelper.getChannelMock({
                    id: 'channel_id',
                    team_id: 'team_id',
                    type: 'O',
                    header: '',
                    delete_at: 1234,
                })}
            />,
            permissionState('channel_id', 'team_id', ['manage_public_channel_properties']),
        );

        await userEvent.click(screen.getByRole('button', {name: 'Channel header'}));

        expect(screen.getByText('No channel header yet')).toBeInTheDocument();
        expect(screen.queryByRole('button', {name: 'Add a channel header'})).not.toBeInTheDocument();
        expect(screen.queryByRole('button', {name: 'Edit'})).not.toBeInTheDocument();
    });

    test('Edit dispatches openModal with Channel Settings and this channel id', async () => {
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
        await userEvent.click(screen.getByRole('button', {name: 'Edit'}));

        expect(modalActions.openModal).toHaveBeenCalledWith(expect.objectContaining({
            modalId: ModalIdentifiers.CHANNEL_SETTINGS,
            dialogProps: expect.objectContaining({
                channelId: 'channel_id',
                isOpen: true,
                focusOriginElement: CHANNEL_HEADER_BUTTON_ID,
            }),
        }));
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    test('group message with delete_at === 0 shows Edit without a properties permission', async () => {
        renderWithContext(
            <ChannelHeaderButton
                channel={TestHelper.getChannelMock({
                    id: 'gm_id',
                    team_id: 'team_id',
                    type: 'G',
                    header: 'Group header',
                    delete_at: 0,
                })}
            />,
            permissionState('gm_id', 'team_id', []),
        );

        await userEvent.click(screen.getByRole('button', {name: 'Channel header'}));

        expect(screen.getByText('Group header')).toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'Edit'})).toBeInTheDocument();
    });
});
