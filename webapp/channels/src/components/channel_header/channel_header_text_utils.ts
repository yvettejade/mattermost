// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Channel} from '@mattermost/types/channels';
import type {UserProfile} from '@mattermost/types/users';

import {Constants} from 'utils/constants';

export function getChannelHeaderText(channel: Channel, dmUser?: UserProfile): string {
    const isBotDMChannel = channel.type === Constants.DM_CHANNEL && (dmUser?.is_bot ?? false);
    return isBotDMChannel ? dmUser?.bot_description ?? '' : channel?.header ?? '';
}

export function hasChannelHeaderText(channel: Channel, dmUser?: UserProfile): boolean {
    return getChannelHeaderText(channel, dmUser).trim().length > 0;
}
