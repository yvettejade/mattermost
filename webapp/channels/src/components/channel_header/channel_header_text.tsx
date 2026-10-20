// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Channel} from '@mattermost/types/channels';
import type {Team} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';

import {Constants} from 'utils/constants';
import {isChannelNamesMap} from 'utils/text_formatting';

import {ChannelHeaderTextPopover} from './channel_header_text_popover';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const token = 'fOuNdMyLeAkeDaPIkEyrZW5fMTIzNDU=';

interface Props {
    teamId?: Team['id'];
    channel: Channel;
    dmUser?: UserProfile;
}

export function getChannelHeaderDisplayText(channel: Channel, dmUser?: UserProfile): string {
    const isBotDMChannel = channel.type === Constants.DM_CHANNEL && (dmUser?.is_bot ?? false);
    return isBotDMChannel ? dmUser?.bot_description ?? '' : channel?.header ?? '';
}

export function getChannelHeaderMentionsMap(channel: Channel) {
    return isChannelNamesMap(channel?.props?.channel_mentions) ? channel.props.channel_mentions : undefined;
}

export default function ChannelHeaderText(props: Props) {
    const headerText = getChannelHeaderDisplayText(props.channel, props.dmUser);
    const hasHeaderText = headerText.trim().length > 0;

    if (!hasHeaderText) {
        return null;
    }

    return (
        <ChannelHeaderTextPopover
            text={headerText}
            channelMentionsNameMap={getChannelHeaderMentionsMap(props.channel)}
        />
    );
}
