// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Channel} from '@mattermost/types/channels';
import type {UserProfile} from '@mattermost/types/users';

import {General} from 'mattermost-redux/constants';

export function getChannelHeaderDisplayText(channel: Channel | undefined, dmUser?: UserProfile): string {
    if (!channel) {
        return '';
    }

    const isBotDMChannel = channel.type === General.DM_CHANNEL && (dmUser?.is_bot ?? false);
    return isBotDMChannel ? dmUser?.bot_description ?? '' : channel.header ?? '';
}
