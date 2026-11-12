// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import Permissions from 'mattermost-redux/constants/permissions';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import {ModalIdentifiers} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import EditChannelHeaderButton from './edit_channel_header_button';

function stateWithChannelPermission(channelId: string, permission?: string) {
    return {
        entities: {
            channels: {
                roles: {
                    [channelId]: new Set(permission ? ['channel_role'] : []),
                },
            },
            users: {
                currentUserId: 'user_id',
                profiles: {
                    user_id: {
                        id: 'user_id',
                        roles: 'system_user',
                    },
                },
            },
            roles: {
                roles: {
                    system_user: {
                        permissions: [],
                    },
                    channel_role: {
                        permissions: permission ? [permission] : [],
                    },
                },
            },
        },
    };
}

describe('EditChannelHeaderButton', () => {
    test('shows Set header on a public channel when the user can manage public channel properties', () => {
        const channel = TestHelper.getChannelMock({type: 'O', header: '   '});

        renderWithContext(
            <EditChannelHeaderButton channel={channel}/>,
            stateWithChannelPermission(channel.id, Permissions.MANAGE_PUBLIC_CHANNEL_PROPERTIES),
        );

        expect(screen.getByRole('button', {name: 'Set header'})).toBeInTheDocument();
    });

    test('shows Edit header when the channel already has a header', () => {
        const channel = TestHelper.getChannelMock({type: 'O', header: 'Welcome'});

        renderWithContext(
            <EditChannelHeaderButton channel={channel}/>,
            stateWithChannelPermission(channel.id, Permissions.MANAGE_PUBLIC_CHANNEL_PROPERTIES),
        );

        expect(screen.getByRole('button', {name: 'Edit header'})).toBeInTheDocument();
        expect(screen.queryByRole('button', {name: 'Set header'})).not.toBeInTheDocument();
    });

    test('hides the button on a public channel without permission to manage its properties', () => {
        const channel = TestHelper.getChannelMock({type: 'O', header: ''});

        renderWithContext(
            <EditChannelHeaderButton channel={channel}/>,
            stateWithChannelPermission(channel.id),
        );

        expect(screen.queryByRole('button', {name: 'Set header'})).not.toBeInTheDocument();
        expect(screen.queryByRole('button', {name: 'Edit header'})).not.toBeInTheDocument();
    });

    test('shows the button on a private channel when the user can manage private channel properties', () => {
        const channel = TestHelper.getChannelMock({type: 'P', header: ''});

        renderWithContext(
            <EditChannelHeaderButton channel={channel}/>,
            stateWithChannelPermission(channel.id, Permissions.MANAGE_PRIVATE_CHANNEL_PROPERTIES),
        );

        expect(screen.getByRole('button', {name: 'Set header'})).toBeInTheDocument();
    });

    test('hides the button on a private channel when the user only has the public channel property permission', () => {
        const channel = TestHelper.getChannelMock({type: 'P', header: ''});

        renderWithContext(
            <EditChannelHeaderButton channel={channel}/>,
            stateWithChannelPermission(channel.id, Permissions.MANAGE_PUBLIC_CHANNEL_PROPERTIES),
        );

        expect(screen.queryByRole('button', {name: 'Set header'})).not.toBeInTheDocument();
    });

    test('hides the button on a public channel when the user only has the private channel property permission', () => {
        const channel = TestHelper.getChannelMock({type: 'O', header: 'Welcome'});

        renderWithContext(
            <EditChannelHeaderButton channel={channel}/>,
            stateWithChannelPermission(channel.id, Permissions.MANAGE_PRIVATE_CHANNEL_PROPERTIES),
        );

        expect(screen.queryByRole('button', {name: 'Edit header'})).not.toBeInTheDocument();
    });

    test('hides the button for direct messages', () => {
        const channel = TestHelper.getChannelMock({type: 'D', header: ''});

        renderWithContext(
            <EditChannelHeaderButton channel={channel}/>,
            stateWithChannelPermission(channel.id, Permissions.MANAGE_PUBLIC_CHANNEL_PROPERTIES),
        );

        expect(screen.queryByRole('button', {name: 'Set header'})).not.toBeInTheDocument();
    });

    test('opens the edit header modal when clicked', async () => {
        const channel = TestHelper.getChannelMock({type: 'O', header: ''});

        const {store} = renderWithContext(
            <EditChannelHeaderButton channel={channel}/>,
            stateWithChannelPermission(channel.id, Permissions.MANAGE_PUBLIC_CHANNEL_PROPERTIES),
        );

        await userEvent.click(screen.getByRole('button', {name: 'Set header'}));

        const modal = store.getState().views.modals.modalState[ModalIdentifiers.EDIT_CHANNEL_HEADER];
        expect(modal.open).toBe(true);
        expect(modal.dialogProps.channel.id).toBe(channel.id);
    });
});
