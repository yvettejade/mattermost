// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Channel} from '@mattermost/types/channels';
import type {UserProfile} from '@mattermost/types/users';
import type {DeepPartial} from '@mattermost/types/utilities';

import {Permissions} from 'mattermost-redux/constants';
import {getDirectChannelName} from 'mattermost-redux/utils/channel_utils';

import Constants from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import type {GlobalState} from 'types/store';

import {canEditChannelHeader} from './channel_header';

describe('Selectors.Views.ChannelHeader', () => {
    const currentUserId = 'user_me';
    const teammateId = 'user_teammate';
    const teamId = 'team1';

    function buildState({
        channel,
        profiles = {},
        permissions = [],
    }: {
        channel?: Channel;
        profiles?: Record<string, UserProfile>;
        permissions?: string[];
    }): GlobalState {
        const roleName = 'channel_header_role';
        const state: DeepPartial<GlobalState> = {
            entities: {
                channels: {
                    channels: channel ? {[channel.id]: channel} : {},
                    roles: channel && permissions.length > 0 ? {
                        [channel.id]: new Set([roleName]),
                    } : {},
                },
                roles: {
                    roles: {
                        [roleName]: {
                            permissions,
                        },
                    },
                },
                users: {
                    currentUserId,
                    profiles: {
                        [currentUserId]: TestHelper.getUserMock({id: currentUserId, roles: ''}),
                        ...profiles,
                    },
                },
                teams: {
                    myMembers: {},
                },
            },
        };
        return state as GlobalState;
    }

    function dmChannel(otherUserId: string, override: Partial<Channel> = {}): Channel {
        return TestHelper.getChannelMock({
            id: 'dm_channel',
            team_id: teamId,
            type: Constants.DM_CHANNEL as Channel['type'],
            name: getDirectChannelName(currentUserId, otherUserId),
            delete_at: 0,
            ...override,
        });
    }

    it('returns false when the channel is not loaded', () => {
        expect(canEditChannelHeader(buildState({}), 'missing')).toBe(false);
    });

    it('returns false for an archived channel even when a DM teammate is loaded', () => {
        const teammate = TestHelper.getUserMock({id: teammateId, is_bot: false});
        const channel = dmChannel(teammateId, {delete_at: 1234});
        const state = buildState({channel, profiles: {[teammateId]: teammate}});

        expect(canEditChannelHeader(state, channel.id)).toBe(false);
    });

    it('returns false for a bot DM', () => {
        const bot = TestHelper.getUserMock({id: teammateId, is_bot: true, bot_description: 'A bot'});
        const channel = dmChannel(teammateId);
        const state = buildState({channel, profiles: {[teammateId]: bot}});

        expect(canEditChannelHeader(state, channel.id)).toBe(false);
    });

    it('returns false when the DM teammate is not loaded', () => {
        const channel = dmChannel(teammateId);
        const state = buildState({channel});

        expect(canEditChannelHeader(state, channel.id)).toBe(false);
    });

    it('returns true for a DM with a loaded teammate', () => {
        const teammate = TestHelper.getUserMock({id: teammateId, is_bot: false});
        const channel = dmChannel(teammateId);
        const state = buildState({channel, profiles: {[teammateId]: teammate}});

        expect(canEditChannelHeader(state, channel.id)).toBe(true);
    });

    it('returns true for a group message', () => {
        const channel = TestHelper.getChannelMock({
            id: 'gm_channel',
            team_id: teamId,
            type: Constants.GM_CHANNEL as Channel['type'],
            delete_at: 0,
        });

        expect(canEditChannelHeader(buildState({channel}), channel.id)).toBe(true);
    });

    it('returns true for a public channel only with manage public channel properties', () => {
        const channel = TestHelper.getChannelMock({
            id: 'public_channel',
            team_id: teamId,
            type: Constants.OPEN_CHANNEL as Channel['type'],
            delete_at: 0,
        });

        expect(canEditChannelHeader(buildState({channel}), channel.id)).toBe(false);
        expect(canEditChannelHeader(buildState({
            channel,
            permissions: [Permissions.MANAGE_PRIVATE_CHANNEL_PROPERTIES],
        }), channel.id)).toBe(false);
        expect(canEditChannelHeader(buildState({
            channel,
            permissions: [Permissions.MANAGE_PUBLIC_CHANNEL_PROPERTIES],
        }), channel.id)).toBe(true);
    });

    it('returns true for a private channel only with manage private channel properties', () => {
        const channel = TestHelper.getChannelMock({
            id: 'private_channel',
            team_id: teamId,
            type: Constants.PRIVATE_CHANNEL as Channel['type'],
            delete_at: 0,
        });

        expect(canEditChannelHeader(buildState({channel}), channel.id)).toBe(false);
        expect(canEditChannelHeader(buildState({
            channel,
            permissions: [Permissions.MANAGE_PUBLIC_CHANNEL_PROPERTIES],
        }), channel.id)).toBe(false);
        expect(canEditChannelHeader(buildState({
            channel,
            permissions: [Permissions.MANAGE_PRIVATE_CHANNEL_PROPERTIES],
        }), channel.id)).toBe(true);
    });
});
