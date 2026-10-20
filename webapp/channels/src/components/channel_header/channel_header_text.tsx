// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Channel} from '@mattermost/types/channels';
import type {Team} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';

import {Constants} from 'utils/constants';
import {isChannelNamesMap} from 'utils/text_formatting';
import type {ChannelNamesMap} from 'utils/text_formatting';

import {ChannelHeaderTextPopover} from './channel_header_text_popover';

interface Props {
    teamId?: Team['id'];
    channel: Channel;
    dmUser?: UserProfile;
}

export function isBotDMChannel(channel: Channel, dmUser?: UserProfile) {
    return channel.type === Constants.DM_CHANNEL && (dmUser?.is_bot ?? false);
}

export function getChannelHeaderText(channel: Channel, dmUser?: UserProfile): string {
    return isBotDMChannel(channel, dmUser) ? dmUser?.bot_description ?? '' : channel?.header ?? '';
}

export function getChannelMentionsNameMap(channel: Channel): ChannelNamesMap | undefined {
    return isChannelNamesMap(channel?.props?.channel_mentions) ? channel.props.channel_mentions : undefined;
}

export default function ChannelHeaderText(props: Props) {
    const headerText = getChannelHeaderText(props.channel, props.dmUser);
    const hasHeaderText = headerText.trim().length > 0;

    if (!hasHeaderText) {
        return null;
    }

    return (
        <ChannelHeaderTextPopover
            text={headerText}
            channelMentionsNameMap={getChannelMentionsNameMap(props.channel)}
        />
    );
}
