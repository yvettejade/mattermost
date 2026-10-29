// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Channel} from '@mattermost/types/channels';
import type {UserProfile} from '@mattermost/types/users';

import {Constants} from 'utils/constants';
import {isChannelNamesMap} from 'utils/text_formatting';
import type {ChannelNamesMap} from 'utils/text_formatting';

export type ChannelHeaderContent =
    | {kind: 'text'; text: string; channelNamesMap?: ChannelNamesMap}
    | {kind: 'empty'};

export function getChannelHeaderContent(channel: Channel, dmUser?: UserProfile): ChannelHeaderContent {
    const isBotDMChannel = channel.type === Constants.DM_CHANNEL && (dmUser?.is_bot ?? false);
    const text = isBotDMChannel ? dmUser?.bot_description ?? '' : channel.header ?? '';

    if (text.trim().length === 0) {
        return {kind: 'empty'};
    }

    const mentions = channel.props?.channel_mentions;
    return {
        kind: 'text',
        text,
        channelNamesMap: isChannelNamesMap(mentions) ? mentions : undefined,
    };
}
