// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Channel} from '@mattermost/types/channels';
import type {UserProfile} from '@mattermost/types/users';

import {General, Permissions} from 'mattermost-redux/constants';
import {haveIChannelPermission} from 'mattermost-redux/selectors/entities/roles';
import {getCurrentUserId, getUser} from 'mattermost-redux/selectors/entities/users';
import {getUserIdFromChannelName} from 'mattermost-redux/utils/channel_utils';

import type {GlobalState} from 'types/store';

export function canEditChannelHeader(
    state: GlobalState,
    channel?: Channel | null,
    dmUser?: UserProfile,
): boolean {
    if (!channel || channel.delete_at > 0) {
        return false;
    }

    if (channel.type === General.DM_CHANNEL) {
        const otherUser = dmUser ?? getDirectTeammate(state, channel);
        if (otherUser?.is_bot) {
            return false;
        }
        return true;
    }

    if (channel.type === General.GM_CHANNEL) {
        return true;
    }

    const permission = channel.type === General.PRIVATE_CHANNEL ?
        Permissions.MANAGE_PRIVATE_CHANNEL_PROPERTIES :
        Permissions.MANAGE_PUBLIC_CHANNEL_PROPERTIES;

    return haveIChannelPermission(state, channel.team_id, channel.id, permission);
}

function getDirectTeammate(state: GlobalState, channel: Channel): UserProfile | undefined {
    const currentUserId = getCurrentUserId(state);
    const otherUserId = getUserIdFromChannelName(currentUserId, channel.name);
    return getUser(state, otherUserId);
}
