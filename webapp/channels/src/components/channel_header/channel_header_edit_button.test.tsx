// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {ChannelType} from '@mattermost/types/channels';
import type {DeepPartial} from '@mattermost/types/utilities';

import * as modalActions from 'actions/views/modals';

import EditChannelHeaderModal from 'components/edit_channel_header_modal';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import {ModalIdentifiers} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import type {GlobalState} from 'types/store';

import ChannelHeaderEditButton from './channel_header_edit_button';

function stateWithPermissions({
    channelId = 'channel_id',
    teamId = 'team_id',
    userId = 'user_id',
    channelPermissions = [] as string[],
    systemPermissions = [] as string[],
} = {}): DeepPartial<GlobalState> {
    return {
        entities: {
            channels: {
                myMembers: {
                    [channelId]: {channel_id: channelId, user_id: userId, roles: 'channel_role'},
                },
                roles: {
                    [channelId]: new Set(['channel_role']),
                },
            },
            teams: {
                myMembers: {
                    [teamId]: {team_id: teamId, user_id: userId, roles: 'team_role'},
                },
            },
            users: {
                currentUserId: userId,
                profiles: {
                    [userId]: {id: userId, roles: 'system_role'},
                },
            },
            roles: {
                roles: {
                    system_role: {permissions: systemPermissions},
                    team_role: {permissions: []},
                    channel_role: {permissions: channelPermissions},
                },
            },
        },
    };
}

