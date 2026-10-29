// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Channel} from '@mattermost/types/channels';

import {Constants} from 'utils/constants';

export function canManageChannelHeader(channel: Channel | undefined, canManageProperties: boolean): boolean {
    if (!channel || channel.delete_at !== 0) {
        return false;
    }

    if (channel.type === Constants.DM_CHANNEL || channel.type === Constants.GM_CHANNEL) {
        return false;
    }

    return canManageProperties;
}
