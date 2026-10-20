// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Channel} from '@mattermost/types/channels';

import {Permissions} from 'mattermost-redux/constants';

import * as modalActions from 'actions/views/modals';

import ChannelSettingsModal from 'components/channel_settings_modal/channel_settings_modal';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import Constants, {ModalIdentifiers} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import ChannelHeaderEditButton from './channel_header_edit_button';

describe('components/channel_header/ChannelHeaderEditButton', () => {
    const getState = (channel: Channel, channelPermissions: string[]) => ({
        entities: {
            users: {
                currentUserId: 'user_id',
                profiles: {
                    user_id: TestHelper.getUserMock({id: 'user_id', roles: 'system_user'}),
                },
            },
            teams: {
                currentTeamId: 'team_id',
                myMembers: {
                    team_id: TestHelper.getTeamMembershipMock({team_id: 'team_id', user_id: 'user_id', roles: 'team_user'}),
                },
            },
            channels: {
                channels: {[channel.id]: channel},
                roles: {
                    [channel.id]: new Set(['channel_user']),
                },
            },
            roles: {
                roles: {
                    system_user: TestHelper.getRoleMock({name: 'system_user', permissions: []}),
                    team_user: TestHelper.getRoleMock({name: 'team_user', permissions: []}),
                    channel_user: TestHelper.getRoleMock({name: 'channel_user', permissions: channelPermissions}),
                },
            },
        },
    });

    const publicChannel = TestHelper.getChannelMock({id: 'channel_id', team_id: 'team_id', type: Constants.OPEN_CHANNEL as Channel['type'], delete_at: 0});

    beforeEach(() => {
        jest.spyOn(modalActions, 'openModal');
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('renders for a public channel when the user can manage channel properties', () => {
        renderWithContext(
            <ChannelHeaderEditButton channel={publicChannel}/>,
            getState(publicChannel, [Permissions.MANAGE_PUBLIC_CHANNEL_PROPERTIES]),
        );

        expect(screen.getByRole('button', {name: 'Edit channel header'})).toBeInTheDocument();
    });

    test('does not render without permission to manage channel properties', () => {
        renderWithContext(
            <ChannelHeaderEditButton channel={publicChannel}/>,
            getState(publicChannel, []),
        );

        expect(screen.queryByRole('button', {name: 'Edit channel header'})).not.toBeInTheDocument();
    });

    test('checks the private channel permission for private channels', () => {
        const privateChannel = {...publicChannel, type: Constants.PRIVATE_CHANNEL as Channel['type']};

        const {unmount} = renderWithContext(
            <ChannelHeaderEditButton channel={privateChannel}/>,
            getState(privateChannel, [Permissions.MANAGE_PUBLIC_CHANNEL_PROPERTIES]),
        );
        expect(screen.queryByRole('button', {name: 'Edit channel header'})).not.toBeInTheDocument();
        unmount();

        renderWithContext(
            <ChannelHeaderEditButton channel={privateChannel}/>,
            getState(privateChannel, [Permissions.MANAGE_PRIVATE_CHANNEL_PROPERTIES]),
        );
        expect(screen.getByRole('button', {name: 'Edit channel header'})).toBeInTheDocument();
    });

    test.each([Constants.DM_CHANNEL, Constants.GM_CHANNEL])('renders for channel type %s without extra permissions', (type) => {
        const channel = {...publicChannel, team_id: '', type: type as Channel['type']};

        renderWithContext(
            <ChannelHeaderEditButton channel={channel}/>,
            getState(channel, []),
        );

        expect(screen.getByRole('button', {name: 'Edit channel header'})).toBeInTheDocument();
    });

    test('does not render for archived channels', () => {
        const archivedChannel = {...publicChannel, delete_at: 1234};

        renderWithContext(
            <ChannelHeaderEditButton channel={archivedChannel}/>,
            getState(archivedChannel, [Permissions.MANAGE_PUBLIC_CHANNEL_PROPERTIES]),
        );

        expect(screen.queryByRole('button', {name: 'Edit channel header'})).not.toBeInTheDocument();
    });

    test('opens the channel settings modal for the channel on click', async () => {
        renderWithContext(
            <ChannelHeaderEditButton channel={publicChannel}/>,
            getState(publicChannel, [Permissions.MANAGE_PUBLIC_CHANNEL_PROPERTIES]),
        );

        await userEvent.click(screen.getByRole('button', {name: 'Edit channel header'}));

        expect(modalActions.openModal).toHaveBeenCalledWith({
            modalId: ModalIdentifiers.CHANNEL_SETTINGS,
            dialogType: ChannelSettingsModal,
            dialogProps: {
                channelId: publicChannel.id,
                focusOriginElement: 'channelHeaderEditButton',
                isOpen: true,
            },
        });
    });
});
