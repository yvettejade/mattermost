// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Permissions} from 'mattermost-redux/constants';
import {getChannel} from 'mattermost-redux/selectors/entities/channels';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/common';
import {haveIChannelPermission} from 'mattermost-redux/selectors/entities/roles';
import {getUser} from 'mattermost-redux/selectors/entities/users';
import {getUserIdFromChannelName} from 'mattermost-redux/utils/channel_utils';

import Constants from 'utils/constants';

import type {GlobalState} from 'types/store';

export function canEditChannelHeader(state: GlobalState, channelId: string): boolean {
    const channel = getChannel(state, channelId);
    if (!channel || channel.delete_at !== 0) {
        return false;
    }

    switch (channel.type) {
    case Constants.DM_CHANNEL: {
        const teammateId = getUserIdFromChannelName(getCurrentUserId(state), channel.name);
        const teammate = getUser(state, teammateId);
        if (!teammate || teammate.is_bot) {
            return false;
        }
        return true;
    }
    case Constants.GM_CHANNEL:
        return true;
    case Constants.PRIVATE_CHANNEL:
        return haveIChannelPermission(
            state,
            channel.team_id,
            channel.id,
            Permissions.MANAGE_PRIVATE_CHANNEL_PROPERTIES,
        );
    default:
        return haveIChannelPermission(
            state,
            channel.team_id,
            channel.id,
            Permissions.MANAGE_PUBLIC_CHANNEL_PROPERTIES,
        );
    }
}
