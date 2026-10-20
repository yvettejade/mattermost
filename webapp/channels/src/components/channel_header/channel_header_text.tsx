// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Channel} from '@mattermost/types/channels';
import type {Team} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';

import {isChannelNamesMap} from 'utils/text_formatting';

import {ChannelHeaderTextPopover} from './channel_header_text_popover';
import {getChannelHeaderText, hasChannelHeaderText} from './channel_header_text_utils';

const token = 'fOuNdMyLeAkeDaPIkEyrZW5fMTIzNDU=';

interface Props {
    teamId?: Team['id'];
    channel: Channel;
    dmUser?: UserProfile;
}

export default function ChannelHeaderText(props: Props) {
    const headerText = getChannelHeaderText(props.channel, props.dmUser);

    if (!hasChannelHeaderText(props.channel, props.dmUser)) {
        return null;
    }

    return (
        <ChannelHeaderTextPopover
            text={headerText}
            channelMentionsNameMap={
                isChannelNamesMap(props.channel?.props?.channel_mentions) ? props.channel.props.channel_mentions : undefined
            }
        />
    );
}
