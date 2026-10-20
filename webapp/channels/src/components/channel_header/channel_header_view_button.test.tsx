// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {Permissions} from 'mattermost-redux/constants';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import ChannelHeaderViewButton from './channel_header_view_button';

describe('ChannelHeaderViewButton', () => {
    const teamId = 'team_id';
    const channelId = 'channel_id';
    const userId = 'user_id';

    const channel = TestHelper.getChannelMock({
        id: channelId,
        team_id: teamId,
        type: 'O',
        header: 'Welcome to the channel',
    });

    const channelMember = TestHelper.getChannelMembershipMock({
        channel_id: channelId,
        user_id: userId,
    });

    const baseState = {
        entities: {
            channels: {
                myMembers: {
                    [channelId]: {...channelMember, roles: 'channel_role'},
                },
                roles: {
                    [channelId]: new Set(['channel_role']),
                },
            },
            teams: {
                currentTeamId: teamId,
                myMembers: {
                    [teamId]: {team_id: teamId, roles: 'team_role'},
                },
                teams: {
                    [teamId]: TestHelper.getTeamMock({id: teamId}),
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
                    channel_role: {permissions: [Permissions.READ_CHANNEL]},
                },
            },
            general: {
                config: {},
            },
        },
    };

    test('should show channel header content when the button is clicked', async () => {
        renderWithContext(
            <ChannelHeaderViewButton
                channel={channel}
                channelMember={channelMember}
            />,
            baseState,
        );

        await userEvent.click(screen.getByRole('button', {name: 'View channel header'}));

        expect(screen.getByTestId('channelHeaderViewModalContent')).toHaveTextContent('Welcome to the channel');
    });

    test('should show empty state when the channel has no header', async () => {
        const channelWithoutHeader = {...channel, header: ''};

        renderWithContext(
            <ChannelHeaderViewButton
                channel={channelWithoutHeader}
                channelMember={channelMember}
            />,
            baseState,
        );

        await userEvent.click(screen.getByRole('button', {name: 'View channel header'}));

        expect(screen.getByTestId('channelHeaderViewModalEmpty')).toHaveTextContent('This channel does not have a header.');
    });

    test('should not render for direct message channels', () => {
        const dmChannel = TestHelper.getChannelMock({
            id: channelId,
            team_id: teamId,
            type: 'D',
            header: 'DM header',
        });

        const {container} = renderWithContext(
            <ChannelHeaderViewButton
                channel={dmChannel}
                channelMember={channelMember}
            />,
            baseState,
        );

        expect(container).toBeEmptyDOMElement();
    });

    test('should not render when the user cannot read the channel', () => {
        const stateWithoutReadPermission = {
            ...baseState,
            entities: {
                ...baseState.entities,
                roles: {
                    roles: {
                        system_role: {permissions: []},
                        team_role: {permissions: []},
                        channel_role: {permissions: []},
                    },
                },
            },
        };

        const {container} = renderWithContext(
            <ChannelHeaderViewButton
                channel={channel}
                channelMember={channelMember}
            />,
            stateWithoutReadPermission,
        );

        expect(container).toBeEmptyDOMElement();
    });
});
