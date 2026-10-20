// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Permissions} from 'mattermost-redux/constants';
import {createSelector} from 'mattermost-redux/selectors/create_selector';
import {getChannel} from 'mattermost-redux/selectors/entities/channels';
import {getMyChannelMemberships} from 'mattermost-redux/selectors/entities/common';
import {haveIChannelPermission} from 'mattermost-redux/selectors/entities/roles';
import {getUser} from 'mattermost-redux/selectors/entities/users';

import Constants from 'utils/constants';

import type {GlobalState} from 'types/store';

export const canEditChannelHeader = createSelector(
    'canEditChannelHeader',
    (state: GlobalState) => state,
    (state: GlobalState, channelId: string) => channelId,
    (state: GlobalState, channelId: string, dmUserId?: string) => dmUserId,
    (state, channelId, dmUserId) => {
        const channel = getChannel(state, channelId);
        if (!channel || channel.delete_at !== 0) {
            return false;
        }

        if (channel.type === Constants.DM_CHANNEL && dmUserId) {
            const dmUser = getUser(state, dmUserId);
            if (dmUser?.is_bot) {
                return false;
            }
        }

        const teamId = channel.team_id;
        const memberships = getMyChannelMemberships(state);

        switch (channel.type) {
        case Constants.OPEN_CHANNEL:
            return haveIChannelPermission(
                state,
                teamId,
                channelId,
                Permissions.MANAGE_PUBLIC_CHANNEL_PROPERTIES,
            );
        case Constants.PRIVATE_CHANNEL:
            return haveIChannelPermission(
                state,
                teamId,
                channelId,
                Permissions.MANAGE_PRIVATE_CHANNEL_PROPERTIES,
            );
        case Constants.DM_CHANNEL:
        case Constants.GM_CHANNEL:
            return Boolean(memberships[channelId]);
        default:
            return false;
        }
    },
);