describe('ChannelHeaderEditButton', () => {
    beforeEach(() => {
        jest.spyOn(modalActions, 'openModal');
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('shows Add header on a public channel with manage_public_channel_properties and an empty header', () => {
        const channel = TestHelper.getChannelMock({type: 'O' as ChannelType, header: ''});

        renderWithContext(
            <ChannelHeaderEditButton channel={channel}/>,
            stateWithPermissions({channelPermissions: ['manage_public_channel_properties']}),
        );

        expect(screen.getByRole('button', {name: 'Add header'})).toBeVisible();
    });

    test('shows Edit header when the stored header has content', () => {
        const channel = TestHelper.getChannelMock({type: 'O' as ChannelType, header: 'Standup at 9'});

        renderWithContext(
            <ChannelHeaderEditButton channel={channel}/>,
            stateWithPermissions({channelPermissions: ['manage_public_channel_properties']}),
        );

        expect(screen.getByRole('button', {name: 'Edit header'})).toBeVisible();
    });

    test('treats whitespace-only headers as empty', () => {
        const channel = TestHelper.getChannelMock({type: 'O' as ChannelType, header: ' \t\n '});

        renderWithContext(
            <ChannelHeaderEditButton channel={channel}/>,
            stateWithPermissions({channelPermissions: ['manage_public_channel_properties']}),
        );

        expect(screen.getByRole('button', {name: 'Add header'})).toBeVisible();
        expect(screen.queryByRole('button', {name: 'Edit header'})).not.toBeInTheDocument();
    });

    test('uses the raw stored header for Add vs Edit, not rendered markdown', () => {
        const channel = TestHelper.getChannelMock({type: 'O' as ChannelType, header: '[ ](http://example.com)'});

        renderWithContext(
            <ChannelHeaderEditButton channel={channel}/>,
            stateWithPermissions({channelPermissions: ['manage_public_channel_properties']}),
        );

        expect(screen.getByRole('button', {name: 'Edit header'})).toBeVisible();
    });

    test('hides the pencil on a public channel without manage_public_channel_properties', () => {
        const channel = TestHelper.getChannelMock({type: 'O' as ChannelType, header: ''});

        renderWithContext(
            <ChannelHeaderEditButton channel={channel}/>,
            stateWithPermissions(),
        );

        expect(screen.queryByRole('button', {name: 'Add header'})).not.toBeInTheDocument();
        expect(screen.queryByRole('button', {name: 'Edit header'})).not.toBeInTheDocument();
    });

    test('does not unlock a private channel with only public manage-properties', () => {
        const channel = TestHelper.getChannelMock({type: 'P' as ChannelType, header: ''});

        renderWithContext(
            <ChannelHeaderEditButton channel={channel}/>,
            stateWithPermissions({channelPermissions: ['manage_public_channel_properties']}),
        );

        expect(screen.queryByRole('button', {name: 'Add header'})).not.toBeInTheDocument();
    });

    test('does not unlock a public channel with only private manage-properties', () => {
        const channel = TestHelper.getChannelMock({type: 'O' as ChannelType, header: ''});

        renderWithContext(
            <ChannelHeaderEditButton channel={channel}/>,
            stateWithPermissions({channelPermissions: ['manage_private_channel_properties']}),
        );

        expect(screen.queryByRole('button', {name: 'Add header'})).not.toBeInTheDocument();
    });

    test('shows the pencil on a private channel with manage_private_channel_properties', () => {
        const channel = TestHelper.getChannelMock({type: 'P' as ChannelType, header: ''});

        renderWithContext(
            <ChannelHeaderEditButton channel={channel}/>,
            stateWithPermissions({channelPermissions: ['manage_private_channel_properties']}),
        );

        expect(screen.getByRole('button', {name: 'Add header'})).toBeVisible();
    });

    test('shows the pencil for a system admin via system permissions', () => {
        const channel = TestHelper.getChannelMock({type: 'O' as ChannelType, header: ''});

        renderWithContext(
            <ChannelHeaderEditButton channel={channel}/>,
            stateWithPermissions({
                systemPermissions: ['manage_public_channel_properties'],
            }),
        );

        expect(screen.getByRole('button', {name: 'Add header'})).toBeVisible();
    });

    test('shows the pencil on a human DM without manage-properties', () => {
        const channel = TestHelper.getChannelMock({type: 'D' as ChannelType, header: ''});
        const dmUser = TestHelper.getUserMock({is_bot: false});

        renderWithContext(
            <ChannelHeaderEditButton
                channel={channel}
                dmUser={dmUser}
            />,
            stateWithPermissions(),
        );

        expect(screen.getByRole('button', {name: 'Add header'})).toBeVisible();
    });

    test('shows the pencil on a GM without manage-properties', () => {
        const channel = TestHelper.getChannelMock({type: 'G' as ChannelType, header: 'Weekly sync'});

        renderWithContext(
            <ChannelHeaderEditButton channel={channel}/>,
            stateWithPermissions(),
        );

        expect(screen.getByRole('button', {name: 'Edit header'})).toBeVisible();
    });

    test('hides the pencil on a bot DM even when a header/description exists', () => {
        const channel = TestHelper.getChannelMock({type: 'D' as ChannelType, header: ''});
        const dmUser = TestHelper.getUserMock({is_bot: true, bot_description: 'I am a bot'});

        renderWithContext(
            <ChannelHeaderEditButton
                channel={channel}
                dmUser={dmUser}
            />,
            stateWithPermissions({
                systemPermissions: ['manage_public_channel_properties', 'manage_private_channel_properties'],
            }),
        );

        expect(screen.queryByRole('button', {name: 'Add header'})).not.toBeInTheDocument();
        expect(screen.queryByRole('button', {name: 'Edit header'})).not.toBeInTheDocument();
    });

    test('still shows the pencil for a DM with a deactivated user', () => {
        const channel = TestHelper.getChannelMock({type: 'D' as ChannelType, header: ''});
        const dmUser = TestHelper.getUserMock({is_bot: false, delete_at: 1234});

        renderWithContext(
            <ChannelHeaderEditButton
                channel={channel}
                dmUser={dmUser}
            />,
            stateWithPermissions(),
        );

        expect(screen.getByRole('button', {name: 'Add header'})).toBeVisible();
    });

    test('hides the pencil on an archived public channel even with permission', () => {
        const channel = TestHelper.getChannelMock({type: 'O' as ChannelType, header: 'Still here', delete_at: 1234});

        renderWithContext(
            <ChannelHeaderEditButton channel={channel}/>,
            stateWithPermissions({channelPermissions: ['manage_public_channel_properties']}),
        );

        expect(screen.queryByRole('button', {name: 'Edit header'})).not.toBeInTheDocument();
    });

    test('hides the pencil on an archived DM', () => {
        const channel = TestHelper.getChannelMock({type: 'D' as ChannelType, header: 'Notes', delete_at: 1234});
        const dmUser = TestHelper.getUserMock({is_bot: false});

        renderWithContext(
            <ChannelHeaderEditButton
                channel={channel}
                dmUser={dmUser}
            />,
            stateWithPermissions(),
        );

        expect(screen.queryByRole('button', {name: 'Edit header'})).not.toBeInTheDocument();
    });

    test('opens the existing Edit Channel Header modal with the channel it was rendered for', async () => {
        const channel = TestHelper.getChannelMock({id: 'opened-channel', type: 'O' as ChannelType, header: ''});

        renderWithContext(
            <ChannelHeaderEditButton channel={channel}/>,
            stateWithPermissions({channelId: 'opened-channel', channelPermissions: ['manage_public_channel_properties']}),
        );

        await userEvent.click(screen.getByRole('button', {name: 'Add header'}));

        expect(modalActions.openModal).toHaveBeenCalledTimes(1);
        expect(modalActions.openModal).toHaveBeenCalledWith({
            modalId: ModalIdentifiers.EDIT_CHANNEL_HEADER,
            dialogType: EditChannelHeaderModal,
            dialogProps: {channel},
        });
    });

    test('marks the pencil icon as decorative so the accessible name is only Add/Edit header', () => {
        const channel = TestHelper.getChannelMock({type: 'O' as ChannelType, header: ''});

        renderWithContext(
            <ChannelHeaderEditButton channel={channel}/>,
            stateWithPermissions({channelPermissions: ['manage_public_channel_properties']}),
        );

        const button = screen.getByRole('button', {name: 'Add header'});
        expect(button.querySelector('.icon-pencil-outline')).toHaveAttribute('aria-hidden', 'true');
    });
});
