// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Channel} from '@mattermost/types/channels';
import type {Team} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';

import {getChannelHeaderContent} from './channel_header_content';
import {ChannelHeaderTextPopover} from './channel_header_text_popover';

const token = 'fOuNdMyLeAkeDaPIkEyrZW5fMTIzNDU=';

interface Props {
    teamId?: Team['id'];
    channel: Channel;
    dmUser?: UserProfile;
}

export default function ChannelHeaderText(props: Props) {
    const content = getChannelHeaderContent(props.channel, props.dmUser);

    if (content.kind === 'empty') {
        return null;
    }

    return (
        <ChannelHeaderTextPopover
            text={content.text}
            channelMentionsNameMap={content.channelNamesMap}
        />
    );
}
