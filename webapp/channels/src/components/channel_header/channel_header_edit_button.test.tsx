// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Channel} from '@mattermost/types/channels';
import type {DeepPartial} from '@mattermost/types/utilities';

import * as modalActions from 'actions/views/modals';

import EditChannelHeaderModal from 'components/edit_channel_header_modal';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import {ModalIdentifiers} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import type {GlobalState} from 'types/store';

import ChannelHeaderEditButton from './channel_header_edit_button';

const CURRENT_USER_ID = 'user_id';
const TEAM_ID = 'team_id';
const CHANNEL_ID = 'channel_id';

function getStateWithPermissions(permissions: string[]): DeepPartial<GlobalState> {
    return {
        entities: {
            users: {
                currentUserId: CURRENT_USER_ID,
                profiles: {
                    [CURRENT_USER_ID]: TestHelper.getUserMock({
                        id: CURRENT_USER_ID,
                        roles: 'system_user',
                    }),
                },
            },
            teams: {
                myMembers: {
                    [TEAM_ID]: {team_id: TEAM_ID, roles: 'team_user'},
                },
            },
            channels: {
                myMembers: {
                    [CHANNEL_ID]: {channel_id: CHANNEL_ID, roles: 'channel_user'},
                },
                roles: {
                    [CHANNEL_ID]: new Set(['channel_user']),
                },
            },
            roles: {
                roles: {
                    system_user: {permissions: []},
                    team_user: {permissions: []},
                    channel_user: {permissions},
                },
            },
        },
    };
}

function getStateWithSystemPermissions(permissions: string[]): DeepPartial<GlobalState> {
    return {
        entities: {
            users: {
                currentUserId: CURRENT_USER_ID,
                profiles: {
                    [CURRENT_USER_ID]: TestHelper.getUserMock({
                        id: CURRENT_USER_ID,
                        roles: 'system_admin',
                    }),
                },
            },
            roles: {
                roles: {
                    system_admin: {permissions},
                },
            },
        },
    };
}

function renderButton(channel: Channel, state: DeepPartial<GlobalState> = {}, dmUser?: ReturnType<typeof TestHelper.getUserMock>) {
    return renderWithContext(
        <ChannelHeaderEditButton
            channel={channel}
            dmUser={dmUser}
        />,
        state,
    );
}

