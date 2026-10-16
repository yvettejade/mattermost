// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Channel} from '@mattermost/types/channels';

import {General} from 'mattermost-redux/constants';

export function canEditChannelHeader(
    channel: Channel | undefined | null,
    isBotDm: boolean,
    canManageProperties: boolean,
): boolean {
    if (!channel || channel.delete_at !== 0 || isBotDm) {
        return false;
    }

    if (channel.type === General.DM_CHANNEL || channel.type === General.GM_CHANNEL) {
        return true;
    }

    return canManageProperties;
}