describe('ChannelHeaderEditButton', () => {
    beforeEach(() => {
        jest.spyOn(modalActions, 'openModal');
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('shows Add header for a public channel with manage-properties and an empty header', () => {
        const channel = TestHelper.getChannelMock({
            id: CHANNEL_ID,
            team_id: TEAM_ID,
            type: 'O',
            header: '',
        });

        renderButton(channel, getStateWithPermissions(['manage_public_channel_properties']));

        expect(screen.getByRole('button', {name: 'Add header'})).toBeVisible();
    });

    test('shows Edit header when the header has non-whitespace content', () => {
        const channel = TestHelper.getChannelMock({
            id: CHANNEL_ID,
            team_id: TEAM_ID,
            type: 'O',
            header: 'Standup at 9',
        });

        renderButton(channel, getStateWithPermissions(['manage_public_channel_properties']));

        expect(screen.getByRole('button', {name: 'Edit header'})).toBeVisible();
        expect(screen.queryByRole('button', {name: 'Add header'})).not.toBeInTheDocument();
    });

    test('treats whitespace-only headers as empty', () => {
        const channel = TestHelper.getChannelMock({
            id: CHANNEL_ID,
            team_id: TEAM_ID,
            type: 'O',
            header: '  \n\t  ',
        });

        renderButton(channel, getStateWithPermissions(['manage_public_channel_properties']));

        expect(screen.getByRole('button', {name: 'Add header'})).toBeVisible();
    });

    test('uses the stored header string, not rendered markdown, for Add vs Edit', () => {
        const channel = TestHelper.getChannelMock({
            id: CHANNEL_ID,
            team_id: TEAM_ID,
            type: 'O',
            header: '[](http://example.com)',
        });

        renderButton(channel, getStateWithPermissions(['manage_public_channel_properties']));

        expect(screen.getByRole('button', {name: 'Edit header'})).toBeVisible();
    });

    test('hides the pencil on a public channel without manage_public_channel_properties', () => {
        const channel = TestHelper.getChannelMock({
            id: CHANNEL_ID,
            team_id: TEAM_ID,
            type: 'O',
            header: '',
        });

        renderButton(channel, getStateWithPermissions(['manage_private_channel_properties']));

        expect(screen.queryByRole('button', {name: 'Add header'})).not.toBeInTheDocument();
        expect(screen.queryByRole('button', {name: 'Edit header'})).not.toBeInTheDocument();
    });

    test('hides the pencil on a private channel without manage_private_channel_properties', () => {
        const channel = TestHelper.getChannelMock({
            id: CHANNEL_ID,
            team_id: TEAM_ID,
            type: 'P',
            header: 'secret',
        });

        renderButton(channel, getStateWithPermissions(['manage_public_channel_properties']));

        expect(screen.queryByRole('button', {name: 'Edit header'})).not.toBeInTheDocument();
    });

    test('shows the pencil on a private channel with manage_private_channel_properties', () => {
        const channel = TestHelper.getChannelMock({
            id: CHANNEL_ID,
            team_id: TEAM_ID,
            type: 'P',
            header: 'secret',
        });

        renderButton(channel, getStateWithPermissions(['manage_private_channel_properties']));

        expect(screen.getByRole('button', {name: 'Edit header'})).toBeVisible();
    });

    test('shows the pencil for a system admin on public and private channels', () => {
        const publicChannel = TestHelper.getChannelMock({
            id: CHANNEL_ID,
            team_id: TEAM_ID,
            type: 'O',
            header: '',
        });
        const adminState = getStateWithSystemPermissions([
            'manage_public_channel_properties',
            'manage_private_channel_properties',
        ]);

        const {unmount} = renderButton(publicChannel, adminState);
        expect(screen.getByRole('button', {name: 'Add header'})).toBeVisible();
        unmount();

        const privateChannel = TestHelper.getChannelMock({
            id: CHANNEL_ID,
            team_id: TEAM_ID,
            type: 'P',
            header: '',
        });
        renderButton(privateChannel, adminState);
        expect(screen.getByRole('button', {name: 'Add header'})).toBeVisible();
    });

    test('shows the pencil for a human DM without manage-properties', () => {
        const channel = TestHelper.getChannelMock({
            id: CHANNEL_ID,
            type: 'D',
            header: '',
        });
        const dmUser = TestHelper.getUserMock({id: 'other_user', is_bot: false});

        renderButton(channel, getStateWithPermissions([]), dmUser);

        expect(screen.getByRole('button', {name: 'Add header'})).toBeVisible();
    });

    test('shows the pencil for a DM with a deactivated user', () => {
        const channel = TestHelper.getChannelMock({
            id: CHANNEL_ID,
            type: 'D',
            header: 'notes',
        });
        const dmUser = TestHelper.getUserMock({id: 'other_user', is_bot: false, delete_at: 1});

        renderButton(channel, getStateWithPermissions([]), dmUser);

        expect(screen.getByRole('button', {name: 'Edit header'})).toBeVisible();
    });

    test('hides the pencil for a bot DM', () => {
        const channel = TestHelper.getChannelMock({
            id: CHANNEL_ID,
            type: 'D',
            header: '',
        });
        const dmUser = TestHelper.getUserMock({id: 'bot_user', is_bot: true, bot_description: 'I am a bot'});

        renderButton(channel, getStateWithPermissions(['manage_public_channel_properties']), dmUser);

        expect(screen.queryByRole('button', {name: 'Add header'})).not.toBeInTheDocument();
        expect(screen.queryByRole('button', {name: 'Edit header'})).not.toBeInTheDocument();
    });

    test('shows the pencil for a group message without manage-properties', () => {
        const channel = TestHelper.getChannelMock({
            id: CHANNEL_ID,
            type: 'G',
            header: 'standup',
        });

        renderButton(channel, getStateWithPermissions([]));

        expect(screen.getByRole('button', {name: 'Edit header'})).toBeVisible();
    });

    test('hides the pencil on an archived public channel even with permission', () => {
        const channel = TestHelper.getChannelMock({
            id: CHANNEL_ID,
            team_id: TEAM_ID,
            type: 'O',
            header: 'old header',
            delete_at: 1234,
        });

        renderButton(channel, getStateWithPermissions(['manage_public_channel_properties']));

        expect(screen.queryByRole('button', {name: 'Edit header'})).not.toBeInTheDocument();
    });

    test('hides the pencil on an archived DM', () => {
        const channel = TestHelper.getChannelMock({
            id: CHANNEL_ID,
            type: 'D',
            header: 'notes',
            delete_at: 1234,
        });
        const dmUser = TestHelper.getUserMock({id: 'other_user', is_bot: false});

        renderButton(channel, {}, dmUser);

        expect(screen.queryByRole('button', {name: 'Edit header'})).not.toBeInTheDocument();
    });

    test('opens the existing Edit Channel Header modal with the channel the button was rendered for', async () => {
        const channel = TestHelper.getChannelMock({
            id: CHANNEL_ID,
            team_id: TEAM_ID,
            type: 'O',
            header: '',
        });

        renderButton(channel, getStateWithPermissions(['manage_public_channel_properties']));

        await userEvent.click(screen.getByRole('button', {name: 'Add header'}));

        expect(modalActions.openModal).toHaveBeenCalledTimes(1);
        expect(modalActions.openModal).toHaveBeenCalledWith({
            modalId: ModalIdentifiers.EDIT_CHANNEL_HEADER,
            dialogType: EditChannelHeaderModal,
            dialogProps: {channel},
        });
    });

    test('is a real button in tab order with a decorative icon', () => {
        const channel = TestHelper.getChannelMock({
            id: CHANNEL_ID,
            team_id: TEAM_ID,
            type: 'O',
            header: '',
        });

        renderButton(channel, getStateWithPermissions(['manage_public_channel_properties']));

        const button = screen.getByRole('button', {name: 'Add header'});
        expect(button.tagName).toBe('BUTTON');
        expect(button).toHaveAttribute('id', 'channelHeaderEditHeaderButton');
        expect(button.querySelector('.icon-pencil-outline')).toHaveAttribute('aria-hidden', 'true');
    });
});
